import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';

export function AuthCard({
  title,
  subtitle,
  backHref,
  backLabel,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Optional "back" link shown at the top of the card (e.g. forgot-password → login). */
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-10">
      <Card className="w-full max-w-sm">
        {backHref && backLabel && (
          <div className="px-4 pt-4">
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-muted-foreground transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft
                className="h-4 w-4 rtl:rotate-180"
                aria-hidden="true"
              />
              {backLabel}
            </Link>
          </div>
        )}
        <CardHeader className="items-center text-center">
          <Link href="/" className="mb-2 text-lg font-bold text-brand-700">
            Buisnez
          </Link>
          <CardTitle>{title}</CardTitle>
          {subtitle && <CardDescription>{subtitle}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-4">{children}</CardContent>
      </Card>
    </div>
  );
}
