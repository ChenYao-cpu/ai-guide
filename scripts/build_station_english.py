"""Export existing reviewed public translations for backend offline consultation."""
import json
from pathlib import Path
from build_ui_english import read_pack

root = Path(__file__).resolve().parents[1]
translations = json.loads((root/'frontend/src/i18n/en.json').read_text(encoding='utf-8'))
public = {key: value for key, value in translations.items() if len(key) > 100}
(root/'data/station_public_english.json').write_text(json.dumps(public, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(f'Exported {len(public)} existing public content translations.')

# Stable attraction keys survive edits to the Chinese paragraphs in the database.
# Only reuse reviewed public English from the bundled resource pack.
spots = read_pack(root/'resources/local-resources.zip')['scenic_spot_info']
by_name = {s['spot_name']: {field: translations[s[field]] for field in
    ('description', 'history_detail', 'photo_tips', 'tour_tips') if s.get(field) in translations}
    for s in spots if not s.get('delete')}
(root/'data/station_spot_english.json').write_text(json.dumps(by_name, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(f'Exported stable English content for {len(by_name)} attractions.')
