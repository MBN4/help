'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useCategoryTree } from '@/lib/hooks/use-categories';
import { useCities } from '@/lib/hooks/use-cities';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function SearchBar(): React.ReactElement {
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

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-sm sm:flex-row sm:items-center"
    >
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder={t('common.searchPlaceholder')}
          className="ps-9"
        />
      </div>

      <Select value={category} onValueChange={setCategory}>
        <SelectTrigger className="sm:w-44">
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
        <SelectTrigger className="sm:w-40">
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

      <Button type="submit" size="lg" className="sm:w-auto">
        {t('home.searchCta')}
      </Button>
    </form>
  );
}
