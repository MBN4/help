import { CheckCircle2 } from 'lucide-react';
import type { BusinessFeatureRef } from '@buisnez/shared';

export interface FeatureListProps {
  features: BusinessFeatureRef[];
}

export function FeatureList({
  features,
}: FeatureListProps): React.ReactElement | null {
  if (features.length === 0) {
    return null;
  }
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
      {features.map((feature) => (
        <li
          key={feature.id}
          className="flex items-center gap-2 text-sm text-foreground"
        >
          <CheckCircle2
            className="h-4 w-4 shrink-0 text-brand-700"
            aria-hidden="true"
          />
          {feature.name}
        </li>
      ))}
    </ul>
  );
}
