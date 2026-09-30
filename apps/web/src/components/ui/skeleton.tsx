import { cn } from '@/lib/utils/cn';

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div className={cn('skeleton-shimmer rounded-md', className)} {...props} />
  );
}

export { Skeleton };
