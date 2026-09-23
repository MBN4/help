import { getTranslations } from 'next-intl/server';
import type { BusinessHoursEntry } from '@buisnez/shared';

export interface HoursTableProps {
  hours: BusinessHoursEntry[];
}

export async function HoursTable({
  hours,
}: HoursTableProps): Promise<React.ReactElement> {
  const t = await getTranslations('business');

  return (
    <table className="w-full text-sm">
      <tbody>
        {hours.map((entry) => (
          <tr
            key={entry.dayOfWeek}
            className="border-b border-border last:border-0"
          >
            <td className="py-1.5 pe-4 font-medium text-foreground">
              {t(`days.${entry.dayOfWeek}`)}
            </td>
            <td className="py-1.5 text-muted-foreground">
              {entry.isClosed || !entry.opensAt || !entry.closesAt
                ? t('closed')
                : `${entry.opensAt} – ${entry.closesAt}`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
