import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import type { BusinessPhoto } from '@buisnez/shared';
import { cn } from '@/lib/utils/cn';

/**
 * Profile hero mosaic (Yelp-style): one large photo plus a grid of small ones, with a "See all N photos"
 * link on the last tile that jumps to the full gallery below. Layout adapts to how many photos exist.
 */
export async function PhotoMosaic({
  photos,
  businessName,
}: {
  photos: BusinessPhoto[];
  businessName: string;
}): Promise<React.ReactElement | null> {
  if (photos.length === 0) {
    return null;
  }
  const t = await getTranslations('business');
  const shown =
    photos.length >= 5
      ? photos.slice(0, 5)
      : photos.slice(0, photos.length >= 3 ? 3 : photos.length);
  const layout =
    shown.length === 1
      ? 'grid-cols-1'
      : shown.length === 2
        ? 'grid-cols-2'
        : shown.length === 3
          ? 'grid-cols-3 grid-rows-2'
          : 'grid-cols-2 grid-rows-2 sm:grid-cols-4';

  return (
    <div
      className={cn(
        'grid h-60 gap-1.5 overflow-hidden rounded-xl sm:h-80',
        layout,
      )}
    >
      {shown.map((photo, index) => {
        const isLead = index === 0 && shown.length >= 3;
        const isLast =
          index === shown.length - 1 && photos.length > shown.length;
        return (
          <div
            key={photo.id}
            className={cn(
              'group relative overflow-hidden bg-muted',
              isLead && 'col-span-2 row-span-2',
              shown.length >= 5 && index > 0 && index < 3 && 'max-sm:hidden',
            )}
          >
            <Image
              src={photo.url}
              alt={photo.caption ?? businessName}
              fill
              priority={index === 0}
              sizes={isLead ? '(min-width: 1024px) 50vw, 100vw' : '25vw'}
              className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03] motion-reduce:transform-none"
            />
            {isLast && (
              <a
                href="#photos"
                className="absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/60 to-transparent p-3 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                {t('seeAllPhotos', { count: photos.length })}
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
