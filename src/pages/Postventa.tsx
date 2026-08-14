import CrudPage from '@/components/ui-custom/CrudPage';

const fields = [
  { key: 'cliente_id', label: 'ID Cliente', type: 'number' },
  { key: 'producto', label: 'Producto' },
  { key: 'tipo_reclamo', label: 'Tipo', options: ['Garantía', 'Devolución', 'Reparación', 'Consulta'] },
  { key: 'estado', label: 'Estado', options: ['Abierto', 'En Proceso', 'Resuelto', 'Cerrado'] },
  { key: 'descripcion', label: 'Descripción', type: 'textarea' },
  { key: 'resolucion', label: 'Resolución', type: 'textarea' },
];

export default function Postventa() {
  return <CrudPage title="Postventa" endpoint="/postventa" fields={fields} />;
}
