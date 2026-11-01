"""Independent GEOS verification of render geometry against original SVG nonzero fills.
Run: uv run --with shapely==2.1.2 python scripts/geo/verify-history-render.py
Uses a separate SVG parser and face/winding reconstruction, not the clipping helper.
"""
import hashlib
import json
import math
import re
from pathlib import Path
from shapely.geometry import LineString, Point, shape
from shapely.ops import polygonize, unary_union

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'static/data'


def svg_rings(path):
    tokens = re.findall(r'[MLZ]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?', path)
    rings = []
    current = []
    index = 0
    while index < len(tokens):
        command = tokens[index]
        index += 1
        if command == 'Z':
            if current[0] != current[-1]:
                current.append(current[0])
            rings.append(current)
            current = []
        elif command in ['M', 'L']:
            current.append((float(tokens[index]), float(tokens[index + 1])))
            index += 2
        else:
            raise RuntimeError('Unsupported SVG command')
    if current:
        raise RuntimeError('Unclosed SVG ring')
    return rings


def winding_number(point, rings):
    x, y = point.x, point.y
    winding = 0
    for ring in rings:
        for start, end in zip(ring, ring[1:]):
            cross = (end[0] - start[0]) * (y - start[1]) - (x - start[0]) * (end[1] - start[1])
            if start[1] <= y < end[1] and cross > 0:
                winding += 1
            elif end[1] <= y < start[1] and cross < 0:
                winding -= 1
    return winding


def canonical_svg_land(national):
    provinces = []
    for region in national['regions']:
        rings = svg_rings(region['path'])
        faces = polygonize(unary_union([LineString(ring) for ring in rings]))
        filled = [face for face in faces if winding_number(face.representative_point(), rings) != 0]
        provinces.append(unary_union(filled))
    return unary_union(provinces)


def projected_shape(feature, projection):
    def project_coordinates(coordinates):
        if isinstance(coordinates[0], (float, int)):
            longitude, latitude = coordinates[:2]
            return [projection['translate'][0] + projection['scale'] * math.radians(longitude),
                    projection['translate'][1] - projection['scale'] * math.log(math.tan(math.pi / 4 + math.radians(latitude) / 2))]
        return [project_coordinates(child) for child in coordinates]
    geometry = feature['geometry']
    return shape({'type': geometry['type'], 'coordinates': project_coordinates(geometry['coordinates'])})


def identity(feature):
    properties = feature['properties']
    return properties['id'], properties['from'], properties['to'], properties['sourceName']


def verify_sources(raw, rendered, national, land):
    projection = national['projection']
    source = {identity(feature): projected_shape(feature, projection) for feature in raw['features']}
    actual = {identity(feature): projected_shape(feature, projection) for feature in rendered['features']}
    if len(source) != len(raw['features']) or len(actual) != len(rendered['features']):
        raise RuntimeError('Duplicate source identities need explicit handling')
    if set(actual) - set(source):
        raise RuntimeError('Render geometry invented a source identity')
    outside = 0
    mismatch = 0
    expected_nonempty = 0
    for key, original in source.items():
        if not original.is_valid:
            raise RuntimeError(f'Invalid original geometry; no automatic repair allowed: {key}')
        expected = original.intersection(land)
        result = actual.get(key)
        if expected.area == 0:
            if result is not None and result.area > 0:
                raise RuntimeError(f'Nonempty render for an empty source intersection: {key}')
            continue
        expected_nonempty += 1
        if result is None or not result.is_valid:
            raise RuntimeError(f'Missing or invalid render geometry: {key}')
        outside += result.difference(land).area
        mismatch += result.symmetric_difference(expected).area
        if not result.covers(expected.representative_point()):
            raise RuntimeError(f'Positive interior witness lost: {key}')
    for polity, start, x, y in [('sunda', 732, 277.874, 336.439), ('sunda', 732, 341.211, 345.352),
                               ('dutch-east-indies', 1908, 642.231, 171.115)]:
        point = Point(x, y)
        if land.covers(point):
            raise RuntimeError('Offshore regression witness is no longer outside the canonical land')
        if any(key[0] == polity and key[1] == start and geometry.covers(point) for key, geometry in actual.items()):
            raise RuntimeError(f'Offshore regression witness remains in {polity}')
    return outside, mismatch, expected_nonempty


def verify_modern_transitions(rendered):
    modern = [feature for feature in rendered['features'] if feature['properties'].get('modern')]
    if not modern:
        return 0

    def outline(polity, year):
        matches = [feature for feature in modern if feature['properties']['id'] == polity
                   and feature['properties']['from'] <= year
                   and (year <= feature['properties']['to'] or feature['properties'].get('reference_ongoing'))]
        if len(matches) != 1:
            raise RuntimeError(f'Expected one modern outline for {polity} in {year}')
        return shape(matches[0]['geometry'])

    witnesses = [
        ('indonesia', 1961, (138.95, -4.1), False),
        ('indonesia', 1963, (138.95, -4.1), True),
        ('indonesia', 1998, (125.854679, -8.803705), True),
        ('indonesia', 1999, (125.854679, -8.803705), False),
        ('indonesia', 2002, (125.854679, -8.803705), False),
        ('timor-leste', 2002, (125.854679, -8.803705), True),
    ]
    for polity, year, coordinates, expected in witnesses:
        if outline(polity, year).covers(Point(*coordinates)) != expected:
            raise RuntimeError(f'Modern transition witness failed: {polity}, {year}, {coordinates}')
    if outline('indonesia', 2025).intersection(outline('timor-leste', 2025)).area > 1e-8:
        raise RuntimeError('Current Indonesian and Timor-Leste display references overlap')
    return len(witnesses)


def main():
    national_bytes = (DATA / 'geometry-2025/national.json').read_bytes()
    source_bytes = (DATA / 'history-territories.geojson').read_bytes()
    national = json.loads(national_bytes)
    raw = json.loads(source_bytes)
    rendered = json.loads((DATA / 'history-territories-render.geojson').read_text())
    metadata = rendered['metadata']
    if metadata['land_mask_sha256'] != hashlib.sha256(national_bytes).hexdigest() or metadata['source_sha256'] != hashlib.sha256(source_bytes).hexdigest():
        raise RuntimeError('Render provenance hashes do not match inputs')
    land = canonical_svg_land(national)
    legacy_render = {**rendered, 'features': [feature for feature in rendered['features'] if not feature['properties'].get('modern')]}
    outside, mismatch, count = verify_sources(raw, legacy_render, national, land)
    modern_witnesses = verify_modern_transitions(rendered)
    if outside >= 1e-6 or mismatch >= 1e-6:
        raise RuntimeError(f'Geometry mismatch: offshore={outside}, symmetric_difference={mismatch}')
    print(json.dumps({'source_features': len(raw['features']), 'nonempty_intersections': count,
                      'render_features': len(rendered['features']), 'legacy_render_features': len(legacy_render['features']),
                      'modern_transition_witnesses': modern_witnesses, 'offshore_projected_area': outside,
                      'source_intersection_difference_area': mismatch,
                      'canonical_mask': 'independent SVG nonzero face reconstruction; GEOS'}))


if __name__ == '__main__':
    main()
