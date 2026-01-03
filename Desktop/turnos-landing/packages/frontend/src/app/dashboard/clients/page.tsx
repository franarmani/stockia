'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Client {
  id?: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  count: number;
  last_appointment: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/appointments');
      
      // Agrupar clientes por email
      const clientMap = new Map<string, Client>();
      
      response.data.forEach((apt: any) => {
        const key = apt.client_email;
        if (!clientMap.has(key)) {
          clientMap.set(key, {
            client_name: apt.client_name,
            client_email: apt.client_email,
            client_phone: apt.client_phone,
            count: 0,
            last_appointment: apt.start_time,
          });
        }
        const client = clientMap.get(key)!;
        client.count++;
        if (new Date(apt.start_time) > new Date(client.last_appointment)) {
          client.last_appointment = apt.start_time;
        }
      });
      
      setClients(Array.from(clientMap.values()).sort((a, b) => b.count - a.count));
    } catch (err) {
      console.error('Error fetching clients:', err);
      setError('Error cargando clientes');
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(
    (client) =>
      client.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.client_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="text-center py-12">Cargando clientes...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Clientes</h2>
        <div className="text-right">
          <p className="text-2xl font-bold text-indigo-600">{clients.length}</p>
          <p className="text-sm text-gray-600">clientes totales</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <input
          type="text"
          placeholder="Buscar por nombre o email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg"
        />
      </div>

      {/* Clients Table */}
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
                Turnos
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold">
                Último Turno
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.map((client, idx) => (
              <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-6 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold">
                      {client.client_name.charAt(0)}
                    </div>
                    <span className="font-medium">{client.client_name}</span>
                  </div>
                </td>
                <td className="px-6 py-3 text-sm text-gray-600">
                  <a
                    href={`mailto:${client.client_email}`}
                    className="text-indigo-600 hover:underline"
                  >
                    {client.client_email}
                  </a>
                </td>
                <td className="px-6 py-3 text-sm text-gray-600">
                  {client.client_phone}
                </td>
                <td className="px-6 py-3">
                  <span className="inline-block bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium">
                    {client.count}
                  </span>
                </td>
                <td className="px-6 py-3 text-sm">
                  {new Date(client.last_appointment).toLocaleDateString(
                    'es-AR'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredClients.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">
            {searchTerm
              ? 'No se encontraron clientes'
              : 'No hay clientes todavía'}
          </p>
        </div>
      )}
    </div>
  );
}
