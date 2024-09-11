package pgeophotos

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"github.com/flatgeobuf/flatgeobuf/src/go/flattypes"
	"github.com/flatgeobuf/flatgeobuf/src/go/writer"
	flatbuffers "github.com/google/flatbuffers/go"
	"golang.org/x/sync/errgroup"
	"io"
	"math"
	"time"
)

type flatGeobufMeta struct {
	CreatedAt time.Time `json:"createdAt"`
}

func (s *Service) buildFlatGeobuf(ctx context.Context, f io.Writer) error {
	l := s.l.WithGroup("buildFlatGeobuf")
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	var grp errgroup.Group

	// Header

	headerB := flatbuffers.NewBuilder(0)

	header := writer.NewHeader(headerB).
		SetName("geophotos").
		SetGeometryType(flattypes.GeometryTypePoint)

	// TODO: change to integer column when https://github.com/felt/tippecanoe/issues/262 fixed
	idCol := writer.NewColumn(headerB).SetName("id").SetType(flattypes.ColumnTypeDouble)
	header.SetColumns([]*writer.Column{idCol})

	meta := flatGeobufMeta{
		CreatedAt: time.Now(),
	}
	metaJSON, metaErr := json.Marshal(meta)
	if metaErr != nil {
		return metaErr
	}
	header.SetMetadata(string(metaJSON))

	crs := writer.NewCrs(headerB)
	crs.SetName("EPSG:4326").SetCode(4326).SetOrg("epsg").SetCodeString("epsg:4326")

	// Data

	features := make(chan *writer.Feature)

	grp.Go(func() error {
		defer func() { close(features) }()
		count := 0
		for photo, err := range s.repo.All(ctx) {
			if err != nil {
				return err
			}

			props := make([]byte, 2+8)
			binary.LittleEndian.PutUint64(props[2:], math.Float64bits(float64(photo.ID)))

			b := flatbuffers.NewBuilder(0)
			geo := writer.NewGeometry(b).SetXY([]float64{photo.Point.X, photo.Point.Y})
			feat := writer.NewFeature(b).SetGeometry(geo).SetProperties(props)

			features <- feat

			count++

			if count%1_000_000 == 0 {
				l.Info("loading data", "count", count)
			}
		}
		return nil
	})

	fgen := featureGeneratorFunc(func() *writer.Feature {
		return <-features
	})

	// Body

	w := writer.NewWriter(header, true, fgen, nil)

	if _, err := w.Write(f); err != nil {
		return nil
	}

	return grp.Wait()
}

type featureGeneratorFunc func() *writer.Feature

func (f featureGeneratorFunc) Generate() *writer.Feature {
	return f()
}
