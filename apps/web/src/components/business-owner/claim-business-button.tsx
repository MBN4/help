'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ApiError, createClaim, getMyClaimForBusiness } from '@/lib/api';
import { useSession } from '@/lib/hooks/use-session';
import { Link, usePathname } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

export function ClaimBusinessButton({
  businessId,
  isClaimed,
}: {
  businessId: string;
  isClaimed: boolean;
}): React.ReactElement | null {
  const t = useTranslations('claims');
  const pathname = usePathname();
  const { isLoading: sessionLoading, isAuthenticated } = useSession();

  const claimQuery = useQuery({
    queryKey: ['my-claim', businessId],
    queryFn: async () => getMyClaimForBusiness(businessId),
    enabled: isAuthenticated && !isClaimed,
  });

  const [formOpen, setFormOpen] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [documentUrl, setDocumentUrl] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = React.useState(false);

  if (isClaimed || sessionLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <div className="rounded-lg border border-dashed border-border p-3 text-sm">
        <p className="mb-2 text-muted-foreground">{t('loginRequired')}</p>
        <Button asChild size="sm" variant="outline">
          <Link href={`/login?returnTo=${encodeURIComponent(pathname)}`}>
            {t('loginToClaimCta')}
          </Link>
        </Button>
      </div>
    );
  }

  if (claimQuery.isLoading) {
    return null;
  }

  const claim = claimQuery.data;

  if (justSubmitted || (claim && claim.status === 'PENDING')) {
    return (
      <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
        {t('pendingReview')}
      </p>
    );
  }

  if (claim && claim.status === 'APPROVED') {
    return null;
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await createClaim({
        businessId,
        message: message.trim() || undefined,
        documentUrl: documentUrl.trim() || undefined,
      });
      setJustSubmitted(true);
      setFormOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errorGeneric'));
    } finally {
      setPending(false);
    }
  }

  if (!formOpen) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setFormOpen(true)}
      >
        {t('claimCta')}
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-lg border border-border p-4 text-sm"
    >
      <h3 className="font-semibold">{t('claimCta')}</h3>
      <div className="space-y-1.5">
        <Label htmlFor="claim-message">{t('messageLabel')}</Label>
        <Textarea
          id="claim-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={2000}
          placeholder={t('messagePlaceholder')}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="claim-document-url">{t('documentUrlLabel')}</Label>
        <Input
          id="claim-document-url"
          value={documentUrl}
          onChange={(event) => setDocumentUrl(event.target.value)}
          placeholder={t('documentUrlPlaceholder')}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {t('submit')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setFormOpen(false)}
        >
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}
