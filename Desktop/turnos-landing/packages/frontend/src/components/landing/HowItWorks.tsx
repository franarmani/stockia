'use client';

export function HowItWorks() {
  const steps = [
    {
      number: '1',
      title: 'Regístrate (30 segundos)',
      description: 'Crea tu cuenta con email y contraseña. Sin necesidad de tarjeta de crédito.',
      icon: '✉️',
    },
    {
      number: '2',
      title: 'Configura tu negocio (10 minutos)',
      description: 'Agrega servicios, profesionales y horarios. Personaliza tu marca.',
      icon: '⚙️',
    },
    {
      number: '3',
      title: 'Comparte tu link (1 segundo)',
      description: 'Tu página de reservas está lista. Comparte en redes, WhatsApp, email.',
      icon: '🔗',
    },
    {
      number: '4',
      title: 'Recibe reservas (automático)',
      description: 'Clientes agendarán online. Tú recibirás SMS y email de confirmación.',
      icon: '🎯',
    },
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Empieza en 4 pasos
          </h2>
          <p className="text-xl text-gray-600">Tan fácil que lo harás en 15 minutos</p>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          {steps.map((step, idx) => (
            <div key={idx} className="relative">
              {/* Connector Line */}
              {idx < steps.length - 1 && (
                <div className="hidden md:block absolute top-24 left-full w-full h-1 bg-gradient-to-r from-indigo-300 to-indigo-100 transform translate-x-2" />
              )}

              {/* Card */}
              <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-100 relative z-10">
                {/* Step Number Circle */}
                <div className="absolute -top-4 -left-4 w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">
                  {step.number}
                </div>

                <div className="text-4xl mb-4">{step.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-gray-600 text-sm">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
