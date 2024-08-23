package pmunroaccess

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/hasura/go-graphql-client"
	"net/http"
	"slices"
	"sync"
	"time"
)

var londonTimeLoc *time.Location

func init() {
	l, err := time.LoadLocation("Europe/London")
	if err != nil {
		panic(err)
	}
	londonTimeLoc = l
}

type GederWorker struct {
	c *graphql.Client
}

func NewGederWorker(otpGTFSEndpoint string) *GederWorker {
	c := graphql.NewClient(otpGTFSEndpoint, &http.Client{})
	return &GederWorker{c: c}
}

type AccessReport struct {
	Version  int           `json:"version"`
	Date     string        `json:"date"` // YYYY-MM-DD
	From     [2]float64    `json:"from"`
	Clusters []matrixEntry `json:"clusters"`
}

type matrixEntry struct {
	To       *munroStartCluster `json:"to"`
	Journeys json.RawMessage    `json:"journeys"`
}

type buildMatrixSubsetResult struct {
	i      int
	subset []matrixEntry
	err    error
}

func (s *GederWorker) Generate(ctx context.Context, from [2]float64, date time.Time, parallelism int) (AccessReport, error) {
	return s.generate(ctx, from, date, parallelism, munroStartClusters)
}

func (s *GederWorker) generate(ctx context.Context, from [2]float64, date time.Time, parallelism int, clusters []*munroStartCluster) (AccessReport, error) {
	date = date.In(londonTimeLoc)
	date = time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, londonTimeLoc)

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

	var outClusters []matrixEntry
	for _, result := range results {
		if result.err != nil {
			return AccessReport{}, result.err
		}
		outClusters = append(outClusters, result.subset...)
	}

	return AccessReport{
		Version:  0,
		Date:     date.Format("2006-01-02"),
		From:     from,
		Clusters: outClusters,
	}, nil
}

func (s *GederWorker) buildMatrixChunk(ctx context.Context, from [2]float64, date time.Time, clusters []*munroStartCluster) ([]matrixEntry, error) {
	var out []matrixEntry
	for _, cluster := range clusters {
		journeys, err := s.queryOnePair(ctx, date, from, cluster.Point)
		if err != nil {
			return nil, err
		}
		out = append(out, matrixEntry{
			To:       cluster,
			Journeys: journeys,
		})
	}
	return out, nil
}

func (s *GederWorker) queryOnePair(ctx context.Context, date time.Time, from, to [2]float64) (json.RawMessage, error) {
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
		time: "04:00am"
		from: {lat: $fromLat, lon: $fromLng}
		to: {lat: $toLat, lon: $toLng}
		numItineraries: 100
		searchWindow: 25200 # (11-4)*60*60
		walkReluctance: 1
	  ) {
		...PlanFragments
	  }
	  
	  back: plan(
		date: $date
		time: "4:00pm"
		to: {lat: $fromLat, lon: $fromLng}
		from: {lat: $toLat, lon: $toLng}
		numItineraries: 100
		searchWindow: 28800 # (12-4)*60*60
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
