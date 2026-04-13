'use client';

import { useState } from 'react';
import {
  Bell,
  Bot,
  Clock,
  Code,
  Layers,
  Mail,
  Send,
  Settings as SettingsIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { getBool, getVal, type SettingsTabProps } from './settings-helpers';

export function NotificationSettingsTab({
  edits,
  setField,
  setBoolField,
}: SettingsTabProps) {
  const [smtpOpen, setSmtpOpen] = useState(false);
  const [pushOpen, setPushOpen] = useState(false);
  const [telegramOpen, setTelegramOpen] = useState(false);

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column */}
        <Card>
          <CardContent className="space-y-0 divide-y pt-6">
            {/* Enable Email Notifications */}
            <div className="flex items-center justify-between py-4 first:pt-0">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center size-9 rounded-lg bg-muted shrink-0">
                  <Mail className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Enable Email Notifications
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Links open in the desktop app for convenience.
                  </p>
                </div>
              </div>
              <Switch
                checked={getBool(edits, 'notify_email_enabled')}
                onCheckedChange={(v) => setBoolField('notify_email_enabled', v)}
              />
            </div>

            {/* Telegram Notifications */}
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center size-9 rounded-lg bg-muted shrink-0">
                  <Send className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Telegram Notifications</p>
                  <p className="text-xs text-muted-foreground">
                    Links open in the desktop app for convenience.
                  </p>
                </div>
              </div>
              <Switch
                checked={getBool(edits, 'notify_telegram_enabled')}
                onCheckedChange={(v) =>
                  setBoolField('notify_telegram_enabled', v)
                }
              />
            </div>

            {/* Notification Frequency */}
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center size-9 rounded-lg bg-muted shrink-0">
                  <Clock className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Notification Frequency</p>
                  <p className="text-xs text-muted-foreground">
                    Users may view and update the
                  </p>
                </div>
              </div>
              <Select
                value={getVal(edits, 'notification_frequency', 'daily')}
                onValueChange={(v) => setField('notification_frequency', v)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="realtime">Realtime</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notification Channels */}
            <div className="flex items-center justify-between py-4 last:pb-0">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center size-9 rounded-lg bg-muted shrink-0">
                  <Layers className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Notification Channels</p>
                  <p className="text-xs text-muted-foreground">
                    Users may view and update the
                  </p>
                </div>
              </div>
              <Select
                value={getVal(edits, 'notification_channel', 'email')}
                onValueChange={(v) => setField('notification_channel', v)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="telegram">Telegram</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Right column */}
        <Card>
          <CardContent className="space-y-0 divide-y pt-6">
            {/* Push Notification */}
            <div className="flex items-center justify-between py-4 first:pt-0">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center size-9 rounded-lg bg-muted shrink-0">
                  <Bell className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Push Notification</p>
                  <p className="text-xs text-muted-foreground">
                    Improve readability with high-contrast interface colors.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPushOpen(true)}
              >
                Setup
              </Button>
            </div>

            {/* SMTP Configuration */}
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center size-9 rounded-lg bg-muted shrink-0">
                  <Mail className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">SMTP Configuration</p>
                  <p className="text-xs text-muted-foreground">
                    Improve readability with high-contrast interface colors.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSmtpOpen(true)}
              >
                Setup
              </Button>
            </div>

            {/* Telegram Bot */}
            <div className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center size-9 rounded-lg bg-muted shrink-0">
                  <Bot className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Telegram Bot</p>
                  <p className="text-xs text-muted-foreground">
                    Improve readability with high-contrast interface colors.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTelegramOpen(true)}
              >
                Setup
              </Button>
            </div>

            {/* Notification Templates */}
            <div className="flex items-center justify-between py-4 last:pb-0">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center size-9 rounded-lg bg-muted shrink-0">
                  <Code className="size-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Notification Templates</p>
                  <p className="text-xs text-muted-foreground">
                    Improve readability with high-contrast interface colors.
                  </p>
                </div>
              </div>
              <Button variant="ghost" mode="icon" size="sm">
                <SettingsIcon className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== SMTP Configuration Modal ===== */}
      <Dialog open={smtpOpen} onOpenChange={setSmtpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>SMTP Configuration</DialogTitle>
            <DialogDescription>
              Configure your SMTP server for sending email notifications.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SMTP Host</Label>
                <Input
                  value={getVal(edits, 'smtp_host')}
                  onChange={(e) => setField('smtp_host', e.target.value)}
                  placeholder="smtp.example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>SMTP Port</Label>
                <Input
                  type="number"
                  value={getVal(edits, 'smtp_port', '587')}
                  onChange={(e) => setField('smtp_port', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  value={getVal(edits, 'smtp_username')}
                  onChange={(e) => setField('smtp_username', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={getVal(edits, 'smtp_password')}
                  onChange={(e) => setField('smtp_password', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sender Email</Label>
                <Input
                  value={getVal(edits, 'smtp_sender_email')}
                  onChange={(e) =>
                    setField('smtp_sender_email', e.target.value)
                  }
                  placeholder="noreply@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Sender Name</Label>
                <Input
                  value={getVal(edits, 'smtp_sender_name')}
                  onChange={(e) => setField('smtp_sender_name', e.target.value)}
                  placeholder="GoMPP"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Encryption</Label>
              <Select
                value={getVal(edits, 'smtp_encryption', 'tls')}
                onValueChange={(v) => setField('smtp_encryption', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="ssl">SSL</SelectItem>
                  <SelectItem value="tls">TLS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSmtpOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast.success(
                  'SMTP configuration updated. Click "Save All" to persist.',
                );
                setSmtpOpen(false);
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Push Notification Modal ===== */}
      <Dialog open={pushOpen} onOpenChange={setPushOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Push Notification</DialogTitle>
            <DialogDescription>
              Configure push notification credentials for web and mobile.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select
                value={getVal(edits, 'push_provider', 'firebase')}
                onValueChange={(v) => setField('push_provider', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="firebase">
                    Firebase Cloud Messaging
                  </SelectItem>
                  <SelectItem value="onesignal">OneSignal</SelectItem>
                  <SelectItem value="pusher">Pusher</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Server Key / API Key</Label>
              <Input
                value={getVal(edits, 'push_server_key')}
                onChange={(e) => setField('push_server_key', e.target.value)}
                placeholder="Enter your server key"
              />
            </div>
            <div className="space-y-2">
              <Label>Sender ID / App ID</Label>
              <Input
                value={getVal(edits, 'push_sender_id')}
                onChange={(e) => setField('push_sender_id', e.target.value)}
                placeholder="Enter your sender or app ID"
              />
            </div>
            <div className="space-y-2">
              <Label>VAPID Public Key</Label>
              <Input
                value={getVal(edits, 'push_vapid_public')}
                onChange={(e) => setField('push_vapid_public', e.target.value)}
                placeholder="Web push VAPID public key"
              />
            </div>
            <div className="space-y-2">
              <Label>VAPID Private Key</Label>
              <Input
                type="password"
                value={getVal(edits, 'push_vapid_private')}
                onChange={(e) => setField('push_vapid_private', e.target.value)}
                placeholder="Web push VAPID private key"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPushOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast.success(
                  'Push notification configuration updated. Click "Save All" to persist.',
                );
                setPushOpen(false);
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Telegram Bot Modal ===== */}
      <Dialog open={telegramOpen} onOpenChange={setTelegramOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Telegram Bot</DialogTitle>
            <DialogDescription>
              Connect a Telegram bot to send notifications to your channels or
              groups.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label>Bot Token</Label>
              <Input
                value={getVal(edits, 'telegram_bot_token')}
                onChange={(e) => setField('telegram_bot_token', e.target.value)}
                placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
              />
              <p className="text-xs text-muted-foreground">
                Get your bot token from @BotFather on Telegram.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Chat ID</Label>
              <Input
                value={getVal(edits, 'telegram_chat_id')}
                onChange={(e) => setField('telegram_chat_id', e.target.value)}
                placeholder="-1001234567890"
              />
              <p className="text-xs text-muted-foreground">
                Channel, group, or personal chat ID to receive notifications.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Message Thread ID (optional)</Label>
              <Input
                value={getVal(edits, 'telegram_thread_id')}
                onChange={(e) => setField('telegram_thread_id', e.target.value)}
                placeholder="Topic thread ID for supergroups"
              />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Switch
                checked={getBool(edits, 'telegram_silent')}
                onCheckedChange={(v) => setBoolField('telegram_silent', v)}
              />
              <Label>Send silently (no notification sound)</Label>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTelegramOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast.success(
                  'Telegram bot configuration updated. Click "Save All" to persist.',
                );
                setTelegramOpen(false);
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
