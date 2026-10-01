'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Input, type InputProps } from './input';

/**
 * Password field with a show/hide eye toggle. The button's accessible name comes from visually-hidden
 * text inside it (not `aria-label`), so `getByLabel(/password/i)` still resolves to the input alone.
 */
const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<InputProps, 'type'>
>(({ className, id, ...props }, ref) => {
  const t = useTranslations('auth');
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        id={id}
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={`pe-11 ${className ?? ''}`}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-pressed={visible}
        aria-controls={id}
        className="absolute end-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {visible ? (
          <EyeOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Eye className="h-4 w-4" aria-hidden="true" />
        )}
        <span className="sr-only">
          {visible ? t('hidePassword') : t('showPassword')}
        </span>
      </button>
    </div>
  );
});
PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };
