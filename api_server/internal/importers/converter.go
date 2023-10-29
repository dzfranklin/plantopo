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

func convertFormat(format string, id string, filename string, reader io.Reader) (*sync_schema.Changeset, error) {
	switch format {
	case "gpx":
		return convertGpx(id, filename, reader)
	default:
		logger.Get().Sugar().Warnw("unknown format", "id", id, "format", format)
		return nil, fmt.Errorf("unknown format: %s", format)
	}
}

func convertGpx(id string, filename string, reader io.Reader) (*sync_schema.Changeset, error) {
	l := logger.Get().Sugar()

	data, err := gpx.Parse(reader)
	if err != nil {
		l.Warnw("failed to parse gpx", zap.Error(err))
		return nil, fmt.Errorf("parse gpx: %w", err)
	}

	l = l.With(
		"id", id,
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

	importName := data.Name
	if importName == "" {
		importName = filename
	}

	cset.FAdd = append(cset.FAdd, parent)
	cset.FSet[parent] = sync_schema.Feature{
		Id:                    parent,
		ParentState:           sync_schema.Set,
		Parent:                "",
		IdxState:              sync_schema.Unset, // first child
		NameState:             sync_schema.Set,
		Name:                  importName,
		ImportedFromFileState: sync_schema.Set,
		ImportedFromFile:      id,
	}

	for i, wpt := range data.Waypoints {
		l.Infof("converting waypoint %d", i)
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
			ImportedFromFile:      id,
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

	for i, route := range data.Routes {
		l.Infof("converting route %d", i)
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
			ImportedFromFile:      id,
		}
		if route.Name != "" {
			f.NameState = sync_schema.Set
			f.Name = route.Name
		}

		coords := make([][2]float64, 0, len(route.Points))
		for _, p := range route.Points {
			coords = append(coords, [2]float64{p.Longitude, p.Latitude})
		}
		l.Infof("route has %d coords", len(coords))
		f.GeometryState = sync_schema.Set
		f.Geometry = sync_schema.Geometry{
			LineString: &sync_schema.LineStringGeometry{
				Coordinates: coords,
			},
		}

		cset.FAdd = append(cset.FAdd, fid)
		cset.FSet[fid] = f
	}

	for i, trk := range data.Tracks {
		l.Infof("converting track %d", i)
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
			ImportedFromFile:      id,
		}
		if trk.Name != "" {
			trkF.NameState = sync_schema.Set
			trkF.Name = trk.Name
		}
		cset.FAdd = append(cset.FAdd, trkFid)
		cset.FSet[trkFid] = trkF

		idxInTrk := ""
		for i, seg := range trk.Segments {
			l.Infof("converting track segment %d", i)
			coords := make([][2]float64, 0, len(seg.Points))
			for _, p := range seg.Points {
				coords = append(coords, [2]float64{p.Longitude, p.Latitude})
			}
			l.Infof("segment has %d coords", len(coords))
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
					ImportedFromFile:      id,
					GeometryState:         sync_schema.Set,
					Geometry:              geom,
				}
				cset.FAdd = append(cset.FAdd, segFid)
				cset.FSet[segFid] = segF
			} else {
				l.Info("trk has only one segment, promoting")
				trkF.GeometryState = sync_schema.Set
				trkF.Geometry = geom
				cset.FSet[trkFid] = trkF
			}
		}
	}

	if len(cset.FAdd) == 2 {
		l.Info("only one top-level feature, promoting")

		parentFid := cset.FAdd[0]
		childFid := cset.FAdd[1]
		parentF := cset.FSet[parentFid]
		childF := cset.FSet[childFid]

		cset.FAdd = []string{childFid}
		delete(cset.FSet, parentFid)

		childF.ParentState = parentF.ParentState
		childF.Parent = parentF.Parent
		childF.IdxState = parentF.IdxState
		childF.Idx = parentF.Idx
		cset.FSet[childFid] = childF
	}

	l.Info("converted gpx")
	return cset, nil
}
