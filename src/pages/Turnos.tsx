import CrudPage from '@/components/ui-custom/CrudPage';

const fields = [
  { key: 'cliente_nombre', label: 'Cliente' },
  { key: 'telefono', label: 'Teléfono' },
  { key: 'fecha_hora', label: 'Fecha/Hora', type: 'datetime-local' },
  { key: 'tipo', label: 'Tipo', options: ['Venta', 'Entrega', 'Canje', 'Consulta'] },
  { key: 'estado', label: 'Estado', options: ['Pendiente', 'Confirmado', 'Completado', 'Cancelado'] },
  { key: 'notas', label: 'Notas', type: 'textarea' },
];

export default function Turnos() {
  return <CrudPage title="Turnos" endpoint="/turnos" fields={fields} />;
}
