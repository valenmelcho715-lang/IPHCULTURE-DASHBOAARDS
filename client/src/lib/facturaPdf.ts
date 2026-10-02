// ============================================================
// lib/facturaPdf.ts — Comprobante X en PDF (Frontend_Ventas_Facturas)
// Diseño premium tipo Apple Store receipt: fondo blanco, header
// centrado, divisores punteados, bloque mono, QR de verificación
// y footer legal EXACTO. Descarga como <numero>.pdf
// ============================================================
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

export interface FacturaPdfData {
  numero: string;
  fecha: string;
  cliente_nombre: string;
  cliente_dni?: string;
  producto: string;
  precio_usd: number;
  monto_senado?: number;
  falta_pagar?: number;
  es_canje?: number;
  closer_nombre?: string;
}

const M = 10; // margen lateral (mm)
const W = 100; // ancho de página (mm) — formato ticket
const CX = W / 2;

function fmtUsd(n: number): string {
  return `USD ${Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
}

function fmtFechaLocal(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso.includes('T') || iso.includes('Z') ? iso : iso.replace(' ', 'T') + 'Z');
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function descargarFacturaPdf(factura: FacturaPdfData): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: [W, 220] });
  let y = 14;

  const dashed = (yy: number) => {
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([1.2, 1.2], 0);
    doc.line(M, yy, W - M, yy);
    doc.setLineDashPattern([], 0);
  };

  // ---------- Header ----------
  doc.setTextColor(15, 15, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('iPhone Culture', CX, y, { align: 'center' });
  y += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 120);
  doc.text('Neuquén, Argentina', CX, y, { align: 'center' });
  y += 4;
  doc.setFontSize(7.5);
  doc.text('COMPROBANTE X', CX, y, { align: 'center' });
  y += 5;
  dashed(y);
  y += 6;

  // ---------- Número / fecha (mono) ----------
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 15, 20);
  doc.text(factura.numero, M, y);
  doc.setFont('courier', 'normal');
  doc.setFontSize(8.5);
  doc.text(fmtFechaLocal(factura.fecha), W - M, y, { align: 'right' });
  y += 6;
  dashed(y);
  y += 6;

  // ---------- Datos del cliente ----------
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 120);
  doc.text('CLIENTE', M, y);
  y += 4.5;
  doc.setFontSize(10);
  doc.setTextColor(15, 15, 20);
  doc.setFont('helvetica', 'bold');
  doc.text(factura.cliente_nombre || '—', M, y);
  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  if (factura.cliente_dni) {
    doc.text(`DNI: ${factura.cliente_dni}`, M, y);
    y += 4.5;
  }
  if (factura.closer_nombre) {
    doc.setTextColor(110, 110, 120);
    doc.text(`Vendedor: ${factura.closer_nombre}`, M, y);
    y += 4.5;
  }
  y += 1.5;
  dashed(y);
  y += 6;

  // ---------- Ítem ----------
  doc.setFontSize(8);
  doc.setTextColor(110, 110, 120);
  doc.text('DETALLE', M, y);
  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 15, 20);
  const lineas = doc.splitTextToSize(factura.producto || 'Producto', W - M * 2 - 26);
  doc.text(lineas, M, y);
  doc.setFont('helvetica', 'bold');
  doc.text(fmtUsd(factura.precio_usd), W - M, y, { align: 'right' });
  y += lineas.length * 4.2 + 2;

  if (factura.es_canje) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(124, 58, 237); // violet — canje
    doc.text('OPERACIÓN CON CANJE', M, y);
    y += 5;
  }

  // ---------- Seña / falta ----------
  const sena = Number(factura.monto_senado || 0);
  const falta = Number(factura.falta_pagar || 0);
  if (sena > 0 || falta > 0) {
    y += 1;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 100);
    if (sena > 0) {
      doc.text('Seña entregada', M, y);
      doc.text(fmtUsd(sena), W - M, y, { align: 'right' });
      y += 4.5;
    }
    if (falta > 0) {
      doc.setTextColor(200, 40, 50);
      doc.text('Falta pagar', M, y);
      doc.text(fmtUsd(falta), W - M, y, { align: 'right' });
      y += 4.5;
    }
  }
  y += 2;
  dashed(y);
  y += 7;

  // ---------- Total ----------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 15, 20);
  doc.text('TOTAL', M, y + 1.5);
  doc.setFontSize(15);
  doc.text(fmtUsd(factura.precio_usd), W - M, y + 2.5, { align: 'right' });
  y += 12;
  dashed(y);
  y += 7;

  // ---------- QR de verificación ----------
  const url = `${window.location.origin}/comprobante/${factura.numero}`;
  const qrDataUrl = await QRCode.toDataURL(url, { margin: 0, width: 300 });
  const qrSize = 28;
  doc.addImage(qrDataUrl, 'PNG', CX - qrSize / 2, y, qrSize, qrSize);
  y += qrSize + 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 100);
  doc.text('Verificá este comprobante escaneando el QR', CX, y, { align: 'center' });
  y += 4;
  doc.setFont('courier', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(150, 150, 160);
  doc.text(url, CX, y, { align: 'center', maxWidth: W - M * 2 });
  y += 7;
  dashed(y);
  y += 6;

  // ---------- Footer legal (texto EXACTO) ----------
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(110, 110, 120);
  const footer = doc.splitTextToSize(
    'Este documento es un comprobante de operación (Factura X). No tiene validez fiscal.',
    W - M * 2
  );
  doc.text(footer, CX, y, { align: 'center' });

  doc.save(`${factura.numero}.pdf`);
}
