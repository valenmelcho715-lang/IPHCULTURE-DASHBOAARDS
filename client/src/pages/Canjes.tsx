import CrudPage from '@/components/ui-custom/CrudPage';

const fields = [
  { key: 'cliente_id', label: 'ID Cliente', type: 'number' },
  { key: 'producto_entregado', label: 'Entregado' },
  { key: 'producto_recibido', label: 'Recibido' },
  { key: 'diferencia_usd', label: 'Diferencia USD', type: 'number' },
  { key: 'estado', label: 'Estado', options: ['Pendiente', 'Aprobado', 'Rechazado', 'Completado'] },
  { key: 'notas', label: 'Notas', type: 'textarea' },
];

export default function Canjes() {
  return <CrudPage title="Canjes" endpoint="/canjes" fields={fields} />;
}
