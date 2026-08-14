import CrudPage from '@/components/ui-custom/CrudPage';

const fields = [
  { key: 'venta_id', label: 'ID Venta', type: 'number' },
  { key: 'tipo', label: 'Tipo', options: ['A', 'B', 'C'] },
  { key: 'numero', label: 'Número' },
  { key: 'monto_usd', label: 'Monto USD', type: 'number' },
  { key: 'monto_ars', label: 'Monto ARS', type: 'number' },
  { key: 'fecha', label: 'Fecha', type: 'date' },
  { key: 'estado', label: 'Estado', options: ['Emitida', 'Pendiente', 'Anulada'] },
];

export default function Facturas() {
  return <CrudPage title="Facturas" endpoint="/facturas" fields={fields} />;
}
