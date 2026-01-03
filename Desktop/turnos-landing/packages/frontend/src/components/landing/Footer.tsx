'use client';

import Link from 'next/link';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-gray-300 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 font-bold text-2xl text-white mb-4">
              <span>🎯</span>
              <span>Tuturno</span>
            </div>
            <p className="text-gray-400 mb-4">
              La plataforma más simple para gestionar turnos online.
            </p>
            <div className="flex gap-4">
              <a href="#" className="hover:text-white transition">
                Facebook
              </a>
              <a href="#" className="hover:text-white transition">
                Instagram
              </a>
              <a href="#" className="hover:text-white transition">
                Twitter
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-bold text-white mb-4">Producto</h4>
            <ul className="space-y-2">
              <li>
                <Link href="#features" className="text-gray-400 hover:text-white transition">
                  Características
                </Link>
              </li>
              <li>
                <Link href="#pricing" className="text-gray-400 hover:text-white transition">
                  Precios
                </Link>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition">
                  Seguridad
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition">
                  Roadmap
                </a>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-bold text-white mb-4">Empresa</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition">
                  Blog
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition">
                  Contacto
                </a>
              </li>
              <li>
                <a href="/terms" className="text-gray-400 hover:text-white transition">
                  Términos
                </a>
              </li>
              <li>
                <a href="/privacy" className="text-gray-400 hover:text-white transition">
                  Privacidad
                </a>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-bold text-white mb-4">Soporte</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition">
                  Centro de ayuda
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition">
                  Documentación
                </a>
              </li>
              <li>
                <a href="mailto:hola@tuturno.app" className="text-gray-400 hover:text-white transition">
                  Email
                </a>
              </li>
              <li>
                <a href="#" className="text-gray-400 hover:text-white transition">
                  Status
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-400 text-sm">
            © {currentYear} Tuturno. Todos los derechos reservados.
          </p>
          <div className="flex gap-6 mt-4 md:mt-0 text-sm">
            <a href="/terms" className="text-gray-400 hover:text-white transition">
              Términos de Servicio
            </a>
            <a href="/privacy" className="text-gray-400 hover:text-white transition">
              Política de Privacidad
            </a>
            <a href="#" className="text-gray-400 hover:text-white transition">
              Preferencias de cookies
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
