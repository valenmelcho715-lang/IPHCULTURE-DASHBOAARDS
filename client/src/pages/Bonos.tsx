import CrudPage from '@/components/ui-custom/CrudPage';

const fields = [
  { key: 'closer_id', label: 'ID Closer', type: 'number' },
  { key: 'tipo_bono', label: 'Tipo', options: ['Por Venta', 'Por Meta', 'Extraordinario'] },
  { key: 'monto_usd', label: 'Monto USD', type: 'number' },
  { key: 'descripcion', label: 'Descripción', type: 'textarea' },
  { key: 'fecha', label: 'Fecha', type: 'date' },
  { key: 'pagado', label: 'Pagado', options: ['0', '1'] },
];

export default function Bonos() {
  return <CrudPage title="Bonos" endpoint="/bonos" fields={fields} />;
}
