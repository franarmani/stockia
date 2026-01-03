'use client';

import React from 'react';
import Link from 'next/link';

export default function BookingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { subdomain: string };
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-indigo-600">
            🎯 Tuturno
          </Link>
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
            ← Volver
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-sm text-gray-600">
          <p>© 2025 Tuturno. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
