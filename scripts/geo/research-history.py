"""Build page-evidenced research dossiers without inventing dates or boundaries.
Run: uv run --with pypdf python scripts/geo/research-history.py
Network responses and copyrighted local-book text remain in ignored research/.
"""
import hashlib
import json
import re
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / 'research/history/sources'
CACHE.mkdir(parents=True, exist_ok=True)
USER_AGENT = 'AtlasNusantara/0.1 (https://github.com/ygrip/atlas-nusantara; historical source research)'
INVENTORY = json.loads((ROOT / 'static/data/history-inventory.geojson').read_text())
BOOK_TITLES = {
    'Buku - Sejarah Nasional Indonesia.pdf': 'Sejarah Nasional Indonesia (Gita Lentera; ISBN 978-623-8708-80-2)',
    'ENSIKLOPEDI KERAJAAN-KERAJAAN NUSANTARA 1.pdf': 'Ivan Taniputera, Ensiklopedi Kerajaan-Kerajaan Nusantara, volume 3 (ISBN 978-602-313-181-5)',
    'Sejarah_nusantara.pdf': 'Sejarah Nusantara (compilation of Indonesian Wikipedia revisions)',
    'Modul Sejarah XI KD 3.1 dan 4.1 - XI_Sejarah_KD-3.1_Final.pdf': 'Edi Sukmadi, Kerajaan-kerajaan maritim di Indonesia masa Hindu Budha (Direktorat SMA, 2020)',
    'Kesulatanan A4.indd - 2121759838976.pdf': 'Ensiklopedia Kesultanan di Nusantara (Kementerian Agama, 2022)'
}


def request_json(parameters):
    url = 'https://id.wikipedia.org/w/api.php?' + urllib.parse.urlencode(parameters)
    key = hashlib.sha256(url.encode()).hexdigest()
    path = CACHE / (key + '.json')
    if path.exists():
        return json.loads(path.read_text())
    for attempt in range(4):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
            with urllib.request.urlopen(request, timeout=60) as response:
                data = json.load(response)
            if 'error' in data:
                raise RuntimeError(str(data['error']))
            path.write_text(json.dumps(data, ensure_ascii=False))
            time.sleep(0.25)
            return data
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)


def normalized(text):
    text = unicodedata.normalize('NFKD', text).casefold()
    text = ''.join(character for character in text if not unicodedata.combining(character))
    text = re.sub(r'\b(kerajaan|kesultanan|kingdom|sultanate|kadipaten|kepangeranan)\b', '', text)
    return re.sub(r'[^a-z0-9]', '', text)


def load_genealogies():
    path = CACHE / 'kerajaan-layout.txt'
    pdf = CACHE / 'kerajaan.pdf'
    if not pdf.exists():
        request = urllib.request.Request('https://dataverse.nl/api/access/datafile/617869', headers={'User-Agent': USER_AGENT})
        with urllib.request.urlopen(request, timeout=120) as response:
            pdf.write_bytes(response.read())
    if hashlib.sha1(pdf.read_bytes()).hexdigest() != '75c43920fd3c0c234821d00c89ece9a729005de1':
        raise RuntimeError('Genealogy PDF does not match pinned Dataverse V3 SHA-1')
    if not path.exists():
        from pypdf import PdfReader
        reader = PdfReader(pdf)
        path.write_text(''.join(f'\n===== PDF PAGE {index + 1} =====\n' + (page.extract_text(extraction_mode='layout') or '') for index, page in enumerate(reader.pages)))
    sections = []
    current = None
    for match in re.finditer(r'===== PDF PAGE (\d+) =====\n(.*?)(?====== PDF PAGE |\Z)', path.read_text(), re.S):
        page = int(match[1])
        text = match[2].strip('\n')
        if page < 8:
            continue
        first = next((line.strip() for line in text.splitlines() if line.strip()), '')
        is_heading = (len(first) < 90 and first == first.upper()
                      and len(re.findall(r'[A-Z]', first)) >= 3
                      and not re.search(r'[_|\d=]', first))
        if is_heading:
            current = {'name': first, 'pages': []}
            sections.append(current)
        if current is not None:
            current['pages'].append({'pdf_page': page, 'text': text})
    aliases = []
    for match in re.finditer(r'===== PDF PAGE ([4-7]) =====\n(.*?)(?====== PDF PAGE |\Z)', path.read_text(), re.S):
        for line in match[2].splitlines():
            for column in re.split(r'\s{3,}', line.strip()):
                if ', see ' in column:
                    alias, target = column.split(', see ', 1)
                    aliases.append({'alias': alias, 'target': target, 'pdf_page': int(match[1])})
    return sections, aliases


def article_titles(feature):
    properties = feature['properties']
    if properties['article_url']:
        return [urllib.parse.unquote(properties['article_url'].split('/wiki/', 1)[1]).replace('_', ' ')]
    name = properties['name']
    return ['Kerajaan ' + name, 'Kesultanan ' + name, name]


def fetch_category():
    members = []
    continuation = {}
    while True:
        data = request_json({'action': 'query', 'list': 'categorymembers', 'cmtitle': 'Kategori:Kerajaan di Nusantara',
                             'cmlimit': 'max', 'format': 'json', **continuation})
        members.extend(data['query']['categorymembers'])
        continuation = data.get('continue', {})
        if not continuation:
            return members


def fetch_articles(category_members):
    titles = sorted({title for feature in INVENTORY['features'] for title in article_titles(feature)}
                    | {member['title'] for member in category_members if member['ns'] == 0})
    articles = {}
    aliases = {}
    for offset in range(0, len(titles), 10):
        batch = titles[offset:offset + 10]
        data = request_json({'action': 'query', 'titles': '|'.join(batch), 'prop': 'extracts|revisions|pageprops',
                             'exintro': 1, 'explaintext': 1, 'exlimit': 10, 'rvprop': 'ids|timestamp|content',
                             'rvslots': 'main', 'redirects': 1, 'format': 'json'})
        query = data.get('query', {})
        for item in query.get('normalized', []) + query.get('redirects', []):
            aliases[item['from']] = item['to']
        for page in query.get('pages', {}).values():
            if 'missing' in page or 'disambiguation' in page.get('pageprops', {}):
                continue
            revisions = page.get('revisions', [])
            if not revisions:
                continue
            revision = revisions[0]
            wikitext = revision.get('slots', {}).get('main', {}).get('*', '')
            # Keep original infobox field expressions; do not turn traditional claims into exact facts.
            fields = []
            if re.search(r'{{\s*(?:Infobox|Kotak info)', wikitext, re.I):
                for field in re.finditer(r'^\|\s*([\w -]+?)\s*=\s*(.*)$', wikitext, re.M):
                    if re.search(r'name|nama|year|tahun|date|tanggal|capital|ibu|relig|agama|government|pemerintah|leader|pemimpin|title|gelar|event|peristiwa', field[1], re.I):
                        fields.append({'field': field[1].strip(), 'source_expression': field[2].strip()})
            references = sorted(set(re.findall(r'https?://[^\s<>\[\]{}|\"]+', wikitext)))
            # A bare-name hit may be a village or person: retain it only as a lead when its intro discusses a polity.
            if not re.search(r'kerajaan|kesultanan|kepangeranan|sultan|dinasti|raja', page.get('extract', '')[:3000], re.I):
                continue
            articles[page['title']] = {
                'title': page['title'], 'page_id': page['pageid'], 'revision': revision['revid'],
                'timestamp': revision['timestamp'], 'language': 'id',
                'url': f"https://id.wikipedia.org/w/index.php?curid={page['pageid']}&oldid={revision['revid']}",
                'summary': page.get('extract', ''), 'reported_fields': fields,
                'reference_urls': references,
                'license': 'CC-BY-SA-4.0', 'attribution': 'Indonesian Wikipedia contributors',
                'review_status': 'source_transcription_not_independent_validation',
                'polity_like': bool(re.match(r'^(Kerajaan|Kesultanan|Kadipaten|Kasunanan|Kepangeranan) ', page['title'])
                                    or re.search(r'(?:adalah|merupakan).{0,70}(?:kerajaan|kesultanan|kepangeranan)', page.get('extract', '')[:600], re.I))
            }
        print(f'Wikipedia article lookup {min(offset + 10, len(titles))}/{len(titles)}; {len(articles)} existing articles', flush=True)
    return articles, aliases


def resolve_article(title, articles, aliases):
    visited = set()
    while title in aliases and title not in visited:
        visited.add(title)
        title = aliases[title]
    return articles.get(title)


def inventory_claims():
    source_page = request_json({'action': 'query', 'prop': 'revisions', 'revids': INVENTORY['metadata']['source_revision'],
                               'rvprop': 'content', 'rvslots': 'main', 'format': 'json'})
    wikitext = next(iter(source_page['query']['pages'].values()))['revisions'][0]['slots']['main']['*']
    visible = re.sub(r'<!--[\s\S]*?-->', '', wikitext)
    claims = []
    in_alphabet = False
    for line in visible.splitlines():
        if line.startswith('=='):
            in_alphabet = bool(re.match(r'^==\s*[A-Z]\s*==\s*$', line))
        elif in_alphabet and re.match(r'^\*(?!\*)', line):
            claims.append(re.sub(r'^\*\s*', '', line))
    if len(claims) != len(INVENTORY['features']):
        raise RuntimeError('Source occurrence accounting mismatch')
    return claims


def load_book_sources():
    path = ROOT / 'research/history/book-mentions.json'
    if not path.exists():
        path = ROOT / 'content/history/book-mentions.json'
    if not path.exists():
        return {}, []
    data = json.loads(path.read_text())
    if data.get('source_revision', INVENTORY['metadata']['source_revision']) != INVENTORY['metadata']['source_revision']:
        raise RuntimeError('Book mention index needs source-revision migration')
    public_keys = ['book_title', 'file', 'pdf_page_count', 'sha256', 'license_assessment', 'quality_warning']
    sources = [{key: source[key] for key in public_keys if key in source} for source in data['sources']]
    for source in sources:
        source['book_title'] = BOOK_TITLES.get(source['file'], source['book_title'])
    names = {feature['properties']['source_entry']: feature['properties']['name'] for feature in INVENTORY['features']}
    entries = {}
    for key, entry in data['entries_by_source_entry_id'].items():
        if names.get(entry['source_entry']) != entry['name']:
            raise RuntimeError(f'Ambiguous book mention identity: {key}')
        matches = []
        for mention in entry['matches']:
            public = {field: mention[field] for field in ['book_title', 'file', 'pages', 'matched_labels', 'ambiguous_labels']}
            public['book_title'] = BOOK_TITLES.get(public['file'], public['book_title'])
            matches.append(public)
        entries[key] = {'name': entry['name'], 'aliases': entry['aliases'], 'source_entry': entry['source_entry'], 'matches': matches}
    return entries, sources


def save_book_sources(entries, sources):
    if not entries:
        return
    path = ROOT / 'content/history/book-mentions.json'
    path.parent.mkdir(parents=True, exist_ok=True)
    index = {'source_revision': INVENTORY['metadata']['source_revision'],
             'matching_method': 'Whole-name PDF page mentions only; not identity or historical validation. No book prose redistributed.',
             'sources': sources, 'entries_by_source_entry_id': entries}
    path.write_text(json.dumps(index, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def public_web_record(record):
    entry = record['source_entry']
    if not isinstance(record['uncertain_or_missing'], str) or not isinstance(record['tool_response_id'], str):
        raise RuntimeError(f'Missing web research provenance or uncertainty note: {entry}')
    if record['factual_claim'] is not None and not isinstance(record['factual_claim'], str):
        raise RuntimeError(f'Invalid web research claim: {entry}')
    for source in record['sources']:
        if urllib.parse.urlparse(source['url']).scheme not in ['http', 'https']:
            raise RuntimeError('Unsafe web research source URL')
    public_keys = ['source_entry', 'name', 'matched_name', 'queries', 'tool_response_id', 'sources',
                   'factual_claim', 'uncertain_or_missing', 'evidence_status']
    result = {key: record[key] for key in public_keys}
    result['sources'] = [{key: source[key] for key in ['title', 'url', 'type']} for source in record['sources']]
    return result


def load_web_research():
    checkpoint = ROOT / 'research/history/native-web-research.jsonl'
    published = ROOT / 'content/history/web-research.json'
    sources = []
    if published.exists():
        data = json.loads(published.read_text())
        if data['metadata']['source_revision'] != INVENTORY['metadata']['source_revision']:
            raise RuntimeError('Published research notes need source-revision migration')
        sources.append(data['entries'])
    if checkpoint.exists():
        sources.append([json.loads(line) for line in checkpoint.read_text().splitlines() if line.strip()])
    names = {feature['properties']['source_entry']: feature['properties']['name'] for feature in INVENTORY['features']}
    records = {}
    for source_records in sources:
        seen_in_source = set()
        for record in source_records:
            entry = record['source_entry']
            if entry in seen_in_source or entry not in names or names[entry] != record['name']:
                raise RuntimeError(f'Ambiguous web research checkpoint: {entry}')
            seen_in_source.add(entry)
            records[entry] = public_web_record(record)
    return records


def save_web_research(records):
    if not records:
        return
    path = ROOT / 'content/history/web-research.json'
    path.parent.mkdir(parents=True, exist_ok=True)
    notes = {'metadata': {'schema_version': '1.0', 'source_revision': INVENTORY['metadata']['source_revision'],
                          'evidence_policy': 'Original search research notes and source leads, not independently verified facts or normalized reign dates.'},
             'entries': [records[entry] for entry in sorted(records)]}
    path.write_text(json.dumps(notes, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def matching_articles(feature, articles, aliases):
    matches = []
    for title in article_titles(feature):
        article = resolve_article(title, articles, aliases)
        if article and article not in matches:
            matches.append(article)
    return matches


def matching_genealogies(properties, genealogies, cross_references):
    keys = {normalized(name) for name in [properties['name'], *properties['aliases']]}
    targets = {normalized(item['target']) for item in cross_references if normalized(item['alias']) in keys}
    matches = []
    for section in genealogies:
        names = [section['name'].split('(')[0].strip()]
        for group in re.findall(r'\(([^)]+)\)', section['name']):
            names.extend(part.strip() for part in group.split(','))
        if {normalized(name) for name in names} & (keys | targets):
            matches.append(section)
    return matches


def genealogy_reference(section):
    return {'name': section['name'], 'from_pdf_page': section['pages'][0]['pdf_page'],
            'to_pdf_page': section['pages'][-1]['pdf_page'],
            'source_id': 'hagerdal-2026-v3', 'identity_review_required': True}


def inventory_dossiers(articles, aliases, genealogies, cross_references, book_index, web_research):
    claims = inventory_claims()
    features = []
    for index, feature in enumerate(INVENTORY['features']):
        properties = feature['properties']
        matches = matching_articles(feature, articles, aliases)
        sections = matching_genealogies(properties, genealogies, cross_references)
        mentions = book_index.get(str(properties['source_entry']), {}).get('matches', [])
        ambiguity_reasons = []
        if sum(other['properties']['name'] == properties['name'] for other in INVENTORY['features']) > 1:
            ambiguity_reasons.append('repeated_primary_label')
        if len(matches) > 1:
            ambiguity_reasons.append('multiple_article_identities')
        if len(sections) > 1:
            ambiguity_reasons.append('multiple_genealogy_entries')
        status = 'list_source_only'
        if mentions:
            status = 'book_mentions_located_identity_review_required'
        if matches or sections:
            status = 'additional_sources_located_identity_review_required'
        web_record = web_research.get(properties['source_entry'])
        if web_record:
            status = 'web_search_leads_identity_review_required'
        features.append({'type': 'Feature', 'id': feature['id'], 'geometry': None,
                         'properties': {**properties, 'review_status': status, 'identity_ambiguous': bool(ambiguity_reasons),
                                        'identity_ambiguity_reasons': ambiguity_reasons,
                                        'source_claim_wikitext_id': claims[index], 'articles': matches,
                                        'book_mentions': mentions, 'web_research': web_record,
                                        'genealogy_sections': [genealogy_reference(section) for section in sections]}})
    return features


def supplementary_dossier(identifier, name, source_entry, source_url, status, articles, sections):
    article_url = None
    if articles:
        article_url = articles[0]['url']
    return {'type': 'Feature', 'id': identifier, 'geometry': None,
            'properties': {'name': name, 'aliases': [], 'source_label': name, 'letter': name[0],
                           'source_entry': source_entry, 'review_status': status,
                           'period': None, 'summary': None, 'rulers': [], 'article_url': article_url,
                           'source_url': source_url, 'source_claim_wikitext_id': '', 'identity_ambiguous': False,
                           'articles': articles, 'genealogy_sections': [genealogy_reference(section) for section in sections]}}


def category_dossiers(features, members, articles, aliases):
    linked = {article['page_id'] for feature in features for article in feature['properties']['articles']}
    additional = []
    for member in members:
        if member['ns'] != 0:
            continue
        article = resolve_article(member['title'], articles, aliases)
        if not article or article['page_id'] in linked or not article['polity_like']:
            continue
        linked.add(article['page_id'])
        additional.append(supplementary_dossier(f"idwiki-page-{article['page_id']}", article['title'], member['pageid'],
                                               'https://id.wikipedia.org/wiki/Kategori:Kerajaan_di_Nusantara',
                                               'category_article_located_identity_review_required', [article], []))
    return additional


def genealogy_dossiers(features, genealogies):
    referenced = {reference['name'] for feature in features for reference in feature['properties']['genealogy_sections']}
    return [supplementary_dossier('hagerdal-' + normalized(section['name']), section['name'],
                                  section['pages'][0]['pdf_page'], 'https://doi.org/10.34894/CBO80N',
                                  'genealogy_heading_identity_review_required', [], [section])
            for section in genealogies if section['name'] not in referenced]


def coverage_counts(inventory_features, category_features, genealogy_features):
    properties = [feature['properties'] for feature in inventory_features]
    return {'entries': len(properties),
            'article_supported': sum(bool(item['articles']) for item in properties),
            'genealogy_matches': sum(bool(item['genealogy_sections']) for item in properties),
            'book_mentions': sum(bool(item['book_mentions']) for item in properties),
            'web_searched': sum(bool(item.get('web_research')) for item in properties),
            'web_factual_summaries': sum(bool(item['web_research']['factual_claim']) for item in properties if item.get('web_research')),
            'web_uncertainty_only': sum(not bool(item['web_research'].get('factual_claim')) for item in properties if item.get('web_research')),
            'identity_ambiguous': sum(bool(item['identity_ambiguous']) for item in properties),
            'corpus_source_gaps_before_web': sum(not bool(item['articles'] or item['genealogy_sections'] or item['book_mentions']) for item in properties),
            'category_additional_records': len(category_features), 'genealogy_additional_records': len(genealogy_features),
            'total_source_records': len(inventory_features) + len(category_features) + len(genealogy_features)}


def research_metadata(counts, book_sources, category_members):
    return {
        'title': 'Nusantara polity source research dossiers', 'coverage': counts,
        'method': ('Every visible list occurrence checked against linked/exact-title Wikipedia articles, exact-normalized genealogy headings/cross-references and a five-book page-mention index. '
                   f'{counts["web_searched"]} catalogue entries have additional targeted web-search notes. '
                   'Search leads do not establish reigns or territorial control; uncertainties remain explicit.'),
        'limitations': 'Locating a source is not independent historical verification. Infobox expressions are source claims, not normalized facts. Genealogies include legend and conflicting traditions. Layout charts must not be flattened into invented reigns.',
        'inventory_source': INVENTORY['metadata'], 'local_book_sources': book_sources,
        'local_book_note': 'Page-number name mentions only, not identity or factual validation. Copyrighted book text is not redistributed.',
        'web_research_note': 'Native web-search leads and original research notes, not full-text source validation. Bing via Camofox returned unrelated results; Google via the same browser returned an unusual-traffic HTTP 429 and was not bypassed. Alternative native-provider searches were explicitly approved.',
        'category_discovery': {'url': 'https://id.wikipedia.org/wiki/Kategori:Kerajaan_di_Nusantara',
                               'members': category_members,
                               'note': 'Direct category members checked; not all category members denote polities. Membership is a discovery lead, not historical verification.'},
        'genealogy_source': {'id': 'hagerdal-2026-v3', 'author': 'Hans Hägerdal', 'title': 'Kerajaan2 Indonesia',
                            'version': 3, 'year': 2026, 'doi': 'https://doi.org/10.34894/CBO80N',
                            'download_url': 'https://dataverse.nl/api/access/datafile/617869',
                            'sha1': '75c43920fd3c0c234821d00c89ece9a729005de1', 'license': 'CC-BY-4.0'}
    }


def main():
    genealogies, cross_references = load_genealogies()
    members = fetch_category()
    articles, aliases = fetch_articles(members)
    book_index, book_sources = load_book_sources()
    save_book_sources(book_index, book_sources)
    web_research = load_web_research()
    save_web_research(web_research)
    inventory_features = inventory_dossiers(articles, aliases, genealogies, cross_references, book_index, web_research)
    category_features = category_dossiers(inventory_features, members, articles, aliases)
    genealogy_features = genealogy_dossiers(inventory_features + category_features, genealogies)
    features = inventory_features + category_features + genealogy_features
    if len({feature['id'] for feature in features}) != len(features):
        raise RuntimeError('Duplicate research dossier IDs require review')
    counts = coverage_counts(inventory_features, category_features, genealogy_features)
    document = {'type': 'FeatureCollection', 'metadata': research_metadata(counts, book_sources, members),
                'features': features, 'genealogy_sections': genealogies, 'genealogy_cross_references': cross_references}
    path = ROOT / 'static/data/history-research.geojson'
    path.write_text(json.dumps(document, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(json.dumps(counts), flush=True)
    print(f'Wrote {path}; {len(genealogies)} genealogy extraction candidates, {len(cross_references)} cross-references', flush=True)

if __name__ == '__main__':
    main()
