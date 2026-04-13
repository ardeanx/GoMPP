'use client';

import Contact from '@/components/landing/contact';
import FAQ from '@/components/landing/faq';
import Features from '@/components/landing/features';
import Footer from '@/components/landing/footer';
import Header from '@/components/landing/header';
import Hero from '@/components/landing/hero';
import HowItWorks from '@/components/landing/how-it-works';

export default function Page() {
  return (
    <div className="min-h-screen">
      <Header />
      <Hero />
      <HowItWorks />
      <Features />
      <FAQ />
      <Contact />
      <Footer />
    </div>
  );
}
