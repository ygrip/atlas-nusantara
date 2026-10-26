"""Builds the relief (topography + bathymetry) texture for the 3D atlas.

Source: ETOPO1 Global Relief Model, 1 arc-minute (NOAA NCEI, public domain), fetched as a
subset from NOAA CoastWatch ERDDAP dataset `etopo180`:
  https://upwell.pfeg.noaa.gov/erddap/griddap/etopo180.nc?altitude[(-13):1:(8)][(93):1:(143)]

The grid is resampled onto the same d3 Mercator plane as static/data/geometry-2025/national.json
(1000 x 500 map units), so relief lines up with the boundary packages exactly.

Encoding (PNG, 8-bit RGB): value = round((elevation_m + 11000) * 3); R = value >> 8, G = value & 255.
Decode: elevation_m = (R * 256 + G) / 3 - 11000.

Usage: uv run --with numpy --with scipy --with pillow python scripts/geo/build-relief.py etopo.nc
"""
import json
import sys

import numpy as np
from PIL import Image
from scipy.io import netcdf_file
from scipy.ndimage import map_coordinates

WIDTH, HEIGHT = 2048, 1024
PLANE_WIDTH, PLANE_HEIGHT = 1000, 500
OUTPUT = "static/data/geometry-2025/relief.png"


def main(source: str) -> None:
    national = json.load(open("static/data/geometry-2025/national.json"))
    projection = national["projection"]
    scale = projection["scale"]
    translate_x, translate_y = projection["translate"]

    with netcdf_file(source, "r", mmap=False) as dataset:
        latitudes = dataset.variables["latitude"][:].astype(np.float64)
        longitudes = dataset.variables["longitude"][:].astype(np.float64)
        altitude = dataset.variables["altitude"][:].astype(np.float32)

    # Plane coordinates of every output pixel centre, inverted through the Mercator projection.
    columns = (np.arange(WIDTH) + 0.5) * PLANE_WIDTH / WIDTH
    rows = (np.arange(HEIGHT) + 0.5) * PLANE_HEIGHT / HEIGHT
    plane_x, plane_y = np.meshgrid(columns, rows)
    lon = np.degrees((plane_x - translate_x) / scale)
    lat = np.degrees(2 * np.arctan(np.exp((translate_y - plane_y) / scale)) - np.pi / 2)

    lat_index = (lat - latitudes[0]) / (latitudes[1] - latitudes[0])
    lon_index = (lon - longitudes[0]) / (longitudes[1] - longitudes[0])
    elevation = map_coordinates(altitude, [lat_index, lon_index], order=1, mode="nearest")

    value = np.clip(np.round((elevation + 11000) * 3), 0, 65535).astype(np.uint32)
    rgb = np.zeros((HEIGHT, WIDTH, 3), dtype=np.uint8)
    rgb[..., 0] = value >> 8
    rgb[..., 1] = value & 255
    Image.fromarray(rgb, "RGB").save(OUTPUT, optimize=True)

    metadata = {
        "source": "ETOPO1 Global Relief Model (NOAA NCEI), via NOAA CoastWatch ERDDAP etopo180",
        "sourceUrl": "https://www.ncei.noaa.gov/products/etopo-global-relief-model",
        "license": "Public domain (U.S. Government work)",
        "attribution": "Relief: ETOPO1, NOAA National Centers for Environmental Information.",
        "encoding": "elevation_m = (R * 256 + G) / 3 - 11000",
        "width": WIDTH,
        "height": HEIGHT,
        "plane": [PLANE_WIDTH, PLANE_HEIGHT],
        "minElevation": float(elevation.min()),
        "maxElevation": float(elevation.max()),
    }
    json.dump(metadata, open(OUTPUT.replace(".png", ".json"), "w"), indent=1)
    print(json.dumps(metadata))


if __name__ == "__main__":
    main(sys.argv[1])
