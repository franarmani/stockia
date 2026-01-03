'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Service {
  id: string;
  name: string;
  description?: string;
  duration_minutes: number;
  price: number;
  is_active: boolean;
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    duration_minutes: 60,
    price: 0,
    is_active: true,
  });

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/services');
      setServices(response.data);
    } catch (err) {
      console.error('Error fetching services:', err);
      setError('Error cargando servicios');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.patch(`/api/services/${editingId}`, formData);
      } else {
        await api.post('/api/services', formData);
      }
      setFormData({
        name: '',
        description: '',
        duration_minutes: 60,
        price: 0,
        is_active: true,
      });
      setEditingId(null);
      setShowForm(false);
      fetchServices();
    } catch (err) {
      console.error('Error saving service:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro?')) {
      try {
        await api.delete(`/api/services/${id}`);
        fetchServices();
      } catch (err) {
        console.error('Error deleting service:', err);
      }
    }
  };

  const handleEdit = (service: Service) => {
    setFormData({
      name: service.name,
      description: service.description || '',
      duration_minutes: service.duration_minutes,
      price: service.price,
      is_active: service.is_active,
    });
    setEditingId(service.id);
    setShowForm(true);
  };

  if (loading) {
    return <div className="text-center py-12">Cargando servicios...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Servicios</h2>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setFormData({
              name: '',
              description: '',
              duration_minutes: 60,
              price: 0,
              is_active: true,
            });
          }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
        >
          + Nuevo Servicio
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-xl font-bold mb-4">
            {editingId ? 'Editar Servicio' : 'Nuevo Servicio'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nombre *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Descripción
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Duración (minutos) *
                </label>
                <input
                  type="number"
                  value={formData.duration_minutes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      duration_minutes: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Precio *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      price: parseFloat(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
                className="h-4 w-4 rounded"
              />
              <label htmlFor="is_active" className="ml-2 text-sm">
                Activo
              </label>
            </div>
            <div className="flex gap-4">
              <button
                type="submit"
                className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Services List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {services.map((service) => (
          <div
            key={service.id}
            className="bg-white border border-gray-200 rounded-lg p-6"
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-bold">{service.name}</h3>
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${
                  service.is_active
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {service.is_active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            {service.description && (
              <p className="text-sm text-gray-600 mb-3">{service.description}</p>
            )}
            <div className="flex justify-between text-sm mb-4">
              <span>⏱️ {service.duration_minutes} min</span>
              <span className="font-bold text-indigo-600">
                ${service.price.toFixed(2)}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(service)}
                className="flex-1 bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
              >
                ✏️ Editar
              </button>
              <button
                onClick={() => handleDelete(service.id)}
                className="flex-1 bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
              >
                🗑️ Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      {services.length === 0 && !showForm && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No hay servicios. ¡Crea uno nuevo!</p>
        </div>
      )}
    </div>
  );
}
