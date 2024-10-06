package main

import (
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/pgeo"
	"github.com/dzfranklin/plantopo/backend/internal/pslices"
	"github.com/paulmach/osm"
	"github.com/paulmach/osm/osmpbf"
	"github.com/tidwall/geojson"
	"github.com/tidwall/geojson/geo"
	"github.com/tidwall/geojson/geometry"
	"github.com/tidwall/rtree"
	"io"
	"log/slog"
	"math"
	"os"
	"path"
	"runtime"
	"slices"
	"strconv"
	"time"
)

// Inspired by graphhopper <https://github.com/graphhopper/graphhopper/blob/c0ad6b040b8930ad2a5a28661b211b1289a5d93d/core/src/main/java/com/graphhopper/reader/osm/WaySegmentParser.java>

// Note that the max OSM id is greater than the max int32 but far, far below the max safe javascript integer

// To generate sample file: osmium extract --strategy complete_ways --bbox -3.8240529289,56.8187786142,-3.8212243862,56.8200899026  --overwrite ~/Downloads/scotland-latest.osm.pbf -o test_samples/trail_intersection_sample.osm.pbf

// Vector map tiles tend to be 0-600k. With tiles of 0.25 degrees we get mostly 50k-100k with up to 1.3M for Scotland or
// up to 9.4M for the densest part of Singapore. With tiles of 0.1 degrees it is max ~400K and generally <10k for
// Scotland and ~3M for Singapore

// The other option would be to produce vector tiles. each tile would have the links in its properties.

// From <https://mokole.com/palette.html>
var debugColors = []string{"rgb(211, 211, 211)", "rgb(47, 79, 79)", "rgb(46, 139, 87)", "rgb(139, 0, 0)", "rgb(128, 128, 0)", "rgb(72, 61, 139)", "rgb(255, 0, 0)", "rgb(255, 140, 0)", "rgb(255, 215, 0)", "rgb(127, 255, 0)", "rgb(186, 85, 211)", "rgb(0, 250, 154)", "rgb(0, 255, 255)", "rgb(0, 191, 255)", "rgb(0, 0, 255)", "rgb(255, 0, 255)", "rgb(240, 230, 140)", "rgb(221, 160, 221)", "rgb(255, 20, 147)", "rgb(255, 160, 122)"}

func main() {
	segmentGeojsonFlag := flag.Bool("segment-geojson", false, "")

	flag.Parse()

	inputPath := flag.Arg(0)
	outputPath := flag.Arg(1)
	if inputPath == "" || outputPath == "" {
		fmt.Println("Usage: ./snapgraph <input-path> <output-path>")
		os.Exit(1)
	}

	input, openErr := os.Open(inputPath)
	if openErr != nil {
		panic(openErr)
	}

	g := process(input)

	if *segmentGeojsonFlag {
		nextDebugColor := 0
		fc := geojson.NewFeatureCollection(pslices.Map(g.Segments, func(s Segment) geojson.Object {
			g := geometry.NewLine(pslices.Map(s.Points, func(p NodePoint) geometry.Point { return p.Point }), nil)
			members := fmt.Sprintf(`{"properties": {"way": %d, "stroke": "%s"}}`, s.Way, debugColors[nextDebugColor])
			nextDebugColor++
			return geojson.NewFeature(geojson.NewLineString(g), members)
		}))
		fmt.Println(fc.String())
		return
	}

	existing, readExistingErr := os.ReadDir(outputPath)
	if errors.Is(readExistingErr, os.ErrNotExist) {
		if err := os.MkdirAll(outputPath, os.ModePerm); err != nil {
			panic(err)
		}
	} else if readExistingErr != nil {
		panic(readExistingErr)
	} else if len(existing) > 0 {
		panic("output directory not empty")
	}

	var segmentIndex SegmentIndex
	for i, s := range g.Segments {
		bounds := geometry.NewLine(pslices.Map(s.Points, func(p NodePoint) geometry.Point {
			return p.Point
		}), nil).Rect()
		segmentIndex.Insert([2]float64{bounds.Min.X, bounds.Min.Y}, [2]float64{bounds.Max.X, bounds.Max.Y}, i)
	}

	for x := -180 * 10; x < 180*10; x += 1 {
		for y := -90 * 10; y < 90*10; y += 1 {
			tile := makeTile(g, segmentIndex, x, y)
			if len(tile.Segments) > 0 {
				writeTile(outputPath, x, y, tile)
				slog.Info("wrote tile", "x", x, "y", y)
			}
		}
	}
}

// GraphTile represents a chunk of a graph. IDs are unique across the whole
// graph. Across all tiles Segments[id] and Links[id] will have the same value if
// present.
type GraphTile struct {
	Attribution string              `json:"attribution"`
	Lng         float64             `json:"lng"`
	Lat         float64             `json:"lat"`
	Segments    map[string]Segment  `json:"segments"`
	Links       map[string][]string `json:"links"`
}

type Graph struct {
	Attribution string    `json:"attribution"`
	Segments    []Segment `json:"segments"`
	Links       [][]int   `json:"links"` // segment index -> linked segments indices
}

type Segment struct {
	Way    int64
	Points []NodePoint
}

func (s Segment) MarshalJSON() ([]byte, error) {
	points := pslices.Map(s.Points, func(p NodePoint) geometry.Point { return p.Point })
	var container = struct {
		Polyline string     `json:"polyline"`
		Meters   int        `json:"meters"`
		BBox     [4]float64 `json:"bbox"`
	}{
		Polyline: pgeo.EncodePolylinePoints(points),
		Meters:   segmentMeters(s),
		BBox:     segmentBBox(s),
	}
	return json.Marshal(container)
}

type NodePoint struct {
	Node  int64
	Point geometry.Point
}

type SegmentIndex = rtree.RTreeG[int]

func makeTile(g Graph, segmentIndex SegmentIndex, x, y int) GraphTile {
	out := GraphTile{
		Attribution: g.Attribution,
		Lng:         float64(x) / 10,
		Lat:         float64(y) / 10,
		Segments:    make(map[string]Segment),
		Links:       make(map[string][]string),
	}

	topLeft := [2]float64{float64(x) / 10, float64(y) / 10}
	bottomRight := [2]float64{topLeft[0] + 0.1, topLeft[1] + 0.1}
	segmentIndex.Search(topLeft, bottomRight, func(_, _ [2]float64, segIdx int) bool {
		segID := strconv.FormatInt(int64(segIdx), 10)
		out.Segments[segID] = g.Segments[segIdx]
		for _, link := range g.Links[segIdx] {
			out.Links[segID] = append(out.Links[segID], strconv.FormatInt(int64(link), 10))
		}
		return true
	})

	return out
}

func writeTile(outputPath string, x, y int, tile GraphTile) {
	tileDir := path.Join(outputPath, fmt.Sprintf("%d", y))
	tilePath := path.Join(tileDir, fmt.Sprintf("%d", x))

	if err := os.MkdirAll(tileDir, os.ModePerm); err != nil {
		panic(err)
	}

	tileF, createErr := os.Create(tilePath)
	if createErr != nil {
		panic(createErr)
	}

	tileW := gzip.NewWriter(tileF)

	if err := json.NewEncoder(tileW).Encode(tile); err != nil {
		panic(err)
	}

	if err := tileW.Close(); err != nil {
		panic(err)
	}

	if err := tileF.Close(); err != nil {
		panic(err)
	}
}

func process(f io.ReadSeeker) Graph {
	startTime := time.Now()

	header, nodesOfInterest := scanStage1(f)
	slog.Info("completed scan stage 1")

	if _, err := f.Seek(0, io.SeekStart); err != nil {
		panic(err)
	}

	segments := scanStage2(f, nodesOfInterest)
	slog.Info("completed scan stage 2")

	preSplitSegmentCount := len(segments)

	segments = splitSegments(segments)
	slog.Info("split segments", "count", len(segments), "preSplitCount", preSplitSegmentCount)

	links := findLinks(segments)
	slog.Info("linked segments")

	return Graph{
		Attribution: fmt.Sprintf("Derived from OpenStreetMap dump (exported %s) at %s via github.com/dzfranklin/plantopo",
			header.ReplicationTimestamp.Format(time.RFC3339), startTime.Format(time.RFC3339)),
		Segments: segments,
		Links:    links,
	}
}

func findLinks(segments []Segment) [][]int {
	endNodes := make(map[int64][]int) // node -> segment

	for i, s := range segments {
		pts := s.Points
		endNodes[pts[0].Node] = append(endNodes[pts[0].Node], i)
		endNodes[pts[len(pts)-1].Node] = append(endNodes[pts[len(pts)-1].Node], i)
	}

	links := make([][]int, len(segments))

	processEndNode := func(s int, n NodePoint) {
		for _, neighbor := range endNodes[n.Node] {
			if neighbor == s {
				continue
			}
			links[s] = append(links[s], neighbor)
		}
	}

	for i, s := range segments {
		pts := s.Points
		processEndNode(i, pts[0])
		processEndNode(i, pts[len(pts)-1])
	}

	return links
}

func splitSegments(segments []Segment) []Segment {
	nodeWays := make(map[int64][]int64)
	for _, s := range segments {
		for _, p := range s.Points {
			if !slices.Contains(nodeWays[p.Node], s.Way) {
				nodeWays[p.Node] = append(nodeWays[p.Node], s.Way)
			}
		}
	}

	out := make([]Segment, 0, len(segments))

	processSegment := func(s Segment) {
		partial := Segment{Way: s.Way}
		for i, p := range s.Points {
			isEnd := i == 0 || i == len(s.Points)-1
			if !isEnd && len(nodeWays[p.Node]) > 1 {
				partial.Points = append(partial.Points, p)
				out = append(out, partial)
				partial = Segment{Way: s.Way, Points: []NodePoint{p}}
			} else {
				partial.Points = append(partial.Points, p)
			}
		}
		if len(partial.Points) >= 2 {
			out = append(out, partial)
		}
	}

	for _, s := range segments {
		if len(s.Points) < 2 {
			continue
		}

		if s.Points[0].Node == s.Points[len(s.Points)-1].Node {
			for _, splitS := range breakLoopSegment(s) {
				processSegment(splitS)
			}
			continue
		}

		processSegment(s)
	}

	return out
}

func breakLoopSegment(s Segment) []Segment {
	if len(s.Points) <= 2 {
		return nil
	}
	return []Segment{
		{Way: s.Way, Points: s.Points[:len(s.Points)-1]},
		{Way: s.Way, Points: s.Points[len(s.Points)-2:]},
	}
}

func filterWay(w *osm.Way) bool {
	return w.Tags.HasTag("highway")
}

// scanStage1 returns a list of all nodes we are interested in
func scanStage1(f io.Reader) (*osmpbf.Header, map[int64]struct{}) {
	out := make(map[int64]struct{})

	s := osmpbf.New(context.Background(), f, runtime.GOMAXPROCS(-1))
	defer s.Close()

	s.SkipNodes = true
	s.SkipRelations = true

	header, headerErr := s.Header()
	if headerErr != nil {
		panic(headerErr)
	}

	for s.Scan() {
		w := s.Object().(*osm.Way)
		if filterWay(w) {
			for _, n := range w.Nodes {
				out[n.ID.FeatureID().Ref()] = struct{}{}
			}
		}
	}

	return header, out
}

// scanStage2 takes the nodes of interest returned by scanStage1 and returns a list of way coordinates
func scanStage2(f io.Reader, nodesOfInterest map[int64]struct{}) []Segment {
	out := make([]Segment, 0)

	s := osmpbf.New(context.Background(), f, runtime.GOMAXPROCS(-1))
	defer s.Close()

	s.SkipRelations = true

	nodePoints := make(map[int64]geometry.Point)

scan:
	for s.Scan() {
		switch o := s.Object().(type) {
		case *osm.Node:
			id := o.ID.FeatureID().Ref()
			if _, ok := nodesOfInterest[id]; ok {
				nodePoints[id] = geometry.Point{X: o.Lon, Y: o.Lat}
			}
		case *osm.Way:
			if filterWay(o) {
				nodes := o.Nodes.NodeIDs()
				points := make([]NodePoint, 0, len(nodes))
				for _, n := range nodes {
					point, ok := nodePoints[n.FeatureID().Ref()]
					if !ok {
						slog.Warn("way node missing", "way", o.ID.FeatureID().Ref(), "node", n.FeatureID().Ref())
						continue scan
					}
					points = append(points, NodePoint{Node: n.FeatureID().Ref(), Point: point})
				}
				out = append(out, Segment{Way: o.ID.FeatureID().Ref(), Points: points})
			}
		}
	}

	return out
}

func segmentMeters(s Segment) int {
	dist := 0.0
	for i := range s.Points {
		if i == len(s.Points)-1 {
			continue
		}
		from := s.Points[i].Point
		to := s.Points[i+1].Point
		dist += geo.DistanceTo(from.Y, from.X, to.Y, to.X)
	}
	return int(math.Round(dist))
}

func segmentBBox(s Segment) [4]float64 {
	minX := s.Points[0].Point.X
	minY := s.Points[0].Point.Y
	maxX := minX
	maxY := minY
	for _, p := range s.Points {
		minX = min(minX, p.Point.X)
		minY = min(minY, p.Point.Y)
		maxX = max(maxX, p.Point.X)
		maxY = max(maxY, p.Point.Y)
	}
	return [4]float64{minX, minY, maxX, maxY}
}
