"""Package source and static web output without credentials or dependencies."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
output = root / 'exports'
output.mkdir(exist_ok=True)
excluded = {'node_modules', '.expo', '.git', 'dist', 'exports', 'test-results', '.test-data', '.tools', '.local', '.gradle', '.cxx', 'build', '.temp', '.branches'}

def source_files(directory):
    for item in directory.iterdir():
        if item.is_symlink() or item.name in excluded:
            continue
        if item.name.startswith('.env') and item.name != '.env.example':
            continue
        if item.name in {'credentials.json','local.properties','demo-signing.properties'} or item.suffix in {'.jks', '.keystore', '.log'}:
            continue
        if item.is_dir():
            yield from source_files(item)
        elif item.is_file():
            yield item

with ZipFile(output / 'NourishExtend-source.zip', 'w', ZIP_DEFLATED) as archive:
    for item in source_files(root):
        archive.write(item, 'NourishExtend/' + item.relative_to(root).as_posix())

with ZipFile(output / 'NourishExtend-web.zip', 'w', ZIP_DEFLATED) as archive:
    for item in (root / 'dist').rglob('*'):
        if item.is_file():
            archive.write(item, item.relative_to(root / 'dist').as_posix())

with ZipFile(output / 'NourishExtend-source.zip') as archive:
    names = archive.namelist()
    assert not any('/node_modules/' in name or '/.local/' in name or name.endswith('/local.properties') or name.endswith(('.keystore','.jks')) or '/.env' in name and not name.endswith('/.env.example') for name in names)
with ZipFile(output / 'NourishExtend-web.zip') as archive:
    assert {'index.html', '_headers', '_redirects', 'theme-init.js'}.issubset(archive.namelist())

print('Created source and web ZIPs. Private .env files, credentials and node_modules are excluded.')
