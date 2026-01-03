'use client';

import Link from 'next/link';

export function Hero() {
  return (
    <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left Column - Text */}
          <div>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Gestiona tus turnos <span className="text-indigo-600">sin complicaciones</span>
            </h1>

            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              La plataforma más simple para peluquerías, estéticas, gimnasios y consultorios.
              Calendarios, SMS automáticos, pagos online y reportes en segundos.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Link
                href="/register"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-lg font-bold text-lg transition transform hover:scale-105 text-center"
              >
                Comenzar Gratis (14 días)
              </Link>
              <button
                onClick={() => {
                  const section = document.getElementById('features');
                  section?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 px-8 py-4 rounded-lg font-bold text-lg transition text-center"
              >
                Ver características
              </button>
            </div>

            {/* Trust Signals */}
            <div className="flex flex-col sm:flex-row gap-6 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span className="text-xl">✓</span>
                <span>Sin tarjeta de crédito</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl">✓</span>
                <span>Configuración en 5 minutos</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl">✓</span>
                <span>Soporte 24/7</span>
              </div>
            </div>
          </div>

          {/* Right Column - Image */}
          <div className="hidden md:flex items-center justify-center">
            <div className="bg-gradient-to-br from-indigo-400 to-purple-400 rounded-2xl p-8 shadow-2xl max-w-sm">
              <div className="bg-white rounded-lg p-6 shadow-xl">
                <div className="space-y-4">
                  <div className="h-12 bg-gradient-to-r from-indigo-200 to-purple-200 rounded-lg animate-pulse"></div>
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded-full w-3/4 animate-pulse"></div>
                    <div className="h-3 bg-gray-200 rounded-full w-1/2 animate-pulse"></div>
                  </div>
                  <div className="grid grid-cols-7 gap-1 mt-6">
                    {[...Array(28)].map((_, i) => (
                      <div
                        key={i}
                        className={`aspect-square rounded-lg ${
                          i % 3 === 0 ? 'bg-indigo-300' : 'bg-gray-100'
                        }`}
                      ></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-20 grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="text-4xl font-bold text-indigo-600 mb-2">500+</div>
            <p className="text-gray-600">Empresas activas</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-indigo-600 mb-2">50K+</div>
            <p className="text-gray-600">Turnos agendados</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-indigo-600 mb-2">4.9★</div>
            <p className="text-gray-600">Calificación promedio</p>
          </div>
        </div>
      </div>
    </section>
  );
}
