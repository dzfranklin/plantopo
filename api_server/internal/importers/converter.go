package importers

import (
	"fmt"
	"github.com/danielzfranklin/plantopo/api/sync_schema"
	"github.com/danielzfranklin/plantopo/api_server/internal/logger"
	"github.com/oklog/ulid/v2"
	"github.com/tkrajina/gpxgo/gpx"
	"go.uber.org/zap"
	"io"
)

func convertFormat(format string, externalId string, reader io.Reader) (*sync_schema.Changeset, error) {
	switch format {
	case "gpx":
		return convertGpx(externalId, reader)
	default:
		logger.Get().Sugar().Warnw("unknown format", "externalId", externalId, "format", format)
		return nil, fmt.Errorf("unknown format: %s", format)
	}
}

func convertGpx(externalId string, reader io.Reader) (*sync_schema.Changeset, error) {
	l := logger.Get().Sugar()

	data, err := gpx.Parse(reader)
	if err != nil {
		l.Warnw("failed to parse gpx", zap.Error(err))
		return nil, fmt.Errorf("parse gpx: %w", err)
	}

	l = l.With(
		"externalId", externalId,
		"gpxCreator", data.Creator, // the name of the software used
		"gpxVersion", data.Version,
	)

	addCount := 1 + len(data.Waypoints) + len(data.Routes) + len(data.Tracks)
	cset := &sync_schema.Changeset{
		FAdd: make([]string, 0, addCount),
		FSet: make(map[string]sync_schema.Feature, addCount),
	}

	idBase := ulid.Make().String()
	idOffset := 0
	idxInParent := ""

	parent := fmt.Sprintf("import-%s-%d", idBase, idOffset)
	l = l.With("parentId", parent)

	cset.FAdd = append(cset.FAdd, parent)
	cset.FSet[parent] = sync_schema.Feature{
		Id:                    parent,
		ParentState:           sync_schema.Set,
		Parent:                "",
		IdxState:              sync_schema.Unset, // first child
		NameState:             sync_schema.Set,
		Name:                  data.Name,
		ImportedFromFileState: sync_schema.Set,
		ImportedFromFile:      externalId,
	}

	for _, wpt := range data.Waypoints {
		idOffset++
		fid := fmt.Sprintf("import-%s-%d", idBase, idOffset)
		idxInParent = sync_schema.IdxBetweenStatic(idxInParent, "")

		f := sync_schema.Feature{
			Id:                    fid,
			ParentState:           sync_schema.Set,
			Parent:                parent,
			IdxState:              sync_schema.Set,
			Idx:                   idxInParent,
			ImportedFromFileState: sync_schema.Set,
			ImportedFromFile:      externalId,
		}
		if wpt.Name != "" {
			f.NameState = sync_schema.Set
			f.Name = wpt.Name
		}

		f.GeometryState = sync_schema.Set
		f.Geometry = sync_schema.Geometry{
			Point: &sync_schema.PointGeometry{
				Coordinates: [2]float64{wpt.Longitude, wpt.Latitude},
			},
		}

		cset.FAdd = append(cset.FAdd, fid)
		cset.FSet[fid] = f
	}

	for _, route := range data.Routes {
		idOffset++
		fid := fmt.Sprintf("import-%s-%d", idBase, idOffset)
		idxInParent = sync_schema.IdxBetweenStatic(idxInParent, "")

		f := sync_schema.Feature{
			Id:                    fid,
			ParentState:           sync_schema.Set,
			Parent:                parent,
			IdxState:              sync_schema.Set,
			Idx:                   idxInParent,
			ImportedFromFileState: sync_schema.Set,
			ImportedFromFile:      externalId,
		}
		if route.Name != "" {
			f.NameState = sync_schema.Set
			f.Name = route.Name
		}

		coords := make([][2]float64, 0, len(route.Points))
		for _, p := range route.Points {
			coords = append(coords, [2]float64{p.Longitude, p.Latitude})
		}
		f.GeometryState = sync_schema.Set
		f.Geometry = sync_schema.Geometry{
			LineString: &sync_schema.LineStringGeometry{
				Coordinates: coords,
			},
		}

		cset.FAdd = append(cset.FAdd, fid)
		cset.FSet[fid] = f
	}

	for _, trk := range data.Tracks {
		idOffset++
		trkFid := fmt.Sprintf("import-%s-%d", idBase, idOffset)
		idxInParent = sync_schema.IdxBetweenStatic(idxInParent, "")
		trkF := sync_schema.Feature{
			Id:                    trkFid,
			ParentState:           sync_schema.Set,
			Parent:                parent,
			IdxState:              sync_schema.Set,
			Idx:                   idxInParent,
			ImportedFromFileState: sync_schema.Set,
			ImportedFromFile:      externalId,
		}
		if trk.Name != "" {
			trkF.NameState = sync_schema.Set
			trkF.Name = trk.Name
		}
		cset.FAdd = append(cset.FAdd, trkFid)
		cset.FSet[trkFid] = trkF

		idxInTrk := ""
		for i, seg := range trk.Segments {
			coords := make([][2]float64, 0, len(seg.Points))
			for _, p := range seg.Points {
				coords = append(coords, [2]float64{p.Longitude, p.Latitude})
			}
			geom := sync_schema.Geometry{
				LineString: &sync_schema.LineStringGeometry{
					Coordinates: coords,
				},
			}

			if len(trk.Segments) > 1 {
				idOffset++
				segFid := fmt.Sprintf("import-%s-%d", idBase, idOffset)
				idxInTrk = sync_schema.IdxBetweenStatic(idxInTrk, "")
				segF := sync_schema.Feature{
					Id:                    segFid,
					ParentState:           sync_schema.Set,
					Parent:                trkFid,
					IdxState:              sync_schema.Set,
					Idx:                   idxInTrk,
					NameState:             sync_schema.Set,
					Name:                  fmt.Sprintf("Segment %d", i),
					ImportedFromFileState: sync_schema.Set,
					ImportedFromFile:      externalId,
					GeometryState:         sync_schema.Set,
					Geometry:              geom,
				}
				cset.FAdd = append(cset.FAdd, segFid)
				cset.FSet[segFid] = segF
			} else {
				trkF.GeometryState = sync_schema.Set
				trkF.Geometry = geom
			}
		}
	}

	l.Info("converted gpx")
	return cset, nil
}
