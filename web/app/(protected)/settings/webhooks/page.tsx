'use client';

import { useState } from 'react';
import {
  Check,
  ClipboardCopy,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Webhook as WebhookIcon,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Webhook } from '@/types/api';
import {
  useCreateWebhook,
  useDeleteWebhook,
  useRegenerateWebhookSecret,
  useUpdateWebhook,
  useWebhookDeliveries,
  useWebhooks,
} from '@/services/webhooks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/components/layouts/main/components/toolbar';

const EVENTS = [
  { id: 'transcode.started', label: 'Transcode Started' },
  { id: 'transcode.completed', label: 'Transcode Completed' },
  { id: 'transcode.failed', label: 'Transcode Failed' },
  { id: 'video.uploaded', label: 'Video Uploaded' },
  { id: 'video.deleted', label: 'Video Deleted' },
];

interface WebhookForm {
  name: string;
  url: string;
  events: string[];
  is_active: boolean;
}

const EMPTY_FORM: WebhookForm = {
  name: '',
  url: '',
  events: [],
  is_active: true,
};

export default function WebhooksPage() {
  const { data, isLoading } = useWebhooks();
  const createMutation = useCreateWebhook();
  const updateMutation = useUpdateWebhook();
  const deleteMutation = useDeleteWebhook();
  const regenerateMutation = useRegenerateWebhookSecret();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WebhookForm>(EMPTY_FORM);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [deliverySheetId, setDeliverySheetId] = useState<string | null>(null);

  const webhooks = data?.data ?? [];

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (wh: Webhook) => {
    setEditingId(wh.id);
    setForm({
      name: wh.name,
      url: wh.url,
      events: wh.events ?? [],
      is_active: wh.is_active,
    });
    setDialogOpen(true);
  };

  const toggleEvent = (event: string) => {
    setForm((f) => ({
      ...f,
      events: f.events.includes(event)
        ? f.events.filter((e) => e !== event)
        : [...f.events, event],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data: form });
        toast.success('Webhook updated');
        setDialogOpen(false);
      } else {
        const res = await createMutation.mutateAsync({
          name: form.name,
          url: form.url,
          events: form.events,
        });
        setCreatedSecret(res.data.secret);
        toast.success('Webhook created');
        setDialogOpen(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete webhook "${name}"?`)) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Webhook deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleRegenerate = async (id: string) => {
    if (
      !confirm(
        'Regenerate secret? The old secret will stop working immediately.',
      )
    )
      return;
    try {
      const res = await regenerateMutation.mutateAsync(id);
      setCreatedSecret(res.data.secret);
      toast.success('Secret regenerated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Regenerate failed');
    }
  };

  const copySecret = () => {
    if (createdSecret) {
      navigator.clipboard.writeText(createdSecret);
      toast.success('Secret copied to clipboard');
    }
  };

  return (
    <>
      <Toolbar>
        <ToolbarHeading title="Webhooks" />
        <ToolbarActions>
          <Button onClick={openCreate}>
            <Plus className="size-4 mr-1.5" />
            New Webhook
          </Button>
        </ToolbarActions>
      </Toolbar>

      <div className="container">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : webhooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <WebhookIcon className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No webhooks configured</h3>
            <p className="text-muted-foreground text-sm mt-1">
              Create a webhook to receive event notifications.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((wh) => (
                  <TableRow key={wh.id}>
                    <TableCell className="font-medium">{wh.name}</TableCell>
                    <TableCell className="max-w-48 truncate font-mono text-xs">
                      {wh.url}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(wh.events ?? []).map((ev) => (
                          <Badge key={ev} variant="outline" className="text-xs">
                            {ev}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {wh.is_active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" mode="icon" size="sm">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(wh)}>
                            <Pencil className="size-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleRegenerate(wh.id)}
                          >
                            <KeyRound className="size-4 mr-2" />
                            Regenerate Secret
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeliverySheetId(wh.id)}
                          >
                            <RefreshCw className="size-4 mr-2" />
                            Delivery Log
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(wh.id, wh.name)}
                          >
                            <Trash2 className="size-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Webhook' : 'New Webhook'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update webhook configuration.'
                : 'Configure a new webhook endpoint.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                required
                placeholder="e.g. Production Webhook"
              />
            </div>
            <div className="space-y-2">
              <Label>Endpoint URL</Label>
              <Input
                type="url"
                value={form.url}
                onChange={(e) =>
                  setForm((f) => ({ ...f, url: e.target.value }))
                }
                required
                placeholder="https://example.com/webhook"
              />
            </div>
            <div className="space-y-2">
              <Label>Events</Label>
              <div className="space-y-2">
                {EVENTS.map((event) => (
                  <label
                    key={event.id}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Checkbox
                      checked={form.events.includes(event.id)}
                      onCheckedChange={() => toggleEvent(event.id)}
                    />
                    <span className="text-sm">{event.label}</span>
                  </label>
                ))}
              </div>
            </div>
            {editingId && (
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) =>
                    setForm((f) => ({ ...f, is_active: v }))
                  }
                />
                <Label>Active</Label>
              </div>
            )}
            <DialogFooter>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingId ? 'Save Changes' : 'Create Webhook'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Secret Display Dialog */}
      <Dialog
        open={!!createdSecret}
        onOpenChange={(open) => !open && setCreatedSecret(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Webhook Secret</DialogTitle>
            <DialogDescription>
              Copy this secret now. It won&apos;t be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input value={createdSecret ?? ''} readOnly className="font-mono" />
            <Button variant="outline" size="sm" onClick={copySecret}>
              <ClipboardCopy className="size-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedSecret(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delivery Log Sheet */}
      <DeliverySheet
        webhookId={deliverySheetId}
        onClose={() => setDeliverySheetId(null)}
      />
    </>
  );
}

function DeliverySheet({
  webhookId,
  onClose,
}: {
  webhookId: string | null;
  onClose: () => void;
}) {
  const { data, isLoading } = useWebhookDeliveries(webhookId ?? '');
  const deliveries = data?.data ?? [];

  return (
    <Sheet open={!!webhookId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Delivery Log</SheetTitle>
          <SheetDescription>Recent webhook delivery attempts.</SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : deliveries.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No deliveries yet.
            </p>
          ) : (
            <div className="space-y-2">
              {deliveries.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between border rounded-lg p-3"
                >
                  <div>
                    <Badge variant="outline" className="text-xs">
                      {d.event}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(d.attempted_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{d.status_code}</Badge>
                    {d.success ? (
                      <Check className="size-4 text-green-500" />
                    ) : (
                      <X className="size-4 text-destructive" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
