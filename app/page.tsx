import { MarketingNav } from '@/components/marketing/nav';
import { Hero } from '@/components/marketing/hero';
import { Benefits } from '@/components/marketing/benefits';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { Pricing } from '@/components/marketing/pricing';
import { Faq } from '@/components/marketing/faq';
import { Footer } from '@/components/marketing/footer';
import { getSessionContext } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase/env';

export default async function LandingPage() {
  // The landing page must render before Supabase is configured, so a missing
  // session is a normal state here, not an error.
  const session = isSupabaseConfigured() ? await getSessionContext() : null;

  return (
    <div className="flex min-h-screen flex-col">
      <MarketingNav signedIn={Boolean(session)} />
      <main className="flex-1">
        <Hero />
        <Benefits />
        <HowItWorks />
        <Pricing signedIn={Boolean(session)} />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}
