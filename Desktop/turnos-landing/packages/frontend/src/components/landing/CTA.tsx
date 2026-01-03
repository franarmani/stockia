'use client';

import Link from 'next/link';
import { useState } from 'react';

export function CTA() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Integrate with Mailchimp or EmailJS
    setSubmitted(true);
    setTimeout(() => {
      setEmail('');
      setSubmitted(false);
    }, 3000);
  };

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-indigo-600 to-purple-600">
      <div className="max-w-4xl mx-auto text-center text-white">
        <h2 className="text-4xl md:text-5xl font-bold mb-6">
          ¿Listo para transformar tu negocio?
        </h2>

        <p className="text-xl text-indigo-100 mb-8 max-w-2xl mx-auto">
          Comienza tu período de prueba gratuito de 14 días. Sin tarjeta de crédito. Sin
          sorpresas. Cancela cuando quieras.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
          <Link
            href="/register"
            className="bg-white text-indigo-600 hover:bg-gray-100 px-8 py-4 rounded-lg font-bold text-lg transition"
          >
            Comenzar ahora
          </Link>
          <a
            href="mailto:hola@tuturno.app"
            className="border-2 border-white text-white hover:bg-white hover:text-indigo-600 px-8 py-4 rounded-lg font-bold text-lg transition"
          >
            Agendar demo
          </a>
        </div>

        {/* Newsletter Signup */}
        <div className="bg-white bg-opacity-10 backdrop-blur rounded-xl p-6 max-w-md mx-auto">
          <p className="text-indigo-100 mb-4 font-medium">
            O recibe tips gratis para crecer tu negocio:
          </p>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-1 px-4 py-3 rounded-lg text-gray-900 placeholder-gray-500"
            />
            <button
              type="submit"
              className="bg-white text-indigo-600 hover:bg-gray-100 px-6 py-3 rounded-lg font-bold transition whitespace-nowrap"
            >
              {submitted ? '✓ Listo!' : 'Suscribir'}
            </button>
          </form>
        </div>

        <p className="text-indigo-100 text-sm mt-8">
          Nos importa tu privacidad. Recibirás solo contenido útil. No spam, prometido.
        </p>
      </div>
    </section>
  );
}
