import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tuturno | Gestión de Turnos Online - Peluquerías, Estéticas, Gimnasios',
  description: 'La plataforma más simple para gestionar turnos online. Calendarios, SMS automáticos, pagos online y reportes. Prueba gratis 14 días. Sin tarjeta de crédito.',
  keywords: ['turnos online', 'gestión de citas', 'peluquería', 'estética', 'gimnasio', 'consultorios', 'saas'],
  authors: [{ name: 'Tuturno' }],
  openGraph: {
    title: 'Tuturno - Gestión de Turnos Online',
    description: 'La plataforma más simple para gestionar turnos. Prueba gratis 14 días.',
    type: 'website',
    url: 'https://tuturno.app',
    siteName: 'Tuturno',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tuturno - Gestión de Turnos',
    description: 'Plataforma SaaS para gestionar turnos, clientes y servicios',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#4f46e5" />
        <link rel="canonical" href="https://tuturno.app" />
      </head>
      <body className="bg-white">{children}</body>
    </html>
  )
}
