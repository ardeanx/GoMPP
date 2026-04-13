'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getVal, type SettingsTabProps } from './settings-helpers';

export function SecuritySettingsTab({ edits, setField }: SettingsTabProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Security Settings</CardTitle>
          <CardDescription>
            JWT, rate limiting, and access control.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>JWT Access Expiry (minutes)</Label>
              <Input
                type="number"
                min={1}
                value={getVal(edits, 'jwt_access_expiry_min', '60')}
                onChange={(e) =>
                  setField('jwt_access_expiry_min', e.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label>JWT Refresh Expiry (days)</Label>
              <Input
                type="number"
                min={1}
                value={getVal(edits, 'jwt_refresh_expiry_day', '7')}
                onChange={(e) =>
                  setField('jwt_refresh_expiry_day', e.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Rate Limit (requests/minute)</Label>
              <Input
                type="number"
                min={1}
                value={getVal(edits, 'rate_limit_rpm', '60')}
                onChange={(e) => setField('rate_limit_rpm', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Auth Rate Limit (requests/minute)</Label>
              <Input
                type="number"
                min={1}
                value={getVal(edits, 'auth_rate_limit_rpm', '10')}
                onChange={(e) =>
                  setField('auth_rate_limit_rpm', e.target.value)
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Link to webhooks */}
      <Card className="mt-4">
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <p className="font-medium">Webhooks</p>
            <p className="text-sm text-muted-foreground">
              Manage webhook endpoints and event subscriptions.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/settings/webhooks">
              Manage Webhooks
              <ExternalLink className="size-4 ml-1.5" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
