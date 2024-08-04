package pmunroaccess

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/hasura/go-graphql-client"
	"net/http"
	"slices"
	"sync"
	"time"
)

type MunroAccessService struct {
	c  *graphql.Client
	mu *sync.Mutex
}

func New(env *pconfig.Env) *MunroAccessService {
	c := graphql.NewClient(env.Config.OpenTransitPlanner.GTFSEndpoint, &http.Client{})
	return &MunroAccessService{c: c, mu: &sync.Mutex{}}
}

type matrixEntry struct {
	From     [2]float64         `json:"from"`
	To       *munroStartCluster `json:"to"`
	Journeys json.RawMessage    `json:"journeys"`
}

type buildMatrixSubsetResult struct {
	i      int
	subset []matrixEntry
	err    error
}

func (s *MunroAccessService) buildMatrix(ctx context.Context, from [2]float64, date time.Time, parallelism int, clusters []*munroStartCluster) ([]matrixEntry, error) {
	var wg sync.WaitGroup
	var mu sync.Mutex
	var results []buildMatrixSubsetResult
	chunkSize := len(clusters) / parallelism
	for i := 0; i < parallelism; i++ {
		chunkStart := i * chunkSize
		chunkEnd := chunkStart + chunkSize
		if i == parallelism-1 {
			chunkEnd = len(clusters)
		}
		chunk := clusters[chunkStart:chunkEnd]

		wg.Add(1)
		go func() {
			defer wg.Done()

			subset, err := s.buildMatrixChunk(ctx, from, date, chunk)

			mu.Lock()
			results = append(results, buildMatrixSubsetResult{i, subset, err})
			mu.Unlock()
		}()
	}
	wg.Wait()

	slices.SortFunc(results, func(a, b buildMatrixSubsetResult) int {
		return a.i - b.i
	})

	var out []matrixEntry
	for _, result := range results {
		if result.err != nil {
			return nil, result.err
		}
		out = append(out, result.subset...)
	}
	return out, nil
}

func (s *MunroAccessService) buildMatrixChunk(ctx context.Context, from [2]float64, date time.Time, clusters []*munroStartCluster) ([]matrixEntry, error) {
	var out []matrixEntry
	for _, cluster := range clusters {
		journeys, err := s.queryOnePair(ctx, date, from, cluster.Point)
		if err != nil {
			return nil, err
		}
		out = append(out, matrixEntry{
			From:     from,
			To:       cluster,
			Journeys: journeys,
		})
	}
	return out, nil
}

func (s *MunroAccessService) queryOnePair(ctx context.Context, date time.Time, from, to [2]float64) (json.RawMessage, error) {
	q := `
	# noinspection GraphQLUnresolvedReference
	
	fragment LegPlaceParts on Place {
	  name
	  vertexType
	  lat
	  lon
	  arrivalTime
	  departureTime
	  stop {
		code
		desc
		locationType
		platformCode
		cluster {
		  name
		}
		parentStation {
		  name
		}
	  }
	}
	
	fragment BookingInfoParts on BookingInfo {
	  contactInfo {
		phoneNumber
		infoUrl
		bookingUrl
		additionalDetails
	  }
	  earliestBookingTime {
		time
		daysPrior
	  }
	  latestBookingTime {
		time
		daysPrior
	  }
	  message
	  pickupMessage
	  dropOffMessage
	}
	
	fragment PlanFragments on Plan {
	  itineraries {
		startTime
		endTime
		duration
		waitingTime
		walkTime
		walkDistance
		legs {
		  startTime
		  endTime
		  departureDelay
		  arrivalDelay
		  mode
		  duration
		  legGeometry {
			length
			points
		  }
		  agency {
			id
		  }
		  distance
		  transitLeg
		  from {
			...LegPlaceParts
		  }
		  to {
			...LegPlaceParts
		  }
		  trip {
			id
		  }
		  serviceDate
		  headsign
		  pickupType
		  dropoffType
		  interlineWithPreviousLeg
		  dropOffBookingInfo {
			...BookingInfoParts
		  }
		  pickupBookingInfo {
			...BookingInfoParts
		  }
		}
		accessibilityScore
		numberOfTransfers
	  }
	  messageEnums
	  messageStrings
	  routingErrors {
		inputField
	  }
	  nextPageCursor
	  previousPageCursor
	  debugOutput {
		totalTime
		pathCalculationTime
		precalculationTime
		renderingTime
		timedOut
	  }
	}
	
	query Plan($date: String!, $fromLat: Float!, $fromLng: Float!, $toLat: Float!, $toLng: Float!) {
	  out: plan(
		date: $date
		time: "00:00:00"
		from: {lat: $fromLat, lon: $fromLng}
		to: {lat: $toLat, lon: $toLng}
		numItineraries: 100
		searchWindow: 43200
		walkReluctance: 1
	  ) {
		...PlanFragments
	  }
	  
	  back: plan(
		date: $date
		time: "12:00:00"
		to: {lat: $fromLat, lon: $fromLng}
		from: {lat: $toLat, lon: $toLng}
		numItineraries: 100
		searchWindow: 43200
		walkReluctance: 1
	  ) {
		...PlanFragments
	  }
	}`

	vars := map[string]any{
		"date":    fmt.Sprintf("%d-%d-%d", date.Year(), date.Month(), date.Day()),
		"fromLng": from[0],
		"fromLat": from[1],
		"toLng":   to[0],
		"toLat":   to[1],
	}

	return s.c.ExecRaw(ctx, q, vars)
}
