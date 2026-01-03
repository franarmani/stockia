'use client';

import React, { useState } from 'react';
import { useBookingStore } from '@/store/bookingStore';

export function DatePicker() {
  const { bookingData, updateBookingData, setStep } = useBookingStore();
  const [selectedDate, setSelectedDate] = useState<string>(
    bookingData.date || new Date().toISOString().split('T')[0]
  );

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };

  const handleNext = () => {
    if (selectedDate) {
      updateBookingData({ date: selectedDate });
      setStep(3);
    }
  };

  // Get min date (today)
  const today = new Date().toISOString().split('T')[0];

  // Get max date (30 days from now)
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 30);
  const maxDateStr = maxDate.toISOString().split('T')[0];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        ¿Qué día te conviene?
      </h2>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Selecciona una fecha
        </label>
        <input
          type="date"
          value={selectedDate}
          onChange={handleDateChange}
          min={today}
          max={maxDateStr}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
        />

        <div className="mt-4 p-4 bg-indigo-50 rounded-lg">
          <p className="text-sm text-indigo-700">
            📅 Fecha seleccionada:{' '}
            <span className="font-semibold">
              {new Date(selectedDate).toLocaleDateString('es-AR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </p>
        </div>
      </div>

      <div className="flex gap-4 mt-6">
        <button
          onClick={() => setStep(1)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
        >
          ← Anterior
        </button>
        <button
          onClick={handleNext}
          className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}
