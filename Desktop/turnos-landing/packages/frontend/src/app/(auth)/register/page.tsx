'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { apiClient } from '@/lib/api';
import type { RegisterDto, AuthResponseDto } from '@/types';

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    company_name: '',
    company_subdomain: '',
    first_name: '',
    last_name: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

  const validatePassword = (password: string) => {
    const errors: string[] = [];
    if (password.length < 8) errors.push('Mínimo 8 caracteres');
    if (!/[A-Z]/.test(password)) errors.push('Debe contener mayúscula');
    if (!/[a-z]/.test(password)) errors.push('Debe contener minúscula');
    if (!/\d/.test(password)) errors.push('Debe contener número');
    return errors;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);

    // Validar contraseña en tiempo real
    if (name === 'password') {
      setPasswordErrors(validatePassword(value));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validaciones del cliente
    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (passwordErrors.length > 0) {
      setError('La contraseña no cumple con los requisitos');
      return;
    }

    if (!formData.company_subdomain.match(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/)) {
      setError('El subdominio solo puede contener letras minúsculas, números y guiones');
      return;
    }

    setLoading(true);

    try {
      const payload: RegisterDto = {
        email: formData.email,
        password: formData.password,
        company_name: formData.company_name,
        company_subdomain: formData.company_subdomain,
        first_name: formData.first_name || undefined,
        last_name: formData.last_name || undefined,
      };

      const response = await apiClient.post<AuthResponseDto>('/auth/register', payload);
      const { token, refreshToken, user, company } = response.data;

      // Guardar en store y localStorage
      setAuth(user, company, token, refreshToken);

      // Redirigir a dashboard
      router.push('/dashboard');
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        'Error al crear la cuenta. Verifica que el email y subdominio no estén en uso.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Crear Cuenta</h1>
        <p className="text-gray-600 mb-6">Comienza a gestionar tus turnos ahora</p>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Correo */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Correo Electrónico
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="tu@email.com"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
            />
          </div>

          {/* Nombre Empresa */}
          <div>
            <label htmlFor="company_name" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre de la Empresa
            </label>
            <input
              type="text"
              id="company_name"
              name="company_name"
              value={formData.company_name}
              onChange={handleChange}
              placeholder="Mi Peluquería"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
            />
          </div>

          {/* Subdominio */}
          <div>
            <label htmlFor="company_subdomain" className="block text-sm font-medium text-gray-700 mb-1">
              Subdominio (ej: mi-peluqueria)
            </label>
            <input
              type="text"
              id="company_subdomain"
              name="company_subdomain"
              value={formData.company_subdomain}
              onChange={handleChange}
              placeholder="mi-peluqueria"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
            />
            <p className="text-xs text-gray-500 mt-1">Se usará como: {formData.company_subdomain}.tuturno.app</p>
          </div>

          {/* Nombre */}
          <div>
            <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-1">
              Nombre (Opcional)
            </label>
            <input
              type="text"
              id="first_name"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              placeholder="Juan"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
            />
          </div>

          {/* Apellido */}
          <div>
            <label htmlFor="last_name" className="block text-sm font-medium text-gray-700 mb-1">
              Apellido (Opcional)
            </label>
            <input
              type="text"
              id="last_name"
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              placeholder="Pérez"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
            />
          </div>

          {/* Contraseña */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
            />
            {passwordErrors.length > 0 && (
              <div className="mt-2 space-y-1">
                {passwordErrors.map((error, idx) => (
                  <p key={idx} className="text-xs text-red-600">
                    • {error}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Confirmar Contraseña */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar Contraseña
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading || passwordErrors.length > 0}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-md transition duration-200"
          >
            {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-center text-gray-600 text-sm">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="text-indigo-600 hover:text-indigo-700 font-semibold">
              Inicia sesión aquí
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
