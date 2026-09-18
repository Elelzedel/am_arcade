"""Validate SVG syntax, inventory the collection, and create the handoff ZIP."""
from pathlib import Path
import hashlib
import json
import xml.etree.ElementTree as ET
from zipfile import ZipFile, ZIP_DEFLATED

root=Path(__file__).resolve().parents[1]
vectors=list(root.rglob('*.svg'))
for p in vectors:
    doc=ET.parse(p).getroot()
    assert doc.tag=='{http://www.w3.org/2000/svg}svg', p
    assert not any(e.tag.endswith('script') for e in doc.iter()), p
files=[]
for p in sorted(root.rglob('*')):
    if not p.is_file() or p.name=='asset-manifest.json': continue
    data=p.read_bytes()
    files.append({'path':str(p.relative_to(root)),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
(root/'asset-manifest.json').write_text(json.dumps({'name':'AM Arcade iconography','version':1,'files':files},indent=2)+'\n')
archive=root.parent/'am-arcade-iconography-v1.zip'
with ZipFile(archive,'w',ZIP_DEFLATED) as z:
    for p in sorted(root.rglob('*')):
        if p.is_file(): z.write(p,Path('am-arcade-iconography-v1')/p.relative_to(root))
print(f'Validated {len(vectors)} SVGs. Packaged {len(files)+1} files: {archive} ({archive.stat().st_size:,} bytes)')
