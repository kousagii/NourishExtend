"""Read the official PSA workbook without evaluating formulas or external links.
Usage: python scripts/import-psgc.py path/to/PSGC-3Q-2026-Publication-Datafile.xlsx
Generates the bundled search catalogue and its matching database data migration.
"""
import hashlib
import json
from pathlib import Path
import sys
import xml.etree.ElementTree as ET
import zipfile

source = Path(sys.argv[1])
root = Path(__file__).resolve().parent.parent
ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(source) as z:
    strings = [''.join(x.itertext()) for x in ET.fromstring(z.read('xl/sharedStrings.xml'))]
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    sheet = next(x for x in wb.find('s:sheets', ns) if x.attrib['name'] == 'PSGC')
    rel = sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
    target = next(x.attrib['Target'] for x in ET.fromstring(z.read('xl/_rels/workbook.xml.rels')) if x.attrib['Id'] == rel)
    rows = []
    for row in ET.fromstring(z.read('xl/' + target)).findall('s:sheetData/s:row', ns):
        values = {}
        for c in row:
            v = c.findtext('s:v', '', ns)
            values[''.join(filter(str.isalpha, c.attrib['r']))] = strings[int(v)] if c.attrib.get('t') == 's' and v else v
        rows.append(values)
regions = {r['B'][:2]: r['C'].strip() for r in rows if r.get('E') == 'Reg'}
provinces = {r['B'][:5]: r['C'].strip() for r in rows if r.get('E') == 'Prov'}
places = []
for r in rows:
    if r.get('E') not in ('City', 'Mun'):
        continue
    code = r['B'].zfill(10)
    places.append(dict(code=code, name=r['C'].strip(), province=provinces.get(code[:5], ''), region=regions[code[:2]], kind='City' if r['E'] == 'City' else 'Municipality'))
assert len(places) == 1642 and len({p['code'] for p in places}) == 1642
assert sum(p['kind'] == 'Municipality' for p in places) == 1493
places.sort(key=lambda p: (p['name'], p['province'], p['code']))
(root / 'src/locations.json').write_text(json.dumps(places, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
quote = lambda v: "'" + v.replace("'", "''") + "'"
values = ',\n'.join('(' + ','.join(quote(p[k]) for k in ('code','name','province','region','kind')) + ')' for p in places)
sha = hashlib.sha256(source.read_bytes()).hexdigest()
sql = '-- Source: Philippine Statistics Authority, PSGC as of 30 September 2026.\n-- https://psa.gov.ph/classification/psgc\n-- Original workbook SHA256: ' + sha + '\n-- Attribution required by workbook metadata. Names and codes extracted; population omitted.\nbegin;\ninsert into public.locations(code,name,province,region,kind) values\n' + values + '\non conflict(code) do update set name=excluded.name,province=excluded.province,region=excluded.region,kind=excluded.kind;\ncommit;\n'
(root / 'supabase/migrations/202611030002_psgc_catalogue.sql').write_text(sql, encoding='utf-8')
(root / 'licenses/PSGC.txt').write_text('Source: Philippine Statistics Authority (PSA), Philippine Standard Geographic Code, 30 September 2026.\nhttps://psa.gov.ph/classification/psgc\nWorkbook metadata: use requires acknowledgement of PSA; distributed without warranty.\nWebsite: CC BY 4.0 unless otherwise stated. https://creativecommons.org/licenses/by/4.0/\nAdaptation: city/municipality names, codes, province and region extracted; other fields omitted.\nWorkbook SHA256: ' + sha + '\n', encoding='utf-8')
print(f'Imported {len(places)} locations: 149 cities, 1493 municipalities. SHA256 {sha}')
