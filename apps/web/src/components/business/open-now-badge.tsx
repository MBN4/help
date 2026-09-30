import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';

export interface OpenNowBadgeProps {
  /** Server-computed value from the API payload (BusinessSummary.isOpenNow / BusinessProfile.isOpenNow) — never derive this client-side. */
  isOpenNow: boolean;
}

export function OpenNowBadge({
  isOpenNow,
}: OpenNowBadgeProps): React.ReactElement {
  const t = useTranslations('common');
  return (
    <Badge variant={isOpenNow ? 'open' : 'closed'}>
      {isOpenNow ? t('openNow') : t('closedNow')}
    </Badge>
  );
}
