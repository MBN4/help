'use client';

import * as React from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { updateProfile } from '@/lib/api';
import { useSession, useInvalidateSession } from '@/lib/hooks/use-session';
import { AvatarUploadButton } from '@/components/review/photo-attachments';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

export default function AccountProfilePage(): React.ReactElement {
  const t = useTranslations('account');
  const authT = useTranslations('auth');
  const { user } = useSession();
  const invalidateSession = useInvalidateSession();

  const [name, setName] = React.useState(user?.name ?? '');
  const [bio, setBio] = React.useState(user?.bio ?? '');
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(
    user?.avatarUrl ?? null,
  );
  const [pending, setPending] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    if (user) {
      setName(user.name);
      setBio(user.bio ?? '');
      setAvatarUrl(user.avatarUrl);
    }
  }, [user]);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setPending(true);
    setSaved(false);
    try {
      await updateProfile({ name, bio: bio || null, avatarUrl });
      await invalidateSession();
      setSaved(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('profileTitle')}</h1>
      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <div className="space-y-1.5">
          <Label>{t('avatarLabel')}</Label>
          <div className="flex items-center gap-4">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt=""
                width={64}
                height={64}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-muted" />
            )}
            <AvatarUploadButton
              onUploaded={(photo) => setAvatarUrl(photo.url)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="name">{authT('nameLabel')}</Label>
          <Input
            id="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bio">{t('bioLabel')}</Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder={t('bioPlaceholder')}
            maxLength={500}
          />
        </div>

        {user && !user.hasPassword && (
          <p className="text-xs text-muted-foreground">{t('setPassword')}</p>
        )}
        {saved && <p className="text-sm text-success">{t('savedSuccess')}</p>}

        <Button type="submit" disabled={pending}>
          {t('saveChanges')}
        </Button>
      </form>
    </div>
  );
}
