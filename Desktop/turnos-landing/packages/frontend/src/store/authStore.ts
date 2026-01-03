import { create } from 'zustand';
import type { User, Company } from '@/types';

interface AuthStore {
  user: User | null;
  company: Company | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Setters individuales
  setUser: (user: User | null) => void;
  setCompany: (company: Company | null) => void;
  setToken: (token: string | null) => void;
  setRefreshToken: (refreshToken: string | null) => void;

  // Método compuesto para login
  setAuth: (user: User, company: Company, token: string, refreshToken: string) => void;

  // Logout
  logout: () => void;

  // Cargar desde localStorage
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  company: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,

  setUser: (user) => set({ user }),

  setCompany: (company) => set({ company }),

  setToken: (token) => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
    set({ token });
  },

  setRefreshToken: (refreshToken) => {
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    } else {
      localStorage.removeItem('refreshToken');
    }
    set({ refreshToken });
  },

  setAuth: (user, company, token, refreshToken) => {
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
    set({
      user,
      company,
      token,
      refreshToken,
      isAuthenticated: true,
    });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    set({
      user: null,
      company: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  },

  loadFromStorage: () => {
    const token = localStorage.getItem('token');
    const refreshToken = localStorage.getItem('refreshToken');
    if (token) {
      set({
        token,
        refreshToken,
        isAuthenticated: true,
      });
    }
  },
}));
