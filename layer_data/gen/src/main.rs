use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
};

use eyre::{bail, eyre, Context};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LayersFile {
    layers: HashMap<u32, OutputLayer>,
    tilesets: HashMap<String, serde_json::Value>,
    sprites: Sprites,
}

type Sprites = HashMap<String, String>; // id -> url

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct InputLayer {
    lid: u32,
    name: String,
    default_opacity: Option<f64>,
    attribution: Option<String>, // Only needed if differs from tileset attribution
    sublayers: SublayerRef,      // pre id-rewrite
    sprites: Option<String>,     // id in Sprites
    #[serde(default)]
    rewrite_sublayer_tilesets: HashMap<String, String>,
}

#[serde_with::skip_serializing_none]
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct OutputLayer {
    lid: u32,
    name: String,
    default_opacity: f64, // 0..1
    attribution: Option<String>,
    sublayers: Vec<Sublayer>, // post id-rewrite
    sublayer_tilesets: Vec<String>,
    /// `sublayer resolved id -> (property -> initial value)` initial value is the
    /// value to multiply by the chosen opacity. it does not take into account
    /// default_opacity.
    sublayer_opacity: HashMap<String, HashMap<String, serde_json::Value>>,
    sprites: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", untagged)]
enum SublayerRef {
    Inline(Vec<Sublayer>),
    Path(String),
}

#[serde_with::skip_serializing_none]
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Sublayer {
    id: String,
    #[serde(rename = "type")]
    _type: SublayerType,
    source: Option<String>,
    filter: Option<Value>,
    #[serde(default)]
    paint: HashMap<String, serde_json::Value>,
    #[serde(default)]
    layout: HashMap<String, serde_json::Value>,
    #[serde(flatten)]
    other: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Deserialize, Serialize, Clone, Copy)]
#[serde(rename_all = "kebab-case")]
enum SublayerType {
    Background,
    Fill,
    Line,
    Symbol,
    Raster,
    Circle,
    FillExtrusion,
    Heatmap,
    Hillshade,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Tileset {
    id: String,
    spec: serde_json::Value,
}

fn main() -> eyre::Result<()> {
    color_eyre::install().unwrap();
    let dir = std::env::args().nth(1).expect("Missing <dir>");
    let dir = PathBuf::from(dir);

    let source_dir = dir.join("source");

    let sprites = fs::read_to_string(source_dir.join("sprites.json"))?;
    let sprites: Sprites = serde_json::from_str(&sprites)?;

    let mut tilesets = HashMap::new();
    for tileset_f in fs::read_dir(source_dir.join("tilesets"))? {
        let tileset_f = tileset_f?.path();
        let tileset = fs::read_to_string(&tileset_f)?;
        let tileset: Tileset = serde_json::from_str(&tileset)
            .wrap_err_with(|| eyre!("parse {}", tileset_f.display()))?;
        tilesets.insert(tileset.id, tileset.spec);
    }

    let mut layers = HashMap::new();
    let source_layers_dir = source_dir.join("layers");
    for layer_f in fs::read_dir(&source_layers_dir)? {
        let layer_f = layer_f?.path();
        let layer = fs::read_to_string(&layer_f)?;
        let layer: InputLayer =
            serde_json::from_str(&layer).wrap_err_with(|| eyre!("parse {}", layer_f.display()))?;
        let layer: OutputLayer = rewrite_layer(&sprites, &tilesets, &source_layers_dir, layer)
            .wrap_err_with(|| eyre!("rewrite {}", layer_f.display()))?;
        layers.insert(layer.lid, layer);
    }

    let output = LayersFile {
        layers,
        tilesets,
        sprites,
    };

    fs::write(dir.join("layers.json"), serde_json::to_string(&output)?)?;

    Ok(())
}

fn rewrite_layer(
    sprite_map: &Sprites,
    tilesets: &HashMap<String, serde_json::Value>,
    working_dir: &Path,
    layer: InputLayer,
) -> eyre::Result<OutputLayer> {
    let InputLayer {
        lid,
        name,
        default_opacity,
        attribution,
        sublayers,
        rewrite_sublayer_tilesets,
        sprites,
    } = layer;

    if let Some(sprites) = sprites.as_ref() {
        if !sprite_map.contains_key(sprites) {
            bail!("Sprite set {} not in sprite map", sprites);
        }
    }

    let mut sublayers = match sublayers {
        SublayerRef::Inline(v) => v,
        SublayerRef::Path(path) => {
            let v = fs::read_to_string(working_dir.join(path))?;
            serde_json::from_str(&v)?
        }
    };

    let default_opacity = default_opacity.unwrap_or(1.0);

    let mut sublayer_opacity: HashMap<String, HashMap<String, serde_json::Value>> = HashMap::new();
    let mut sublayer_tilesets = HashSet::new();
    for subl in &mut sublayers {
        subl.id = format!("{lid}:{}", subl.id);

        rewrite_sprite_refs(sprites.as_deref(), subl)?;
        for (key, value) in &mut subl.paint {
            rewrite_expr(&subl.id, &(format!("paint.{key}")), value)?;
        }
        for (key, value) in &mut subl.layout {
            rewrite_expr(&subl.id, &(format!("layout.{key}")), value)?;
        }
        if let Some(value) = &mut subl.filter {
            rewrite_expr(&subl.id, "filter", value)?;
        }

        let mut opacity = HashMap::new();
        for prop in opacity_props_for(subl._type) {
            let orig_value = subl.paint.get(&prop).cloned().unwrap_or(1.into());
            let mut in_context = Value::Array(vec!["*".into(), orig_value, 0.5.into()]);
            rewrite_expr(
                &format!("{}-opacity-prop-context", subl.id),
                &prop,
                &mut in_context,
            )?;
            let value = in_context
                .get(2)
                .ok_or(eyre!(
                    "rewrite_expr unexpectedly changed shape of opacity prop context"
                ))
                .cloned()?;
            opacity.insert(prop, value);
        }
        sublayer_opacity.insert(subl.id.clone(), opacity);

        if let Some(tileset) = subl.source.as_mut() {
            if let Some(replacement) = rewrite_sublayer_tilesets.get(tileset) {
                *tileset = replacement.clone();
            }
            if !tilesets.contains_key(tileset) {
                bail!("Unexpected sublayer source {tileset}");
            }
            sublayer_tilesets.insert(tileset.clone());
        }
    }

    Ok(OutputLayer {
        lid,
        name,
        default_opacity,
        attribution,
        sublayers,
        sublayer_tilesets: sublayer_tilesets.into_iter().collect(),
        sprites,
        sublayer_opacity,
    })
}

fn rewrite_expr(layer_id: &str, prop: &str, value: &mut Value) -> eyre::Result<()> {
    let label = format!("{layer_id}.{prop}");
    _rewrite_expr(&label, prop, value).wrap_err_with(|| {
        eyre!(
            "rewrite_expr {label} ({})",
            serde_json::to_string(value).unwrap(),
        )
    })
}

fn _rewrite_expr(label: &str, prop: &str, value: &mut Value) -> eyre::Result<()> {
    match value {
        Value::Array(expr) => match expr.get(0) {
            Some(first) => match first.as_str() {
                Some("step") if prop == "layout.icon-image" => {
                    eprintln!("{label} step in layout.icon-image unsupported, picking first");
                    // 1 is the predicate, 2 is the first option
                    let first_option = expr.get(2).ok_or(eyre!("step missing first option"))?;
                    *value = first_option.clone();
                    Ok(())
                }
                Some("literal") => Ok(()),
                Some("pitch") => {
                    eprintln!("{label} Replacing unsupported pitch expr with default");
                    *value = Value::Number(0.into());
                    Ok(())
                }
                Some("distance-from-center") => {
                    eprintln!(
                        "{label} Replacing unsupported distance-from-center expr with center"
                    );
                    *value = Value::Number(0.into());
                    Ok(())
                }
                _ => {
                    for (i, sub) in expr.iter_mut().enumerate().skip(1) {
                        let label = format!("{label}.[{i}]");
                        _rewrite_expr(&label, prop, sub)?;
                    }
                    Ok(())
                }
            },
            None => Ok(()),
        },
        _ => Ok(()),
    }
}

fn opacity_props_for(ty: SublayerType) -> Vec<String> {
    match ty {
        SublayerType::Background => vec!["background-opacity".to_string()],
        SublayerType::Fill => vec!["fill-opacity".to_string()],
        SublayerType::Line => vec!["line-opacity".to_string()],
        SublayerType::Symbol => vec![], // Skipping "icon-opacity", "text-opacity"
        SublayerType::Raster => vec!["raster-opacity".to_string()],
        SublayerType::Circle => vec![
            "circle-opacity".to_string(),
            "circle-stroke-opacity".to_string(),
        ],
        SublayerType::FillExtrusion => vec!["fill-extrusion-opacity".to_string()],
        SublayerType::Heatmap => vec!["heatmap-opacity".to_string()],
        SublayerType::Hillshade => vec!["hillshade-exaggeration".to_string()],
    }
}

fn rewrite_sprite_refs(spriteset: Option<&str>, subl: &mut Sublayer) -> eyre::Result<()> {
    // Scheme id:name allowed by <https://github.com/maplibre/maplibre-gl-js/pull/1805>
    let (paint_prop, layout_prop) = match subl._type {
        SublayerType::Background => (Some("background-pattern"), None),
        SublayerType::Fill => (Some("fill-pattern"), None),
        SublayerType::Line => (Some("line-pattern"), None),
        SublayerType::Symbol => (None, Some("icon-image")),
        SublayerType::FillExtrusion => (Some("fill-extrusion-pattern"), None),
        _ => (None, None),
    };

    if let Some(name) = paint_prop {
        rewrite_sprite_prop(spriteset, subl.paint.get_mut(name))?;
    }
    if let Some(name) = layout_prop {
        rewrite_sprite_prop(spriteset, subl.layout.get_mut(name))?;
    }
    Ok(())
}

fn rewrite_sprite_prop(
    spriteset: Option<&str>,
    value: Option<&mut serde_json::Value>,
) -> eyre::Result<()> {
    let Some(value) = value else { return Ok(()) };
    let Some(spriteset) = spriteset else {
        if value.is_null() {
            return Ok(());
        } else {
            bail!("Expected layer to have sprite set");
        }
    };

    if let serde_json::Value::String(value) = value {
        *value = format!("{spriteset}:{value}");
        Ok(())
    } else {
        *value = vec![
            "concat".into(),
            format!("{spriteset}:").into(),
            value.clone(),
        ]
        .into();
        Ok(())
    }
}
