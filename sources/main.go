package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path"

	"github.com/perimeterx/marshmallow"
	"github.com/tidwall/btree"
	"go.uber.org/zap"
)

type OutFile struct {
	Layers   *btree.Map[string, OutLayer]        `json:"layers"`
	Tilesets *btree.Map[string, json.RawMessage] `json:"tilesets"`
	Sprites  Sprites                             `json:"sprites"`
}

type Sprites struct {
	*btree.Map[string, string] // id -> url
}

type InputLayer struct {
	Id             string  `json:"id"`
	Name           string  `json:"name"`
	DefaultOpacity float64 `json:"defaultOpacity"`
	Attribution    string  `json:"attribution,omitempty"`
	// either an inline array of Sublayer[] or a path to a file containing one
	Sublayers               json.RawMessage           `json:"sublayers"`
	Sprites                 string                    `json:"sprites,omitempty"`
	RewriteSublayerTilesets btree.Map[string, string] `json:"rewriteSublayerTilesets,omitempty"`
}

type OutLayer struct {
	Id               string     `json:"id"`
	Name             string     `json:"name"`
	DefaultOpacity   float64    `json:"defaultOpacity"`
	Attribution      string     `json:"attribution,omitempty"`
	Sublayers        []Sublayer `json:"sublayers"`
	SublayerTilesets []string   `json:"sublayerTilesets"`
	/// `sublayer resolved id -> (property -> initial value)` initial value is the
	/// value to multiply by the chosen opacity. it does not take into account
	/// default_opacity.
	SublayerOpacity *btree.Map[
		string,
		*btree.Map[string, interface{}],
	] `json:"sublayerOpacity"`
	Sprites string `json:"sprites,omitempty"`
}

type Sublayer struct {
	Id     string                           `json:"id"`
	Type   string                           `json:"type"`
	Source string                           `json:"source"`
	Filter interface{}                      `json:"filter"`
	Paint  *btree.Map[string, *interface{}] `json:"paint"`
	Layout *btree.Map[string, *interface{}] `json:"layout"`
	Other  *btree.Map[string, interface{}]  `json:"other"`
}

type Tileset struct {
	Id   string          `json:"id"`
	Spec json.RawMessage `json:"spec"`
}

func main() {
	globalL, err := zap.NewDevelopment()
	if err != nil {
		panic(err)
	}
	zap.ReplaceGlobals(globalL)
	l := zap.L().Sugar()

	sourceDir := "./sources/spec"
	if _, err := os.Stat(sourceDir); err != nil {
		l.Panic("cannot read sourceDir", zap.Error(err))
	}

	outDir := "./sources/out"
	if err := os.Mkdir(outDir, 0755); err != nil && !os.IsExist(err) {
		l.Panic("cannot create outDir", zap.Error(err))
	}

	spritesMap := readFile[btree.Map[string, string]](path.Join(sourceDir, "sprites.json"))
	sprites := Sprites{&spritesMap}

	var tilesets btree.Map[string, json.RawMessage]
	tilesetFiles, err := os.ReadDir(path.Join(sourceDir, "tilesets"))
	if err != nil {
		l.Panic("cannot read tilesets dir", zap.Error(err))
	}
	for _, tilesetFile := range tilesetFiles {
		path := path.Join(sourceDir, "tilesets", tilesetFile.Name())
		tileset := readFile[Tileset](path)
		tilesets.Set(tileset.Id, tileset.Spec)
	}

	var layers btree.Map[string, OutLayer]
	sourceLayersDir := path.Join(sourceDir, "layers")
	layerFiles, err := os.ReadDir(sourceLayersDir)
	if err != nil {
		l.Panic("cannot read layers dir", zap.Error(err))
	}
	for _, layerFile := range layerFiles {
		path := path.Join(sourceLayersDir, layerFile.Name())
		inputLayer := readFile[InputLayer](path)
		outLayer := rewriteLayer(
			sprites,
			&tilesets,
			sourceLayersDir,
			inputLayer,
		)
		layers.Set(outLayer.Id, outLayer)
	}

	out := OutFile{
		Layers:   &layers,
		Tilesets: &tilesets,
		Sprites:  sprites,
	}

	outFile := path.Join(outDir, "mapSources.json")
	outBytes, err := json.MarshalIndent(out, "", "  ")
	if err != nil {
		l.Panic("cannot marshal out", zap.Error(err))
	}
	if err = os.WriteFile(outFile, outBytes, 0644); err != nil {
		l.Panic("cannot write out", zap.Error(err))
	}
	l.Info("wrote ", outFile)
}

func (s Sublayer) MarshalJSON() ([]byte, error) {
	dto := make(map[string]interface{})
	dto["id"] = s.Id
	dto["type"] = s.Type
	if s.Source != "" {
		dto["source"] = s.Source
	}
	if s.Filter != nil {
		dto["filter"] = s.Filter
	}
	if s.Paint != nil && s.Paint.Len() > 0 {
		dto["paint"] = s.Paint
	}
	if s.Layout != nil && s.Layout.Len() > 0 {
		dto["layout"] = s.Layout
	}
	if s.Other != nil {
		s.Other.Scan(func(key string, value interface{}) bool {
			dto[key] = value
			return true
		})
	}
	return json.Marshal(dto)
}

func readFile[T any](path string) T {
	bytes, err := os.ReadFile(path)
	if err != nil {
		zap.L().Panic("cannot read file", zap.String("path", path), zap.Error(err))
	}
	var out T
	if err := json.Unmarshal(bytes, &out); err != nil {
		zap.L().Panic("cannot unmarshal file", zap.String("path", path), zap.Error(err))
	}
	return out
}

func rewriteLayer(
	spriteMap Sprites,
	tilesets *btree.Map[string, json.RawMessage],
	workingDir string,
	input InputLayer,
) OutLayer {
	l := zap.L().With(zap.String("layer", input.Id)).Sugar()

	if input.Sprites != "" {
		if _, ok := spriteMap.Get(input.Sprites); !ok {
			l.Panic("unknown sprite ", input.Sprites)
		}
	}

	sublayers := readSublayers(l, workingDir, input.Sublayers)

	defaultOpacity := input.DefaultOpacity
	if defaultOpacity == 0 {
		defaultOpacity = 1
	}

	var sublayerOpacity btree.Map[string, *btree.Map[string, interface{}]]
	var sublayerTilesets btree.Set[string]
	for i, subl := range sublayers {
		subl.Id = fmt.Sprintf("%s:%s", input.Id, subl.Id)

		rewriteSpriteRefs(l, input.Sprites, &subl)
		if subl.Paint != nil {
			subl.Paint.Scan(func(key string, value *interface{}) bool {
				rewriteExpr(l, subl.Id, fmt.Sprintf("paint.%s", key), value)
				return true
			})
		}
		if subl.Layout != nil {
			subl.Layout.Scan(func(key string, value *interface{}) bool {
				rewriteExpr(l, subl.Id, fmt.Sprintf("layout.%s", key), value)
				return true
			})
		}
		if subl.Filter != nil {
			rewriteExpr(l, subl.Id, "filter", &subl.Filter)
		}

		var opacity btree.Map[string, interface{}]
		for _, prop := range opacityPropsFor(l, subl.Type) {
			var value interface{} = float64(1)
			if subl.Paint != nil {
				if v, ok := subl.Paint.Get(prop); ok {
					value = *v
				}
			}
			opacity.Set(prop, value)
		}
		sublayerOpacity.Set(subl.Id, &opacity)

		if subl.Source != "" {
			replacement, ok := input.RewriteSublayerTilesets.Get(subl.Source)
			if ok {
				subl.Source = replacement
			}
			if _, ok := tilesets.Get(subl.Source); !ok {
				l.Panic("unknown tileset ", subl.Source)
			}
			sublayerTilesets.Insert(subl.Source)
		}

		sublayers[i] = subl
	}

	return OutLayer{
		Id:               input.Id,
		Name:             input.Name,
		DefaultOpacity:   defaultOpacity,
		Attribution:      input.Attribution,
		Sublayers:        sublayers,
		SublayerTilesets: sublayerTilesets.Keys(),
		Sprites:          input.Sprites,
		SublayerOpacity:  &sublayerOpacity,
	}
}

func readSublayers(
	l *zap.SugaredLogger, workingDir string, raw json.RawMessage,
) []Sublayer {
	var inParts []json.RawMessage
	var ref string
	if err := json.Unmarshal(raw, &ref); err == nil {
		inParts = readFile[[]json.RawMessage](path.Join(workingDir, ref))
	} else if err := json.Unmarshal(raw, &inParts); err != nil {
		l.Panic("cannot unmarshal sublayers", zap.Error(err))
	}

	outParts := make([]Sublayer, len(inParts))
	for i, part := range inParts {
		var out Sublayer
		other, err := marshmallow.Unmarshal(
			part, &out, marshmallow.WithExcludeKnownFieldsFromMap(true))
		if err != nil {
			l.Panic("cannot unmarshal sublayer", zap.Error(err))
		}
		if len(other) > 0 {
			out.Other = btree.NewMap[string, interface{}](2)
			for k, v := range other {
				out.Other.Set(k, v)
			}
		}
		outParts[i] = out
	}
	return outParts
}

func rewriteExpr(
	l *zap.SugaredLogger, layerId string, prop string, value *interface{},
) {
	label := fmt.Sprintf("%s.%s", layerId, prop)
	_rewriteExpr(l, label, prop, value)
}

func _rewriteExpr(
	l *zap.SugaredLogger, label string, prop string, value *interface{},
) {
	l = l.With(zap.String("label", label))
	switch v := (*value).(type) {
	case []interface{}:
		if len(v) == 0 {
			return
		}
		first := v[0]
		if first == "literal" {

		} else if first == "step" && prop == "layout.icon-image" {
			// 1 is the predicate, 2 is the first option
			if len(v) < 3 {
				l.Panic("step in layout.icon-image has no options")
			}
			firstOption := v[2]
			*value = firstOption
		} else if first == "pitch" || first == "distance-from-center" {
			*value = json.RawMessage("0")
		} else {
			for i := range v {
				if i == 0 {
					continue
				}
				label := fmt.Sprintf("%s.[%d]", label, i)
				_rewriteExpr(l, label, prop, &v[i])
			}
		}
	default:
		// pass through
	}
}

func opacityPropsFor(l *zap.SugaredLogger, ty string) []string {
	switch ty {
	case "background":
		return []string{"background-opacity"}
	case "fill":
		return []string{"fill-opacity"}
	case "line":
		return []string{"line-opacity"}
	case "symbol":
		// keep icons/text fully opaque
		return []string{}
	case "raster":
		return []string{"raster-opacity"}
	case "circle":
		return []string{"circle-opacity", "circle-stroke-opacity"}
	case "fill-extrusion":
		return []string{"fill-extrusion-opacity"}
	case "heatmap":
		return []string{"heatmap-opacity"}
	case "hillshade":
		return []string{"hillshade-exaggeration"}
	default:
		l.Panic("unknown layer type", zap.String("type", ty))
	}
	panic("unreachable")
}

func rewriteSpriteRefs(l *zap.SugaredLogger, spriteset string, subl *Sublayer) {
	// Scheme id:name allowed by <https://github.com/maplibre/maplibre-gl-js/pull/1805>
	var paintProp string
	var layoutProp string
	switch subl.Type {
	case "background":
		paintProp = "background-pattern"
	case "fill":
		paintProp = "fill-pattern"
	case "line":
		paintProp = "line-pattern"
	case "symbol":
		layoutProp = "icon-image"
	case "fill-extrusion":
		paintProp = "fill-extrusion-pattern"
	default:
		// doesn't use sprites
	}

	if paintProp != "" {
		if value, ok := subl.Paint.Get(paintProp); ok {
			rewriteSpriteProp(l, spriteset, value)
		}
	}
	if layoutProp != "" {
		if value, ok := subl.Layout.Get(layoutProp); ok {
			rewriteSpriteProp(l, spriteset, value)
		}
	}
}

func rewriteSpriteProp(
	l *zap.SugaredLogger, spriteset string, value *interface{},
) {
	if spriteset == "" {
		l.Panic("expected layer to have spriteset")
	}
	if v, ok := (*value).(string); ok {
		*value = fmt.Sprintf("%s:%s", spriteset, v)
	} else {
		*value = []interface{}{
			"concat",
			fmt.Sprintf("%s:", spriteset),
			*value,
		}
	}
}
