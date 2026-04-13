'use client';

import { useEffect, useState } from 'react';
import { I18N_LANGUAGES } from '@/i18n/config';
import { getTimeZones } from '@/i18n/timezones';
import { Settings as SettingsIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  applyFavicon,
  applyThemeColor,
} from '@/components/theme-color-applier';
import { ImageDropzone } from './image-dropzone';
import { getBool, getVal, type SettingsTabProps } from './settings-helpers';

interface SystemSettingsTabProps extends SettingsTabProps {
  logoPreview?: string;
  faviconPreview?: string;
  onLogoFile: (file: File) => void;
  onFaviconFile: (file: File) => void;
}

export function SystemSettingsTab({
  edits,
  setField,
  setBoolField,
  logoPreview,
  faviconPreview,
  onLogoFile,
  onFaviconFile,
}: SystemSettingsTabProps) {
  const timezones = getTimeZones();
  const currentColor = getVal(edits, 'theme_color', '#0011ff');
  const [cacheOpen, setCacheOpen] = useState(false);

  // Live preview: apply theme color as the user picks it
  useEffect(() => {
    if (/^#[0-9a-f]{6}$/i.test(currentColor)) {
      applyThemeColor(currentColor);
    }
  }, [currentColor]);

  // Live preview: apply favicon as the user picks it
  useEffect(() => {
    if (faviconPreview) {
      applyFavicon(faviconPreview);
    }
  }, [faviconPreview]);

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left — Appearance */}
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <ImageDropzone
              label="System Logo"
              description="Logo for the System"
              preview={logoPreview}
              onFile={onLogoFile}
            />

            <ImageDropzone
              label="Favicon"
              description="Favicon for the System"
              preview={faviconPreview}
              onFile={onFaviconFile}
            />

            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium">Theme Color</p>
                <p className="text-xs text-muted-foreground">
                  Applies to all System
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={getVal(edits, 'theme_color', '#0011ff')}
                  onChange={(e) => setField('theme_color', e.target.value)}
                  className="size-8 rounded border border-border cursor-pointer p-0.5"
                />
                <Input
                  value={getVal(edits, 'theme_color', '#0011ff')}
                  onChange={(e) => setField('theme_color', e.target.value)}
                  className="w-32 uppercase"
                  placeholder="#0011ff"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right — Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Site Name</Label>
              <Input
                value={getVal(edits, 'site_name')}
                onChange={(e) => setField('site_name', e.target.value)}
                placeholder="GoMPP"
              />
            </div>

            <div className="space-y-2">
              <Label>Site URL</Label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-sm text-muted-foreground">
                  https://
                </span>
                <Input
                  value={getVal(edits, 'base_url').replace(/^https?:\/\//, '')}
                  onChange={(e) =>
                    setField('base_url', `https://${e.target.value}`)
                  }
                  className="rounded-l-none"
                  placeholder="example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Default Language</Label>
              <Select
                value={getVal(edits, 'default_language', 'en')}
                onValueChange={(v) => setField('default_language', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {I18N_LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      <div className="flex items-center gap-2">
                        <img
                          src={lang.flag}
                          alt={lang.name}
                          className="w-4 h-4 rounded-full"
                        />
                        {lang.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Time zone</Label>
              <Select
                value={getVal(edits, 'timezone', 'America/New_York')}
                onValueChange={(v) => setField('timezone', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {timezones.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="text-sm font-medium">Cache Settings</p>
                <p className="text-xs text-muted-foreground">
                  Activate and Configure your cache.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={getBool(edits, 'cache_enabled')}
                  onCheckedChange={(v) => setBoolField('cache_enabled', v)}
                />
                <Button
                  variant="ghost"
                  mode="icon"
                  size="sm"
                  onClick={() => setCacheOpen(true)}
                >
                  <SettingsIcon className="size-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Activate Maintenance Mode?</p>
              <Switch
                checked={getBool(edits, 'maintenance_mode')}
                onCheckedChange={(v) => setBoolField('maintenance_mode', v)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cache Settings Dialog */}
      <Dialog open={cacheOpen} onOpenChange={setCacheOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cache Settings</DialogTitle>
            <DialogDescription>
              Configure cache driver and TTL for your system.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label>Cache Driver</Label>
              <Select
                value={getVal(edits, 'cache_driver', 'memory')}
                onValueChange={(v) => setField('cache_driver', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="memory">In-Memory</SelectItem>
                  <SelectItem value="redis">Redis</SelectItem>
                  <SelectItem value="file">File</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {getVal(edits, 'cache_driver') === 'redis' && (
              <div className="space-y-2">
                <Label>Redis URL</Label>
                <Input
                  value={getVal(edits, 'cache_redis_url')}
                  onChange={(e) => setField('cache_redis_url', e.target.value)}
                  placeholder="redis://localhost:6379"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Default TTL (seconds)</Label>
              <Input
                type="number"
                value={getVal(edits, 'cache_ttl', '3600')}
                onChange={(e) => setField('cache_ttl', e.target.value)}
                placeholder="3600"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCacheOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setCacheOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
