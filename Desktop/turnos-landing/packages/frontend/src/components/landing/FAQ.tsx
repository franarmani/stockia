'use client';

import { useState } from 'react';

export function FAQ() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const faqs = [
    {
      question: '¿Cuánto cuesta?',
      answer:
        'Contamos con 3 planes: Gratis para pequeños negocios, Professional ($29/mes) y Enterprise ($99/mes). Todos incluyen 14 días de prueba gratis, sin necesidad de tarjeta de crédito.',
    },
    {
      question: '¿Puedo cancelar cuando quiera?',
      answer:
        'Sí, sin preguntas. Puedes cancelar tu suscripción en cualquier momento desde tu panel de configuración. No hay contratos ni penalizaciones.',
    },
    {
      question: '¿Qué pasa si tengo más de 5 profesionales?',
      answer:
        'En el plan Starter tienes límite de 1 profesional. En Professional hasta 5, y en Enterprise es ilimitado. Puedes upgradear tu plan en cualquier momento.',
    },
    {
      question: '¿Aceptan clientes sin cuenta?',
      answer:
        'Exactamente. Tu página de reservas es pública. Los clientes no necesitan cuenta. Solo llenan nombre, email, teléfono y reservan. Simple.',
    },
    {
      question: '¿Qué métodos de pago aceptan?',
      answer:
        'Mercado Pago (recomendado para LATAM) en los planes Professional y Enterprise. Puedes cobrar seña o total del servicio. Los clientes eligen cómo pagar.',
    },
    {
      question: '¿Dónde está almacenada mi información?',
      answer:
        'Todos tus datos están en servidores seguros en AWS con encriptación de nivel bancario. Cumplimos con GDPR y estándares internacionales de seguridad.',
    },
    {
      question: '¿Hay soporte técnico?',
      answer:
        'Tenemos equipo de soporte 24/7 por email y chat. Los usuarios de Enterprise tienen un account manager dedicado.',
    },
    {
      question: '¿Puedo integrar con mis redes sociales?',
      answer:
        'Sí, puedes insertar tu botón de reserva en Instagram, Facebook y WhatsApp. También generamos códigos QR personalizados.',
    },
  ];

  return (
    <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Preguntas frecuentes
          </h2>
          <p className="text-xl text-gray-600">Respondemos lo que te preocupa</p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div key={idx} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
              >
                <h3 className="text-lg font-bold text-gray-900 text-left">{faq.question}</h3>
                <span
                  className={`flex-shrink-0 text-2xl text-indigo-600 transition-transform ${
                    openIdx === idx ? 'rotate-180' : ''
                  }`}
                >
                  ▼
                </span>
              </button>

              {openIdx === idx && (
                <div className="px-6 pb-4 bg-gray-50 border-t border-gray-200">
                  <p className="text-gray-700 leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 bg-indigo-50 rounded-xl p-8 text-center">
          <p className="text-gray-700 mb-4">¿No encontraste lo que buscabas?</p>
          <a
            href="mailto:hola@tuturno.app"
            className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-bold transition"
          >
            Enviar pregunta
          </a>
        </div>
      </div>
    </section>
  );
}
