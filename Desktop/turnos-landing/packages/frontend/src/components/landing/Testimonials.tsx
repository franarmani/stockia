'use client';

export function Testimonials() {
  const testimonials = [
    {
      name: 'María García',
      role: 'Dueña - Peluquería "Bella Vida"',
      image: '👩‍💼',
      text: 'Perdía clientes porque atendía llamadas todo el día. Con Tuturno, los turnos se agendarán solos. Gano 2 horas diarias.',
      rating: 5,
    },
    {
      name: 'Juan Rodríguez',
      role: 'Entrenador - Gimnasio "Fit Life"',
      image: '💪',
      text: 'Los recordatorios automáticos bajaron las ausencias de 40% a 5%. El dinero que gasto en la suscripción lo recupero en una semana.',
      rating: 5,
    },
    {
      name: 'Lucía Fernández',
      role: 'Esteticista - Estética "Belleza Natural"',
      image: '💅',
      text: 'Mis clientes amaron poder reservar online. El sistema de pagos es seguro y confiable. ¡Recomendado 100%!',
      rating: 5,
    },
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Amado por emprendedores
          </h2>
          <p className="text-xl text-gray-600">Mira qué dicen nuestros usuarios</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, idx) => (
            <div key={idx} className="bg-white rounded-xl p-8 shadow-sm border border-gray-100">
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <span key={i} className="text-yellow-400 text-lg">
                    ★
                  </span>
                ))}
              </div>

              {/* Quote */}
              <p className="text-gray-700 mb-6 italic leading-relaxed">"{testimonial.text}"</p>

              {/* Author */}
              <div className="flex items-center gap-4">
                <div className="text-4xl">{testimonial.image}</div>
                <div>
                  <h4 className="font-bold text-gray-900">{testimonial.name}</h4>
                  <p className="text-sm text-gray-600">{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
