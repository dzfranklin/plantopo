#!/usr/bin/env -S poetry run python3
import argparse
import os
import pathlib
import sys
import traceback

from rio_tiler.io import Reader

concurrency = os.cpu_count()

tile_size = 256


def process(out: pathlib.Path, r: Reader, tile_coords):
    try:
        (z, x, y) = tile_coords

        resampling_method = "average"
        if z > 12:
            resampling_method = "bilinear"

        tile_dir = out / str(z) / str(x)
        tile_out = tile_dir / (str(y) + ".webp")

        tile = r.tile(x, y, z, resampling_method=resampling_method, tilesize=tile_size)
        tile_data = tile.render(img_format="webp", quality=75)
        print("Generated " + str(tile_out))

        try:
            with open(tile_out, "wb+") as tile_f:
                tile_f.write(tile_data)
        except FileNotFoundError:
            tile_dir.mkdir(parents=True, exist_ok=True)
            with open(tile_out, "wb+") as tile_f:
                tile_f.write(tile_data)
    except Exception as err:
        traceback.print_exception(err)
        os._exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(prog="rastertile")
    parser.add_argument("--zmin", type=int, required=True)
    parser.add_argument("--zmax", type=int, required=True)
    parser.add_argument("-i", "--input", required=True)
    parser.add_argument("-o", "--output", required=True)
    parser.add_argument("--skip-blank", action=argparse.BooleanOptionalAction)
    args = parser.parse_args()
    print(args)

    out = pathlib.Path(args.output)
    r = Reader(args.input)

    tiles = []

    print("Searching for tiles to generate")
    checked = 0
    for z in range(args.zmin, args.zmax + 1):
        for x in range(0, 2 ** z):
            for y in range(0, 2 ** z):
                if r.tile_exists(x, y, z):
                    tiles.append((z, x, y))

                checked += 1
                if checked % 10_000 == 0:
                    print(f"Checked {checked} tiles")
    print(f"Generating {len(tiles)} tiles")
    tiles.reverse()  # Loading the higher zooms first might be more efficient

    print(f"Executing... [concurrency={concurrency}]")

    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
        results = []
        for tile in tiles:
            results.append(executor.submit(process, out, r, tile))
        concurrent.futures.wait(results)
        for res in results:
            res.result()  # propagate exceptions

    # TODO: Save a blank webp and then copy it
    # transparent_img = Image.new("RGBA", (tile_size, tile_size))
    # transparent_img.save("path.webp", "webp")
