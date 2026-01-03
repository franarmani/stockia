import { ReactNode } from 'react';

export function JsonLD() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Tuturno',
    description: 'Plataforma SaaS para gestionar turnos online',
    url: 'https://tuturno.app',
    image: 'https://tuturno.app/logo.png',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      ratingCount: '487',
    },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'ARS',
      description: 'Plan gratuito',
    },
    provider: {
      '@type': 'Organization',
      name: 'Tuturno',
      url: 'https://tuturno.app',
      email: 'hola@tuturno.app',
      sameAs: [
        'https://facebook.com/tuturno',
        'https://instagram.com/tuturno',
        'https://twitter.com/tuturno',
      ],
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
