'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getBool, getVal, type SettingsTabProps } from './settings-helpers';

export function ApiSettingsTab({
  edits,
  setField,
  setBoolField,
}: SettingsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>API Settings</CardTitle>
        <CardDescription>Configure API access and rate limits.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>API Rate Limit (requests/minute)</Label>
            <Input
              type="number"
              min={1}
              value={getVal(edits, 'api_rate_limit', '120')}
              onChange={(e) => setField('api_rate_limit', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Max Upload Size (MB)</Label>
            <Input
              type="number"
              min={1}
              value={getVal(edits, 'max_upload_size_mb', '5120')}
              onChange={(e) => setField('max_upload_size_mb', e.target.value)}
            />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Allowed Origins (CORS)</Label>
            <Input
              value={getVal(edits, 'cors_allowed_origins', '*')}
              onChange={(e) => setField('cors_allowed_origins', e.target.value)}
              placeholder="*, https://example.com"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Switch
            checked={getBool(edits, 'api_docs_enabled')}
            onCheckedChange={(v) => setBoolField('api_docs_enabled', v)}
          />
          <Label>Enable Public API Docs</Label>
        </div>
      </CardContent>
    </Card>
  );
}
