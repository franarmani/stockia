'use client';

import React, { useState } from 'react';
import { useBookingStore } from '@/store/bookingStore';
import { api } from '@/lib/api';

interface ConfirmationProps {
  companyId: string;
}

export function ConfirmationPage({ companyId }: ConfirmationProps) {
  const { bookingData, resetBooking } = useBookingStore();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirmBooking = async () => {
    if (
      !bookingData.service ||
      !bookingData.employee ||
      !bookingData.time ||
      !bookingData.clientInfo
    ) {
      setError('Faltan datos del turno');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/api/public/appointments', {
        service_id: bookingData.service.id,
        employee_id: bookingData.employee.id,
        start_time: bookingData.time,
        client_name: bookingData.clientInfo.name,
        client_email: bookingData.clientInfo.email,
        client_phone: bookingData.clientInfo.phone,
        notes: bookingData.clientInfo.notes,
      });

      if (response.status === 201) {
        setSuccess(true);
      }
    } catch (err: any) {
      console.error('Error creating appointment:', err);
      setError(
        err.response?.data?.message ||
          'Error al crear el turno. Intenta nuevamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-green-900 mb-2">
            ¡Turno Confirmado!
          </h2>
          <p className="text-green-700 mb-6">
            Tu turno ha sido agendado exitosamente.
          </p>

          <div className="bg-white border border-green-200 rounded-lg p-6 mb-6 text-left space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Servicio:</span>
              <span className="font-semibold text-gray-900">
                {bookingData.service?.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Profesional:</span>
              <span className="font-semibold text-gray-900">
                {bookingData.employee?.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Fecha:</span>
              <span className="font-semibold text-gray-900">
                {new Date(bookingData.time || '').toLocaleDateString('es-AR', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Hora:</span>
              <span className="font-semibold text-gray-900">
                {new Date(bookingData.time || '').toLocaleTimeString('es-AR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Precio:</span>
              <span className="font-semibold text-green-600">
                ${bookingData.service?.price.toFixed(2)}
              </span>
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-6">
            Se ha enviado una confirmación a:{' '}
            <span className="font-semibold">{bookingData.clientInfo?.email}</span>
          </p>

          <button
            onClick={() => {
              resetBooking();
              window.location.href = '/';
            }}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        Resumen de tu turno
      </h2>

      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4 mb-6">
        <div className="flex justify-between py-3 border-b border-gray-200">
          <span className="text-gray-600">Servicio:</span>
          <span className="font-semibold text-gray-900">
            {bookingData.service?.name}
          </span>
        </div>
        <div className="flex justify-between py-3 border-b border-gray-200">
          <span className="text-gray-600">Profesional:</span>
          <span className="font-semibold text-gray-900">
            {bookingData.employee?.name}
          </span>
        </div>
        <div className="flex justify-between py-3 border-b border-gray-200">
          <span className="text-gray-600">Duración:</span>
          <span className="font-semibold text-gray-900">
            {bookingData.service?.duration_minutes} minutos
          </span>
        </div>
        <div className="flex justify-between py-3 border-b border-gray-200">
          <span className="text-gray-600">Fecha y hora:</span>
          <span className="font-semibold text-gray-900">
            {new Date(bookingData.time || '').toLocaleDateString('es-AR')} -{' '}
            {new Date(bookingData.time || '').toLocaleTimeString('es-AR', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
        <div className="flex justify-between py-3">
          <span className="text-gray-600">Cliente:</span>
          <span className="font-semibold text-gray-900">
            {bookingData.clientInfo?.name}
          </span>
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
        <p className="text-indigo-700">
          <strong>Precio total:</strong> ${' '}
          <span className="text-lg">
            {bookingData.service?.price.toFixed(2)}
          </span>
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-4">
        <button
          onClick={() => window.history.back()}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
          disabled={loading}
        >
          ← Editar datos
        </button>
        <button
          onClick={handleConfirmBooking}
          disabled={loading}
          className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Confirmando...' : 'Confirmar turno'}
        </button>
      </div>
    </div>
  );
}
