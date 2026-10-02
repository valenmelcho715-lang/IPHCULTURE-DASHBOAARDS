import CrudPage from '@/components/ui-custom/CrudPage';

const fields = [
  { key: 'nombre', label: 'Nombre' },
  { key: 'telefono', label: 'Teléfono' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'fuente', label: 'Fuente', options: ['Instagram', 'WhatsApp', 'Referido', 'Web', 'Otro'] },
  { key: 'estado', label: 'Estado', options: ['Nuevo', 'Contactado', 'Interesado', 'Cerrado', 'Perdido'] },
  { key: 'closer_asignado_id', label: 'Closer ID', type: 'number' },
  { key: 'notas', label: 'Notas', type: 'textarea' },
];

export default function Leads() {
  return <CrudPage title="Leads" endpoint="/leads" fields={fields} />;
}
