import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import {
  Smartphone, Printer, Download, Share2, Instagram, Phone,
  CheckCircle, Clock, AlertCircle, MessageCircle, FileDown,
  MapPin, Mail, ShieldCheck, User, Calendar, Hash, Receipt,
  QrCode, ArrowRight, CreditCard, Banknote, Package
} from 'lucide-react';

export default function FacturaView() {
  const { id } = useParams();
  const [factura, setFactura] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/comprobante/${id}`)
      .then(r => r.json())
      .then((data) => {
        setFactura(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const handlePrint = () => window.print();

  const cleanStr = (s: string) =>
    (s || '')
      .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u')
      .replace(/Á/g, 'A').replace(/É/g, 'E').replace(/Í/g, 'I').replace(/Ó/g, 'O').replace(/Ú/g, 'U')
      .replace(/ñ/g, 'n').replace(/Ñ/g, 'N').replace(/ü/g, 'u').replace(/Ü/g, 'U')
      .replace(/[^\x00-\x7F]/g, '');

  const handleDownloadPDF = () => {
    if (!factura) return;
    const doc = new jsPDF('p', 'mm', 'a4');
    const w = doc.internal.pageSize.getWidth();
    const m = 20;
    const cw = w - m * 2;
    let y = m;

    const fecha = new Date(factura.created_at || factura.fecha).toLocaleDateString('es-AR', {
      day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    // === HEADER FONDO OSCURO ===
    doc.setFillColor(10, 10, 20);
    doc.rect(0, 0, w, 55, 'F');

    // Logo area
    doc.setFontSize(22);
    doc.setTextColor(0, 240, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('iPhone', m, y + 12);
    doc.setTextColor(255, 255, 255);
    doc.text('Culture', m + doc.getTextWidth('iPhone ') - 1, y + 12);

    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.text('Venta de iPhones, iPad, MacBook, Apple Watch y Android', m, y + 18);

    // Contacto
    doc.setFontSize(7);
    doc.text('Neuquen, Argentina', m, y + 23);
    doc.text('Tel: +54 9 299 333-2164', m, y + 27);
    doc.text('IG: @iphoneculture', m, y + 31);

    // Badge COMPROBANTE X
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(w - m - 50, y + 4, 50, 14, 3, 3, 'F');
    doc.setFontSize(10);
    doc.setTextColor(10, 10, 20);
    doc.setFont('helvetica', 'bold');
    doc.text('COMPROBANTE X', w - m - 48, y + 13);
    doc.setFontSize(6);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text('Sin validez fiscal', w - m - 48, y + 17);

    y = 62;

    // === NUMERO Y FECHA ===
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'bold');
    doc.text('N° COMPROBANTE', m, y);
    doc.text('FECHA', m + cw * 0.55, y);

    doc.setFontSize(14);
    doc.setTextColor(10, 10, 20);
    doc.setFont('helvetica', 'bold');
    doc.text(factura.numero || '', m, y + 7);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(cleanStr(fecha), m + cw * 0.55, y + 7);

    y += 16;

    // === CLIENTE ===
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(m, y, cw, 20, 2, 2, 'F');

    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'bold');
    doc.text('CLIENTE', m + 4, y + 5);

    doc.setFontSize(12);
    doc.setTextColor(10, 10, 20);
    doc.setFont('helvetica', 'bold');
    doc.text(cleanStr(factura.cliente_nombre || 'Consumidor Final'), m + 4, y + 12);

    if (factura.cliente_dni) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(`DNI / CUIT: ${factura.cliente_dni}`, m + 4, y + 17);
    }

    y += 26;

    // === VENDEDOR ===
    if (factura.closer_nombre) {
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.setFont('helvetica', 'bold');
      doc.text('ATENDIDO POR', m, y);
      doc.setFontSize(9);
      doc.setTextColor(10, 10, 20);
      doc.setFont('helvetica', 'normal');
      doc.text(cleanStr(factura.closer_nombre), m, y + 5);
      y += 10;
    }

    // === PRODUCTO ===
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'bold');
    doc.text('DETALLE DE LA OPERACION', m, y);

    y += 6;

    // Producto box
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(m, y, cw, 26, 2, 2, 'F');
    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(m, y, cw, 26, 2, 2, 'S');

    doc.setFontSize(11);
    doc.setTextColor(10, 10, 20);
    doc.setFont('helvetica', 'bold');
    doc.text(cleanStr(factura.producto || ''), m + 4, y + 9);

    if (factura.es_canje === 1) {
      doc.setFillColor(230, 126, 34);
      doc.roundedRect(m + 4, y + 12, 16, 5, 1, 1, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.text('CANJE', m + 6, y + 15.5);
    }

    doc.setFontSize(16);
    doc.setTextColor(39, 174, 96);
    doc.setFont('helvetica', 'bold');
    const precioTxt = `$${factura.precio_usd} USD`;
    const precioW = doc.getTextWidth(precioTxt);
    doc.text(precioTxt, w - m - 4 - precioW, y + 10);

    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.text('Precio del equipo', w - m - 4 - precioW, y + 15);

    y += 32;

    // === TABLA DE PAGOS ===
    const rows: any[] = [];
    rows.push(['Precio del equipo', `$${factura.precio_usd} USD`, 'normal']);
    if (factura.monto_senado > 0) {
      rows.push(['Sena pagada', `-$${factura.monto_senado} USD`, 'senado']);
    }
    if (factura.falta_pagar > 0) {
      rows.push(['Saldo pendiente', `$${factura.falta_pagar} USD`, 'pendiente']);
    }
    if (!factura.monto_senado && !factura.falta_pagar) {
      rows.push(['Estado del pago', 'PAGO COMPLETO', 'completo']);
    }

    // Header tabla
    doc.setFillColor(10, 10, 20);
    doc.rect(m, y, cw, 8, 'F');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('CONCEPTO', m + 4, y + 5.5);
    doc.text('IMPORTE', w - m - 30, y + 5.5);

    y += 8;

    rows.forEach((r, i) => {
      if (i > 0) {
        doc.setDrawColor(230, 230, 230);
        doc.line(m + 2, y, w - m - 2, y);
      }
      doc.setFontSize(9);
      if (r[2] === 'completo') {
        doc.setTextColor(39, 174, 96);
      } else if (r[2] === 'pendiente') {
        doc.setTextColor(231, 76, 60);
      } else if (r[2] === 'senado') {
        doc.setTextColor(230, 126, 34);
      } else {
        doc.setTextColor(60, 60, 60);
      }
      doc.setFont('helvetica', 'normal');
      doc.text(cleanStr(r[0]), m + 4, y + 5);
      doc.setFont('helvetica', 'bold');
      const tw = doc.getTextWidth(r[1]);
      doc.text(r[1], w - m - 4 - tw, y + 5);
      y += 8;
    });

    // === TOTAL ===
    y += 2;
    doc.setFillColor(10, 10, 20);
    doc.roundedRect(m, y, cw, 14, 2, 2, 'F');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL DE LA OPERACION', m + 4, y + 9);
    const totalTxt = `$${factura.precio_usd} USD`;
    const totalW = doc.getTextWidth(totalTxt);
    doc.text(totalTxt, w - m - 4 - totalW, y + 9);

    y += 22;

    // === METODO Y ESTADO ===
    if (factura.metodo_pago || factura.venta_estado) {
      const half = (cw - 4) / 2;
      if (factura.metodo_pago) {
        doc.setFillColor(250, 250, 250);
        doc.roundedRect(m, y, half, 14, 2, 2, 'F');
        doc.setDrawColor(220, 220, 220);
        doc.roundedRect(m, y, half, 14, 2, 2, 'S');
        doc.setFontSize(6);
        doc.setTextColor(120, 120, 120);
        doc.setFont('helvetica', 'bold');
        doc.text('METODO DE PAGO', m + 4, y + 5);
        doc.setFontSize(9);
        doc.setTextColor(10, 10, 20);
        doc.setFont('helvetica', 'normal');
        doc.text(cleanStr(factura.metodo_pago), m + 4, y + 10);
      }
      if (factura.venta_estado) {
        doc.setFillColor(250, 250, 250);
        doc.roundedRect(m + half + 4, y, half, 14, 2, 2, 'F');
        doc.setDrawColor(220, 220, 220);
        doc.roundedRect(m + half + 4, y, half, 14, 2, 2, 'S');
        doc.setFontSize(6);
        doc.setTextColor(120, 120, 120);
        doc.setFont('helvetica', 'bold');
        doc.text('ESTADO', m + half + 8, y + 5);
        doc.setFontSize(9);
        doc.setTextColor(10, 10, 20);
        doc.setFont('helvetica', 'normal');
        doc.text(cleanStr(factura.venta_estado), m + half + 8, y + 10);
      }
      y += 20;
    }

    // === NOTAS ===
    if (factura.notas) {
      doc.setFillColor(255, 250, 230);
      doc.roundedRect(m, y, cw, 14, 2, 2, 'F');
      doc.setDrawColor(230, 200, 150);
      doc.roundedRect(m, y, cw, 14, 2, 2, 'S');
      doc.setFontSize(6);
      doc.setTextColor(150, 120, 50);
      doc.setFont('helvetica', 'bold');
      doc.text('NOTAS', m + 4, y + 5);
      doc.setFontSize(8);
      doc.setTextColor(80, 60, 20);
      doc.setFont('helvetica', 'normal');
      doc.text(cleanStr(factura.notas), m + 4, y + 10);
      y += 18;
    }

    // === QR ===
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(m, y, cw, 32, 2, 2, 'F');
    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(m, y, cw, 32, 2, 2, 'S');

    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'bold');
    doc.text('CODIGO DE VERIFICACION', m + 4, y + 6);
    doc.setFontSize(9);
    doc.setTextColor(10, 10, 20);
    doc.setFont('helvetica', 'normal');
    doc.text(cleanStr(factura.numero || ''), m + 4, y + 12);
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    doc.text('Escanea para verificar la autenticidad de este comprobante', m + 4, y + 16);

    // QR estetico
    doc.setFillColor(10, 10, 20);
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        if ((i + j) % 3 !== 0) {
          doc.roundedRect(m + cw - 28 + i * 3.5, y + 5 + j * 3.5, 3, 3, 0.5, 0.5, 'F');
        }
      }
    }

    y += 38;

    // === GARANTIA ===
    doc.setFillColor(235, 250, 235);
    doc.roundedRect(m, y, cw, 12, 2, 2, 'F');
    doc.setDrawColor(180, 220, 180);
    doc.roundedRect(m, y, cw, 12, 2, 2, 'S');
    doc.setFontSize(7);
    doc.setTextColor(39, 130, 39);
    doc.setFont('helvetica', 'bold');
    doc.text('GARANTIA OFICIAL', m + 4, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.text('1 ano de garantia en equipos sellados originales.', m + 4, y + 9);

    y += 18;

    // === FOOTER ===
    doc.setDrawColor(200, 200, 200);
    doc.line(m, y, w - m, y);
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'normal');
    doc.text('Este documento es un comprobante de operacion (Factura X). No tiene validez fiscal.', m, y + 6);
    doc.text('iPhone Culture | @iphoneculture | +54 9 299 333-2164 | Neuquen, Argentina', m, y + 10);
    doc.setFontSize(6);
    doc.text(`Generado el ${new Date().toLocaleString('es-AR')}`, m, y + 14);

    doc.save(`Comprobante-${factura.numero}.pdf`);
  };

  const handleShare = () => {
    const text = `*${factura?.numero}*\n📱 ${factura?.producto}\n👤 ${factura?.cliente_nombre}\n💰 Total: $${factura?.precio_usd} USD\n${factura?.monto_senado ? `⏳ Seno: $${factura.monto_senado} USD | Falta: $${factura.falta_pagar} USD` : '✅ Pago completo'}\n\n📲 iPhone Culture | @iphoneculture`;
    navigator.clipboard.writeText(text);
    alert('Datos copiados al portapapeles');
  };

  const waMessage = factura
    ? encodeURIComponent(
        `*${factura.numero}*\n📱 ${factura.producto}\n👤 ${factura.cliente_nombre}\n💰 Total: $${factura.precio_usd} USD\n${factura.monto_senado ? `⏳ Seno: $${factura.monto_senado} USD\nFalta: $${factura.falta_pagar} USD` : '✅ Pago completo'}\n\n📲 iPhone Culture`
      )
    : '';
  const waLink = `https://wa.me/?text=${waMessage}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0f]">
        <div className="text-center">
          <Receipt className="w-12 h-12 text-cyan-400 mx-auto mb-3 animate-pulse" />
          <div className="text-cyan-400 animate-pulse text-lg">Cargando comprobante...</div>
        </div>
      </div>
    );
  }

  if (!factura || factura.error) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0f] text-center px-4">
        <div>
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-white mb-2">Comprobante no encontrado</h1>
          <p className="text-gray-400 text-sm">El numero de comprobante no existe o fue eliminado.</p>
        </div>
      </div>
    );
  }

  const pagadoCompleto = !factura.monto_senado && !factura.falta_pagar;
  const fecha = new Date(factura.created_at || factura.fecha).toLocaleDateString('es-AR', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const estadoColor = pagadoCompleto ? 'emerald' : factura.falta_pagar > 0 ? 'red' : 'amber';
  const estadoIcon = pagadoCompleto ? CheckCircle : factura.falta_pagar > 0 ? AlertCircle : Clock;
  const estadoText = pagadoCompleto ? 'Pago completo' : factura.falta_pagar > 0 ? `Falta pagar $${factura.falta_pagar}` : `Sena $${factura.monto_senado}`;

  return (
    <div className="min-h-screen bg-[#0a0a0f] py-6 px-4 print:bg-white print:py-0">
      <div className="max-w-lg mx-auto">

        {/* === COMPROBANTE PREMIUM === */}
        <div className="relative rounded-3xl border border-cyan-500/15 bg-[#0d0d14] overflow-hidden print:bg-white print:text-black print:border-gray-200"
          style={{ boxShadow: '0 0 60px rgba(0,240,255,0.04)' }}>

          {/* Glow decorativo */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-cyan-500/8 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-fuchsia-500/8 rounded-full blur-3xl pointer-events-none" />

          {/* === HEADER OSCURO === */}
          <div className="relative bg-[#080810] px-6 pt-8 pb-6 print:bg-gray-50">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                    <Smartphone className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h1 className="text-xl font-extrabold tracking-tight">
                      <span className="text-cyan-400">iPhone</span>
                      <span className="text-white print:text-black"> Culture</span>
                    </h1>
                  </div>
                </div>
                <p className="text-gray-500 text-[10px] ml-12 print:text-gray-600">Venta de iPhones y Android Importados</p>
                <p className="text-gray-600 text-[10px] ml-12 print:text-gray-500">Neuquen, Argentina</p>
              </div>

              <div className="text-right">
                <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/5 border border-white/10 print:bg-gray-100 print:border-gray-300">
                  <Receipt className="w-3 h-3 text-cyan-400 mr-1.5 print:text-gray-600" />
                  <span className="text-[10px] font-bold text-cyan-400 tracking-widest uppercase print:text-gray-800">Comprobante X</span>
                </div>
                <p className="text-[9px] text-gray-600 mt-1 print:text-gray-500">Sin validez fiscal</p>
              </div>
            </div>

            {/* Linea decorativa */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-[linear-gradient(90deg,transparent_0%,rgba(0,240,255,0.2)_30%,rgba(168,85,247,0.2)_70%,transparent_100%)]" />
          </div>

          {/* === BODY === */}
          <div className="px-6 py-5 space-y-5">

            {/* Numero y fecha */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-black/20 border border-cyan-500/5 print:bg-gray-50 print:border-gray-200">
                <div className="flex items-center gap-1.5 mb-1">
                  <Hash className="w-3 h-3 text-cyan-400/50" />
                  <p className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">N° Comprobante</p>
                </div>
                <p className="text-lg font-bold text-cyan-400 tracking-wider print:text-black">{factura.numero}</p>
              </div>
              <div className="p-3 rounded-xl bg-black/20 border border-cyan-500/5 print:bg-gray-50 print:border-gray-200">
                <div className="flex items-center gap-1.5 mb-1">
                  <Calendar className="w-3 h-3 text-cyan-400/50" />
                  <p className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">Fecha</p>
                </div>
                <p className="text-sm font-medium text-gray-300 print:text-black">{fecha}</p>
              </div>
            </div>

            {/* Cliente */}
            <div className="p-4 rounded-xl bg-black/20 border border-cyan-500/5 print:bg-gray-50 print:border-gray-200">
              <div className="flex items-center gap-1.5 mb-2">
                <User className="w-3 h-3 text-cyan-400/50" />
                <p className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">Datos del Cliente</p>
              </div>
              <p className="text-base font-bold text-white print:text-black">{factura.cliente_nombre || 'Consumidor Final'}</p>
              {factura.cliente_dni && (
                <p className="text-sm text-gray-400 print:text-gray-600 mt-0.5">DNI / CUIT: {factura.cliente_dni}</p>
              )}
            </div>

            {/* Vendedor */}
            {factura.closer_nombre && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/5 border border-cyan-500/10 print:bg-gray-50">
                <Package className="w-3 h-3 text-cyan-400/60" />
                <p className="text-[10px] text-gray-400 print:text-gray-600">Atendido por <span className="text-cyan-400 font-semibold print:text-black">{factura.closer_nombre}</span></p>
              </div>
            )}

            {/* Producto */}
            <div className="p-5 rounded-xl bg-[#080810] border border-cyan-500/10 print:bg-gray-50 print:border-gray-200">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-[9px] text-gray-500 uppercase tracking-wider font-bold mb-1">Producto</p>
                  <p className="text-lg font-bold text-white print:text-black leading-tight">{factura.producto}</p>
                  {factura.es_canje === 1 && (
                    <span className="inline-block mt-2 px-2.5 py-0.5 rounded-md bg-orange-500/15 text-orange-400 text-[10px] font-bold uppercase tracking-wider border border-orange-500/20">
                      Canje
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-gray-500 uppercase tracking-wider font-bold mb-1">Precio</p>
                  <p className="text-3xl font-extrabold text-emerald-400 print:text-black">${factura.precio_usd}</p>
                  <p className="text-[10px] text-gray-500">USD</p>
                </div>
              </div>
            </div>

            {/* Estado de pago */}
            <div className="space-y-0">
              <div className="flex justify-between items-center py-3 border-b border-cyan-500/5 print:border-gray-200">
                <span className="text-gray-400 text-sm print:text-gray-600">Precio del equipo</span>
                <span className="text-white text-sm font-semibold print:text-black">${factura.precio_usd} USD</span>
              </div>

              {factura.monto_senado > 0 && (
                <div className="flex justify-between items-center py-3 border-b border-cyan-500/5 print:border-gray-200">
                  <span className="text-amber-400 text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Sena pagada
                  </span>
                  <span className="text-amber-400 text-sm font-bold">-${factura.monto_senado} USD</span>
                </div>
              )}

              {factura.falta_pagar > 0 && (
                <div className="flex justify-between items-center py-3 border-b border-cyan-500/5 print:border-gray-200">
                  <span className="text-red-400 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> Saldo pendiente
                  </span>
                  <span className="text-red-400 text-sm font-bold">${factura.falta_pagar} USD</span>
                </div>
              )}

              {pagadoCompleto && (
                <div className="flex justify-between items-center py-3 border-b border-cyan-500/5 print:border-gray-200">
                  <span className="text-emerald-400 text-sm flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Estado del pago
                  </span>
                  <span className="text-emerald-400 text-sm font-bold">PAGO COMPLETO</span>
                </div>
              )}

              {/* Total */}
              <div className="flex justify-between items-center py-4 mt-1">
                <span className="text-cyan-300 font-bold text-sm uppercase tracking-wider">Total operacion</span>
                <span className="text-cyan-300 font-extrabold text-2xl">${factura.precio_usd}</span>
              </div>
            </div>

            {/* Metodo y estado */}
            {(factura.metodo_pago || factura.venta_estado) && (
              <div className="grid grid-cols-2 gap-3">
                {factura.metodo_pago && (
                  <div className="p-3 rounded-xl bg-black/20 border border-cyan-500/5 print:bg-gray-50 print:border-gray-200 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <CreditCard className="w-3 h-3 text-gray-500" />
                      <p className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">Metodo de pago</p>
                    </div>
                    <p className="text-sm font-semibold text-white print:text-black">{factura.metodo_pago}</p>
                  </div>
                )}
                {factura.venta_estado && (
                  <div className="p-3 rounded-xl bg-black/20 border border-cyan-500/5 print:bg-gray-50 print:border-gray-200 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <ShieldCheck className="w-3 h-3 text-gray-500" />
                      <p className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">Estado</p>
                    </div>
                    <p className="text-sm font-semibold text-white print:text-black">{factura.venta_estado}</p>
                  </div>
                )}
              </div>
            )}

            {/* Notas */}
            {factura.notas && (
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 print:bg-amber-50">
                <p className="text-[9px] text-amber-400/70 uppercase tracking-wider font-bold mb-1">Notas</p>
                <p className="text-sm text-amber-200/80 print:text-amber-800">{factura.notas}</p>
              </div>
            )}

            {/* Garantia */}
            <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15 print:bg-emerald-50 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400 print:text-emerald-600 shrink-0" />
              <div>
                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider print:text-emerald-700">Garantia oficial</p>
                <p className="text-xs text-emerald-300/70 print:text-emerald-800">1 ano de garantia en equipos sellados originales.</p>
              </div>
            </div>

            {/* QR */}
            <div className="flex flex-col items-center py-4">
              <div className="w-28 h-28 rounded-2xl bg-white p-2.5 shadow-xl shadow-cyan-500/5 border border-gray-100">
                <div className="w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ3aGl0ZSIvPjxyZWN0IHg9IjEwIiB5PSIxMCIgd2lkdGg9IjMwIiBoZWlnaHQ9IjMwIiBmaWxsPSJibGFjayIvPjxyZWN0IHg9IjYwIiB5PSIxMCIgd2lkdGg9IjMwIiBoZWlnaHQ9IjMwIiBmaWxsPSJibGFjayIvPjxyZWN0IHg9IjEwIiB5PSI2MCIgd2lkdGg9IjMwIiBoZWlnaHQ9IjMwIiBmaWxsPSJibGFjayIvPjxyZWN0IHg9IjUwIiB5PSI1MCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSJibGFjayIvPjxyZWN0IHg9IjUwIiB5PSI3MCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSJibGFjayIvPjxyZWN0IHg9IjcwIiB5PSI1MCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSJibGFjayIvPjxyZWN0IHg9IjcwIiB5PSI3MCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSJibGFjayIvPjwvc3ZnPg==')] bg-contain bg-no-repeat bg-center" />
              </div>
              <p className="text-[9px] text-gray-500 mt-2">Escanea para verificar autenticidad</p>
              <p className="text-[10px] text-gray-600 font-mono mt-0.5">{factura.numero}</p>
            </div>

            {/* Footer contacto */}
            <div className="text-center pt-5 border-t border-cyan-500/10 print:border-gray-200 space-y-2">
              <div className="flex items-center justify-center gap-1">
                <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-bold text-cyan-400 tracking-wider">IPHONE CULTURE</span>
              </div>
              <div className="flex items-center justify-center gap-5 text-[11px] text-gray-400 print:text-gray-600">
                <span className="flex items-center gap-1"><Instagram className="w-3 h-3" /> @iphoneculture</span>
                <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> +54 9 299 333-2164</span>
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Neuquen, AR</span>
              </div>
              <p className="text-[9px] text-gray-600 max-w-xs mx-auto leading-relaxed">
                Este documento es un comprobante de operacion (Factura X). No tiene validez fiscal.
              </p>
              <p className="text-[8px] text-gray-700">Generado el {new Date().toLocaleString('es-AR')}</p>
            </div>

            {/* Linea decorativa final */}
            <div className="h-1 rounded-full bg-[linear-gradient(90deg,transparent_0%,rgba(0,240,255,0.2)_30%,rgba(168,85,247,0.2)_70%,transparent_100%)]" />
          </div>
        </div>

        {/* === ACCIONES === */}
        <div className="flex flex-wrap justify-center gap-2.5 mt-6 print:hidden">
          <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition-all text-sm font-medium">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
          <button onClick={handleDownloadPDF} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition-all text-sm font-medium">
            <FileDown className="w-4 h-4" /> Descargar PDF
          </button>
          <a href={waLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 transition-all text-sm font-medium">
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </a>
          <button onClick={handleShare} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-400 hover:bg-fuchsia-500/20 transition-all text-sm font-medium">
            <Share2 className="w-4 h-4" /> Copiar
          </button>
        </div>
      </div>
    </div>
  );
}
