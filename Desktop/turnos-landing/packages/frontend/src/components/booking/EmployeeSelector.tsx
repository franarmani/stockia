'use client';

import React, { useEffect, useState } from 'react';
import { useBookingStore } from '@/store/bookingStore';
import { api } from '@/lib/api';

interface Employee {
  id: string;
  name: string;
  email: string;
}

export function EmployeeSelector({ companyId }: { companyId: string }) {
  const { bookingData, updateBookingData, setStep } = useBookingStore();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/api/public/employees?company_id=${companyId}`);
        setEmployees(response.data);
      } catch (err) {
        console.error('Error fetching employees:', err);
        setError('No se pudieron cargar los profesionales');
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, [companyId]);

  const handleSelectEmployee = (employee: Employee) => {
    updateBookingData({
      employee: {
        id: employee.id,
        name: employee.name,
      },
    });
    setStep(2);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando profesionales...</p>
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

  if (employees.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-700">
        No hay profesionales disponibles
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        ¿Con quién deseas agendar?
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {employees.map((employee) => (
          <button
            key={employee.id}
            onClick={() => handleSelectEmployee(employee)}
            className={`p-4 border-2 rounded-lg text-left transition-all ${
              bookingData.employee?.id === employee.id
                ? 'border-indigo-600 bg-indigo-50'
                : 'border-gray-200 bg-white hover:border-indigo-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                {employee.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  {employee.name}
                </h3>
                <p className="text-sm text-gray-500">{employee.email}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={() => setStep(1)}
        className="mt-6 text-indigo-600 hover:text-indigo-700 font-medium"
      >
        ← Volver al paso anterior
      </button>
    </div>
  );
}
