'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { BusinessManageProfile } from '@buisnez/shared';
import { ApiError, updateBusinessInfo } from '@/lib/api';
import { useCategoryTree } from '@/lib/hooks/use-categories';
import type { CategoryNode } from '@buisnez/shared';
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

function flattenCategories(
  nodes: CategoryNode[],
  depth = 0,
): { id: string; name: string; depth: number }[] {
  return nodes.flatMap((node) => [
    { id: node.id, name: node.name, depth },
    ...flattenCategories(node.children, depth + 1),
  ]);
}

export function CoreInfoForm({
  business,
  onSaved,
}: {
  business: BusinessManageProfile;
  onSaved: (business: BusinessManageProfile) => void;
}): React.ReactElement {
  const t = useTranslations('businessOwner');

  const { data: categoryTree } = useCategoryTree();
  const flatCategories = React.useMemo(
    () => (categoryTree ? flattenCategories(categoryTree) : []),
    [categoryTree],
  );

  const [name, setName] = React.useState(business.name);
  const [description, setDescription] = React.useState(
    business.description ?? '',
  );
  const [categoryId, setCategoryId] = React.useState(business.category.id);
  const [phone, setPhone] = React.useState(business.phone ?? '');
  const [whatsapp, setWhatsapp] = React.useState(business.whatsapp ?? '');
  const [email, setEmail] = React.useState(business.email ?? '');
  const [website, setWebsite] = React.useState(business.website ?? '');
  const [pending, setPending] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setPending(true);
    setSaved(false);
    setError(null);
    try {
      const { data } = await updateBusinessInfo(business.id, {
        name: name.trim() || undefined,
        description: description.trim(),
        categoryId,
        phone: phone.trim() || undefined,
        whatsapp: whatsapp.trim() || undefined,
        email: email.trim() || undefined,
        website: website.trim() || undefined,
      });
      onSaved(data);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('errorGeneric'));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="business-name">{t('info.nameLabel')}</Label>
        <Input
          id="business-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="business-description">
          {t('info.descriptionLabel')}
        </Label>
        <Textarea
          id="business-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={5000}
        />
      </div>

      <div className="space-y-1.5">
        <Label>{t('info.categoryLabel')}</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger>
            <SelectValue>
              {flatCategories.find((c) => c.id === categoryId)?.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {flatCategories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {' '.repeat(c.depth * 2)}
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="business-phone">{t('info.phoneLabel')}</Label>
          <Input
            id="business-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="business-whatsapp">{t('info.whatsappLabel')}</Label>
          <Input
            id="business-whatsapp"
            value={whatsapp}
            onChange={(event) => setWhatsapp(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="business-email">{t('info.emailLabel')}</Label>
          <Input
            id="business-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="business-website">{t('info.websiteLabel')}</Label>
          <Input
            id="business-website"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-success">{t('savedSuccess')}</p>}

      <Button type="submit" disabled={pending}>
        {t('saveChanges')}
      </Button>
    </form>
  );
}
