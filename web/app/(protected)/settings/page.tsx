'use client';

import { useCallback, useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { SystemSetting } from '@/types/api';
import { useBulkUpdateSettings, useSystemSettings } from '@/services/settings';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/components/layouts/main/components/toolbar';
import { ApiSettingsTab } from './_components/api-settings-tab';
import { EncodingSettingsTab } from './_components/encoding-settings-tab';
import { NotificationSettingsTab } from './_components/notification-settings-tab';
import { PaymentSettingsTab } from './_components/payment-settings-tab';
import { PlayerSettingsTab } from './_components/player-settings-tab';
import { SecuritySettingsTab } from './_components/security-settings-tab';
import { SystemSettingsTab } from './_components/system-settings-tab';
import { TranscribingSettingsTab } from './_components/transcribing-settings-tab';

export default function SettingsPage() {
  const { data, isLoading } = useSystemSettings();
  const bulkUpdate = useBulkUpdateSettings();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [logoPreview, setLogoPreview] = useState<string | undefined>();
  const [faviconPreview, setFaviconPreview] = useState<string | undefined>();

  const settings: SystemSetting[] = data?.data ?? [];

  useEffect(() => {
    if (settings.length > 0 && Object.keys(edits).length === 0) {
      const initial: Record<string, string> = {};
      settings.forEach((s) => {
        initial[s.key] =
          typeof s.value === 'string' ? s.value : JSON.stringify(s.value);
      });
      setEdits(initial);

      if (initial['site_logo']) setLogoPreview(initial['site_logo']);
      if (initial['site_favicon']) setFaviconPreview(initial['site_favicon']);
    }
  }, [settings, edits]);

  const setField = useCallback(
    (key: string, value: string) =>
      setEdits((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const setBoolField = useCallback(
    (key: string, value: boolean) => setField(key, value ? 'true' : 'false'),
    [setField],
  );

  const handleLogoFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setLogoPreview(dataUrl);
        setField('site_logo', dataUrl);
      };
      reader.readAsDataURL(file);
      toast.info('Logo selected — save settings to apply.');
    },
    [setField],
  );

  const handleFaviconFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setFaviconPreview(dataUrl);
        setField('site_favicon', dataUrl);
      };
      reader.readAsDataURL(file);
      toast.info('Favicon selected — save settings to apply.');
    },
    [setField],
  );

  const handleSave = async () => {
    const payload = Object.entries(edits).map(([key, value]) => {
      let parsed: unknown = value;
      try {
        parsed = JSON.parse(value);
      } catch {
        // keep as string
      }
      return { key, value: parsed };
    });

    try {
      await bulkUpdate.mutateAsync(payload);
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    }
  };

  if (isLoading) {
    return (
      <>
        <Toolbar>
          <ToolbarHeading title="Settings" />
        </Toolbar>
        <div className="container space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </>
    );
  }

  const tabProps = { edits, setField, setBoolField };

  return (
    <>
      <Toolbar>
        <ToolbarHeading title="Settings" />
        <ToolbarActions>
          <Button onClick={handleSave} disabled={bulkUpdate.isPending}>
            <Save className="size-4 mr-1.5" />
            {bulkUpdate.isPending ? 'Saving...' : 'Save All'}
          </Button>
        </ToolbarActions>
      </Toolbar>

      <div className="container">
        <Tabs defaultValue="system">
          <TabsList className="mb-6">
            <TabsTrigger value="system">System Settings</TabsTrigger>
            <TabsTrigger value="player">Player</TabsTrigger>
            <TabsTrigger value="notification">Notification</TabsTrigger>
            <TabsTrigger value="encoding">Encoding</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="transcribing">Transcribing</TabsTrigger>
            <TabsTrigger value="payment">Payment Gateway</TabsTrigger>
            <TabsTrigger value="api">API</TabsTrigger>
          </TabsList>

          <TabsContent value="system">
            <SystemSettingsTab
              {...tabProps}
              logoPreview={logoPreview}
              faviconPreview={faviconPreview}
              onLogoFile={handleLogoFile}
              onFaviconFile={handleFaviconFile}
            />
          </TabsContent>

          <TabsContent value="player">
            <PlayerSettingsTab {...tabProps} />
          </TabsContent>

          <TabsContent value="notification">
            <NotificationSettingsTab {...tabProps} />
          </TabsContent>

          <TabsContent value="encoding">
            <EncodingSettingsTab {...tabProps} />
          </TabsContent>

          <TabsContent value="security">
            <SecuritySettingsTab {...tabProps} />
          </TabsContent>

          <TabsContent value="transcribing">
            <TranscribingSettingsTab {...tabProps} />
          </TabsContent>

          <TabsContent value="payment">
            <PaymentSettingsTab {...tabProps} />
          </TabsContent>

          <TabsContent value="api">
            <ApiSettingsTab {...tabProps} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
