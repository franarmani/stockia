'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/employees');
      setEmployees(response.data);
    } catch (err) {
      console.error('Error fetching employees:', err);
      setError('Error cargando empleados');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.patch(`/api/employees/${editingId}`, formData);
      } else {
        await api.post('/api/employees', formData);
      }
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
      });
      setEditingId(null);
      setShowForm(false);
      fetchEmployees();
    } catch (err) {
      console.error('Error saving employee:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro?')) {
      try {
        await api.delete(`/api/employees/${id}`);
        fetchEmployees();
      } catch (err) {
        console.error('Error deleting employee:', err);
      }
    }
  };

  const handleEdit = (employee: Employee) => {
    setFormData({
      first_name: employee.first_name,
      last_name: employee.last_name,
      email: employee.email,
      phone: employee.phone || '',
    });
    setEditingId(employee.id);
    setShowForm(true);
  };

  if (loading) {
    return <div className="text-center py-12">Cargando empleados...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Empleados</h2>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setFormData({
              first_name: '',
              last_name: '',
              email: '',
              phone: '',
            });
          }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
        >
          + Nuevo Empleado
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
            {editingId ? 'Editar Empleado' : 'Nuevo Empleado'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) =>
                    setFormData({ ...formData, first_name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Apellido *
                </label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) =>
                    setFormData({ ...formData, last_name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Teléfono
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
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

      {/* Employees Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold">
                Nombre
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold">
                Email
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold">
                Teléfono
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                      {employee.first_name.charAt(0)}
                    </div>
                    <span className="font-medium">
                      {employee.first_name} {employee.last_name}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-3 text-sm text-gray-600">
                  {employee.email}
                </td>
                <td className="px-6 py-3 text-sm text-gray-600">
                  {employee.phone || '-'}
                </td>
                <td className="px-6 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(employee)}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(employee.id)}
                      className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {employees.length === 0 && !showForm && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No hay empleados. ¡Agrega uno nuevo!</p>
        </div>
      )}
    </div>
  );
}
