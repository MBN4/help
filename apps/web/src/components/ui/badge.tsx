import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground',
        success: 'border-transparent bg-success text-success-foreground',
        warning: 'border-transparent bg-warning text-warning-foreground',
        accent: 'border-transparent bg-accent text-accent-foreground',
        /* Tasteful tinted-pill status badges (Phase 11 design overhaul) — used for open/closed instead of
           a solid fill, per docs/17-design-overhaul.md's "Closed — sparingly" guidance. Text uses
           emerald-700, not the lighter status-open token, against the tint — axe's color-contrast rule
           caught status-open text at 3.93:1 on this background (needs 4.5:1); emerald-700 measures ~6.9:1. */
        open: 'border-transparent bg-status-open/10 text-emerald-700',
        closed: 'border-transparent bg-status-closed/10 text-status-closed',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({
  className,
  variant,
  ...props
}: BadgeProps): React.ReactElement {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
