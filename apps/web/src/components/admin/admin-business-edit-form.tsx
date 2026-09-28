'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { CategoryNode } from '@buisnez/shared';
import {
  ApiError,
  getAreas,
  getCategoryTree,
  getCities,
  getProvinces,
  updateAdminBusiness,
} from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface AdminBusinessDetail {
  id: string;
  name: string;
  description: string | null;
  addressLine: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  category: { id: string; name: string };
  province: { id: string; name: string };
  city: { id: string; name: string; slug: string };
  area: { id: string; name: string } | null;
}

function flattenCategories(
  nodes: CategoryNode[],
  depth = 0,
): { id: string; name: string; depth: number }[] {
  return nodes.flatMap((node) => [
    { id: node.id, name: node.name, depth },
    ...flattenCategories(node.children, depth + 1),
  ]);
}

export function AdminBusinessEditForm({
  business,
  onSaved,
}: {
  business: AdminBusinessDetail;
  onSaved: () => void;
}): React.ReactElement {
  const t = useTranslations('admin');

  const { data: categoryTree } = useQuery({
    queryKey: ['category-tree'],
    queryFn: async () => (await getCategoryTree()).data,
    staleTime: 10 * 60_000,
  });
  const flatCategories = React.useMemo(
    () => (categoryTree ? flattenCategories(categoryTree) : []),
    [categoryTree],
  );
  const { data: provincesData } = useQuery({
    queryKey: ['provinces'],
    queryFn: getProvinces,
  });
  const { data: citiesData } = useQuery({
    queryKey: ['cities'],
    queryFn: () => getCities(),
  });

  const [name, setName] = React.useState(business.name);
  const [description, setDescription] = React.useState(
    business.description ?? '',
  );
  const [categoryId, setCategoryId] = React.useState(business.category.id);
  const [provinceId, setProvinceId] = React.useState(business.province.id);
  const [cityId, setCityId] = React.useState(business.city.id);
  const [citySlug, setCitySlug] = React.useState(business.city.slug);
  const [areaId, setAreaId] = React.useState(business.area?.id ?? '');
  const [addressLine, setAddressLine] = React.useState(business.addressLine);
  const [phone, setPhone] = React.useState(business.phone ?? '');
  const [whatsapp, setWhatsapp] = React.useState(business.whatsapp ?? '');
  const [email, setEmail] = React.useState(business.email ?? '');
  const [website, setWebsite] = React.useState(business.website ?? '');
  const [pending, setPending] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const { data: areasData } = useQuery({
    queryKey: ['areas', citySlug],
    queryFn: () => getAreas(citySlug),
    enabled: !!citySlug,
  });

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setPending(true);
    setSaved(false);
    setError(null);
    try {
      await updateAdminBusiness(business.id, {
        name: name.trim() || undefined,
        description: description.trim() || null,
        categoryId,
        provinceId,
        cityId,
        areaId: areaId || null,
        addressLine: addressLine.trim() || undefined,
        phone: phone.trim() || null,
        whatsapp: whatsapp.trim() || null,
        email: email.trim() || null,
        website: website.trim() || null,
      });
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('businesses.errorGeneric'),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="admin-business-name">{t('businesses.nameLabel')}</Label>
        <Input
          id="admin-business-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="admin-business-description">
          {t('businesses.descriptionLabel')}
        </Label>
        <Textarea
          id="admin-business-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={5000}
        />
      </div>

      <div className="space-y-1.5">
        <Label>{t('businesses.categoryLabel')}</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger aria-label={t('businesses.categoryLabel')}>
            <SelectValue>
              {flatCategories.find((c) => c.id === categoryId)?.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {flatCategories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {' '.repeat(c.depth * 2)}
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>{t('businesses.provinceLabel')}</Label>
          <Select value={provinceId} onValueChange={setProvinceId}>
            <SelectTrigger aria-label={t('businesses.provinceLabel')}>
              <SelectValue>
                {
                  (provincesData?.data ?? []).find((p) => p.id === provinceId)
                    ?.name
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(provincesData?.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t('businesses.cityLabel')}</Label>
          <Select
            value={cityId}
            onValueChange={(value) => {
              setCityId(value);
              const city = (citiesData?.data ?? []).find((c) => c.id === value);
              setCitySlug(city?.slug ?? '');
              setAreaId('');
            }}
          >
            <SelectTrigger aria-label={t('businesses.cityLabel')}>
              <SelectValue>
                {(citiesData?.data ?? []).find((c) => c.id === cityId)?.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(citiesData?.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t('businesses.areaLabel')}</Label>
          <Select
            value={areaId || '__none__'}
            onValueChange={(value) =>
              setAreaId(value === '__none__' ? '' : value)
            }
          >
            <SelectTrigger aria-label={t('businesses.areaLabel')}>
              <SelectValue>
                {areaId
                  ? (areasData?.data ?? []).find((a) => a.id === areaId)?.name
                  : t('businesses.noAreaOption')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">
                {t('businesses.noAreaOption')}
              </SelectItem>
              {(areasData?.data ?? []).map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="admin-business-address">
          {t('businesses.addressLabel')}
        </Label>
        <Input
          id="admin-business-address"
          value={addressLine}
          onChange={(event) => setAddressLine(event.target.value)}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="admin-business-phone">
            {t('businesses.phoneLabel')}
          </Label>
          <Input
            id="admin-business-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-business-whatsapp">
            {t('businesses.whatsappLabel')}
          </Label>
          <Input
            id="admin-business-whatsapp"
            value={whatsapp}
            onChange={(event) => setWhatsapp(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-business-email">
            {t('businesses.emailLabel')}
          </Label>
          <Input
            id="admin-business-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-business-website">
            {t('businesses.websiteLabel')}
          </Label>
          <Input
            id="admin-business-website"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && (
        <p className="text-sm text-success">{t('businesses.savedSuccess')}</p>
      )}

      <Button type="submit" disabled={pending}>
        {t('businesses.saveChanges')}
      </Button>
    </form>
  );
}
