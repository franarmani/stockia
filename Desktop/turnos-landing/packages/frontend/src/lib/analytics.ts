import Script from 'next/script';

/**
 * Google Analytics 4 Component
 * Agregá this a tu layout.tsx
 */
export function GoogleAnalytics({ gaId }: { gaId: string }) {
  return (
    <>
      {/* Google Analytics Script */}
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${gaId}', {
              page_path: window.location.pathname,
            });
          `,
        }}
      />
    </>
  );
}

/**
 * Eventos de Analytics
 */
export const analyticsEvents = {
  // Página views
  pageView: (pageName: string) => {
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', 'page_view', {
        page_title: pageName,
        page_path: window.location.pathname,
      });
    }
  },

  // Auth events
  userSignup: (method: string) => {
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', 'sign_up', {
        method: method,
      });
    }
  },

  userLogin: (method: string) => {
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', 'login', {
        method: method,
      });
    }
  },

  // Booking events
  appointmentCreated: (serviceId: string, price: number) => {
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', 'purchase', {
        currency: 'ARS',
        value: price,
        items: [
          {
            item_id: serviceId,
            item_name: 'Appointment',
            price: price,
            quantity: 1,
          },
        ],
      });
    }
  },

  appointmentConfirmed: (appointmentId: string) => {
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', 'appointment_confirmed', {
        appointment_id: appointmentId,
      });
    }
  },

  // Service events
  serviceCreated: (serviceName: string, price: number) => {
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', 'service_created', {
        service_name: serviceName,
        price: price,
      });
    }
  },

  // CTAs
  ctaClicked: (ctaName: string, location: string) => {
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', 'cta_click', {
        cta_name: ctaName,
        location: location,
      });
    }
  },

  // Landing page
  landingPageViewed: () => {
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', 'view_item', {
        items: [
          {
            item_id: 'landing_page',
            item_name: 'Landing Page',
            item_category: 'page_view',
          },
        ],
      });
    }
  },

  // Booking flow
  bookingStarted: () => {
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', 'begin_checkout');
    }
  },

  bookingCompleted: (appointmentId: string, amount: number) => {
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', 'purchase', {
        transaction_id: appointmentId,
        value: amount,
        currency: 'ARS',
      });
    }
  },

  // Error tracking
  errorOccurred: (errorType: string, errorMessage: string) => {
    if (typeof window !== 'undefined' && 'gtag' in window) {
      (window as any).gtag('event', 'exception', {
        description: `${errorType}: ${errorMessage}`,
        fatal: false,
      });
    }
  },
};
