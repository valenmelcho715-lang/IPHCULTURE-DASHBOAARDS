// ============================================================
// lib/auth.tsx — CONTRATO COMPARTIDO (solo el orquestador lo modifica)
// Contexto de autenticación. Uso:
//   const { user, login, logout, loading } = useAuth();
//   user.rol: 'admin' | 'oficina' | 'closer'
// ============================================================
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, getToken, setToken } from './api';

export interface User {
  id: number;
  nombre: string;
  email: string;
  rol: 'admin' | 'oficina' | 'closer';
  telefono?: string;
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<User>('/api/auth/me');
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>('/api/auth/login', { email, password });
    setToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    location.href = '/login';
  };

  return <Ctx.Provider value={{ user, loading, login, logout, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  return useContext(Ctx);
}
