import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { cn } from '@/lib/utils';
import { getSiteUrl } from '@/lib/utils';
import './globals.css';

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: 'DealGuard — know what a supplier offer really costs',
    template: '%s · DealGuard',
  },
  description:
    'DealGuard reads a supplier offer, computes the true net unit cost after rebates, freight and payment terms, compares it against your own history, and writes the counter-offer email.',
  keywords: [
    'supplier offer analysis',
    'true net cost',
    'purchasing',
    'restaurant food cost',
    'retail margin',
    'volume rebate',
    'counter offer',
  ],
  openGraph: {
    title: 'DealGuard — know what a supplier offer really costs',
    description:
      'Upload a quote. Get the true net unit cost, the hidden charges, and a counter-offer email with specific asks.',
    type: 'website',
    siteName: 'DealGuard',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DealGuard — know what a supplier offer really costs',
    description: 'Upload a quote. Get the true net unit cost and a counter-offer email with specific asks.',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#080F1C',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(sans.variable, mono.variable, 'min-h-screen bg-background font-sans')}>
        {children}
        <Toaster
          theme="dark"
          position="top-center"
          toastOptions={{
            classNames: {
              toast: 'bg-card border-border text-foreground',
              description: 'text-muted-foreground',
            },
          }}
        />
      </body>
    </html>
  );
}
