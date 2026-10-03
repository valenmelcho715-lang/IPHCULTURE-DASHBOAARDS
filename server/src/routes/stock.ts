// ============================================================
// stock.ts — Gestión de stock
// GET    /              → todos los roles (orden: categoria, producto)
// POST   /              → admin u oficina
// PUT    /:id           → admin u oficina
// POST   /:id/ajustar   → solo admin ({ delta } — cantidad += delta, mínimo 0)
// DELETE /:id           → admin, oficina o closer (el closer elimina al vender)
// DELETE /              → solo admin (elimina TODO el stock)
// ============================================================
import { Router, Response } from 'express';
import { db } from '../db';
import { authRequired, requireRole, AuthRequest } from '../auth';
import net from 'node:net';

const router = Router();
function visible(row: any, role: string) { const value={...row}; if(role!=='admin') delete value.precio_costo_usd; return value; }
async function held(id: number) {const r=await db.execute({sql:"SELECT COUNT(*) AS n FROM crm_reservations r JOIN crm_conversations c ON c.id=r.conversation_id WHERE r.stock_id=? AND r.status='confirmed' AND r.expires_at>? AND c.sandbox=0",args:[id,new Date().toISOString()]});return Number(r.rows[0].n);}
function imageUrl(value:unknown):string|null {if(value==null||String(value).trim()==='')return null;try{const u=new URL(String(value).trim());if(u.protocol!=='https:'||u.username||u.password||u.port||net.isIP(u.hostname)||u.hostname==='localhost'||!u.hostname.includes('.'))throw new Error();return u.toString();}catch{throw new Error('La foto debe usar una dirección HTTPS pública');}}


// ---- GET / (todos los roles autenticados) ----
router.get('/', authRequired, async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.execute(
      'SELECT * FROM stock ORDER BY categoria ASC, producto ASC, modelo ASC'
    );
    res.json(result.rows.map(r=>visible(r,req.user!.rol)));
  } catch (err) {
    console.error('Error GET /stock:', err);
    res.status(500).json({ error: 'Error al obtener el stock' });
  }
});

// ---- POST / (admin u oficina) — crear item de stock ----
router.post('/', authRequired, requireRole('admin', 'oficina'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      producto,
      modelo,
      capacidad = null,
      color = null,
      condicion = null,
      precio_costo_usd = 0,
      precio_venta_usd = 0,
      cantidad = 0,
      categoria = null, battery_pct = null, repairs = null, warranty_months = null, image_url = null,
    } = req.body || {};

    if (!producto || !modelo) {
      res.status(400).json({ error: 'Producto y modelo son obligatorios' });
      return;
    }

    if ((battery_pct!=null&&(!Number.isFinite(Number(battery_pct))||Number(battery_pct)<1||Number(battery_pct)>100))||(warranty_months!=null&&(!Number.isInteger(Number(warranty_months))||Number(warranty_months)<0||Number(warranty_months)>60))){res.status(400).json({error:'Batería o garantía inválida'});return;}
    let photo:string|null;try{photo=imageUrl(image_url);}catch(e){res.status(400).json({error:(e as Error).message});return;}
    const result = await db.execute({
      sql: `INSERT INTO stock (producto, modelo, capacidad, color, condicion, precio_costo_usd, precio_venta_usd, cantidad, categoria, battery_pct, repairs, warranty_months, image_url)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        producto,
        modelo,
        capacidad,
        color,
        condicion,
        req.user!.rol==='admin' ? Number(precio_costo_usd)||0 : 0,
        Number(precio_venta_usd) || 0,
        Math.max(0, Math.trunc(Number(cantidad) || 0)),
        categoria, battery_pct==null?null:Number(battery_pct), repairs==null?null:String(repairs).slice(0,500), warranty_months==null?null:Number(warranty_months), photo,
      ],
    });

    const id = Number(result.lastInsertRowid);
    const created = await db.execute({ sql: 'SELECT * FROM stock WHERE id = ?', args: [id] });
    res.status(201).json(visible(created.rows[0],req.user!.rol));
  } catch (err) {
    console.error('Error POST /stock:', err);
    res.status(500).json({ error: 'Error al crear el item de stock' });
  }
});

// ---- PUT /:id (admin u oficina) — editar item ----
router.put('/:id', authRequired, requireRole('admin', 'oficina'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = await db.execute({ sql: 'SELECT * FROM stock WHERE id = ?', args: [id] });
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Item de stock no encontrado' });
      return;
    }
    const prev = existing.rows[0];

    const {
      producto = prev.producto,
      modelo = prev.modelo,
      capacidad = prev.capacidad,
      color = prev.color,
      condicion = prev.condicion,
      precio_costo_usd = prev.precio_costo_usd,
      precio_venta_usd = prev.precio_venta_usd,
      cantidad = prev.cantidad,
      categoria = prev.categoria, battery_pct = prev.battery_pct, repairs = prev.repairs, warranty_months = prev.warranty_months, image_url = prev.image_url,
    } = req.body || {};

    if ((battery_pct!=null&&(!Number.isFinite(Number(battery_pct))||Number(battery_pct)<1||Number(battery_pct)>100))||(warranty_months!=null&&(!Number.isInteger(Number(warranty_months))||Number(warranty_months)<0||Number(warranty_months)>60))){res.status(400).json({error:'Batería o garantía inválida'});return;}
    if (Number(cantidad) < await held(id)) {res.status(409).json({error:'La cantidad no puede ser menor a las unidades reservadas'});return;}
    let photo:string|null;try{photo=imageUrl(image_url);}catch(e){res.status(400).json({error:(e as Error).message});return;}
    const saved = await db.execute({
      sql: `UPDATE stock SET producto=?, modelo=?, capacidad=?, color=?, condicion=?,
            precio_costo_usd=?, precio_venta_usd=?, cantidad=?, categoria=?, battery_pct=?, repairs=?, warranty_months=?, image_url=? WHERE id=? AND ? >= (SELECT COUNT(*) FROM crm_reservations r JOIN crm_conversations c ON c.id=r.conversation_id WHERE r.stock_id=? AND r.status='confirmed' AND r.expires_at>? AND c.sandbox=0)`,
      args: [
        producto,
        modelo,
        capacidad,
        color,
        condicion,
        req.user!.rol==='admin' ? Number(precio_costo_usd)||0 : Number(prev.precio_costo_usd)||0,
        Number(precio_venta_usd) || 0,
        Math.max(0, Math.trunc(Number(cantidad) || 0)),
        categoria, battery_pct==null?null:Number(battery_pct), repairs==null?null:String(repairs).slice(0,500), warranty_months==null?null:Number(warranty_months), photo,
        id,
        Math.max(0, Math.trunc(Number(cantidad) || 0)), id, new Date().toISOString(),
      ],
    });
    if(saved.rowsAffected!==1){res.status(409).json({error:"El stock cambió o tiene reservas vigentes"});return;}

    const updated = await db.execute({ sql: 'SELECT * FROM stock WHERE id = ?', args: [id] });
    res.json(visible(updated.rows[0],req.user!.rol));
  } catch (err) {
    console.error('Error PUT /stock/:id:', err);
    res.status(500).json({ error: 'Error al actualizar el item de stock' });
  }
});

// ---- POST /:id/ajustar (admin) — ajuste de cantidad por delta ----
router.post(
  '/:id/ajustar',
  authRequired,
  requireRole('admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const id = Number(req.params.id);
      const delta = Math.trunc(Number(req.body?.delta));
      if (!Number.isFinite(delta) || delta === 0) {
        res.status(400).json({ error: 'Delta inválido (debe ser un número distinto de 0)' });
        return;
      }

      const existing = await db.execute({ sql: 'SELECT * FROM stock WHERE id = ?', args: [id] });
      if (existing.rows.length === 0) {
        res.status(404).json({ error: 'Item de stock no encontrado' });
        return;
      }

      const actual = Number(existing.rows[0].cantidad) || 0;
      const nueva = Math.max(0, actual + delta);

      if(nueva < await held(id)){res.status(409).json({error:'Hay unidades reservadas'});return;}
      const adjusted=await db.execute({sql:"UPDATE stock SET cantidad=MAX(0,cantidad+?) WHERE id=? AND MAX(0,cantidad+?) >= (SELECT COUNT(*) FROM crm_reservations r JOIN crm_conversations c ON c.id=r.conversation_id WHERE r.stock_id=? AND r.status='confirmed' AND r.expires_at>? AND c.sandbox=0)",args:[delta,id,delta,id,new Date().toISOString()]});
      if(adjusted.rowsAffected!==1){res.status(409).json({error:'Hay unidades reservadas'});return;}

      const updated = await db.execute({ sql: 'SELECT * FROM stock WHERE id = ?', args: [id] });
      res.json(visible(updated.rows[0],req.user!.rol));
    } catch (err) {
      console.error('Error POST /stock/:id/ajustar:', err);
      res.status(500).json({ error: 'Error al ajustar el stock' });
    }
  }
);

// ---- DELETE /:id (admin, oficina o closer) — eliminar un item (el closer al vender) ----
router.delete('/:id', authRequired, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = await db.execute({ sql: 'SELECT id FROM stock WHERE id = ?', args: [id] });
    if (existing.rows.length === 0) {
      res.status(404).json({ error: 'Item de stock no encontrado' });
      return;
    }
    if(await held(id)){res.status(409).json({error:'El equipo tiene reservas vigentes'});return;}
    const removed=await db.execute({sql:"DELETE FROM stock WHERE id=? AND NOT EXISTS(SELECT 1 FROM crm_reservations r WHERE r.stock_id=? AND r.status='confirmed' AND r.expires_at>?)",args:[id,id,new Date().toISOString()]});
    if(removed.rowsAffected!==1){res.status(409).json({error:'Hay unidades reservadas'});return;}
    res.json({ ok: true, id });
  } catch (err) {
    console.error('Error DELETE /stock/:id:', err);
    res.status(500).json({ error: 'Error al eliminar el item de stock' });
  }
});

// ---- DELETE / (admin) — eliminar TODO el stock ----
router.delete('/', authRequired, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    if((await db.execute({sql:"SELECT id FROM crm_reservations WHERE status='confirmed' AND expires_at>? LIMIT 1",args:[new Date().toISOString()]})).rows.length){res.status(409).json({error:'Hay reservas vigentes'});return;}
    await db.execute({sql:"DELETE FROM stock WHERE NOT EXISTS(SELECT 1 FROM crm_reservations WHERE status='confirmed' AND expires_at>?)",args:[new Date().toISOString()]});
    res.json({ ok: true, mensaje: 'Todo el stock fue eliminado' });
  } catch (err) {
    console.error('Error DELETE /stock:', err);
    res.status(500).json({ error: 'Error al eliminar el stock' });
  }
});

export default router;
