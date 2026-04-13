'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ExternalLink, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { usePresets } from '@/services/presets';
import { useVerifyFFmpeg } from '@/services/settings';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { getBool, getVal, type SettingsTabProps } from './settings-helpers';

export function EncodingSettingsTab({
  edits,
  setField,
  setBoolField,
}: SettingsTabProps) {
  const verifyFFmpeg = useVerifyFFmpeg();
  const [ffmpegStatus, setFfmpegStatus] = useState<{
    valid: boolean;
    version: string;
  } | null>(null);

  const { data: presetsData } = usePresets();
  const presets = presetsData?.data ?? [];

  const handleVerify = async () => {
    setFfmpegStatus(null);
    try {
      const res = await verifyFFmpeg.mutateAsync(
        getVal(edits, 'ffmpeg_path', 'ffmpeg'),
      );
      const result = res.data;
      setFfmpegStatus({ valid: result.valid, version: result.version });
      if (result.valid) {
        toast.success('FFmpeg verified: ' + result.version);
      } else {
        toast.error(result.error || 'FFmpeg not found');
      }
    } catch {
      toast.error('Failed to verify FFmpeg');
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Encoding Settings</CardTitle>
          <CardDescription>
            Configure the transcoding pipeline and storage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Max Concurrent Jobs</Label>
              <Input
                type="number"
                min={1}
                max={32}
                value={getVal(edits, 'max_concurrent_jobs', '2')}
                onChange={(e) =>
                  setField('max_concurrent_jobs', e.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Default Preset</Label>
              <Select
                value={getVal(edits, 'default_preset')}
                onValueChange={(v) => setField('default_preset', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a preset" />
                </SelectTrigger>
                <SelectContent>
                  {presets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Temp Directory</Label>
              <Input
                value={getVal(edits, 'temp_directory')}
                onChange={(e) => setField('temp_directory', e.target.value)}
                placeholder="./tmp"
              />
            </div>
            <div className="space-y-2">
              <Label>FFmpeg Path</Label>
              <div className="flex gap-2">
                <Input
                  value={getVal(edits, 'ffmpeg_path', 'ffmpeg')}
                  onChange={(e) => {
                    setField('ffmpeg_path', e.target.value);
                    setFfmpegStatus(null);
                  }}
                  placeholder="ffmpeg"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleVerify}
                  disabled={verifyFFmpeg.isPending}
                  className="shrink-0"
                >
                  {verifyFFmpeg.isPending ? (
                    <Loader2 className="size-4 animate-spin mr-1.5" />
                  ) : ffmpegStatus?.valid ? (
                    <CheckCircle2 className="size-4 text-green-500 mr-1.5" />
                  ) : ffmpegStatus && !ffmpegStatus.valid ? (
                    <XCircle className="size-4 text-red-500 mr-1.5" />
                  ) : null}
                  Verify
                </Button>
              </div>
              {ffmpegStatus?.valid && (
                <p className="text-xs text-green-600">{ffmpegStatus.version}</p>
              )}
              {ffmpegStatus && !ffmpegStatus.valid && (
                <p className="text-xs text-red-500">
                  FFmpeg not found at this path
                </p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Active Storage Backend</Label>
            <Select
              value={getVal(edits, 'storage_backend', 'local')}
              onValueChange={(v) => setField('storage_backend', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local</SelectItem>
                <SelectItem value="s3">S3 / S3-Compatible</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {getVal(edits, 'storage_backend') === 's3' && (
            <div className="grid grid-cols-2 gap-4 border-t pt-4">
              <div className="space-y-2">
                <Label>S3 Endpoint</Label>
                <Input
                  value={getVal(edits, 's3_endpoint')}
                  onChange={(e) => setField('s3_endpoint', e.target.value)}
                  placeholder="https://s3.amazonaws.com"
                />
              </div>
              <div className="space-y-2">
                <Label>S3 Region</Label>
                <Input
                  value={getVal(edits, 's3_region')}
                  onChange={(e) => setField('s3_region', e.target.value)}
                  placeholder="us-east-1"
                />
              </div>
              <div className="space-y-2">
                <Label>S3 Bucket</Label>
                <Input
                  value={getVal(edits, 's3_bucket')}
                  onChange={(e) => setField('s3_bucket', e.target.value)}
                  placeholder="my-bucket"
                />
              </div>
              <div className="space-y-2">
                <Label>S3 Access Key</Label>
                <Input
                  value={getVal(edits, 's3_access_key')}
                  onChange={(e) => setField('s3_access_key', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>S3 Secret Key</Label>
                <Input
                  type="password"
                  value={getVal(edits, 's3_secret_key')}
                  onChange={(e) => setField('s3_secret_key', e.target.value)}
                />
              </div>
            </div>
          )}

          {getVal(edits, 'storage_backend', 'local') === 'local' && (
            <div className="grid grid-cols-2 gap-4 border-t pt-4">
              <div className="space-y-2">
                <Label>Upload Path</Label>
                <Input
                  value={getVal(edits, 'local_upload_path')}
                  onChange={(e) =>
                    setField('local_upload_path', e.target.value)
                  }
                  placeholder="./uploads"
                />
              </div>
              <div className="space-y-2">
                <Label>Output Path</Label>
                <Input
                  value={getVal(edits, 'local_output_path')}
                  onChange={(e) =>
                    setField('local_output_path', e.target.value)
                  }
                  placeholder="./output"
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Switch
              checked={getBool(edits, 'keep_original_file')}
              onCheckedChange={(v) => setBoolField('keep_original_file', v)}
            />
            <Label>Keep Original File</Label>
          </div>
        </CardContent>
      </Card>

      {/* Link to presets */}
      <Card className="mt-4">
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <p className="font-medium">Encoding Presets</p>
            <p className="text-sm text-muted-foreground">
              Manage codec, resolution, and quality presets.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/presets">
              Manage Presets
              <ExternalLink className="size-4 ml-1.5" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </>
  );
}
