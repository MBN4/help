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
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-10">
      <Card className="w-full max-w-sm">
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
