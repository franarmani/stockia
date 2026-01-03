'use client';

export function Features() {
  const features = [
    {
      icon: '📅',
      title: 'Calendario Inteligente',
      description: 'Vista diaria, semanal y mensual. Arrastra y suelta turnos, configura disponibilidad.',
    },
    {
      icon: '📱',
      title: 'SMS y WhatsApp Automáticos',
      description: 'Confirmación de reserva, recordatorios 24h antes. Reduce ausencias hasta 70%.',
    },
    {
      icon: '🌐',
      title: 'Página de Reservas Online',
      description: 'Clientes agendarán desde tu sitio. Acceso 24/7 sin necesidad de llamadas.',
    },
    {
      icon: '💰',
      title: 'Pagos Online Integrados',
      description: 'Mercado Pago, Stripe, efectivo. Cobra seña o total del servicio automáticamente.',
    },
    {
      icon: '👥',
      title: 'Gestión de Equipo',
      description: 'Asigna profesionales, horarios, servicios. Controla permiso y disponibilidad.',
    },
    {
      icon: '📊',
      title: 'Reportes y Análisis',
      description: 'Ingresos, ocupación, clientes frecuentes. Datos para crecer tu negocio.',
    },
  ];

  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Características potentes y fáciles de usar
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Todo lo que necesitas para administrar tu negocio en un solo lugar
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, idx) => (
            <div
              key={idx}
              className="bg-white rounded-xl p-8 shadow-sm hover:shadow-lg transition-shadow border border-gray-100"
            >
              <div className="text-5xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
