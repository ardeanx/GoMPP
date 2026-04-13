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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getVal, type SettingsTabProps } from './settings-helpers';

export function PaymentSettingsTab({ edits, setField }: SettingsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Gateway</CardTitle>
        <CardDescription>
          Configure payment integrations for premium features.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Provider</Label>
          <Select
            value={getVal(edits, 'payment_provider', 'none')}
            onValueChange={(v) => setField('payment_provider', v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Disabled</SelectItem>
              <SelectItem value="stripe">Stripe</SelectItem>
              <SelectItem value="midtrans">Midtrans</SelectItem>
              <SelectItem value="paypal">PayPal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {getVal(edits, 'payment_provider') !== 'none' &&
          getVal(edits, 'payment_provider') && (
            <div className="grid grid-cols-2 gap-4 border-t pt-4">
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input
                  value={getVal(edits, 'payment_api_key')}
                  onChange={(e) => setField('payment_api_key', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Secret Key</Label>
                <Input
                  type="password"
                  value={getVal(edits, 'payment_secret_key')}
                  onChange={(e) =>
                    setField('payment_secret_key', e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <Input
                  value={getVal(edits, 'payment_webhook_url')}
                  onChange={(e) =>
                    setField('payment_webhook_url', e.target.value)
                  }
                  placeholder="https://example.com/api/v1/webhooks/payment"
                />
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select
                  value={getVal(edits, 'payment_currency', 'USD')}
                  onValueChange={(v) => setField('payment_currency', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="IDR">IDR</SelectItem>
                    <SelectItem value="JPY">JPY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
      </CardContent>
    </Card>
  );
}
