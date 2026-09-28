'use client';

import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { getMyPhotos } from '@/lib/api';
import { Link } from '@/i18n/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { ModerationStatusBanner } from '@/components/moderation/moderation-status-banner';

export default function AccountPhotosPage(): React.ReactElement {
  const t = useTranslations('account');
  const { data, isLoading } = useQuery({
    queryKey: ['my-photos'],
    queryFn: async () => (await getMyPhotos(1, 50)).data,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('photosTitle')}</h1>
      {isLoading && <Skeleton className="h-32 w-full" />}
      {!isLoading && data?.length === 0 && (
        <p className="text-muted-foreground">{t('photosEmpty')}</p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {data?.map((photo) => {
          const image = (
            <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
              <Image
                src={photo.cardUrl ?? photo.url}
                alt={photo.caption ?? ''}
                fill
                sizes="(min-width: 640px) 20vw, 33vw"
                className="object-cover"
              />
            </div>
          );
          return (
            <div key={photo.id} className="space-y-1.5">
              {photo.business ? (
                <Link href={`/business/${photo.business.slug}`}>{image}</Link>
              ) : (
                image
              )}
              <ModerationStatusBanner
                targetType="PHOTO"
                targetId={photo.id}
                status={photo.status}
                moderationReason={photo.moderationReason}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
