import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Smartphone, Printer, Download, Share2, MapPin, Instagram, Phone, Mail, CheckCircle, Clock, AlertCircle, MessageCircle, FileDown } from 'lucide-react';

export default function FacturaView() {
  const { id } = useParams();
  const [factura, setFactura] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const ticketRef = useRef<HTMLDivElement>(null);

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

  const handleDownloadPNG = async () => {
    if (!ticketRef.current) return;
    const canvas = await html2canvas(ticketRef.current, {
      backgroundColor: '#0a0a0f',
      scale: 2,
      useCORS: true,
    });
    const link = document.createElement('a');
    link.download = `FacturaX-${factura?.numero || 'ticket'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleDownloadPDF = async () => {
    if (!ticketRef.current) return;
    const canvas = await html2canvas(ticketRef.current, {
      backgroundColor: '#0a0a0f',
      scale: 2,
      useCORS: true,
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    const margin = 10;
    const usableWidth = pdfWidth - margin * 2;
    const usableHeight = (canvas.height * usableWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', margin, margin, usableWidth, usableHeight);
    pdf.save(`Comprobante-${factura?.numero || 'ticket'}.pdf`);
  };

  const handleShare = () => {
    const text = `🧾 ${factura?.numero}\n📱 ${factura?.producto}\n👤 ${factura?.cliente_nombre}\n💵 Total: $${factura?.precio_usd} USD\n${factura?.monto_senado ? `Señó: $${factura.monto_senado} USD\nFalta: $${factura.falta_pagar} USD` : 'Pagó completo ✅'}\n\n📲 iPhone Culture`;
    navigator.clipboard.writeText(text);
    alert('Datos copiados al portapapeles');
  };

  const waMessage = factura
    ? encodeURIComponent(
        `🧾 *${factura.numero}*\n📱 ${factura.producto}\n👤 ${factura.cliente_nombre}\n💵 Total: $${factura.precio_usd} USD\n${factura.monto_senado ? `Señó: $${factura.monto_senado} USD\nFalta: $${factura.falta_pagar} USD` : 'Pagó completo ✅'}\n\n📲 iPhone Culture`
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
          <p className="text-gray-400 text-sm">El número de factura no existe o fue eliminado.</p>
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
        {/* Ticket / Comprobante */}
        <div
          ref={ticketRef}
          className="relative rounded-2xl border border-cyan-500/20 bg-[#0d0d14] p-6 overflow-hidden print:bg-white print:text-black print:border-gray-300"
          style={{ boxShadow: '0 0 40px rgba(0,240,255,0.06)' }}
        >
          {/* Neon glow accents */}
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
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">N° Comprobante</p>
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
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">Detalle de la Operación</p>
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
                  <Clock className="w-3.5 h-3.5" /> Seña pagada
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
              <span className="text-cyan-300 font-bold text-sm uppercase tracking-wider">Total operación</span>
              <span className="text-cyan-300 font-extrabold text-xl">${factura.precio_usd}</span>
            </div>
          </div>

          {/* Método de pago y estado */}
          {(factura.metodo_pago || factura.venta_estado) && (
            <div className="grid grid-cols-2 gap-3 mb-5">
              {factura.metodo_pago && (
                <div className="p-3 rounded-xl bg-black/20 border border-cyan-500/5 print:bg-gray-50 print:border-gray-200 text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Método de pago</p>
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

          {/* QR estético */}
          <div className="flex flex-col items-center mb-5">
            <div className="w-28 h-28 rounded-xl bg-white p-2 shadow-lg shadow-cyan-500/10">
              <div className="w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ3aGl0ZSIvPjxyZWN0IHg9IjEwIiB5PSIxMCIgd2lkdGg9IjMwIiBoZWlnaHQ9IjMwIiBmaWxsPSJibGFjayIvPjxyZWN0IHg9IjYwIiB5PSIxMCIgd2lkdGg9IjMwIiBoZWlnaHQ9IjMwIiBmaWxsPSJibGFjayIvPjxyZWN0IHg9IjEwIiB5PSI2MCIgd2lkdGg9IjMwIiBoZWlnaHQ9IjMwIiBmaWxsPSJibGFjayIvPjxyZWN0IHg9IjUwIiB5PSI1MCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSJibGFjayIvPjxyZWN0IHg9IjUwIiB5PSI3MCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSJibGFjayIvPjxyZWN0IHg9IjcwIiB5PSI1MCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSJibGFjayIvPjxyZWN0IHg9IjcwIiB5PSI3MCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSJibGFjayIvPjwvc3ZnPg==')] bg-contain bg-no-repeat bg-center" />
            </div>
            <p className="text-[10px] text-gray-500 mt-2">Escaneá para verificar</p>
          </div>

          {/* Footer contacto */}
          <div className="text-center pt-5 border-t border-cyan-500/10 print:border-gray-200 space-y-1.5">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">iPhone Culture</p>
            <div className="flex items-center justify-center gap-4 text-[11px] text-gray-400 print:text-gray-600">
              <span className="flex items-center gap-1"><Instagram className="w-3 h-3" /> @iphoneculture</span>
              <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> +54 9 299 333-2164</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">Garantía de 1 año en equipos sellados</p>
            <p className="text-[10px] text-gray-600">Este documento es un comprobante de operación (Factura X).</p>
          </div>

          {/* Ticket perforation effect */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-[linear-gradient(90deg,transparent_0%,rgba(0,240,255,0.15)_50%,transparent_100%)]" />
        </div>

        {/* Actions */}
        <div className="flex flex-wrap justify-center gap-3 mt-5 print:hidden">
          <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition-colors text-sm font-medium">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
          <button onClick={handleDownloadPNG} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors text-sm font-medium">
            <Download className="w-4 h-4" /> PNG
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
