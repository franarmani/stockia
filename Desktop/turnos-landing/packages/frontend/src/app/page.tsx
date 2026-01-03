'use client';

import { Navigation } from '@/components/landing/Navigation';
import { Hero } from '@/components/landing/Hero';
import { Features } from '@/components/landing/Features';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Pricing } from '@/components/landing/Pricing';
import { Testimonials } from '@/components/landing/Testimonials';
import { FAQ } from '@/components/landing/FAQ';
import { CTA } from '@/components/landing/CTA';
import { Footer } from '@/components/landing/Footer';

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />
      <Hero />
      <Features />
      <HowItWorks />
      <Pricing />
      <Testimonials />
      <FAQ />
      <CTA />
      <Footer />
    </div>
  );
}
