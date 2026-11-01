"""Index name mentions in user-supplied books; never redistribute their prose.
Run: uv run --with pypdf python scripts/geo/index-history-books.py [PDF-directory]
PDF page numbers are discovery references, not historical identity validation.
"""
import hashlib
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / 'research/history/sources'
BOOKS = [
    ('Buku - Sejarah Nasional Indonesia.pdf', 'Sejarah Nasional Indonesia (Gita Lentera)'),
    ('ENSIKLOPEDI KERAJAAN-KERAJAAN NUSANTARA 1.pdf', 'Ensiklopedi Kerajaan-Kerajaan Nusantara, volume 3'),
    ('Sejarah_nusantara.pdf', 'Sejarah Nusantara (Wikipedia compilation)'),
    ('Modul Sejarah XI KD 3.1 dan 4.1 - XI_Sejarah_KD-3.1_Final.pdf', 'Edi Sukmadi, Kerajaan-kerajaan maritim di Indonesia masa Hindu Budha (2020)'),
    ('Kesulatanan A4.indd - 2121759838976.pdf', 'Ensiklopedia Kesultanan di Nusantara (Kementerian Agama, 2022)')
]


def folded(text):
    text = unicodedata.normalize('NFKD', text).casefold()
    return ''.join(character for character in text if not unicodedata.combining(character))


def mention_pattern(name):
    words = re.findall(r'\w+', folded(name))
    # Some PDFs put spaces between every letter. Keep word boundaries around the full name.
    letters = [r'\s*'.join(re.escape(character) for character in word) for word in words]
    return re.compile(r'(?<!\w)' + r'[\s\W]+'.join(letters) + r'(?!\w)')


def main():
    from pypdf import PdfReader
    directory = Path.home() / 'Downloads'
    if len(sys.argv) > 1:
        directory = Path(sys.argv[1])
    inventory = json.loads((ROOT / 'static/data/history-inventory.geojson').read_text())
    CACHE.mkdir(parents=True, exist_ok=True)
    sources = []
    texts = []
    for filename, title in BOOKS:
        path = directory / filename
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        cache = CACHE / f'book-{digest}.json'
        if cache.exists():
            pages = json.loads(cache.read_text())
        else:
            reader = PdfReader(path)
            pages = [page.extract_text() or '' for page in reader.pages]
            cache.write_text(json.dumps(pages, ensure_ascii=False))
        sources.append({'book_title': title, 'file': filename, 'pdf_page_count': len(pages), 'sha256': digest,
                        'license_assessment': 'No redistribution permission inferred from possession. This index publishes page references only.',
                        'quality_warning': 'PDF extraction and inter-letter whitespace matching can produce omissions or ambiguous matches.'})
        texts.append([folded(page) for page in pages])
    entries = {}
    name_counts = {}
    for feature in inventory['features']:
        name = feature['properties']['name']
        name_counts[name] = name_counts.get(name, 0) + 1
    for feature in inventory['features']:
        properties = feature['properties']
        labels = [properties['name'], *properties['aliases']]
        patterns = [(label, mention_pattern(label)) for label in labels if label.strip()]
        matches = []
        for source, pages in zip(sources, texts):
            page_numbers = []
            matched = set()
            for index, page in enumerate(pages):
                hits = [label for label, pattern in patterns if pattern.search(page)]
                if hits:
                    page_numbers.append(index + 1)
                    matched.update(hits)
            if page_numbers:
                ambiguous = [label for label in matched if len(label) < 6 or name_counts.get(label, 0) > 1]
                matches.append({'book_title': source['book_title'], 'file': source['file'], 'pages': page_numbers,
                                'matched_labels': sorted(matched), 'ambiguous_labels': ambiguous})
        entries[str(properties['source_entry'])] = {'name': properties['name'], 'aliases': properties['aliases'],
                                                    'source_entry': properties['source_entry'], 'matches': matches}
    result = {'source_entry_count': len(entries), 'matching_method': 'Whole-name/inter-letter whitespace mention search; not identity verification.',
              'sources': sources, 'entries_by_source_entry_id': entries}
    output = ROOT / 'research/history/book-mentions.json'
    output.write_text(json.dumps(result, ensure_ascii=False))
    print(f'Indexed {len(entries)} source entries across {len(sources)} books; {sum(bool(entry["matches"]) for entry in entries.values())} have name mentions.')


if __name__ == '__main__':
    main()
