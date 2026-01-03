'use client';

import React, { useState } from 'react';
import { useBookingStore } from '@/store/bookingStore';

export function ClientForm() {
  const { updateBookingData, setStep } = useBookingStore();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'El email es requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'El teléfono es requerido';
    } else if (!/^\+?[0-9]{10,}/.test(formData.phone.replace(/\D/g, ''))) {
      newErrors.phone = 'Teléfono inválido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleNext = () => {
    if (validateForm()) {
      updateBookingData({
        clientInfo: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          notes: formData.notes,
        },
      });
      setStep(5);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        ¿Cuáles son tus datos?
      </h2>

      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre completo *
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Tu nombre"
            className={`w-full px-4 py-2 border rounded-lg focus:ring-indigo-500 focus:border-indigo-500 ${
              errors.name ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email *
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="tu@email.com"
            className={`w-full px-4 py-2 border rounded-lg focus:ring-indigo-500 focus:border-indigo-500 ${
              errors.email ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email}</p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Teléfono *
          </label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="+54 9 11 1234-5678"
            className={`w-full px-4 py-2 border rounded-lg focus:ring-indigo-500 focus:border-indigo-500 ${
              errors.phone ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.phone && (
            <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notas (opcional)
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            placeholder="Cuéntanos algo adicional..."
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="flex gap-4 mt-6">
        <button
          onClick={() => setStep(3)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
        >
          ← Anterior
        </button>
        <button
          onClick={handleNext}
          className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"
        >
          Confirmar →
        </button>
      </div>
    </div>
  );
}
