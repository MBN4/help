'use client';

import { SlidersHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useUIStore } from '@/lib/stores/ui-store';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { FilterPanel } from './filter-panel';

export function MobileFilterSheet(): React.ReactElement {
  const t = useTranslations('search');
  const { filterSheetOpen, setFilterSheetOpen } = useUIStore();

  return (
    <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          {t('filters')}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>{t('filters')}</SheetTitle>
        </SheetHeader>
        <div className="pt-3">
          <FilterPanel />
        </div>
      </SheetContent>
    </Sheet>
  );
}
