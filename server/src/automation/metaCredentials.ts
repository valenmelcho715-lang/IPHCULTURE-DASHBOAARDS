import crypto from 'node:crypto';
import { db } from '../db';

export type InstagramConnection = {
  accountId: string;
  username: string | null;
  pageId: string;
  token: string;
};

const key = (): Buffer => {
  const secret = process.env.META_TOKEN_ENCRYPTION_KEY || process.env.META_APP_SECRET || '';
  if (!secret) throw new Error('Falta la clave segura para guardar la conexión de Meta');
  return crypto.createHash('sha256').update(secret).digest();
};

const ensureTable = async () => {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS meta_instagram_connection (
      id INTEGER PRIMARY KEY CHECK(id=1),
      instagram_account_id TEXT NOT NULL,
      instagram_username TEXT,
      page_id TEXT NOT NULL,
      token_encrypted TEXT NOT NULL,
      token_iv TEXT NOT NULL,
      token_tag TEXT NOT NULL,
      connected_at TEXT NOT NULL
    )
  `);
};

export async function saveInstagramConnection(value: InstagramConnection): Promise<void> {
  await ensureTable();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(value.token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  await db.execute({
    sql: `INSERT INTO meta_instagram_connection
      (id,instagram_account_id,instagram_username,page_id,token_encrypted,token_iv,token_tag,connected_at)
      VALUES(1,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        instagram_account_id=excluded.instagram_account_id,
        instagram_username=excluded.instagram_username,
        page_id=excluded.page_id,
        token_encrypted=excluded.token_encrypted,
        token_iv=excluded.token_iv,
        token_tag=excluded.token_tag,
        connected_at=excluded.connected_at`,
    args: [
      value.accountId,
      value.username,
      value.pageId,
      encrypted.toString('base64'),
      iv.toString('base64'),
      tag.toString('base64'),
      new Date().toISOString(),
    ],
  });
}

export async function getInstagramConnection(): Promise<InstagramConnection | null> {
  const envToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const envAccount = process.env.INSTAGRAM_ACCOUNT_ID;
  if (envToken && envAccount) {
    return { accountId: envAccount, username: null, pageId: '', token: envToken };
  }
  try {
    await ensureTable();
    const result = await db.execute('SELECT * FROM meta_instagram_connection WHERE id=1');
    const row = result.rows[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key(),
      Buffer.from(String(row.token_iv), 'base64')
    );
    decipher.setAuthTag(Buffer.from(String(row.token_tag), 'base64'));
    const token = Buffer.concat([
      decipher.update(Buffer.from(String(row.token_encrypted), 'base64')),
      decipher.final(),
    ]).toString('utf8');
    return {
      accountId: String(row.instagram_account_id),
      username: row.instagram_username ? String(row.instagram_username) : null,
      pageId: String(row.page_id),
      token,
    };
  } catch (error) {
    console.error('[meta-credentials] No se pudo leer la conexión cifrada de Instagram', error);
    return null;
  }
}
