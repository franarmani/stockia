'use client';

import React, { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';

export default function SettingsPage() {
  const { user, company } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    company_name: company?.name || '',
    company_phone: company?.phone || '',
    company_email: company?.email || '',
    company_address: company?.address || '',
    company_city: company?.city || '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);
      
      // TODO: Implementar endpoint PATCH para actualizar empresa
      // await api.patch('/api/companies/profile', formData);
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Error updating settings:', err);
      setError('Error al guardar los cambios');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Configuración</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700">
          ✓ Cambios guardados correctamente
        </div>
      )}

      {/* Company Info Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-xl font-bold mb-4">Información de la Empresa</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Nombre de la Empresa
            </label>
            <input
              type="text"
              name="company_name"
              value={formData.company_name}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Teléfono</label>
              <input
                type="tel"
                name="company_phone"
                value={formData.company_phone}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                name="company_email"
                value={formData.company_email}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Dirección</label>
            <input
              type="text"
              name="company_address"
              value={formData.company_address}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Ciudad</label>
            <input
              type="text"
              name="company_city"
              value={formData.company_city}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>
      </div>

      {/* Public Link Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-xl font-bold mb-4">Link Público de Reservas</h3>
        
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">
            Comparte este link con tus clientes para que agenden turnos:
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={`https://tuturno.app/book/${company?.subdomain}`}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  `https://tuturno.app/book/${company?.subdomain}`
                );
                alert('¡Link copiado!');
              }}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
            >
              📋 Copiar
            </button>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-700">
              💡 Tip: Comparte este link en tus redes sociales, WhatsApp, email y
              sitio web para que los clientes puedan agendar directamente.
            </p>
          </div>
        </div>
      </div>

      {/* Account Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-xl font-bold mb-4">Tu Cuenta</h3>
        
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600">Email</p>
            <p className="font-medium">{user?.email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Nombre</p>
            <p className="font-medium">
              {user?.first_name} {user?.last_name}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Rol</p>
            <p className="font-medium">
              {user?.role === 'admin' ? 'Administrador' : user?.role}
            </p>
          </div>
        </div>
      </div>

      {/* Plan Info */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-6">
        <h3 className="text-xl font-bold mb-4">Tu Plan</h3>
        
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600">Plan actual:</span>
            <span className="font-bold">Professional</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Período de prueba:</span>
            <span className="font-bold">14 días restantes</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Precio:</span>
            <span className="font-bold">$29/mes</span>
          </div>
          <hr className="my-3" />
          <button className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
            Gestionar Suscripción
          </button>
        </div>
      </div>

      {/* Help */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-xl font-bold mb-4">Necesitas Ayuda?</h3>
        
        <div className="space-y-2">
          <a
            href="#"
            className="block text-indigo-600 hover:underline font-medium"
          >
            📚 Centro de ayuda
          </a>
          <a
            href="#"
            className="block text-indigo-600 hover:underline font-medium"
          >
            💬 Chat con soporte
          </a>
          <a
            href="#"
            className="block text-indigo-600 hover:underline font-medium"
          >
            📧 Enviar email a soporte
          </a>
        </div>
      </div>
    </div>
  );
}
