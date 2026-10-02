import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PRIVACY_CONTACT_EMAIL } from '@/lib/constants';
import { buildMetadata } from '@/lib/seo/metadata';
import { Breadcrumb } from '@/components/layout/breadcrumb';

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ locale: string }>;
}

interface PolicySection {
  id: string;
  heading: string;
  paragraphs?: string[];
  items?: string[];
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'privacy' });
  return buildMetadata({
    title: t('metaTitle'),
    description: t('metaDescription'),
    path: '/privacy',
    locale,
  });
}

export default async function PrivacyPolicyPage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, breadcrumbT] = await Promise.all([
    getTranslations('privacy'),
    getTranslations('breadcrumb'),
  ]);
  const sections = t.raw('sections') as PolicySection[];

  return (
    <div className="container max-w-3xl space-y-8 py-8">
      <Breadcrumb
        items={[
          { label: breadcrumbT('home'), href: '/' },
          { label: t('title') },
        ]}
      />

      <header className="space-y-3">
        <h1 className="font-display text-4xl font-extrabold tracking-tight">
          {t('title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('lastUpdated')}</p>
        <p className="text-lg leading-relaxed text-ink">{t('intro')}</p>
      </header>

      <nav
        aria-label={t('contentsLabel')}
        className="rounded border border-border bg-white p-4"
      >
        <h2 className="font-display text-sm font-bold">{t('contentsLabel')}</h2>
        <ol className="mt-2 grid list-inside list-decimal gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="text-brand-700 hover:underline"
              >
                {section.heading}
              </a>
            </li>
          ))}
          <li>
            <a href="#contact" className="text-brand-700 hover:underline">
              {t('contactHeading')}
            </a>
          </li>
        </ol>
      </nav>

      <div className="space-y-8">
        {sections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="scroll-mt-40 space-y-3"
          >
            <h2 className="font-display text-2xl font-bold">
              {section.heading}
            </h2>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph} className="leading-relaxed text-ink">
                {paragraph}
              </p>
            ))}
            {section.items && (
              <ul className="list-disc space-y-1.5 ps-6 leading-relaxed text-ink marker:text-brand-600">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <section id="contact" className="scroll-mt-40 space-y-3">
          <h2 className="font-display text-2xl font-bold">
            {t('contactHeading')}
          </h2>
          <p className="leading-relaxed text-ink">{t('contactBody')}</p>
          <p>
            <a
              href={`mailto:${PRIVACY_CONTACT_EMAIL}`}
              className="font-semibold text-brand-700 hover:underline"
            >
              {PRIVACY_CONTACT_EMAIL}
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
