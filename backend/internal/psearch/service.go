package psearch

import (
	"context"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/prand"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/dzfranklin/plantopo/backend/internal/pslices"
	"log/slog"
	"slices"
	"sync"
	"time"
)

type Source interface {
	Query(ctx context.Context, query Query) ([]Result, error)
}

type Service struct {
	l              *slog.Logger
	sources        []Source
	fallbackSource Source
}

func New(env *pconfig.Env) *Service {
	l := env.Logger.With("app", "psearch")

	sources := []Source{
		gbPostcodeRepo{prepo.NewGBPostcode(env)},
		britishAndIrishHillsRepo{prepo.NewBritishAndIrishHills(env.DB)},
	}

	fallbackSource := newPhotonClient(l)

	return &Service{l: l, sources: sources, fallbackSource: fallbackSource}
}

func (s *Service) Query(ctx context.Context, query Query) ([]Result, error) {
	timeout := 10 * time.Second
	if query.HigherQuality {
		timeout = 30 * time.Second
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	l := s.l.With(
		"queryText", query.Text,
		"queryUser", query.User,
		"queryBias", query.Bias,
		"timeout", timeout,
	)

	// Try sources in parallel

	sourceResults := make(chan []Result, len(s.sources))
	var wg sync.WaitGroup
	wg.Add(len(s.sources))
	for _, source := range s.sources {
		go func() {
			defer wg.Done()
			partialResults, err := source.Query(ctx, query)
			if err != nil {
				l.Error("query failed",
					"source", fmt.Sprintf("%T", source),
					"error", err)
				return
			}
			sourceResults <- partialResults
		}()
	}
	wg.Wait()
	close(sourceResults)

	// Collect results

	var results []Result
	for partial := range sourceResults {
		results = append(results, partial...)
	}
	results = processResults(query, results)

	// Maybe use fallback

	var bestWithoutFallback Result
	if len(results) > 0 {
		bestWithoutFallback = results[0]
	}
	l = l.With("resultsWithoutFallback", len(results), "bestWithoutFallback", bestWithoutFallback.weight)

	if bestWithoutFallback.weight > 0.9 {
		l.Info("not using fallback")
		return results, nil
	}

	fallbackStart := time.Now()
	fallbackResults, err := s.fallbackSource.Query(ctx, query)
	if err != nil {
		l.Error("failed to query fallback", "error", err)
		return results, nil
	}
	fallbackSearchTime := time.Since(fallbackStart)

	results = processResults(query, append(results, fallbackResults...))

	var bestWithFallback Result
	if len(results) > 0 {
		bestWithFallback = results[0]
	}
	l.Info("used fallback",
		"fallbackSearchTime", fallbackSearchTime, "resultsWithFallback", len(results),
		"bestWithFallback", bestWithFallback.weight)

	return results, nil
}

func processResults(query Query, input []Result) []Result {
	results := append([]Result(nil), input...)

	for i, r := range results {
		if r.Type == "" {
			r.Type = OtherType
		}

		if r.ID == "" {
			r.ID = prand.CryptoRandHex(16)
		}

		var term string
		if r.matchingTerm != "" {
			term = r.matchingTerm
		} else {
			term = r.Name
		}

		var sim float64
		if r.Type == PostcodeType {
			sim = trigramSimilarity(prepo.NormalizePostcode(query.Text), prepo.NormalizePostcode(term))
		} else {
			sim = trigramSimilarity(query.Text, term)
		}
		r.Debug["sim"] = sim

		// TODO: consider distance (consider <https://github.com/komoot/photon/blob/master/app/es_embedded/src/main/java/de/komoot/photon/elasticsearch/PhotonQueryBuilder.java#L22>)
		r.weight = sim
		r.Debug["weight"] = r.weight

		results[i] = r
	}

	slices.SortFunc(results, func(a, b Result) int {
		if a.weight > b.weight {
			return -1
		} else if a.weight < b.weight {
			return 1
		} else if a.Name < b.Name {
			return -1
		} else if a.Name > b.Name {
			return 1
		} else {
			return 0
		}
	})

	results = filterDuplicateResults(results)

	if len(results) == 0 {
		return results
	}
	best := results[0]

	if best.weight > 0.3 {
		results = pslices.Filter(results, func(r Result) bool {
			return r.weight > 0.3
		})
	}

	return results[:min(5, len(results))]
}

// expects to receive results sorted by weight, best first
func filterDuplicateResults(results []Result) []Result {
	var toRemove []string
	for aI, a := range results {
		if slices.Contains(toRemove, a.ID) {
			continue
		}

		for bI, b := range results {
			if slices.Contains(toRemove, b.ID) || aI == bI {
				continue
			}
			distM := a.Geometry.Distance(b.Geometry)
			if distM < 10 {
				toRemove = append(toRemove, b.ID)
			}
		}
	}
	filteredResults := make([]Result, 0, len(results))
	for _, r := range results {
		if !slices.Contains(toRemove, r.ID) {
			filteredResults = append(filteredResults, r)
		}
	}
	return filteredResults
}
