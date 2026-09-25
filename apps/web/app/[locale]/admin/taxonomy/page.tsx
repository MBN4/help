'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  createCategory,
  createCity,
  createFeature,
  createProvince,
  deleteCategory,
  deleteCity,
  deleteFeature,
  deleteProvince,
  getCategoryTree,
  getCities,
  getFeatures,
  getProvinces,
  updateCategory,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function CategoriesSection(): React.ReactElement {
  const t = useTranslations('admin');
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategoryTree,
  });
  const [name, setName] = React.useState('');

  const invalidate = (): Promise<void> =>
    queryClient
      .invalidateQueries({ queryKey: ['categories'] })
      .then(() => undefined);
  const createMutation = useMutation({
    mutationFn: () => createCategory({ name, slug: slugify(name) }),
    onSuccess: () => {
      setName('');
      return invalidate();
    },
  });
  const moveMutation = useMutation({
    mutationFn: ({ id, order }: { id: string; order: number }) =>
      updateCategory(id, { order }),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: invalidate,
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  const flat: { id: string; name: string; order: number; isChild: boolean }[] =
    (data?.data ?? []).flatMap((node, i) => [
      { id: node.id, name: node.name, order: i, isChild: false },
      ...node.children.map((c, j) => ({
        id: c.id,
        name: c.name,
        order: j,
        isChild: true,
      })),
    ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('taxonomy.categories')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('taxonomy.name')}
          />
          <Button
            size="sm"
            onClick={() => createMutation.mutate()}
            disabled={!name}
          >
            {t('taxonomy.add')}
          </Button>
        </div>
        <ul className="space-y-1">
          {flat.map((node) => (
            <li
              key={node.id}
              className="flex items-center justify-between text-sm"
            >
              <span className={node.isChild ? 'pl-4' : ''}>{node.name}</span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    moveMutation.mutate({ id: node.id, order: node.order - 1 })
                  }
                >
                  ↑
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    moveMutation.mutate({ id: node.id, order: node.order + 1 })
                  }
                >
                  ↓
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteMutation.mutate(node.id)}
                >
                  {t('taxonomy.delete')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ProvincesSection(): React.ReactElement {
  const t = useTranslations('admin');
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['provinces'],
    queryFn: getProvinces,
  });
  const [name, setName] = React.useState('');
  const invalidate = (): Promise<void> =>
    queryClient
      .invalidateQueries({ queryKey: ['provinces'] })
      .then(() => undefined);
  const createMutation = useMutation({
    mutationFn: () => createProvince({ name, slug: slugify(name) }),
    onSuccess: () => {
      setName('');
      return invalidate();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteProvince,
    onSuccess: invalidate,
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('taxonomy.provinces')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('taxonomy.name')}
          />
          <Button
            size="sm"
            onClick={() => createMutation.mutate()}
            disabled={!name}
          >
            {t('taxonomy.add')}
          </Button>
        </div>
        <ul className="space-y-1">
          {(data?.data ?? []).map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between text-sm"
            >
              <span>{p.name}</span>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => deleteMutation.mutate(p.id)}
              >
                {t('taxonomy.delete')}
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function CitiesSection(): React.ReactElement {
  const t = useTranslations('admin');
  const queryClient = useQueryClient();
  const { data: provincesData } = useQuery({
    queryKey: ['provinces'],
    queryFn: getProvinces,
  });
  const { data, isLoading } = useQuery({
    queryKey: ['cities'],
    queryFn: () => getCities(),
  });
  const [name, setName] = React.useState('');
  const [provinceId, setProvinceId] = React.useState('');
  const [lat, setLat] = React.useState('');
  const [lng, setLng] = React.useState('');
  const invalidate = (): Promise<void> =>
    queryClient
      .invalidateQueries({ queryKey: ['cities'] })
      .then(() => undefined);
  const createMutation = useMutation({
    mutationFn: () =>
      createCity({
        name,
        slug: slugify(name),
        provinceId,
        centroid:
          lat && lng ? { lat: Number(lat), lng: Number(lng) } : undefined,
      }),
    onSuccess: () => {
      setName('');
      setLat('');
      setLng('');
      return invalidate();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteCity,
    onSuccess: invalidate,
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('taxonomy.cities')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('taxonomy.name')}
            className="w-40"
          />
          <select
            className="rounded-md border border-input bg-background px-2 text-sm"
            value={provinceId}
            onChange={(e) => setProvinceId(e.target.value)}
          >
            <option value="">{t('taxonomy.selectProvince')}</option>
            {(provincesData?.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Input
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="lat"
            className="w-24"
          />
          <Input
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="lng"
            className="w-24"
          />
          <Button
            size="sm"
            onClick={() => createMutation.mutate()}
            disabled={!name || !provinceId}
          >
            {t('taxonomy.add')}
          </Button>
        </div>
        <ul className="space-y-1">
          {(data?.data ?? []).map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between text-sm"
            >
              <span>
                {c.name} ({c.provinceName})
              </span>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => deleteMutation.mutate(c.id)}
              >
                {t('taxonomy.delete')}
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function FeaturesSection(): React.ReactElement {
  const t = useTranslations('admin');
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['features'],
    queryFn: getFeatures,
  });
  const [name, setName] = React.useState('');
  const invalidate = (): Promise<void> =>
    queryClient
      .invalidateQueries({ queryKey: ['features'] })
      .then(() => undefined);
  const createMutation = useMutation({
    mutationFn: () => createFeature({ name, slug: slugify(name) }),
    onSuccess: () => {
      setName('');
      return invalidate();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteFeature,
    onSuccess: invalidate,
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <Card data-testid="taxonomy-features">
      <CardHeader>
        <CardTitle>{t('taxonomy.features')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('taxonomy.name')}
            data-testid="taxonomy-features-name"
          />
          <Button
            size="sm"
            onClick={() => createMutation.mutate()}
            disabled={!name}
            data-testid="taxonomy-features-add"
          >
            {t('taxonomy.add')}
          </Button>
        </div>
        <ul className="space-y-1">
          {(data?.data ?? []).map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between text-sm"
            >
              <span>{f.name}</span>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => deleteMutation.mutate(f.id)}
              >
                {t('taxonomy.delete')}
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default function AdminTaxonomyPage(): React.ReactElement {
  const t = useTranslations('admin');
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t('taxonomy.title')}</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <CategoriesSection />
        <ProvincesSection />
        <CitiesSection />
        <FeaturesSection />
      </div>
    </div>
  );
}
