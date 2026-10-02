// ============================================================
// pages/Login.tsx — Frontend_Login_Layout
// Pantalla de login dark neon espectacular (SPEC sección 10).
// Fondo #0a0a0f con glow radial cyan/violet, anillos decorativos
// estilo Apple, card glass centrada con gradiente neon.
// ============================================================
import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Smartphone, Mail, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Input, Label } from '../components/ui';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Ya logueado → directo al dashboard
  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-base-900 px-4">
      {/* ---------- Decoración de fondo: glows radiales ---------- */}
      <div className="pointer-events-none absolute -top-48 -left-48 w-[560px] h-[560px] rounded-full bg-neon/10 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-56 -right-40 w-[620px] h-[620px] rounded-full bg-oficina/10 blur-[160px]" />
      <div className="pointer-events-none absolute top-1/3 left-2/3 w-[320px] h-[320px] rounded-full bg-neon/5 blur-[100px]" />

      {/* ---------- Anillos decorativos estilo Apple ---------- */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full border border-neon/15" />
      <div className="pointer-events-none absolute -top-10 -right-10 w-72 h-72 rounded-full border border-oficina/20" />
      <div className="pointer-events-none absolute top-6 right-6 w-40 h-40 rounded-full border border-neon/25 shadow-glow" />
      <div className="pointer-events-none absolute -bottom-28 -left-28 w-[420px] h-[420px] rounded-full border border-oficina/15" />
      <div className="pointer-events-none absolute -bottom-14 -left-14 w-64 h-64 rounded-full border border-neon/20" />

      {/* ---------- Card de login ---------- */}
      <div className="relative z-10 w-full max-w-md">
        {/* Línea superior con gradiente neon */}
        <div className="h-1 rounded-t-2xl bg-neon-grad" />
        <div className="glass rounded-t-none p-8 shadow-glow-lg">
          {/* Logo */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-neon-grad flex items-center justify-center shadow-glow-lg mb-4">
              <Smartphone className="w-8 h-8 text-base-900" strokeWidth={2.2} />
            </div>
            <h1 className="text-3xl font-extrabold text-neon glow-text tracking-tight">
              iPhone Culture
            </h1>
            <p className="text-sm text-slate-400 mt-1">Panel de ventas — Neuquén</p>
          </div>

          {/* Formulario */}
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label>Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <Input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="tu@iphoneculture.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label>Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <Input
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/40 rounded-xl px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl font-bold text-base-900 bg-neon-grad hover:shadow-glow-lg hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-base-900/30 border-t-base-900 rounded-full animate-spin" />
              )}
              {loading ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
