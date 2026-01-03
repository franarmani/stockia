'use client';

import React, { useEffect, useState } from 'react';
import { useBookingStore } from '@/store/bookingStore';
import { api } from '@/lib/api';

interface Service {
  id: string;
  name: string;
  description?: string;
  duration_minutes: number;
  price: number;
}

export function ServiceSelector({ companyId }: { companyId: string }) {
  const { bookingData, updateBookingData, setStep } = useBookingStore();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/api/public/services?company_id=${companyId}`);
        setServices(response.data);
      } catch (err) {
        console.error('Error fetching services:', err);
        setError('No se pudieron cargar los servicios');
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, [companyId]);

  const handleSelectService = (service: Service) => {
    updateBookingData({
      service: {
        id: service.id,
        name: service.name,
        duration_minutes: service.duration_minutes,
        price: service.price,
      },
    });
    setStep(1);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando servicios...</p>
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

  if (services.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-700">
        No hay servicios disponibles
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        ¿Qué servicio deseas agendar?
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {services.map((service) => (
          <button
            key={service.id}
            onClick={() => handleSelectService(service)}
            className={`p-4 border-2 rounded-lg text-left transition-all ${
              bookingData.service?.id === service.id
                ? 'border-indigo-600 bg-indigo-50'
                : 'border-gray-200 bg-white hover:border-indigo-300'
            }`}
          >
            <h3 className="font-semibold text-gray-900 mb-1">
              {service.name}
            </h3>
            {service.description && (
              <p className="text-sm text-gray-600 mb-3">
                {service.description}
              </p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">
                ⏱️ {service.duration_minutes} min
              </span>
              <span className="font-bold text-indigo-600">
                ${service.price.toFixed(2)}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
