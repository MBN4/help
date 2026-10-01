import { Skeleton } from '@/components/ui/skeleton';
import { BusinessListItemSkeleton } from '@/components/business/business-list-item';

export default function SearchLoading(): React.ReactElement {
  return (
    <div className="container space-y-6 py-6">
      <div className="grid gap-6 lg:grid-cols-[240px_1fr_380px]">
        <div className="hidden lg:block">
          <Skeleton className="h-96 w-full" />
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-9 w-32" />
          </div>
          {Array.from({ length: 5 }).map((_, index) => (
            <BusinessListItemSkeleton key={index} />
          ))}
        </div>
        <div className="hidden lg:block">
          <Skeleton className="h-[480px] w-full" />
        </div>
      </div>
    </div>
  );
}
