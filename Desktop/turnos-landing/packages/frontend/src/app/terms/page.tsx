'use client';

import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-8 md:p-12">
        <Link href="/" className="text-indigo-600 hover:text-indigo-700 mb-6 inline-block">
          ← Volver al inicio
        </Link>

        <h1 className="text-4xl font-bold text-gray-900 mb-2">Términos de Servicio</h1>
        <p className="text-gray-600 mb-8">Última actualización: {new Date().toLocaleDateString('es-ES')}</p>

        <div className="prose prose-sm max-w-none text-gray-700 space-y-6">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">1. Aceptación de Términos</h2>
            <p>
              Al acceder y utilizar Tuturno ("Servicio"), aceptas estar obligado por estos Términos de Servicio. Si no
              estás de acuerdo con alguna parte de estos términos, no debes utilizar nuestro Servicio.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">2. Descripción del Servicio</h2>
            <p>
              Tuturno es una plataforma SaaS que proporciona herramientas para gestionar citas, turnos y reservas
              online. Incluye características como calendarios, notificaciones automáticas, procesamiento de pagos e
              integración con servicios de comunicación.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">3. Cuentas de Usuario</h2>
            <p>
              <strong>Responsabilidad de la Cuenta:</strong> Eres responsable de mantener la confidencialidad de tu
              contraseña y de toda la actividad que ocurra bajo tu cuenta. Debes notificarnos inmediatamente de cualquier
              uso no autorizado.
            </p>
            <p>
              <strong>Información Precisa:</strong> Te comprometes a proporcionar información precisa y completa al crear
              tu cuenta.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">4. Uso Aceptable</h2>
            <p>Aceptas no utilizar Tuturno para:</p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Violar leyes o regulaciones aplicables</li>
              <li>Transmitir malware, spam o contenido dañino</li>
              <li>Acceder sin autorización a sistemas o datos</li>
              <li>Crear múltiples cuentas para evasión</li>
              <li>Acosar, amenazar o difamar a otros usuarios</li>
              <li>Violar derechos de propiedad intelectual</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">5. Propiedad Intelectual</h2>
            <p>
              Todo el contenido de Tuturno (software, diseño, texto, imágenes, gráficos) está protegido por derechos de
              autor. No está permitido copiar, modificar o distribuir sin autorización.
            </p>
            <p>
              Tus datos y contenido creado dentro de la plataforma son de tu propiedad. Nos otorgas el derecho de usar,
              almacenar y transmitir tus datos para proporcionar el Servicio.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">6. Limitación de Responsabilidad</h2>
            <p>
              <strong>Sin Garantías:</strong> El Servicio se proporciona "tal como está" sin garantías de ningún tipo. No
              garantizamos disponibilidad continua, precisión de datos o funcionalidad específica.
            </p>
            <p>
              <strong>Limitación de Daños:</strong> En ningún caso Tuturno será responsable por daños indirectos,
              incidentales o consecuentes que resulten del uso de nuestro Servicio.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">7. Pagos y Suscripciones</h2>
            <p>
              <strong>Acuerdos de Pago:</strong> Al suscribirte a un plan de pago, autorizas el cobro del precio indicado.
              Las suscripciones se renuevan automáticamente a menos que las canceles.
            </p>
            <p>
              <strong>Reembolsos:</strong> No ofrecemos reembolsos por períodos ya completados. Puedes cancelar en
              cualquier momento, pero no reembolsamos el período pagado.
            </p>
            <p>
              <strong>Cambios de Precio:</strong> Podemos cambiar nuestros precios con 30 días de aviso previo.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">8. Suspensión y Terminación</h2>
            <p>
              Nos reservamos el derecho a suspender o terminar tu cuenta si violates estos términos o usas el Servicio
              de manera que cause daño a otros usuarios o a nuestra plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">9. Cambios a los Términos</h2>
            <p>
              Podemos modificar estos Términos en cualquier momento. Los cambios serán efectivos cuando se publiquen en
              nuestro sitio web. Tu uso continuado del Servicio después de cambios constituye aceptación de los nuevos
              términos.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">10. Contacto</h2>
            <p>
              Si tienes preguntas sobre estos Términos de Servicio, por favor contacta a:{' '}
              <a href="mailto:hola@tuturno.app" className="text-indigo-600 hover:text-indigo-700">
                hola@tuturno.app
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
