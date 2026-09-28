import { Skeleton } from '@/components/ui/skeleton';

export default function CityCategoryLoading(): React.ReactElement {
  return (
    <div className="container space-y-6 py-6">
      <Skeleton className="h-4 w-56" />
      <div className="space-y-1">
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-5 w-1/3" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="aspect-[4/3] w-full" />
        ))}
      </div>
    </div>
  );
}
