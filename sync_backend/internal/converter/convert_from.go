package converter

import (
	"encoding/json"
	"github.com/danielzfranklin/plantopo/api/sync_schema"
	"github.com/danielzfranklin/plantopo/sync_backend/internal/docstore"
	"github.com/tkrajina/gpxgo/gpx"
	"go.uber.org/zap"
)

func ConvertFromChangeset(logger *zap.Logger, format string, name string, cset sync_schema.Changeset) ([]byte, error) {
	l := logger.Sugar()
	switch format {
	case "ptinternal":
		return json.MarshalIndent(cset, "", "    ")
	case "gpx":
		return convertChangesetToGPX(l, name, cset)
	default:
		return nil, UnknownFormatError
	}
}

func convertChangesetToGPX(l *zap.SugaredLogger, name string, cset sync_schema.Changeset) ([]byte, error) {
	in := docstore.NewDoc(l.Desugar())
	_, err := in.Update(&cset)
	if err != nil {
		l.Errorw("cset invalid", zap.Error(err))
		return nil, err
	}

	out := &gpx.GPX{
		Name:    name,
		Creator: "plantopo.com",
	}

	in.TraverseFeatures(func(f sync_schema.Feature) {
		if f.GeometryState != sync_schema.Set {
			return
		}
		geom := f.Geometry

		name := ""
		if f.NameState == sync_schema.Set {
			name = f.Name
		}

		if geom.Point != nil {
			p := geom.Point.Coordinates
			out.AppendWaypoint(&gpx.GPXPoint{
				Name:  name,
				Point: gpx.Point{Longitude: p[0], Latitude: p[1]},
			})
		} else if geom.LineString != nil {
			points := make([]gpx.GPXPoint, 0)
			for _, p := range geom.LineString.Coordinates {
				points = append(points, gpx.GPXPoint{
					Point: gpx.Point{
						Longitude: p[0],
						Latitude:  p[1],
					},
				})
			}
			out.AppendRoute(&gpx.GPXRoute{
				Name:   name,
				Points: points,
			})
		}
	})

	outXML, err := gpx.ToXml(out, gpx.ToXmlParams{Indent: true})
	if err != nil {
		l.Errorw("gpx.ToXml failed", zap.Error(err))
		return nil, err
	}
	return outXML, nil
}
