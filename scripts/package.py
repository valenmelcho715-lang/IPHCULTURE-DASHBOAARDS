#!/usr/bin/env python3
"""Empaqueta el código y la documentación, sin datos de clientes ni secretos."""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
root=Path(__file__).resolve().parent.parent
destination=root.parent/'iPhoneCulture_IA_Proyecto.zip'
skip={'node_modules','.git','.demo','backups','artifacts','private-media','data','restic-repository','restore','dist','dist-local','__pycache__'}
with ZipFile(destination,'w',ZIP_DEFLATED) as archive:
    for file in sorted(root.rglob('*')):
        relative=file.relative_to(root)
        if not file.is_file() or any(part in skip for part in relative.parts):continue
        if relative.parts[:2]==('docs','legado'):continue
        if file.name.startswith('.env') and file.name!='.env.example':continue
        if '.db' in file.name or file.suffix in {'.log','.pyc'} or file.name=='.DS_Store':continue
        archive.write(file,Path('iphone-culture-ia')/relative)
print(destination)
print(str(destination.stat().st_size)+' bytes')
