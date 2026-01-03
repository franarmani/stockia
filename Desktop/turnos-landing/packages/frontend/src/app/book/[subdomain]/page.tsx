'use client';

import { BookingFlow } from '@/components/booking/BookingFlow';

interface BookingPageProps {
  params: {
    subdomain: string;
  };
}

export default function BookingPage({ params }: BookingPageProps) {
  return <BookingFlow subdomain={params.subdomain} />;
}
