package pgeo

import (
	"bytes"
	"encoding/json"
	"fmt"
	"github.com/tidwall/geojson/geometry"
	"strconv"
)

type FeatureCollectionWriter struct {
	buf *bytes.Buffer
	i   int
}

func (w *FeatureCollectionWriter) Finish() []byte {
	if w.i == 0 {
		return []byte(`{"type": "FeatureCollection", "features": []}`)
	}
	w.buf.WriteString("\n]}")
	return w.buf.Bytes()
}

func (w *FeatureCollectionWriter) write(id int, geom []byte, props map[string]any) {
	if w.buf == nil {
		w.buf = new(bytes.Buffer)
		w.buf.Grow(1024)
	}

	if w.i == 0 {
		w.buf.WriteString(`{"type": "FeatureCollection", "features": [`)
	}

	if w.i == 0 {
		w.buf.WriteString("\n  ")
	} else {
		w.buf.WriteString(",\n  ")
	}
	w.i++

	w.buf.WriteString(`{"type": "Feature", `)

	if id != 0 {
		w.buf.WriteString(`"id": ` + strconv.Itoa(id) + `, `)
	}

	propsS, err := json.Marshal(&props)
	if err != nil {
		panic(err)
	}
	w.buf.WriteString(`"properties": `)
	w.buf.Write(propsS)
	w.buf.WriteString(`, `)

	w.buf.WriteString(`"geometry": `)
	w.buf.Write(geom)
	w.buf.WriteString(`}`)
}

func (w *FeatureCollectionWriter) WritePoint(id int, geom geometry.Point, props map[string]any) {
	geomS := []byte(fmt.Sprintf(`{"type": "Point", "coordinates": [%f, %f]}`, geom.X, geom.Y))
	w.write(id, geomS, props)
}
