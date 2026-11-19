"""Build a Windows portable ZIP from a pinned runtime and an explicit art pack."""
import argparse
from hashlib import file_digest
import json
from pathlib import Path, PurePosixPath
from shutil import copyfile, copyfileobj
import subprocess
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
ACTIONS = ('idle','greet','tap','reply','happy','confused','thinking','remind')
VERSION = json.loads((ROOT/'package.json').read_bytes())['version']
OUTPUT = f'Amoo-Desktop-Pet-v{VERSION}-windows-x64'
SOURCES = (
    'src/desktop/main.cjs','src/desktop/preload.cjs','src/desktop/asset-routes.cjs',
    'src/desktop/window-shape.cjs','src/desktop/visible-bounds.cjs','src/desktop/throw-window.cjs',
    'src/desktop/motion-settings.cjs','src/desktop/pet-peers.cjs',
    'src/desktop/dsh-pet/LICENSE','src/desktop/dsh-pet/desktop-geometry.js',
    'src/desktop/dsh-pet/pointer-target.js','src/desktop/dsh-pet/range.js',
    'src/desktop/dsh-pet/taskbar-watchdog.js','src/desktop/dsh-pet/topmost-watchdog.js',
    'src/desktop/dsh-pet/tray-platform.js','src/desktop/dsh-pet/shared/types.ts',
    'src/desktop/dsh-pet/shared/displays.ts',
    *(f'src/desktop/dsh-pet/shared/physics/{name}.ts' for name in ('constants','contact','release','spring','throw')),
    *(f'src/pet/{name}' for name in ('actor.mjs','behavior.mjs','behaviors.json','companion.css',
        'desktop-presenter.mjs','desktop.html','desktop.mjs','dsh-pet-pickers.mjs',
        'hit-mask.mjs','idle-handoff.mjs','idle-poses.json')),
)
DOCS = ('LICENSE','ASSETS_LICENSE.md','THIRD_PARTY_NOTICES.md','README.md','README_EN.md',
        'CHANGELOG.md','docs/KNOWN_ISSUES.md')


def sha(path):
    with path.open('rb') as file:
        return file_digest(file,'sha256').hexdigest()


def safe_copy(source, destination):
    if not source.is_file() or source.is_symlink():
        raise ValueError(f'Expected an ordinary file named {source.name}')
    destination.parent.mkdir(parents=True,exist_ok=True)
    copyfile(source,destination)


def asset_files(root, demo=False):
    manifest = json.loads((root/'character/manifest.json').read_bytes())
    names = {'character/manifest.json','character/poster.png','character/tray.png'}
    if set(manifest['motions'])!=set(ACTIONS) or manifest.get('designSize')!=[480,600]:
        raise ValueError('The pack must supply the eight actions on a 480×600 canvas.')
    for key,row in manifest['motions'].items():
        main = f'animations/{key}.webm'
        atlas = f'animations/{key}.'+('png' if demo else 'webp')
        if row['file']!=main or row['fallbackAtlas']['file']!=atlas:
            raise ValueError(f'Unexpected filename for animation {key}.')
        names.add(atlas)
        if not demo:
            names.add(main)
    return sorted(names)


def extract_electron(archive, target):
    with ZipFile(archive) as original:
        for item in original.infolist():
            member = PurePosixPath(item.filename)
            if member.is_absolute() or '..' in member.parts or '\\' in item.filename or ':' in item.filename:
                raise ValueError(f'Unsafe Electron ZIP member {item.filename!r}')
            if item.is_dir():
                continue
            path = target.joinpath(*member.parts)
            path.parent.mkdir(parents=True,exist_ok=True)
            with original.open(item) as source,path.open('xb') as destination:
                copyfileobj(source,destination)


def native_exes(stage, compiler):
    for name,target,gui in (('CompanionLauncher','AOMM Companion.exe',True),
                            ('PointerDrag','src/desktop/PointerDrag.exe',False),
                            ('FullscreenProbe','src/desktop/FullscreenProbe.exe',False)):
        command = [str(compiler),'/nologo','/codepage:65001','/platform:x64','/optimize+','/debug-',
                   '/target:winexe' if gui else '/target:exe',f'/out:{stage/target}']
        if gui:
            command.append('/r:System.Windows.Forms.dll')
        subprocess.run([*command,str(ROOT/f'src/desktop/{name}.cs')],check=True)


def build(runtime, assets, output, compiler, demo=False):
    lock = json.loads((ROOT/'runtime.lock.json').read_bytes())
    if sha(runtime)!=lock['sha256']:
        raise ValueError('Electron archive SHA-256 does not match runtime.lock.json.')
    media = asset_files(assets,demo)
    output.mkdir(parents=True,exist_ok=True)
    name = OUTPUT+('-DEMO' if demo else '')
    stage = output/name
    stage.mkdir()
    for file in (*SOURCES,*DOCS):
        safe_copy(ROOT/file,stage/file)
    version = {'name':'aomm-companion','version':VERSION,'main':'main.cjs'}
    (stage/'src/desktop/package.json').write_text(json.dumps(version,indent=2)+'\n',encoding='utf8')
    for file in media:
        safe_copy(assets/file,stage/'assets'/file)
    extract_electron(runtime,stage/'electron')
    native_exes(stage,compiler)
    with ZipFile(output/(name+'.zip'),'x',ZIP_DEFLATED,compresslevel=3) as archive:
        for file in sorted(stage.rglob('*')):
            if file.is_file():
                archive.write(file,name+'/'+file.relative_to(stage).as_posix())
    return output/(name+'.zip')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime',required=True,type=Path)
    parser.add_argument('--assets',required=True,type=Path)
    parser.add_argument('--output',required=True,type=Path)
    parser.add_argument('--compiler',type=Path,default=Path('C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe'))
    parser.add_argument('--demo',action='store_true')
    args=parser.parse_args()
    print(build(args.runtime,args.assets,args.output,args.compiler,args.demo))
