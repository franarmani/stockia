'use client';

import React, { useEffect, useState } from 'react';
import { useBookingStore } from '@/store/bookingStore';
import { api } from '@/lib/api';

interface TimeSlot {
  start: string;
  end: string;
  label: string;
}

interface TimeSlotSelectorProps {
  companyId: string;
}

export function TimeSlotSelector({ companyId }: TimeSlotSelectorProps) {
  const { bookingData, updateBookingData, setStep } = useBookingStore();
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSlots = async () => {
      if (!bookingData.date || !bookingData.employee?.id || !bookingData.service?.id) {
        setError('Faltan datos necesarios');
        return;
      }

      try {
        setLoading(true);
        const response = await api.get('/api/public/availability', {
          params: {
            date: bookingData.date,
            employee_id: bookingData.employee.id,
            service_id: bookingData.service.id,
          },
        });
        setSlots(response.data);
      } catch (err) {
        console.error('Error fetching availability:', err);
        setError('No se pudieron cargar los horarios disponibles');
      } finally {
        setLoading(false);
      }
    };

    fetchSlots();
  }, [bookingData.date, bookingData.employee?.id, bookingData.service?.id]);

  const handleSelectSlot = (slot: TimeSlot) => {
    updateBookingData({ time: slot.start });
    setStep(4);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando horarios disponibles...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error}
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="space-y-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-700">
          No hay horarios disponibles para esta fecha. Intenta con otra fecha.
        </div>
        <button
          onClick={() => setStep(2)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
        >
          ← Cambiar fecha
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        ¿Qué horario prefieres?
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {slots.map((slot, idx) => (
          <button
            key={idx}
            onClick={() => handleSelectSlot(slot)}
            className={`p-3 border-2 rounded-lg font-medium transition-all ${
              bookingData.time === slot.start
                ? 'border-indigo-600 bg-indigo-50 text-indigo-600'
                : 'border-gray-200 bg-white text-gray-900 hover:border-indigo-300'
            }`}
          >
            {slot.label}
          </button>
        ))}
      </div>

      <button
        onClick={() => setStep(2)}
        className="mt-6 text-indigo-600 hover:text-indigo-700 font-medium"
      >
        ← Volver al paso anterior
      </button>
    </div>
  );
}
