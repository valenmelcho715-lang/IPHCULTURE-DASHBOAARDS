import {db} from '../db';
import {DEFAULT_SETTINGS, Settings} from './domain';
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS crm_settings(id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS crm_contacts(id INTEGER PRIMARY KEY, name TEXT NOT NULL, phone TEXT, customer_id INTEGER, verified_returning INTEGER NOT NULL DEFAULT 0, opt_out INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS crm_conversations(id INTEGER PRIMARY KEY, channel TEXT NOT NULL, external_id TEXT NOT NULL, sandbox INTEGER NOT NULL DEFAULT 0, contact_id INTEGER NOT NULL, opportunity_id INTEGER, lead_id INTEGER, owner_id INTEGER, mode TEXT NOT NULL DEFAULT 'auto', status TEXT NOT NULL DEFAULT 'active', score INTEGER NOT NULL DEFAULT 0, tier TEXT NOT NULL DEFAULT 'Por conocer', qualification TEXT NOT NULL DEFAULT '{}', reasons TEXT NOT NULL DEFAULT '[]', summary TEXT NOT NULL DEFAULT '', handoff_reason TEXT, followup_optin INTEGER NOT NULL DEFAULT 0, consent_evidence TEXT, followup_attempts INTEGER NOT NULL DEFAULT 0, last_inbound TEXT, last_outbound TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(channel,external_id,sandbox));
CREATE TABLE IF NOT EXISTS crm_opportunities(id INTEGER PRIMARY KEY, conversation_id INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, closed_at TEXT, loss_reason TEXT, sale_id INTEGER);
CREATE TABLE IF NOT EXISTS crm_messages(id INTEGER PRIMARY KEY, conversation_id INTEGER NOT NULL, provider_id TEXT UNIQUE, direction TEXT NOT NULL, author TEXT NOT NULL, text TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'text', delivery TEXT NOT NULL DEFAULT 'received', metadata TEXT, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS crm_messages_conversation ON crm_messages(conversation_id,id);
CREATE TABLE IF NOT EXISTS crm_jobs(id INTEGER PRIMARY KEY, conversation_id INTEGER NOT NULL, message_id INTEGER NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, ready_at TEXT NOT NULL, leased_at TEXT, error TEXT);
CREATE TABLE IF NOT EXISTS crm_outbox(id INTEGER PRIMARY KEY, message_id INTEGER NOT NULL UNIQUE, conversation_id INTEGER NOT NULL, cause_message_id INTEGER, kind TEXT NOT NULL DEFAULT 'text', status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, ready_at TEXT NOT NULL, leased_at TEXT, error TEXT, template TEXT, UNIQUE(conversation_id,cause_message_id,kind));
CREATE TABLE IF NOT EXISTS crm_events(id INTEGER PRIMARY KEY, conversation_id INTEGER, actor_id INTEGER, type TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS crm_quotes(id INTEGER PRIMARY KEY, conversation_id INTEGER NOT NULL, stock_id INTEGER NOT NULL, detail TEXT NOT NULL, total_usd REAL NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS crm_reservations(id INTEGER PRIMARY KEY, conversation_id INTEGER NOT NULL, quote_id INTEGER NOT NULL UNIQUE, stock_id INTEGER NOT NULL, amount_usd REAL NOT NULL, status TEXT NOT NULL DEFAULT 'pending', confirmed_by INTEGER, payment_reference TEXT, confirmed_at TEXT, expires_at TEXT, sale_id INTEGER, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS crm_reservation_stock ON crm_reservations(stock_id,status,expires_at);
CREATE TABLE IF NOT EXISTS crm_appointment_slots(id INTEGER PRIMARY KEY, conversation_id INTEGER NOT NULL, owner_id INTEGER NOT NULL, start_at TEXT NOT NULL, turno_id INTEGER NOT NULL, UNIQUE(owner_id,start_at));
CREATE TABLE IF NOT EXISTS crm_usage(id INTEGER PRIMARY KEY, conversation_id INTEGER, model TEXT NOT NULL, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, estimated_usd REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS crm_followups(id INTEGER PRIMARY KEY, conversation_id INTEGER NOT NULL, cycle TEXT NOT NULL, attempt INTEGER NOT NULL, message_id INTEGER, status TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(conversation_id,cycle,attempt));
CREATE TABLE IF NOT EXISTS crm_actions(id INTEGER PRIMARY KEY, conversation_id INTEGER NOT NULL, cause_message_id INTEGER NOT NULL, kind TEXT NOT NULL, result TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(conversation_id,cause_message_id,kind));
`;
export async function initAutomation() {
  for(const sql of SCHEMA.split(';').map(x=>x.trim()).filter(Boolean)) await db.execute(sql);
  const additions:Record<string,Array<[string,string]>>={
    crm_conversations:[['archived_at','TEXT'],['next_action_at','TEXT'],['next_action_note','TEXT'],['next_action_notified','TEXT']],
    crm_opportunities:[['qualification',"TEXT NOT NULL DEFAULT '{}'"],['summary',"TEXT NOT NULL DEFAULT ''"],['score','INTEGER NOT NULL DEFAULT 0'],['tier',"TEXT NOT NULL DEFAULT 'Por conocer'"],['reasons',"TEXT NOT NULL DEFAULT '[]'"],['owner_id','INTEGER'],['opening_reason','TEXT']],
    crm_messages:[['opportunity_id','INTEGER']]
  };
  for(const [table,columns] of Object.entries(additions)){
    const existing=(await db.execute(`PRAGMA table_info(${table})`)).rows.map(x=>String(x.name));
    for(const [name,type] of columns)if(!existing.includes(name))await db.execute(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
  }
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS crm_contact_notes(id INTEGER PRIMARY KEY,conversation_id INTEGER NOT NULL,text TEXT NOT NULL,actor_id INTEGER NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS crm_identity_links(id INTEGER PRIMARY KEY,source_contact_id INTEGER NOT NULL,target_contact_id INTEGER NOT NULL,actor_id INTEGER NOT NULL,evidence TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS crm_attachments(id INTEGER PRIMARY KEY,message_id INTEGER NOT NULL,conversation_id INTEGER NOT NULL,channel TEXT NOT NULL,provider_ref TEXT,source_url TEXT,mime TEXT,name TEXT,status TEXT NOT NULL,storage_key TEXT,size_bytes INTEGER,sha256 TEXT,expected_sha256 TEXT,attempts INTEGER NOT NULL DEFAULT 0,retry_at TEXT,started_at TEXT,error TEXT,created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS crm_attachment_message ON crm_attachments(message_id);
    CREATE INDEX IF NOT EXISTS crm_attachment_queue ON crm_attachments(status,retry_at);
    CREATE TABLE IF NOT EXISTS crm_storage_runs(id INTEGER PRIMARY KEY,kind TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,completed_at TEXT,detail TEXT);
    CREATE INDEX IF NOT EXISTS crm_opportunity_history ON crm_opportunities(conversation_id,id);
    CREATE INDEX IF NOT EXISTS crm_contact_channels ON crm_conversations(contact_id,sandbox);
    CREATE INDEX IF NOT EXISTS crm_inbox_scope ON crm_conversations(sandbox,owner_id,status);
    CREATE INDEX IF NOT EXISTS crm_contact_note_history ON crm_contact_notes(conversation_id,id);
    CREATE INDEX IF NOT EXISTS crm_followup_due ON crm_conversations(next_action_at,status);
  `);
  const conversationColumns=(await db.execute('PRAGMA table_info(crm_conversations)')).rows.map(x=>String(x.name));
  if(!conversationColumns.includes('opportunity_id')) await db.execute('ALTER TABLE crm_conversations ADD COLUMN opportunity_id INTEGER');
  await db.execute(`UPDATE crm_opportunities SET qualification=(SELECT qualification FROM crm_conversations c WHERE c.opportunity_id=crm_opportunities.id),summary=COALESCE((SELECT summary FROM crm_conversations c WHERE c.opportunity_id=crm_opportunities.id),''),score=COALESCE((SELECT score FROM crm_conversations c WHERE c.opportunity_id=crm_opportunities.id),0),owner_id=(SELECT owner_id FROM crm_conversations c WHERE c.opportunity_id=crm_opportunities.id) WHERE qualification='{}' AND EXISTS(SELECT 1 FROM crm_conversations c WHERE c.opportunity_id=crm_opportunities.id)`);
  const usageColumns=(await db.execute('PRAGMA table_info(crm_usage)')).rows.map(x=>String(x.name));
  if(!usageColumns.includes('status')) await db.execute("ALTER TABLE crm_usage ADD COLUMN status TEXT NOT NULL DEFAULT 'settled'");
  const messageColumns=(await db.execute('PRAGMA table_info(crm_messages)')).rows.map(x=>String(x.name));
  if(!messageColumns.includes('processable')) await db.execute('ALTER TABLE crm_messages ADD COLUMN processable INTEGER NOT NULL DEFAULT 1');
  const followupColumns=(await db.execute('PRAGMA table_info(crm_followups)')).rows.map(x=>String(x.name));
  if(!followupColumns.includes('sent_at')) await db.execute('ALTER TABLE crm_followups ADD COLUMN sent_at TEXT');
  await db.execute({sql:'INSERT INTO crm_settings(id,value) VALUES(1,?) ON CONFLICT(id) DO NOTHING',args:[JSON.stringify(DEFAULT_SETTINGS)]});
  // Regla comercial confirmada: el anterior valor inicial de USD 20 pasa a USD 15.
  // Solo se migra el valor heredado exacto para no pisar otra decisión del administrador.
  const stored=await settings();
  if(stored.maxDiscountUsd===20){stored.maxDiscountUsd=15;await db.execute({sql:'UPDATE crm_settings SET value=? WHERE id=1',args:[JSON.stringify(stored)]});}
  const stockColumns=(await db.execute('PRAGMA table_info(stock)')).rows.map(x=>String(x.name));
  for(const [name,type] of [['battery_pct','INTEGER'],['repairs','TEXT'],['warranty_months','INTEGER'],['image_url','TEXT']]) if(!stockColumns.includes(name)) await db.execute(`ALTER TABLE stock ADD COLUMN ${name} ${type}`);
  const attachmentColumns=(await db.execute('PRAGMA table_info(crm_attachments)')).rows.map(x=>String(x.name));
  for(const [name,type] of [['transcript','TEXT'],['transcribed_at','TEXT'],['transcription_status','TEXT']]) if(!attachmentColumns.includes(name)) await db.execute(`ALTER TABLE crm_attachments ADD COLUMN ${name} ${type}`);
  const saleColumns=(await db.execute('PRAGMA table_info(ventas)')).rows.map(x=>String(x.name));
  for(const [name,type] of [['stock_id','INTEGER'],['crm_conversation_id','INTEGER'],['payment_confirmed_by','INTEGER']]) if(!saleColumns.includes(name)) await db.execute(`ALTER TABLE ventas ADD COLUMN ${name} ${type}`);
}
export async function settings(): Promise<Settings> {
  const r=await db.execute('SELECT value FROM crm_settings WHERE id=1');
  return {...DEFAULT_SETTINGS,...JSON.parse(String(r.rows[0]?.value||'{}'))};
}
export async function event(conversationId:number|null,type:string,detail:string,actorId:number|null=null) {
  await db.execute({sql:'INSERT INTO crm_events(conversation_id,actor_id,type,detail,created_at) VALUES(?,?,?,?,?)',args:[conversationId,actorId,type,detail.slice(0,1500),new Date().toISOString()]});
}

export async function notifyTeam(conversationId:number,reason:string,ownerId:number|null,administration=false){
  try {
    const ids=new Set<number>();if(ownerId)ids.add(ownerId);
    if(administration)for(const u of (await db.execute("SELECT id FROM users WHERE rol='admin'")).rows)ids.add(Number(u.id));
    for(const id of ids)await db.execute({sql:'INSERT INTO mensajes(closer_id,titulo,contenido,creado_por) VALUES(?,?,?,NULL)',args:[id,'Atención IA · conversación #'+conversationId,reason+' · Abrí Atención IA para ver el contexto.']});
  }catch{console.error('[atencion] No se pudo registrar el aviso interno');}
}
