import Image from 'next/image';
import type { BusinessPhoto } from '@buisnez/shared';

export function PhotoGallery({
  photos,
  businessName,
}: {
  photos: BusinessPhoto[];
  businessName: string;
}): React.ReactElement | null {
  if (photos.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {photos.map((photo) => (
        <div
          key={photo.id}
          className="relative aspect-square overflow-hidden rounded-lg bg-muted"
        >
          <Image
            src={photo.url}
            alt={photo.caption ?? businessName}
            fill
            sizes="(min-width: 640px) 20vw, 33vw"
            className="object-cover"
          />
        </div>
      ))}
    </div>
  );
}
