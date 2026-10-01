'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useCategoryTree } from '@/lib/hooks/use-categories';
import { useCities } from '@/lib/hooks/use-cities';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface SearchBarProps {
  /** `hero` = large, on the homepage hero photo. `header` = compact, sits in the sticky white bar. */
  variant?: 'hero' | 'header';
  className?: string;
}

/**
 * Dual-field ("Find" / "Near") search — docs/17-design-overhaul.md's adopted layout pattern. Same
 * `/search?q=&category=&city=` navigation as before this redesign; only the visual container changed.
 */
export function SearchBar({
  variant = 'hero',
  className,
}: SearchBarProps): React.ReactElement {
  const t = useTranslations();
  const router = useRouter();
  const { data: categories } = useCategoryTree();
  const { data: cities } = useCities();

  const [q, setQ] = React.useState('');
  const [category, setCategory] = React.useState<string>();
  const [city, setCity] = React.useState<string>();

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (category) params.set('category', category);
    if (city) params.set('city', city);
    router.push(`/search?${params.toString()}`);
  }

  const isHeader = variant === 'header';

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'flex w-full flex-col gap-2 sm:flex-row sm:items-center',
        isHeader
          ? 'rounded-pill border border-border bg-white p-1 text-foreground shadow-sm transition-shadow focus-within:shadow-md hover:shadow-md sm:gap-0 sm:divide-x sm:divide-border'
          : 'rounded-2xl border border-border bg-card p-3 shadow-lg sm:gap-0 sm:divide-x sm:divide-border',
        className,
      )}
    >
      <div className="relative flex-1">
        <Search
          className={cn(
            'pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground',
            isHeader && 'start-4',
          )}
        />
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder={t('common.searchPlaceholder')}
          aria-label={t('common.searchPlaceholder')}
          className={cn(
            'border-none bg-transparent shadow-none focus-visible:ring-0',
            isHeader ? 'h-9 ps-10' : 'h-11 ps-9',
          )}
        />
      </div>

      <Select value={category} onValueChange={setCategory}>
        <SelectTrigger
          className={cn(
            'border-none bg-transparent shadow-none focus:ring-0 sm:w-44',
            isHeader ? 'h-9' : 'h-11',
          )}
          aria-label={t('search.allCategories')}
        >
          <SelectValue placeholder={t('search.allCategories')} />
        </SelectTrigger>
        <SelectContent>
          {categories?.map((node) => (
            <SelectItem key={node.id} value={node.slug}>
              {node.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={city} onValueChange={setCity}>
        <SelectTrigger
          className={cn(
            'border-none bg-transparent shadow-none focus:ring-0 sm:w-40',
            isHeader ? 'h-9' : 'h-11',
          )}
          aria-label={t('search.allCities')}
        >
          <SelectValue placeholder={t('search.allCities')} />
        </SelectTrigger>
        <SelectContent>
          {cities?.map((c) => (
            <SelectItem key={c.id} value={c.slug}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        type="submit"
        size={isHeader ? 'icon' : 'lg'}
        variant="accent"
        aria-label={t('home.searchCta')}
        className={cn(
          'rounded-pill shrink-0',
          !isHeader && 'sm:w-auto sm:px-6',
        )}
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        {!isHeader && t('home.searchCta')}
      </Button>
    </form>
  );
}
