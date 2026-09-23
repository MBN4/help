import { useTranslations } from 'next-intl';
import type { PriceTier } from '@buisnez/shared';
import { cn } from '@/lib/utils/cn';

export interface PriceLevelProps {
  tier: PriceTier | null;
  className?: string;
}

export function PriceLevel({
  tier,
  className,
}: PriceLevelProps): React.ReactElement | null {
  const t = useTranslations('priceTier');
  if (!tier) {
    return null;
  }
  return (
    <span className={cn('font-medium text-muted-foreground', className)}>
      {t(tier)}
    </span>
  );
}
