import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import '../../src/styles/globals.css';

// Self-hosted (next/font downloads + serves these at build time, no runtime Google Fonts request) —
// docs/17-design-overhaul.md: Inter everywhere (Yelp-style pass: one family, weight carries hierarchy).
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});
import { routing } from '@/i18n/routing';
import { QueryProvider } from '@/components/providers/query-provider';
import { PostHogProvider } from '@/components/providers/posthog-provider';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { MobileNav } from '@/components/layout/mobile-nav';

export function generateStaticParams(): { locale: string }[] {
  return routing.locales.map((locale) => ({ locale }));
}

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: LocaleLayoutProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });
  return {
    title: { default: t('metaTitle'), template: '%s' },
    description: t('metaDescription'),
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
    ),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps): Promise<React.ReactElement> {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  setRequestLocale(locale);

  const [messages, t] = await Promise.all([
    getMessages(),
    getTranslations('common'),
  ]);

  return (
    <html lang={locale} dir="ltr" className={`${inter.variable}`}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <Suspense fallback={null}>
            <PostHogProvider />
          </Suspense>
          <QueryProvider>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
            >
              {t('skipToContent')}
            </a>
            <Header />
            <main id="main-content" className="min-h-[60vh] pb-16 sm:pb-0">
              {children}
            </main>
            <Footer />
            <MobileNav />
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
