import { Skeleton } from '@/components/ui/skeleton';

export default function SearchLoading(): React.ReactElement {
  return (
    <div className="container space-y-6 py-6">
      <Skeleton className="h-11 w-full" />
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <div className="hidden lg:block">
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-9 w-32" />
          </div>
          <Skeleton className="h-48 w-full" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="aspect-[4/3] w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
