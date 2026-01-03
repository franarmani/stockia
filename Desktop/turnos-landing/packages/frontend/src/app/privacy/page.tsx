'use client';

import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-8 md:p-12">
        <Link href="/" className="text-indigo-600 hover:text-indigo-700 mb-6 inline-block">
          ← Volver al inicio
        </Link>

        <h1 className="text-4xl font-bold text-gray-900 mb-2">Política de Privacidad</h1>
        <p className="text-gray-600 mb-8">Última actualización: {new Date().toLocaleDateString('es-ES')}</p>

        <div className="prose prose-sm max-w-none text-gray-700 space-y-6">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">1. Introducción</h2>
            <p>
              En Tuturno ("nosotros" o "nuestro"), nos comprometemos a proteger tu privacidad. Esta Política de
              Privacidad explica cómo recopilamos, usamos, divulgamos y mantenemos segura tu información.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">2. Información que Recopilamos</h2>
            <p>
              <strong>Información de Registro:</strong> Nombre, email, contraseña, teléfono, dirección de negocio.
            </p>
            <p>
              <strong>Información de Perfil:</strong> Logo de empresa, descripción, categoría de negocio, servicios
              ofrecidos.
            </p>
            <p>
              <strong>Datos de Clientes:</strong> Nombres de clientes, teléfonos, emails, históricos de turnos
              (recopilados a través de tu uso de la plataforma).
            </p>
            <p>
              <strong>Datos de Uso:</strong> IP, tipo de navegador, páginas visitadas, hora de acceso (mediante cookies
              y análisis).
            </p>
            <p>
              <strong>Datos de Pago:</strong> Información de tarjeta (procesada por MercadoPago/Stripe, no almacenada
              por nosotros).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">3. Cómo Usamos tu Información</h2>
            <p>Usamos tu información para:</p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>Proporcionar y mantener el Servicio</li>
              <li>Procesar transacciones y enviar confirmaciones</li>
              <li>Enviar emails de soporte y actualizaciones de producto</li>
              <li>Mejorar y optimizar la plataforma</li>
              <li>Detectar y prevenir fraude o abuso</li>
              <li>Cumplir con obligaciones legales</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">4. Cómo Protegemos tu Información</h2>
            <p>
              <strong>Encriptación:</strong> Tu información se transmite usando encriptación SSL/TLS de nivel bancario.
            </p>
            <p>
              <strong>Almacenamiento Seguro:</strong> Tu información se almacena en servidores seguros en AWS con
              múltiples capas de protección.
            </p>
            <p>
              <strong>Acceso Limitado:</strong> Solo los empleados autorizados pueden acceder a tu información, bajo
              acuerdos de confidencialidad.
            </p>
            <p>
              <strong>Monitoreo Regular:</strong> Realizamos auditorías de seguridad regulares para identificar y
              corregir vulnerabilidades.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">5. Compartir Información</h2>
            <p>
              <strong>Terceros de Confianza:</strong> Compartimos información solo con proveedores de servicios
              esenciales (procesamiento de pagos, envío de emails, hosting).
            </p>
            <p>
              <strong>Cumplimiento Legal:</strong> Podemos divulgar información si lo requiere la ley o si creemos que es
              necesario para proteger derechos.
            </p>
            <p>
              <strong>Consentimiento:</strong> No vendemos tu información a terceros para marketing.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">6. Cookies</h2>
            <p>
              <strong>¿Qué son?:</strong> Pequeños archivos almacenados en tu dispositivo para recordar preferencias y
              mejorar tu experiencia.
            </p>
            <p>
              <strong>Tipos:</strong> Usamos cookies esenciales (funcionamiento), analíticas (Google Analytics) y de
              marketing (redireccionamiento).
            </p>
            <p>
              <strong>Control:</strong> Puedes desactivar cookies en tu navegador, pero esto afectará la funcionalidad.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">7. Retención de Datos</h2>
            <p>
              Retemos tu información mientras tu cuenta esté activa. Después de la cancelación, eliminamos datos
              personales en 90 días (excepto lo requerido por ley).
            </p>
            <p>
              Los turnos y datos de clientes son propiedad tuya. Puedes exportarlos o solicitar eliminación en cualquier
              momento.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">8. Derechos de Privacidad</h2>
            <p>Tienes derecho a:</p>
            <ul className="list-disc list-inside ml-4 space-y-2">
              <li>
                <strong>Acceso:</strong> Solicitar copia de tu información
              </li>
              <li>
                <strong>Rectificación:</strong> Corregir información imprecisa
              </li>
              <li>
                <strong>Eliminación:</strong> Solicitar borrado de datos (derecho al olvido)
              </li>
              <li>
                <strong>Portabilidad:</strong> Recibir tus datos en formato transferible
              </li>
              <li>
                <strong>Objeción:</strong> Oponerte al procesamiento de ciertos datos
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">9. GDPR (Europa)</h2>
            <p>
              Si eres usuario en la UE/EEA, tus datos se procesan según GDPR. Tenemos acuerdos de tratamiento de datos
              con nuestros proveedores. Puedes ejercer tus derechos contactándonos.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">10. Cambios a la Política</h2>
            <p>
              Podemos actualizar esta Política de Privacidad periódicamente. Los cambios significativos se notificarán
              por email o aviso prominente en nuestro sitio.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">11. Contacto</h2>
            <p>
              Si tienes preguntas sobre esta Política de Privacidad o tus derechos, contacta:{' '}
              <a href="mailto:privacy@tuturno.app" className="text-indigo-600 hover:text-indigo-700">
                privacy@tuturno.app
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
