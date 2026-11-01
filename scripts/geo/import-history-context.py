#!/usr/bin/env python3
"""Import only Timor-Leste reference land and country label points from Natural Earth.

Run with: uv run --with pyshp==2.3.1 python scripts/geo/import-history-context.py SOURCE.zip OUTPUT.geojson
Reference land is not a historical sovereignty claim or a dated military-control map.
"""
import hashlib
import io
import json
import sys
import zipfile
from pathlib import Path

import shapefile

SOURCE_URL = 'https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_countries.zip'
SOURCE_SHA256 = 'ce1ac7036499a0edd641fbc093cd209a98f96a49d2eca8480aaacad35138a7f6'


def signed_area(ring):
    return sum(start[0] * end[1] - end[0] * start[1] for start, end in zip(ring, ring[1:])) / 2


def geojson_winding(geometry):
    if geometry['type'] == 'Polygon':
        polygons = [geometry['coordinates']]
    else:
        polygons = geometry['coordinates']
    for polygon in polygons:
        for index, ring in enumerate(polygon):
            area = signed_area(ring)
            if (index == 0 and area < 0) or (index > 0 and area > 0):
                ring.reverse()
    return geometry


def main():
    source_path, output_path = map(Path, sys.argv[1:])
    source = source_path.read_bytes()
    if hashlib.sha256(source).hexdigest() != SOURCE_SHA256:
        raise ValueError('Unexpected Natural Earth source; review before changing the pinned hash')
    archive = zipfile.ZipFile(io.BytesIO(source))
    names = archive.namelist()
    reader = shapefile.Reader(
        shp=io.BytesIO(archive.read(next(name for name in names if name.endswith('.shp')))),
        dbf=io.BytesIO(archive.read(next(name for name in names if name.endswith('.dbf')))),
        encoding='utf-8',
    )
    fields = [field[0] for field in reader.fields[1:]]
    features = []
    label_points = {}
    for record in reader.iterShapeRecords():
        properties = dict(zip(fields, record.record))
        code = properties['ADM0_A3']
        if code not in ('IDN', 'TLS'):
            continue
        label_points[code] = [properties['LABEL_X'], properties['LABEL_Y']]
        if code == 'TLS':
            features.append({
                'type': 'Feature', 'id': 'reference:timor-leste:natural-earth-5.1.1',
                'properties': {'id': 'timor-leste', 'name': 'Timor-Leste', 'role': 'reference_land_not_historical_sovereignty'},
                'geometry': geojson_winding(record.shape.__geo_interface__),
            })
    if len(features) != 1 or len(label_points) != 2:
        raise ValueError('Expected one Timor-Leste geometry and two country label points')
    output = {
        'type': 'FeatureCollection',
        'metadata': {
            'source': SOURCE_URL, 'source_sha256': SOURCE_SHA256, 'version': '5.1.1',
            'attribution': 'Natural Earth', 'license': 'Public domain',
            'license_url': 'https://www.naturalearthdata.com/about/terms-of-use/',
            'interpretation': 'Modern reference coastline only, not evidence of sovereignty or effective control in an earlier year. Country label points are cartographic placements, not capitals.',
            'country_label_points': label_points,
        },
        'features': features,
    }
    output_path.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(f'Imported Timor-Leste reference land and {len(label_points)} country label points')


if __name__ == '__main__':
    main()
