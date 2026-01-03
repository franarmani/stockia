'use client';

import Link from 'next/link';

export function Pricing() {
  const plans = [
    {
      name: 'Starter',
      price: 'Gratis',
      period: 'Siempre',
      description: 'Perfecto para pequeños negocios',
      features: [
        '✓ Hasta 5 servicios',
        '✓ 1 profesional',
        '✓ Página de reservas pública',
        '✓ SMS de recordatorio',
        '✓ Email de confirmación',
        '✗ Pagos online',
        '✗ Reportes avanzados',
      ],
      cta: 'Comenzar ahora',
      highlight: false,
    },
    {
      name: 'Professional',
      price: '$29',
      period: '/mes',
      description: 'Para negocios en crecimiento',
      features: [
        '✓ Servicios ilimitados',
        '✓ Hasta 5 profesionales',
        '✓ Página de reservas pública',
        '✓ SMS + WhatsApp',
        '✓ Email de confirmación',
        '✓ Pagos online (MercadoPago)',
        '✓ Reportes básicos',
      ],
      cta: 'Probar gratis',
      highlight: true,
    },
    {
      name: 'Enterprise',
      price: '$99',
      period: '/mes',
      description: 'Para negocios grandes',
      features: [
        '✓ Servicios ilimitados',
        '✓ Profesionales ilimitados',
        '✓ Página de reservas pública',
        '✓ SMS + WhatsApp + Push',
        '✓ Email de confirmación',
        '✓ Pagos online (Stripe + MP)',
        '✓ Reportes avanzados + API',
      ],
      cta: 'Consultar',
      highlight: false,
    },
  ];

  return (
    <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Planes simples y transparentes
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Sin sorpresas. Sin contratos. Cancela cuando quieras.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan, idx) => (
            <div
              key={idx}
              className={`rounded-2xl p-8 transition-all ${
                plan.highlight
                  ? 'bg-indigo-600 text-white shadow-2xl transform md:scale-105'
                  : 'bg-white border-2 border-gray-200 shadow-sm'
              }`}
            >
              {plan.highlight && (
                <div className="inline-block bg-yellow-400 text-gray-900 px-3 py-1 rounded-full text-sm font-bold mb-4">
                  Más popular
                </div>
              )}

              <h3 className={`text-2xl font-bold mb-2 ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>
                {plan.name}
              </h3>

              <p className={`mb-6 ${plan.highlight ? 'text-indigo-100' : 'text-gray-600'}`}>
                {plan.description}
              </p>

              <div className="mb-6">
                <span className={`text-4xl font-bold ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>
                  {plan.price}
                </span>
                <span className={`text-sm ${plan.highlight ? 'text-indigo-100' : 'text-gray-600'}`}>
                  {plan.period}
                </span>
              </div>

              <Link
                href="/register"
                className={`block text-center py-3 px-6 rounded-lg font-bold transition mb-8 ${
                  plan.highlight
                    ? 'bg-white text-indigo-600 hover:bg-gray-100'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {plan.cta}
              </Link>

              <div className="space-y-3">
                {plan.features.map((feature, fidx) => (
                  <div
                    key={fidx}
                    className={`text-sm ${
                      plan.highlight ? 'text-indigo-100' : 'text-gray-600'
                    }`}
                  >
                    {feature.startsWith('✓') ? (
                      <span className={`${plan.highlight ? 'text-green-200' : 'text-green-600'}`}>
                        {feature}
                      </span>
                    ) : (
                      <span className="opacity-50">{feature}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-gray-600">
            ¿Necesitas algo personalizado?{' '}
            <a href="mailto:hola@tuturno.app" className="text-indigo-600 font-bold hover:underline">
              Contacta nuestro equipo
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
