'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { logout, user } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = async () => {
    logout();
    router.push('/login');
  };

  const menuItems = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: '📊',
    },
    {
      label: 'Turnos',
      href: '/dashboard/appointments',
      icon: '📅',
    },
    {
      label: 'Servicios',
      href: '/dashboard/services',
      icon: '✨',
    },
    {
      label: 'Empleados',
      href: '/dashboard/employees',
      icon: '👥',
    },
    {
      label: 'Clientes',
      href: '/dashboard/clients',
      icon: '👤',
    },
    {
      label: 'Configuración',
      href: '/dashboard/settings',
      icon: '⚙️',
    },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-indigo-600 text-white transition-all duration-300 flex flex-col`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-indigo-500">
          <div className="flex items-center justify-between">
            {sidebarOpen && <h1 className="text-xl font-bold">🎯 Tuturno</h1>}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-indigo-700 rounded-lg transition-colors"
            >
              {sidebarOpen ? '◀' : '▶'}
            </button>
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-4 py-3 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium group"
            >
              <span className="text-lg">{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-indigo-500 space-y-3">
          {sidebarOpen && (
            <div className="px-3 py-2 bg-indigo-700 rounded-lg">
              <p className="text-xs opacity-75">Conectado como</p>
              <p className="text-sm font-semibold truncate">
                {user?.first_name} {user?.last_name}
              </p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 bg-indigo-700 hover:bg-indigo-800 rounded-lg transition-colors text-sm font-medium"
          >
            {sidebarOpen ? '🚪 Salir' : '🚪'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              Panel de Administración
            </h2>
            <div className="text-sm text-gray-600">
              {new Date().toLocaleDateString('es-AR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
