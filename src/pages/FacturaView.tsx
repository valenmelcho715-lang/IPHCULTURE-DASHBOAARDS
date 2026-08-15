import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import { Smartphone, Printer, Download, Share2, Instagram, Phone, CheckCircle, Clock, AlertCircle, MessageCircle, FileDown, FileText } from 'lucide-react';

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
    const m = 18;
    const cw = w - m * 2;
    let y = m;

    const fecha = new Date(factura.created_at || factura.fecha).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    // Header box
    doc.setFillColor(250, 250, 250);
    doc.rect(m, y, cw, 28, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(m, y, cw, 28, 'S');

    doc.setFontSize(18);
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.text('iPhone Culture', m + 4, y + 10);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(cleanStr('Venta de iPhones y Android Importados'), m + 4, y + 16);
    doc.text('Tel: +54 9 299 333-2164 | IG: @iphoneculture', m + 4, y + 21);

    // Comprobante X badge
    doc.setFillColor(30, 30, 30);
    doc.rect(w - m - 44, y + 5, 40, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('COMPROBANTE X', w - m - 42, y + 11.5);

    y += 34;

    // Factura info box
    doc.setFillColor(250, 250, 250);
    doc.rect(m, y, cw, 18, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(m, y, cw, 18, 'S');

    doc.setTextColor(80, 80, 80);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('N COMPROBANTE', m + 4, y + 6);
    doc.text('FECHA Y HORA', w - m - 54, y + 6);

    doc.setTextColor(30, 30, 30);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(cleanStr(factura.numero || ''), m + 4, y + 13);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(cleanStr(fecha), w - m - 54, y + 13);

    y += 24;

    // Cliente
    doc.setFillColor(250, 250, 250);
    doc.rect(m, y, cw, 16, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(m, y, cw, 16, 'S');

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('CLIENTE', m + 4, y + 6);
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.text(cleanStr(factura.cliente_nombre || ''), m + 4, y + 12);
    if (factura.cliente_dni) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`DNI: ${factura.cliente_dni}`, m + 4, y + 16);
    }

    y += 22;

    // Producto / Detalle
    doc.setFillColor(250, 250, 250);
    doc.rect(m, y, cw, 22, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(m, y, cw, 22, 'S');

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text('PRODUCTO', m + 4, y + 6);

    doc.setFontSize(12);
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.text(cleanStr(factura.producto || ''), m + 4, y + 13);

    if (factura.es_canje === 1) {
      doc.setFillColor(230, 126, 34);
      doc.rect(m + 4, y + 15, 18, 5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.text('CANJE', m + 6, y + 18.5);
    }

    doc.setFontSize(14);
    doc.setTextColor(39, 174, 96);
    doc.setFont('helvetica', 'bold');
    const precioTxt = `$${factura.precio_usd} USD`;
    const precioW = doc.getTextWidth(precioTxt);
    doc.text(precioTxt, w - m - 4 - precioW, y + 13);

    y += 28;

    // Tabla de pagos
    const rows: any[] = [];
    rows.push(['Precio del equipo', `$${factura.precio_usd} USD`]);
    if (factura.monto_senado > 0) {
      rows.push(['Senia pagada', `-$${factura.monto_senado} USD`]);
    }
    if (factura.falta_pagar > 0) {
      rows.push(['Falta pagar', `$${factura.falta_pagar} USD`]);
    }
    if (!factura.monto_senado && !factura.falta_pagar) {
      rows.push(['Estado', 'Pago completo']);
    }

    // Dibujar tabla manualmente
    const rowH = 8;
    doc.setFillColor(250, 250, 250);
    doc.rect(m, y, cw, rows.length * rowH + 12, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(m, y, cw, rows.length * rowH + 12, 'S');

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'bold');
    doc.text('CONCEPTO', m + 4, y + 6);
    doc.text('IMPORTE', w - m - 40, y + 6);

    let ry = y + 10;
    rows.forEach((r, i) => {
      if (i > 0) {
        doc.setDrawColor(230, 230, 230);
        doc.line(m + 2, ry - 1, w - m - 2, ry - 1);
      }
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'normal');
      doc.text(cleanStr(r[0]), m + 4, ry + 4);
      doc.setFont('helvetica', 'bold');
      const tw = doc.getTextWidth(r[1]);
      doc.text(r[1], w - m - 4 - tw, ry + 4);
      ry += rowH;
    });

    y = ry + 4;

    // Total
    doc.setFillColor(30, 30, 30);
    doc.rect(m, y, cw, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL OPERACION', m + 4, y + 8);
    const totalTxt = `$${factura.precio_usd} USD`;
    const totalW = doc.getTextWidth(totalTxt);
    doc.text(totalTxt, w - m - 4 - totalW, y + 8);

    y += 18;

    // Metodo de pago y estado
    if (factura.metodo_pago || factura.venta_estado) {
      const half = (cw - 4) / 2;
      if (factura.metodo_pago) {
        doc.setFillColor(250, 250, 250);
        doc.rect(m, y, half, 14, 'F');
        doc.setDrawColor(200, 200, 200);
        doc.rect(m, y, half, 14, 'S');
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 120);
        doc.text('METODO DE PAGO', m + 4, y + 5);
        doc.setFontSize(9);
        doc.setTextColor(30, 30, 30);
        doc.text(cleanStr(factura.metodo_pago), m + 4, y + 10);
      }
      if (factura.venta_estado) {
        doc.setFillColor(250, 250, 250);
        doc.rect(m + half + 4, y, half, 14, 'F');
        doc.setDrawColor(200, 200, 200);
        doc.rect(m + half + 4, y, half, 14, 'S');
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 120);
        doc.text('ESTADO', m + half + 8, y + 5);
        doc.setFontSize(9);
        doc.setTextColor(30, 30, 30);
        doc.text(cleanStr(factura.venta_estado), m + half + 8, y + 10);
      }
      y += 20;
    }

    // Notas
    if (factura.notas) {
      doc.setFillColor(250, 250, 250);
      doc.rect(m, y, cw, 14, 'F');
      doc.setDrawColor(200, 200, 200);
      doc.rect(m, y, cw, 14, 'S');
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text('NOTAS', m + 4, y + 5);
      doc.setFontSize(8);
      doc.setTextColor(60, 60, 60);
      doc.text(cleanStr(factura.notas), m + 4, y + 10);
      y += 18;
    }

    // QR
    doc.setFillColor(250, 250, 250);
    doc.rect(m, y, cw, 40, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(m, y, cw, 40, 'S');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('CODIGO DE VERIFICACION', m + 4, y + 6);
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(cleanStr(factura.numero || ''), m + 4, y + 12);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('Escanea para verificar la autenticidad de este comprobante', m + 4, y + 17);
    // QR simulado
    doc.setFillColor(30, 30, 30);
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        if ((i + j) % 3 !== 0) {
          doc.rect(m + cw - 30 + i * 4, y + 6 + j * 4, 3.5, 3.5, 'F');
        }
      }
    }

    y += 46;

    // Footer
    doc.setDrawColor(200, 200, 200);
    doc.line(m, y, w - m, y);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'normal');
    doc.text('Garantia de 1 ano en equipos sellados.', m, y + 6);
    doc.text('Este documento es un comprobante de operacion (Factura X).', m, y + 10);
    doc.text('No tiene validez fiscal.', m, y + 14);
    doc.setFontSize(7);
    doc.text('iPhone Culture | @iphoneculture | +54 9 299 333-2164', m, y + 20);

    doc.save(`Comprobante-${factura.numero}.pdf`);
  };

  const handleShare = () => {
    const text = `Comprobante: ${factura?.numero}\nProducto: ${factura?.producto}\nCliente: ${factura?.cliente_nombre}\nTotal: $${factura?.precio_usd} USD\n${factura?.monto_senado ? `Seno: $${factura.monto_senado} USD | Falta: $${factura.falta_pagar} USD` : 'Pago completo'}\n\niPhone Culture`;
    navigator.clipboard.writeText(text);
    alert('Datos copiados al portapapeles');
  };

  const waMessage = factura
    ? encodeURIComponent(
        `*${factura.numero}*\n${factura.producto}\n${factura.cliente_nombre}\nTotal: $${factura.precio_usd} USD\n${factura.monto_senado ? `Seno: $${factura.monto_senado} USD\nFalta: $${factura.falta_pagar} USD` : 'Pago completo'}\n\niPhone Culture`
      )
    : '';
  const waLink = `https://wa.me/?text=${waMessage}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0f]">
        <div className="text-cyan-400 animate-pulse text-lg">Cargando comprobante...</div>
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
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <div className="min-h-screen bg-[#0a0a0f] py-6 px-4 print:bg-white print:py-0">
      <div className="max-w-md mx-auto">
        {/* Ticket / Comprobante Visual */}
        <div className="relative rounded-2xl border border-cyan-500/20 bg-[#0d0d14] p-6 overflow-hidden print:bg-white print:text-black print:border-gray-300"
          style={{ boxShadow: '0 0 40px rgba(0,240,255,0.06)' }}>

          <div className="absolute -top-10 -right-10 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="text-center mb-6 relative">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 mb-3">
              <Smartphone className="w-8 h-8 text-cyan-400" style={{ filter: 'drop-shadow(0 0 8px rgba(0,240,255,0.6))' }} />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              <span className="bg-clip-text text-transparent bg-[linear-gradient(90deg,#00f0ff,#a855f7)]">
                iPhone Culture
              </span>
            </h1>
            <p className="text-gray-400 text-xs mt-1 print:text-gray-600">Venta de iPhones y Android Importados</p>
            <div className="mt-2 inline-block px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20">
              <span className="text-[10px] font-bold text-cyan-400 tracking-widest uppercase">Comprobante X</span>
            </div>
          </div>

          {/* Factura info */}
          <div className="flex justify-between items-center mb-5 p-3 rounded-xl bg-black/30 border border-cyan-500/10 print:bg-gray-50 print:border-gray-200">
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">N Comprobante</p>
              <p className="text-lg font-bold text-cyan-400 print:text-black">{factura.numero}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Fecha y Hora</p>
              <p className="text-sm text-gray-300 print:text-black font-medium">{fecha}</p>
            </div>
          </div>

          {/* Cliente */}
          <div className="mb-5">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">Datos del Cliente</p>
            <div className="p-3 rounded-xl bg-black/20 border border-cyan-500/5 print:bg-gray-50 print:border-gray-200">
              <p className="text-base font-semibold text-white print:text-black">{factura.cliente_nombre}</p>
              {factura.cliente_dni && (
                <p className="text-sm text-gray-400 print:text-gray-600 mt-0.5">DNI: {factura.cliente_dni}</p>
              )}
            </div>
          </div>

          {/* Producto */}
          <div className="mb-5">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">Detalle de la Operacion</p>
            <div className="p-4 rounded-xl bg-black/30 border border-cyan-500/10 print:bg-gray-50 print:border-gray-200">
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1">
                  <p className="text-sm text-gray-400 print:text-gray-600 uppercase tracking-wider mb-1">Producto</p>
                  <p className="text-lg font-bold text-white print:text-black leading-tight">{factura.producto}</p>
                  {factura.es_canje === 1 && (
                    <span className="inline-block mt-2 px-2.5 py-0.5 rounded-md bg-orange-500/15 text-orange-400 text-[10px] font-bold uppercase tracking-wider border border-orange-500/20">
                      Canje
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400 print:text-gray-600 uppercase tracking-wider mb-1">Precio</p>
                  <p className="text-2xl font-extrabold text-emerald-400 print:text-black">${factura.precio_usd}</p>
                  <p className="text-[10px] text-gray-500">USD</p>
                </div>
              </div>
            </div>
          </div>

          {/* Estado de pago */}
          <div className="mb-5 space-y-2">
            <div className="flex justify-between items-center py-2.5 border-b border-cyan-500/5 print:border-gray-200">
              <span className="text-gray-400 text-sm print:text-gray-600">Precio del equipo</span>
              <span className="text-white text-sm font-medium print:text-black">${factura.precio_usd}</span>
            </div>
            {factura.monto_senado > 0 && (
              <div className="flex justify-between items-center py-2.5 border-b border-cyan-500/5 print:border-gray-200">
                <span className="text-amber-400 text-sm flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Senia pagada
                </span>
                <span className="text-amber-400 text-sm font-bold">-${factura.monto_senado}</span>
              </div>
            )}
            {factura.falta_pagar > 0 && (
              <div className="flex justify-between items-center py-2.5 border-b border-cyan-500/5 print:border-gray-200">
                <span className="text-red-400 text-sm flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> Falta pagar
                </span>
                <span className="text-red-400 text-sm font-bold">${factura.falta_pagar}</span>
              </div>
            )}
            {pagadoCompleto && (
              <div className="flex justify-between items-center py-2.5 border-b border-cyan-500/5 print:border-gray-200">
                <span className="text-emerald-400 text-sm flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" /> Pago completo
                </span>
                <span className="text-emerald-400 text-sm font-bold">Pagado</span>
              </div>
            )}
            <div className="flex justify-between items-center py-3">
              <span className="text-cyan-300 font-bold text-sm uppercase tracking-wider">Total operacion</span>
              <span className="text-cyan-300 font-extrabold text-xl">${factura.precio_usd}</span>
            </div>
          </div>

          {/* Metodo de pago y estado */}
          {(factura.metodo_pago || factura.venta_estado) && (
            <div className="grid grid-cols-2 gap-3 mb-5">
              {factura.metodo_pago && (
                <div className="p-3 rounded-xl bg-black/20 border border-cyan-500/5 print:bg-gray-50 print:border-gray-200 text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Metodo de pago</p>
                  <p className="text-sm font-medium text-white print:text-black mt-1">{factura.metodo_pago}</p>
                </div>
              )}
              {factura.venta_estado && (
                <div className="p-3 rounded-xl bg-black/20 border border-cyan-500/5 print:bg-gray-50 print:border-gray-200 text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Estado</p>
                  <p className="text-sm font-medium text-white print:text-black mt-1">{factura.venta_estado}</p>
                </div>
              )}
            </div>
          )}

          {/* QR estetico */}
          <div className="flex flex-col items-center mb-5">
            <div className="w-28 h-28 rounded-xl bg-white p-2 shadow-lg shadow-cyan-500/10">
              <div className="w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ3aGl0ZSIvPjxyZWN0IHg9IjEwIiB5PSIxMCIgd2lkdGg9IjMwIiBoZWlnaHQ9IjMwIiBmaWxsPSJibGFjayIvPjxyZWN0IHg9IjYwIiB5PSIxMCIgd2lkdGg9IjMwIiBoZWlnaHQ9IjMwIiBmaWxsPSJibGFjayIvPjxyZWN0IHg9IjEwIiB5PSI2MCIgd2lkdGg9IjMwIiBoZWlnaHQ9IjMwIiBmaWxsPSJibGFjayIvPjxyZWN0IHg9IjUwIiB5PSI1MCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSJibGFjayIvPjxyZWN0IHg9IjUwIiB5PSI3MCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSJibGFjayIvPjxyZWN0IHg9IjcwIiB5PSI1MCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSJibGFjayIvPjxyZWN0IHg9IjcwIiB5PSI3MCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSJibGFjayIvPjwvc3ZnPg==')] bg-contain bg-no-repeat bg-center" />
            </div>
            <p className="text-[10px] text-gray-500 mt-2">Escanea para verificar</p>
          </div>

          {/* Footer contacto */}
          <div className="text-center pt-5 border-t border-cyan-500/10 print:border-gray-200 space-y-1.5">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">iPhone Culture</p>
            <div className="flex items-center justify-center gap-4 text-[11px] text-gray-400 print:text-gray-600">
              <span className="flex items-center gap-1"><Instagram className="w-3 h-3" /> @iphoneculture</span>
              <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> +54 9 299 333-2164</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">Garantia de 1 ano en equipos sellados</p>
            <p className="text-[10px] text-gray-600">Este documento es un comprobante de operacion (Factura X).</p>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-1 bg-[linear-gradient(90deg,transparent_0%,rgba(0,240,255,0.15)_50%,transparent_100%)]" />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap justify-center gap-3 mt-5 print:hidden">
          <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition-colors text-sm font-medium">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
          <button onClick={handleDownloadPDF} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition-colors text-sm font-medium">
            <FileDown className="w-4 h-4" /> PDF
          </button>
          <a href={waLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 transition-colors text-sm font-medium">
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </a>
          <button onClick={handleShare} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-400 hover:bg-fuchsia-500/20 transition-colors text-sm font-medium">
            <Share2 className="w-4 h-4" /> Copiar
          </button>
        </div>
      </div>
    </div>
  );
}
