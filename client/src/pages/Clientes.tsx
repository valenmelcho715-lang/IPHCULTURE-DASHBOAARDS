import CrudPage from '@/components/ui-custom/CrudPage';

const fields = [
  { key: 'nombre', label: 'Nombre' },
  { key: 'canal_origen', label: 'Canal', options: ['Instagram', 'WhatsApp', 'Otro'] },
  { key: 'cantidad_compras', label: 'Compras', type: 'number' },
  { key: 'cliente_recurrente', label: 'Recurrente', options: ['0', '1'] },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'telefono', label: 'Teléfono' },
  { key: 'total_comprado_usd', label: 'Total USD', type: 'number' },
];

export default function Clientes() {
  return <CrudPage title="Clientes" endpoint="/clientes" fields={fields} />;
}
