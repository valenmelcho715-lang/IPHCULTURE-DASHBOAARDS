import CrudPage from '@/components/ui-custom/CrudPage';

const fields = [
  { key: 'cliente_id', label: 'ID Cliente', type: 'number' },
  { key: 'tipo', label: 'Tipo', options: ['Devolución', 'Garantía', 'Reclamo'] },
  { key: 'motivo', label: 'Motivo', type: 'textarea' },
  { key: 'estado', label: 'Estado', options: ['Abierto', 'En revisión', 'Resuelto', 'Cerrado'] },
  { key: 'monto_reclamado_usd', label: 'Monto USD', type: 'number' },
  { key: 'resolucion', label: 'Resolución', type: 'textarea' },
];

export default function Casos() {
  return <CrudPage title="Casos" endpoint="/casos" fields={fields} />;
}
