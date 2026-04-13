'use client';

import { useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { CreatePresetRequest, Preset, ResolutionEntry } from '@/types/api';
import {
  useCreatePreset,
  useDeletePreset,
  usePresets,
  useUpdatePreset,
} from '@/services/presets';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
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
import { Separator } from '@/components/ui/separator';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/components/layouts/main/components/toolbar';

const RESOLUTIONS: Record<string, { w: number; h: number }> = {
  '4K': { w: 3840, h: 2160 },
  '2K': { w: 2560, h: 1440 },
  '1080p': { w: 1920, h: 1080 },
  '720p': { w: 1280, h: 720 },
  '480p': { w: 854, h: 480 },
  '360p': { w: 640, h: 360 },
};

function resolutionLabel(resolution: string): string {
  for (const [label, { w, h }] of Object.entries(RESOLUTIONS)) {
    if (resolution === `${w}x${h}`) return label;
  }
  return resolution;
}

function resolutionsToLabels(resolutions: ResolutionEntry[]): string[] {
  return resolutions.map((r) => {
    for (const [label, { w, h }] of Object.entries(RESOLUTIONS)) {
      if (r.width === w && r.height === h) return label;
    }
    return r.label;
  });
}

const EMPTY_FORM: CreatePresetRequest = {
  name: '',
  codec: 'h264',
  container: 'mp4',
  output_format: 'hls',
  resolutions: [{ label: '1920x1080', width: 1920, height: 1080 }],
  video_bitrate: '5000k',
  audio_codec: 'aac',
  audio_bitrate: '128k',
  audio_channels: 2,
  framerate: 30,
  pixel_format: 'yuv420p',
  preset_speed: 'medium',
  crf: 23,
  hls_segment_duration: 6,
  encryption: 'none',
  key_rotation_interval: 0,
  hw_accel: 'none',
  signed_url_enabled: false,
  signed_url_expiry: 3600,
  thumbnail_enabled: false,
  thumbnail_interval: 10,
  banner_enabled: false,
  banner_timestamp: 5,
  faststart: true,
  movflags: '+faststart',
  two_pass: false,
  is_default: false,
  sort_order: 0,
};

export default function PresetsPage() {
  const { data, isLoading } = usePresets();
  const createMutation = useCreatePreset();
  const updateMutation = useUpdatePreset();
  const deleteMutation = useDeletePreset();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreatePresetRequest>(EMPTY_FORM);

  const presets = data?.data ?? [];

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (preset: Preset) => {
    setEditingId(preset.id);
    setForm({
      name: preset.name,
      codec: preset.codec,
      container: preset.container,
      output_format: preset.output_format ?? 'hls',
      resolutions:
        preset.resolutions && preset.resolutions.length > 0
          ? preset.resolutions
          : [
              {
                label: preset.resolution,
                width: preset.width,
                height: preset.height,
              },
            ],
      video_bitrate: preset.video_bitrate,
      audio_codec: preset.audio_codec,
      audio_bitrate: preset.audio_bitrate,
      audio_channels: preset.audio_channels,
      framerate: preset.framerate,
      pixel_format: preset.pixel_format,
      preset_speed: preset.preset_speed,
      crf: preset.crf,
      hls_segment_duration: preset.hls_segment_duration ?? 6,
      encryption: preset.encryption ?? 'none',
      key_rotation_interval: preset.key_rotation_interval ?? 0,
      hw_accel: preset.hw_accel ?? 'none',
      signed_url_enabled: preset.signed_url_enabled ?? false,
      signed_url_expiry: preset.signed_url_expiry ?? 3600,
      thumbnail_enabled: preset.thumbnail_enabled ?? false,
      thumbnail_interval: preset.thumbnail_interval ?? 10,
      banner_enabled: preset.banner_enabled ?? false,
      banner_timestamp: preset.banner_timestamp ?? 5,
      faststart: preset.faststart ?? true,
      movflags: preset.movflags ?? '+faststart',
      two_pass: preset.two_pass ?? false,
      is_default: preset.is_default,
      sort_order: preset.sort_order,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data: form });
        toast.success('Preset updated');
      } else {
        await createMutation.mutateAsync(form);
        toast.success('Preset created');
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete preset "${name}"?`)) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Preset deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const setField = <K extends keyof CreatePresetRequest>(
    key: K,
    value: CreatePresetRequest[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  const handleResolutionChange = (values: string[]) => {
    if (values.length === 0) return;
    const entries: ResolutionEntry[] = values
      .map((label) => {
        const res = RESOLUTIONS[label];
        if (!res) return null;
        return { label: `${res.w}x${res.h}`, width: res.w, height: res.h };
      })
      .filter((e): e is ResolutionEntry => e !== null);
    if (entries.length > 0) {
      setForm((f) => ({
        ...f,
        resolutions: entries,
      }));
    }
  };

  const currentResLabels = resolutionsToLabels(form.resolutions ?? []);

  return (
    <>
      <Toolbar>
        <ToolbarHeading title="Encoding & Transcoding Presets" />
        <ToolbarActions>
          <Button onClick={openCreate}>
            <Plus className="size-4 mr-1.5" />
            New Preset
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
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Codec</TableHead>
                  <TableHead>Resolution</TableHead>
                  <TableHead>Bitrate</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {presets.map((preset) => (
                  <TableRow key={preset.id}>
                    <TableCell className="font-medium">{preset.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {(
                          preset.output_format ?? preset.container
                        ).toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{preset.codec}</Badge>
                    </TableCell>
                    <TableCell>
                      {preset.resolutions && preset.resolutions.length > 0
                        ? resolutionsToLabels(preset.resolutions).join(', ')
                        : resolutionLabel(preset.resolution)}
                    </TableCell>
                    <TableCell>{preset.video_bitrate}</TableCell>
                    <TableCell>
                      {preset.is_default ? (
                        <Check className="size-4 text-green-500" />
                      ) : (
                        <X className="size-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>
                      {preset.is_active ? (
                        <Check className="size-4 text-green-500" />
                      ) : (
                        <X className="size-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          mode="icon"
                          size="sm"
                          onClick={() => openEdit(preset)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          mode="icon"
                          size="sm"
                          onClick={() => handleDelete(preset.id, preset.name)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Preset' : 'New Preset'}
            </DialogTitle>
            <DialogDescription>
              Configure encoding parameters for the preset.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name */}
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                required
                placeholder="e.g. 1080p HLS Standard"
              />
            </div>

            {/* Output & Codec */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Output Format</Label>
                <Select
                  value={form.output_format ?? 'hls'}
                  onValueChange={(v) => setField('output_format', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hls">HLS</SelectItem>
                    <SelectItem value="dash">DASH</SelectItem>
                    <SelectItem value="fmp4">FMP4</SelectItem>
                    <SelectItem value="webm">WebM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Codec</Label>
                <Select
                  value={form.codec}
                  onValueChange={(v) => setField('codec', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="h264">H.264</SelectItem>
                    <SelectItem value="h265">H.265</SelectItem>
                    <SelectItem value="vp9">VP9</SelectItem>
                    <SelectItem value="av1">AV1</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Resolution Toggle Group (multi-select) */}
            <div className="space-y-2">
              <Label>Resolutions</Label>
              <ToggleGroup
                type="multiple"
                value={currentResLabels}
                onValueChange={handleResolutionChange}
                className="flex-wrap justify-start"
              >
                {Object.keys(RESOLUTIONS).map((label) => (
                  <ToggleGroupItem key={label} value={label} size="sm">
                    {label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            {/* Bitrate */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Video Bitrate</Label>
                <Input
                  value={form.video_bitrate ?? ''}
                  onChange={(e) => setField('video_bitrate', e.target.value)}
                  placeholder="5000k"
                />
              </div>
              <div className="space-y-2">
                <Label>Preset Speed</Label>
                <Select
                  value={form.preset_speed ?? 'medium'}
                  onValueChange={(v) => setField('preset_speed', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ultrafast">Ultrafast</SelectItem>
                    <SelectItem value="veryfast">Very Fast</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="slow">Slow</SelectItem>
                    <SelectItem value="veryslow">Very Slow</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* HLS-specific */}
            {form.output_format === 'hls' && (
              <div className="space-y-2">
                <Label>HLS Segment Duration (seconds)</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={form.hls_segment_duration ?? 6}
                  onChange={(e) =>
                    setField('hls_segment_duration', Number(e.target.value))
                  }
                />
              </div>
            )}

            <Separator />

            {/* Encryption */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Encryption</Label>
                <Select
                  value={form.encryption ?? 'none'}
                  onValueChange={(v) => setField('encryption', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="aes-128">AES-128</SelectItem>
                    <SelectItem value="sample-aes">Sample-AES</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.encryption !== 'none' && (
                <div className="space-y-2">
                  <Label>Key Rotation Interval (seconds)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.key_rotation_interval ?? 0}
                    onChange={(e) =>
                      setField('key_rotation_interval', Number(e.target.value))
                    }
                  />
                </div>
              )}
            </div>

            {/* Hardware Acceleration */}
            <div className="space-y-2">
              <Label>Hardware Acceleration</Label>
              <Select
                value={form.hw_accel ?? 'none'}
                onValueChange={(v) => setField('hw_accel', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="nvenc">NVENC</SelectItem>
                  <SelectItem value="quicksync">QuickSync</SelectItem>
                  <SelectItem value="vaapi">VAAPI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Signed URL */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.signed_url_enabled ?? false}
                  onCheckedChange={(v) => setField('signed_url_enabled', v)}
                />
                <Label>Signed URLs</Label>
              </div>
              {form.signed_url_enabled && (
                <div className="space-y-2 pl-10">
                  <Label>Expiry Time (seconds)</Label>
                  <Input
                    type="number"
                    min={60}
                    value={form.signed_url_expiry ?? 3600}
                    onChange={(e) =>
                      setField('signed_url_expiry', Number(e.target.value))
                    }
                  />
                </div>
              )}
            </div>

            {/* Thumbnail & Banner */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={form.thumbnail_enabled ?? false}
                    onCheckedChange={(v) => setField('thumbnail_enabled', v)}
                  />
                  <Label>Thumbnail Generation</Label>
                </div>
                {form.thumbnail_enabled && (
                  <div className="space-y-2 pl-10">
                    <Label>Capture Interval (seconds)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.thumbnail_interval ?? 10}
                      onChange={(e) =>
                        setField('thumbnail_interval', Number(e.target.value))
                      }
                    />
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={form.banner_enabled ?? false}
                    onCheckedChange={(v) => setField('banner_enabled', v)}
                  />
                  <Label>Banner Image Generation</Label>
                </div>
                {form.banner_enabled && (
                  <div className="space-y-2 pl-10">
                    <Label>Capture Timestamp (seconds)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.banner_timestamp ?? 5}
                      onChange={(e) =>
                        setField('banner_timestamp', Number(e.target.value))
                      }
                    />
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Audio Settings */}
            <div>
              <h4 className="text-sm font-medium mb-3">Audio Settings</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Audio Codec</Label>
                  <Select
                    value={form.audio_codec ?? 'aac'}
                    onValueChange={(v) => setField('audio_codec', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aac">AAC</SelectItem>
                      <SelectItem value="opus">Opus</SelectItem>
                      <SelectItem value="vorbis">Vorbis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Audio Bitrate</Label>
                  <Input
                    value={form.audio_bitrate ?? ''}
                    onChange={(e) => setField('audio_bitrate', e.target.value)}
                    placeholder="128k"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Channels</Label>
                  <Select
                    value={String(form.audio_channels ?? 2)}
                    onValueChange={(v) => setField('audio_channels', Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Mono (1)</SelectItem>
                      <SelectItem value="2">Stereo (2)</SelectItem>
                      <SelectItem value="6">5.1 (6)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* FFmpeg Flags */}
            <div>
              <h4 className="text-sm font-medium mb-3">FFmpeg Flags</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CRF</Label>
                  <Input
                    type="number"
                    min={0}
                    max={51}
                    value={form.crf ?? 23}
                    onChange={(e) => setField('crf', Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>movflags</Label>
                  <Input
                    value={form.movflags ?? ''}
                    onChange={(e) => setField('movflags', e.target.value)}
                    placeholder="+faststart"
                  />
                </div>
              </div>
              <div className="flex gap-6 mt-3">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={form.faststart ?? true}
                    onCheckedChange={(v) => setField('faststart', v)}
                  />
                  <Label>faststart</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={form.two_pass ?? false}
                    onCheckedChange={(v) => setField('two_pass', v)}
                  />
                  <Label>Two-pass Encoding</Label>
                </div>
              </div>
            </div>

            <Separator />

            {/* Default Preset */}
            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_default ?? false}
                onCheckedChange={(v) => setField('is_default', v)}
              />
              <Label>Default preset</Label>
            </div>

            <DialogFooter>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingId ? 'Save Changes' : 'Create Preset'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
