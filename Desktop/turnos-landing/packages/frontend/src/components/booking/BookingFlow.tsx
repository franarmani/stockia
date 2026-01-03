'use client';

import React, { useState, useEffect } from 'react';
import { ServiceSelector } from './ServiceSelector';
import { EmployeeSelector } from './EmployeeSelector';
import { DatePicker } from './DatePicker';
import { TimeSlotSelector } from './TimeSlotSelector';
import { ClientForm } from './ClientForm';
import { ConfirmationPage } from './ConfirmationPage';
import { useBookingStore } from '@/store/bookingStore';
import { api } from '@/lib/api';

interface BookingFlowProps {
  subdomain: string;
}

export function BookingFlow({ subdomain }: BookingFlowProps) {
  const { currentStep } = useBookingStore();
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/api/public/companies/${subdomain}`);
        setCompany(response.data);
      } catch (err) {
        console.error('Error fetching company:', err);
        setError('No encontramos la empresa. Verifica el link.');
      } finally {
        setLoading(false);
      }
    };

    fetchCompany();
  }, [subdomain]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando información de la empresa...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
        <h2 className="text-xl font-bold mb-2">Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-yellow-700">
        <h2 className="text-xl font-bold mb-2">Empresa no encontrada</h2>
        <p>No pudimos encontrar la empresa solicitada.</p>
      </div>
    );
  }

  // Company header
  const CompanyHeader = () => (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        {company.name}
      </h1>
      <div className="flex flex-col sm:flex-row gap-4 text-gray-600 text-sm">
        {company.phone && (
          <div className="flex items-center gap-2">
            <span>📞</span>
            <a href={`tel:${company.phone}`} className="hover:text-indigo-600">
              {company.phone}
            </a>
          </div>
        )}
        {company.email && (
          <div className="flex items-center gap-2">
            <span>📧</span>
            <a href={`mailto:${company.email}`} className="hover:text-indigo-600">
              {company.email}
            </a>
          </div>
        )}
        {company.address && (
          <div className="flex items-center gap-2">
            <span>📍</span>
            <span>
              {company.address}
              {company.city && `, ${company.city}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  // Progress indicator
  const ProgressIndicator = () => {
    const steps = [
      'Servicio',
      'Profesional',
      'Fecha',
      'Horario',
      'Datos',
      'Confirmar',
    ];

    return (
      <div className="mb-8 px-4">
        <div className="flex items-center justify-between mb-2">
          {steps.map((step, idx) => (
            <div key={idx} className="flex flex-col items-center flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  idx === currentStep
                    ? 'bg-indigo-600 text-white'
                    : idx < currentStep
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                }`}
              >
                {idx < currentStep ? '✓' : idx + 1}
              </div>
              <span className="text-xs text-gray-600 mt-1 text-center">
                {step}
              </span>
            </div>
          ))}
        </div>
        <div className="h-1 bg-gray-200 rounded">
          <div
            className="h-full bg-indigo-600 rounded transition-all"
            style={{ width: `${((currentStep + 1) / 6) * 100}%` }}
          ></div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <CompanyHeader />

      <ProgressIndicator />

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        {currentStep === 0 && <ServiceSelector companyId={company.id} />}
        {currentStep === 1 && <EmployeeSelector companyId={company.id} />}
        {currentStep === 2 && <DatePicker />}
        {currentStep === 3 && <TimeSlotSelector companyId={company.id} />}
        {currentStep === 4 && <ClientForm />}
        {currentStep === 5 && <ConfirmationPage companyId={company.id} />}
      </div>
    </div>
  );
}
