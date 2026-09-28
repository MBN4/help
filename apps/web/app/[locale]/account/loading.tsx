import { Skeleton } from '@/components/ui/skeleton';

export default function AccountLoading(): React.ReactElement {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full max-w-md" />
    </div>
  );
}
