// ============================================================
// components/ui.tsx — DESIGN SYSTEM COMPARTIDO
// Todos los agentes de frontend DEBEN usar estos primitivos.
// Paleta: bg-base-900, neon #00f0ff, success emerald, admin amber, oficina violet.
// ============================================================
import { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export const cn = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(' ');

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('glass p-5 shadow-glow min-w-0', className)}>{children}</div>;
}

type BtnVariant = 'primary' | 'ghost' | 'danger' | 'success' | 'amber';
const btnStyles: Record<BtnVariant, string> = {
  primary: 'bg-neon/10 text-neon border border-neon/40 hover:bg-neon/20 hover:shadow-glow',
  ghost: 'bg-base-700 text-slate-300 border border-slate-600/30 hover:border-neon/40 hover:text-neon',
  danger: 'bg-red-500/10 text-red-400 border border-red-500/40 hover:bg-red-500/20',
  success: 'bg-success/10 text-success border border-success/40 hover:bg-success/20',
  amber: 'bg-admin/10 text-admin border border-admin/40 hover:bg-admin/20',
};

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
}
export function Button({ variant = 'primary', className, ...props }: BtnProps) {
  return (
    <button
      className={cn(
        'px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed',
        btnStyles[variant],
        className
      )}
      {...props}
    />
  );
}

const fieldCls =
  'w-full bg-base-700 border border-slate-600/30 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-neon/60 focus:shadow-glow transition-all';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldCls, className)} {...props} />;
}
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldCls, className)} {...props}>
      {children}
    </select>
  );
}
export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldCls, className)} rows={3} {...props} />;
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">{children}</label>;
}

type BadgeColor = 'neon' | 'success' | 'amber' | 'violet' | 'red' | 'slate';
const badgeStyles: Record<BadgeColor, string> = {
  neon: 'bg-neon/10 text-neon border-neon/40',
  success: 'bg-success/10 text-success border-success/40',
  amber: 'bg-admin/10 text-admin border-admin/40',
  violet: 'bg-oficina/10 text-oficina border-oficina/40',
  red: 'bg-red-500/10 text-red-400 border-red-500/40',
  slate: 'bg-slate-500/10 text-slate-400 border-slate-500/40',
};
export function Badge({ color = 'slate', children }: { color?: BadgeColor; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border', badgeStyles[color])}>
      {children}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className={cn('glass p-6 w-full shadow-glow-lg max-h-[90vh] overflow-y-auto', wide ? 'max-w-3xl' : 'max-w-lg')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-100">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-neon text-xl leading-none">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Eliminar',
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="text-sm text-slate-300">{message}</div>
      <div className="flex justify-end gap-2 mt-6">
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={loading}>
          {loading ? 'Eliminando…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

export function StatCard({ label, value, hint, accent = 'neon' }: { label: string; value: ReactNode; hint?: string; accent?: 'neon' | 'success' | 'amber' | 'violet' }) {
  const accents = { neon: 'text-neon', success: 'text-success', amber: 'text-admin', violet: 'text-oficina' };
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={cn('text-2xl font-extrabold mt-1', accents[accent])}>{value}</p>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </Card>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-100">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-2 border-neon/30 border-t-neon rounded-full animate-spin" />
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="text-center py-12 text-slate-500 text-sm">{message}</div>;
}
