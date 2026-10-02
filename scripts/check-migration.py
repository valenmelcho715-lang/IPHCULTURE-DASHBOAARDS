#!/usr/bin/env python3
"""Verifica migraciones sobre una copia temporal. No abre la base fuente para escribir."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import tempfile

root=Path(__file__).resolve().parent.parent
if len(sys.argv)!=2:
    raise SystemExit('Uso: python3 scripts/check-migration.py /ruta/a/iphone-culture.db')
source=Path(sys.argv[1]).resolve()
if not source.is_file():
    raise SystemExit('No existe la base indicada')
files=[p for p in [source,Path(str(source)+'-wal'),Path(str(source)+'-shm')] if p.exists()]
original={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}

def quote(identifier):
    return '"'+identifier.replace('"','""')+'"'

def fingerprint(connection, table, columns):
    query='SELECT '+','.join(map(quote,columns))+' FROM '+quote(table)
    rows=sorted(json.dumps(row,ensure_ascii=False,default=str) for row in connection.execute(query))
    return hashlib.sha256('\n'.join(rows).encode()).hexdigest(),len(rows)

with tempfile.TemporaryDirectory(prefix='iphone-culture-migration-') as directory:
    directory=Path(directory)
    for p in files:shutil.copy2(p,directory/p.name)
    # Backup de SQLite incorpora WAL; los tres archivos temporales son una instantánea.
    snapshot=sqlite3.connect(f'file:{directory/source.name}?mode=ro',uri=True)
    target=directory/'migration.db'
    baseline=sqlite3.connect(target)
    snapshot.backup(baseline);snapshot.close()
    tables=[r[0] for r in baseline.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'crm_%' ORDER BY name")]
    columns={t:[r[1] for r in baseline.execute('PRAGMA table_info('+quote(t)+')')] for t in tables}
    before={t:fingerprint(baseline,t,columns[t]) for t in tables}
    baseline.close()
    environment={**os.environ,'TURSO_DATABASE_URL':'file:'+str(target),'NODE_ENV':'test','DEMO_SEED':'false','BOOTSTRAP_ADMIN_EMAIL':'','BOOTSTRAP_ADMIN_PASSWORD':''}
    subprocess.run(['node','-e',"const d=require('./server/dist/db');const a=require('./server/dist/automation/schema');(async()=>{await d.initDb();await a.initAutomation();await a.initAutomation();d.db.close();})().catch(()=>{console.error('Falló la migración de prueba');process.exit(1);});"],cwd=root,env=environment,check=True)
    migrated=sqlite3.connect(f'file:{target}?mode=ro',uri=True)
    integrity=migrated.execute('PRAGMA integrity_check').fetchone()[0]
    unchanged=all(before[t]==fingerprint(migrated,t,columns[t]) for t in tables)
    additions=migrated.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name LIKE 'crm_%'").fetchone()[0]
    migrated.close()
    source_untouched=all(hashlib.sha256(Path(p).read_bytes()).hexdigest()==digest for p,digest in original.items())
    report={'integrity':integrity,'legacy_rows_unchanged':unchanged,'source_files_unchanged':source_untouched,'crm_tables':additions,'legacy_counts':{t:before[t][1] for t in tables}}
    (root/'artifacts').mkdir(exist_ok=True)
    (root/'artifacts/migration.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
    if integrity!='ok' or not unchanged or not source_untouched:raise SystemExit('La migración requiere revisión. Ver artifacts/migration.json')
    print('Migración verificada: integridad OK, '+str(len(tables))+' tablas anteriores sin cambios de datos y archivos fuente intactos.')
    for table in ['leads','clientes','ventas','turnos','stock','cuotas_fees','users']:
        if table in before:print(table+': '+str(before[table][1])+' filas conservadas')
