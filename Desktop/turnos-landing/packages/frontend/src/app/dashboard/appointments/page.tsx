'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Appointment {
  id: string;
  client_name: string;
  client_email: string;
  service_name: string;
  start_time: string;
  end_time: string;
  status: string;
  service_price: number;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-gray-100 text-gray-700',
};

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  completed: 'Completado',
  cancelled: 'Cancelado',
  no_show: 'No Asistió',
};

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    fetchAppointments();
  }, [selectedDate]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedDate) params.append('date', selectedDate);
      if (filter) params.append('status', filter);

      const response = await api.get(`/api/appointments?${params}`);
      setAppointments(response.data);
    } catch (err) {
      console.error('Error fetching appointments:', err);
      setError('Error cargando turnos');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      await api.patch(`/api/appointments/${id}`, { status: newStatus });
      fetchAppointments();
    } catch (err) {
      console.error('Error updating appointment:', err);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Cargando turnos...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">Turnos</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 flex gap-4 flex-wrap items-center">
        <div>
          <label className="text-sm font-medium">Fecha:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="ml-2 px-3 py-1 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Estado:</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="ml-2 px-3 py-1 border border-gray-300 rounded-lg"
          >
            <option value="">Todos</option>
            <option value="pending">Pendiente</option>
            <option value="confirmed">Confirmado</option>
            <option value="completed">Completado</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
        <button
          onClick={fetchAppointments}
          className="ml-auto bg-indigo-600 text-white px-4 py-1 rounded-lg hover:bg-indigo-700"
        >
          Actualizar
        </button>
      </div>

      {/* Appointments List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold">
                Cliente
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold">
                Servicio
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold">
                Fecha y Hora
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold">
                Precio
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold">
                Estado
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((apt) => (
              <tr key={apt.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-6 py-3">
                  <div>
                    <p className="font-medium">{apt.client_name}</p>
                    <p className="text-sm text-gray-600">{apt.client_email}</p>
                  </div>
                </td>
                <td className="px-6 py-3">{apt.service_name}</td>
                <td className="px-6 py-3 text-sm">
                  {new Date(apt.start_time).toLocaleDateString('es-AR')}
                  <br />
                  {new Date(apt.start_time).toLocaleTimeString('es-AR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="px-6 py-3 font-semibold">
                  ${apt.service_price.toFixed(2)}
                </td>
                <td className="px-6 py-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      statusColors[apt.status] || 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {statusLabels[apt.status] || apt.status}
                  </span>
                </td>
                <td className="px-6 py-3">
                  <div className="flex gap-2">
                    {apt.status === 'pending' && (
                      <button
                        onClick={() => updateStatus(apt.id, 'confirmed')}
                        className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700"
                      >
                        ✓ Confirmar
                      </button>
                    )}
                    {apt.status !== 'cancelled' && (
                      <button
                        onClick={() => updateStatus(apt.id, 'cancelled')}
                        className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700"
                      >
                        ✕ Cancelar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {appointments.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No hay turnos para esta fecha</p>
        </div>
      )}
    </div>
  );
}
