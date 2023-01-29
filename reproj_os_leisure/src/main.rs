use std::{
    collections::HashMap,
    fs::{self, File},
    ptr,
};

use eyre::{Context, ContextCompat};
use gdal::{
    programs::raster::build_vrt, spatial_ref::SpatialRef, Dataset, DatasetOptions, DriverManager,
};
use image::{imageops, GenericImage, Rgb, RgbImage};
use proj::Proj;
use tile_grid::{Extent, ExtentInt, Grid};

//  projsync --file "uk_os_OSGM15_GB.tif" --target-dir './proj' && projsync --file "uk_os_OSTN15_NTv2_OSGBtoETRS.tif" --target-dir './proj'

fn main() -> eyre::Result<()> {
    color_eyre::install()?;
    get(13, 4028, 2613, true)?;
    todo!()
}

const SOURCE_RESOLUTIONS: &[f64] = &[896.0, 448.0, 224.0, 112.0, 56.0, 28.0, 14.0, 7.0, 3.5, 1.75];
const SOURCE_SIZE_PX: u32 = 256;

fn get(input_z: u8, input_x: u32, input_y: u32, draw_dbg: bool) -> eyre::Result<Vec<u8>> {
    let input_grid = Grid::web_mercator();
    let source_grid = Grid::new(
        SOURCE_SIZE_PX as u16,
        SOURCE_SIZE_PX as u16,
        Extent {
            minx: -238375.0,
            miny: 0.0,
            maxx: 900000.0,
            maxy: 1376256.0,
        },
        27700,
        tile_grid::Unit::Meters,
        SOURCE_RESOLUTIONS.to_owned(),
        tile_grid::Origin::TopLeft, // This is a guess
    );
    let input_to_source = Proj::new_known_crs("EPSG:3857", "EPSG:27700", None)?;
    let source_to_input = Proj::new_known_crs("EPSG:27700", "EPSG:3857", None)?;
    let source_spatial_ref = SpatialRef::from_epsg(27700)?;
    let input_spatial_ref = SpatialRef::from_epsg(3857)?;

    let input_bbox = input_grid.tile_extent_xyz(input_x, input_y, input_z);
    let input_res = input_grid.pixel_width(input_z);

    let source_target_bbox = convert_extent(&input_to_source, &input_bbox)?;
    let max_source_z = SOURCE_RESOLUTIONS.len() - 1;
    let (source_z, &source_res) = SOURCE_RESOLUTIONS
        .iter()
        .enumerate()
        .find(|(_, &source_res)| source_res <= input_res)
        .unwrap_or((max_source_z, &SOURCE_RESOLUTIONS[max_source_z]));
    let source_z: u8 = source_z.try_into()?;
    let scale_factor = input_res / source_res;

    let source_tile_extents =
        tile_limits_xyz(&source_grid, &source_target_bbox, source_z, source_res);

    let mut coords = Vec::new();
    for y in source_tile_extents.miny..source_tile_extents.maxy {
        for x in source_tile_extents.minx..source_tile_extents.maxx {
            coords.push((x, y));
        }
    }

    dbg!(&source_tile_extents);
    let img_width = (source_tile_extents.maxx - source_tile_extents.minx) * SOURCE_SIZE_PX;
    let img_height = (source_tile_extents.maxy - source_tile_extents.miny) * SOURCE_SIZE_PX;
    let mut img = RgbImage::new(img_width, img_height);

    for &(tile_x, tile_y) in &coords {
        let src_path = format!("test_assets/{}_{}_{}.png", source_z, tile_x, tile_y);
        let tile = image::open(&src_path).with_context(|| format!("No tile {}", &src_path))?;
        let tile = tile.as_rgb8().context("tile not rgb8")?;

        imageops::replace(
            &mut img,
            tile,
            (tile_x - source_tile_extents.minx) as i64 * SOURCE_SIZE_PX as i64,
            (tile_y - source_tile_extents.miny) as i64 * SOURCE_SIZE_PX as i64,
        );

        dbg_box(
            draw_dbg,
            &mut img,
            (tile_x - source_tile_extents.minx) * SOURCE_SIZE_PX,
            (tile_y - source_tile_extents.miny) * SOURCE_SIZE_PX,
            SOURCE_SIZE_PX,
            SOURCE_SIZE_PX,
            Rgb([0, 255, 211]),
        )
    }

    let topleft_tile_extent =
        source_grid.tile_extent_xyz(source_tile_extents.minx, source_tile_extents.miny, source_z);

    let minx = ((source_target_bbox.minx - topleft_tile_extent.minx) / source_res).round() as u32;
    let miny = ((source_target_bbox.miny - topleft_tile_extent.miny) / source_res).round() as u32;
    let maxx = ((source_target_bbox.maxx - topleft_tile_extent.minx) / source_res).round() as u32;
    let maxy = ((source_target_bbox.maxy - topleft_tile_extent.miny) / source_res).round() as u32;
    dbg!(
        &source_tile_extents,
        &source_target_bbox,
        &topleft_tile_extent
    );
    dbg!(minx, miny, maxx, maxy);

    dbg_box(
        draw_dbg,
        &mut img,
        minx,
        miny,
        maxx - minx,
        maxy - miny,
        Rgb([0, 153, 255]),
    );

    img.save("test_assets/out_tiled_pre_reproj.png")?;
    let mut src_ds = Dataset::open("test_assets/out_tiled_pre_reproj.png")?;

    src_ds.set_geo_transform(&[
        topleft_tile_extent.minx,
        source_res,
        0.0,
        topleft_tile_extent.miny,
        0.0,
        source_res,
    ])?;
    src_ds.set_spatial_ref(&source_spatial_ref)?;

    //     let mut dst_ds = tiff_drv.create(
    //         dst_path,
    //         SOURCE_SIZE_PX as isize,
    //         SOURCE_SIZE_PX as isize,
    //         3,
    //     )?;
    //     let dst_extent = convert_extent(&source_to_input, &src_extent)?;
    //     dst_ds.set_geo_transform(&[
    //         dst_extent.minx,
    //         input_res,
    //         0.0,
    //         dst_extent.miny,
    //         0.0,
    //         input_res,
    //     ])?;
    //     dst_ds.set_spatial_ref(&input_spatial_ref)?;

    //     unsafe {
    //         gdal_sys::GDALReprojectImage(
    //             src_ds.c_dataset(),
    //             ptr::null(),
    //             dst_ds.c_dataset(),
    //             ptr::null(),
    //             gdal_sys::GDALResampleAlg::GRA_Bilinear,
    //             0.0,
    //             0.5, // default OpenLayers max error
    //             None,
    //             ptr::null_mut(),
    //             ptr::null_mut(),
    //         );
    //     }
    // }

    todo!()
}

fn dbg_box(
    draw_dbg: bool,
    img: &mut RgbImage,
    topleft_x: u32,
    topleft_y: u32,
    width: u32,
    height: u32,
    color: Rgb<u8>,
) {
    if !draw_dbg {
        return;
    }

    // Horizontals
    for x in topleft_x..(topleft_x + width) {
        img.put_pixel(x, topleft_y, color);
        img.put_pixel(x, topleft_y + height - 1, color);
    }
    // Verticals
    for y in topleft_y..(topleft_y + height) {
        img.put_pixel(topleft_x, y, color);
        img.put_pixel(topleft_x + width - 1, y, color);
    }
}

fn convert_extent(proj: &Proj, from: &Extent) -> eyre::Result<Extent> {
    let (minx, miny) = proj.convert((from.minx, from.miny))?;
    let (maxx, maxy) = proj.convert((from.maxx, from.maxy))?;
    Ok(Extent {
        minx,
        miny,
        maxx,
        maxy,
    })
}

fn tile_limits_xyz(grid: &Grid, extent: &Extent, z: u8, res: f64) -> ExtentInt {
    // Based on Grid::tile_limits for Origin::TopLeft
    let tolerance = 0; // guess
    const EPSILON: f64 = 0.0000001;
    let unitsize = SOURCE_SIZE_PX as f64 * res;

    let level_maxy =
        ((grid.extent.maxy - grid.extent.miny - 0.01 * unitsize) / unitsize).ceil() as u32;
    let level_maxx =
        ((grid.extent.maxx - grid.extent.minx - 0.01 * unitsize) / unitsize).ceil() as u32;

    let mut minx =
        (((extent.minx - grid.extent.minx) / unitsize + EPSILON).floor() as i32) - tolerance;
    let mut maxx =
        (((extent.maxx - grid.extent.minx) / unitsize - EPSILON).ceil() as i32) + tolerance;
    let mut miny =
        (((grid.extent.maxy - extent.maxy) / unitsize + EPSILON).floor() as i32) - tolerance;
    let mut maxy =
        (((grid.extent.maxy - extent.miny) / unitsize - EPSILON).ceil() as i32) + tolerance;

    // to avoid requesting out-of-range tiles
    if minx < 0 {
        minx = 0;
    }
    if maxx > level_maxx as i32 {
        maxx = level_maxx as i32
    };
    if miny < 0 {
        miny = 0
    };
    if maxy > level_maxy as i32 {
        maxy = level_maxy as i32
    };

    ExtentInt {
        minx: minx as u32,
        maxx: maxx as u32,
        // Note: The math works out such that ytile_from_xyz also converts
        // ytile to xyz, as we need here. Also the conversion inverts max/min
        miny: grid.ytile_from_xyz(maxy as u32, z),
        maxy: grid.ytile_from_xyz(miny as u32, z),
    }
}
