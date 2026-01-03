'use client';

import Link from 'next/link';
import { useState } from 'react';

export function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed w-full bg-white shadow-sm z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-2xl text-indigo-600">
            <span>🎯</span>
            <span>Tuturno</span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex gap-8">
            <Link href="#features" className="text-gray-700 hover:text-indigo-600 transition">
              Características
            </Link>
            <Link href="#pricing" className="text-gray-700 hover:text-indigo-600 transition">
              Precios
            </Link>
            <Link href="#faq" className="text-gray-700 hover:text-indigo-600 transition">
              FAQ
            </Link>
            <a href="mailto:hola@tuturno.app" className="text-gray-700 hover:text-indigo-600 transition">
              Contacto
            </a>
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex gap-4 items-center">
            <Link href="/login" className="text-gray-700 hover:text-indigo-600 font-medium transition">
              Iniciar Sesión
            </Link>
            <Link
              href="/register"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition"
            >
              Probar Gratis
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 border-t">
            <Link href="#features" className="block py-2 text-gray-700 hover:text-indigo-600">
              Características
            </Link>
            <Link href="#pricing" className="block py-2 text-gray-700 hover:text-indigo-600">
              Precios
            </Link>
            <Link href="#faq" className="block py-2 text-gray-700 hover:text-indigo-600">
              FAQ
            </Link>
            <Link href="/login" className="block py-2 text-gray-700 hover:text-indigo-600">
              Iniciar Sesión
            </Link>
            <Link
              href="/register"
              className="block mt-4 bg-indigo-600 text-white px-6 py-2 rounded-lg text-center font-medium"
            >
              Probar Gratis
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
