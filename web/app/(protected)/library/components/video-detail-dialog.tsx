'use client';

import { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Film,
  ImagePlus,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { JobStatus, Video, VideoStatus } from '@/types/api';
import {
  useAttachSubtitle,
  useDeleteSubtitle,
  useSubtitleSearch,
  useUploadSubtitle,
  useVideoSubtitles,
} from '@/services/subtitles';
import {
  useDeleteVideo,
  useRetranscodeVideo,
  useSetThumbnail,
  useUpdateVideo,
  useUploadThumbnail,
  useVideo,
  useVideoThumbnails,
} from '@/services/videos';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VideoPlayer } from '@/components/video-player';

// helpers

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

const STATUS_LABEL: Record<VideoStatus, string> = {
  uploading: 'Uploading',
  uploaded: 'Uploaded',
  processing: 'Processing',
  ready: 'Active',
  failed: 'Failed',
  deleted: 'Deleted',
};

const STATUS_BADGE_VARIANT: Record<
  VideoStatus,
  'primary' | 'success' | 'warning' | 'destructive' | 'secondary'
> = {
  uploading: 'primary',
  uploaded: 'secondary',
  processing: 'warning',
  ready: 'success',
  failed: 'destructive',
  deleted: 'secondary',
};

const JOB_BADGE: Record<
  JobStatus,
  {
    variant: 'primary' | 'success' | 'warning' | 'destructive' | 'secondary';
    label: string;
  }
> = {
  pending: { variant: 'secondary', label: 'Pending' },
  processing: { variant: 'warning', label: 'Processing' },
  completed: { variant: 'success', label: 'Completed' },
  failed: { variant: 'destructive', label: 'Failed' },
  cancelled: { variant: 'secondary', label: 'Cancelled' },
};

// stat card

function StatItem({
  label,
  value,
  trend,
  trendLabel,
}: {
  label: string;
  value: string;
  trend?: number;
  trendLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold">{value}</span>
      {trend !== undefined && (
        <div
          className={`flex items-center gap-1 text-xs ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}
        >
          {trend >= 0 ? (
            <TrendingUp className="size-3" />
          ) : (
            <TrendingDown className="size-3" />
          )}
          {Math.abs(trend).toFixed(1)}%
          {trendLabel && (
            <span className="text-muted-foreground ml-0.5">{trendLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}

// copy button

function CopyField({ label, value }: { label: string; value: string }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <Input value={value} readOnly className="text-sm font-mono" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          mode="icon"
          onClick={handleCopy}
        >
          <Copy className="size-4" />
        </Button>
      </div>
    </div>
  );
}

// main dialog

interface VideoDetailDialogProps {
  videoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function VideoDetailDialog({
  videoId,
  open,
  onOpenChange,
  onDeleted,
}: VideoDetailDialogProps) {
  const [shouldPoll, setShouldPoll] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const { data, isLoading } = useVideo(videoId ?? '', shouldPoll);
  const updateMutation = useUpdateVideo();
  const deleteMutation = useDeleteVideo();
  const retranscodeMutation = useRetranscodeVideo();

  const [subtitleQuery, setSubtitleQuery] = useState('');
  const [subtitleLang, setSubtitleLang] = useState('en');
  const [searchEnabled, setSearchEnabled] = useState(false);
  const subtitleSearch = useSubtitleSearch({
    query: subtitleQuery,
    languages: subtitleLang,
    enabled: searchEnabled && subtitleQuery.length > 0,
  });
  const attachSubtitle = useAttachSubtitle();
  const deleteSubtitle = useDeleteSubtitle();
  const uploadSubtitle = useUploadSubtitle();
  const videoSubtitles = useVideoSubtitles(videoId ?? '');
  const subtitleFileRef = useRef<HTMLInputElement>(null);
  const [uploadSubLang, setUploadSubLang] = useState('en');
  const [uploadSubLabel, setUploadSubLabel] = useState('');

  // Thumbnail management
  const thumbnailsQuery = useVideoThumbnails(videoId ?? '');
  const setThumbnailMutation = useSetThumbnail();
  const uploadThumbnailMutation = useUploadThumbnail();
  const thumbnailFileRef = useRef<HTMLInputElement>(null);

  const video = data?.data?.video;
  const jobs = data?.data?.jobs ?? [];
  const streamUrl = data?.data?.stream_url;

  const hasActiveJobs = useMemo(
    () => jobs.some((j) => j.status === 'pending' || j.status === 'processing'),
    [jobs],
  );

  if (hasActiveJobs !== shouldPoll) {
    setShouldPoll(hasActiveJobs);
  }

  const handleSelectThumbnail = async (path: string) => {
    if (!videoId) return;
    try {
      await setThumbnailMutation.mutateAsync({ id: videoId, path });
      toast.success('Thumbnail updated');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to set thumbnail',
      );
    }
  };

  const handleUploadThumbnail = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !videoId) return;
    try {
      await uploadThumbnailMutation.mutateAsync({ id: videoId, file });
      toast.success('Custom thumbnail uploaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    }
    if (thumbnailFileRef.current) thumbnailFileRef.current.value = '';
  };

  const handleDelete = async () => {
    if (!videoId) return;
    if (!confirm('Delete this video? This cannot be undone.')) return;
    try {
      await deleteMutation.mutateAsync(videoId);
      toast.success('Video deleted');
      onOpenChange(false);
      onDeleted?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleToggleDownload = async (checked: boolean) => {
    if (!videoId) return;
    try {
      await updateMutation.mutateAsync({
        id: videoId,
        data: { allow_download: checked },
      });
      toast.success(checked ? 'Download enabled' : 'Download disabled');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handleTitleSave = async () => {
    if (!videoId || !titleDraft.trim()) return;
    try {
      await updateMutation.mutateAsync({
        id: videoId,
        data: { title: titleDraft.trim() },
      });
      toast.success('Title updated');
      setEditingTitle(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handleRetranscode = async () => {
    if (!videoId) return;
    if (
      !confirm('Re-transcode this video? This will create new transcode jobs.')
    )
      return;
    try {
      await retranscodeMutation.mutateAsync({ id: videoId });
      toast.success('Re-transcode started');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Re-transcode failed');
    }
  };

  const apiBase =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
  const siteBase = apiBase.replace('/api/v1', '');

  const handleCopyEmbed = () => {
    if (!video) return;
    const embedUrl = `${siteBase}/embed/${video.id}`;
    const embed = `<iframe src="${embedUrl}" width="640" height="360" frameborder="0" allowfullscreen></iframe>`;
    navigator.clipboard.writeText(embed);
    toast.success('Embed code copied!');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        close={false}
        className="w-full sm:max-w-2xl overflow-y-auto p-0"
      >
        {/* Close button outside top-left */}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute -left-10 top-4 z-50 rounded-full bg-background border p-1.5 shadow-md hover:bg-muted transition-colors cursor-pointer"
        >
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </button>

        {isLoading || !video ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="p-6 space-y-6">
            <SheetHeader className="space-y-1">
              <div className="flex items-center gap-3">
                <SheetTitle className="text-lg">{video.title}</SheetTitle>
                <Badge
                  variant={STATUS_BADGE_VARIANT[video.status]}
                  appearance="light"
                  size="sm"
                >
                  {STATUS_LABEL[video.status]}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                {video.id}
              </p>
            </SheetHeader>

            {/* Tabs */}
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="caption">Caption</TabsTrigger>
                <TabsTrigger value="chapters">Chapters</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4 space-y-6">
                {/* Player preview for ready videos */}
                {video.status === 'ready' && video.master_playlist && (
                  <div className="aspect-video rounded-lg overflow-hidden border bg-black">
                    <VideoPlayer
                      src={`${siteBase}/${streamUrl || video.master_playlist}`}
                      title={video.title}
                      poster={
                        video.thumbnail_path
                          ? `${siteBase}/${video.thumbnail_path}`
                          : undefined
                      }
                      subtitles={(videoSubtitles.data?.data ?? []).map((s) => ({
                        id: s.id,
                        language: s.language,
                        label: s.label,
                        format: s.format,
                        url: `${siteBase}/subtitles/serve/${s.id}`,
                      }))}
                      className="size-full"
                    />
                  </div>
                )}

                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-lg border p-4">
                  <StatItem
                    label="Total Views"
                    value={formatNumber(video.view_count)}
                    trend={12.5}
                    trendLabel="Annual trend"
                  />
                  <StatItem
                    label="Bandwidth Served"
                    value="—"
                    trend={3.2}
                    trendLabel="Monthly trend"
                  />
                  <StatItem
                    label="Traffic Served"
                    value="—"
                    trend={-1.4}
                    trendLabel="Weekly trend"
                  />
                  <StatItem
                    label="Income"
                    value="—"
                    trend={8.7}
                    trendLabel="Daily trend"
                  />
                </div>

                {/* Main content: left thumbnail / right form */}
                <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6">
                  {/* Left column */}
                  <div className="space-y-4">
                    {/* Active Thumbnail */}
                    <div className="aspect-video rounded-lg bg-muted flex items-center justify-center overflow-hidden border">
                      {video.thumbnail_path ? (
                        <img
                          src={`${siteBase}/${video.thumbnail_path}`}
                          alt={video.title}
                          className="size-full object-cover"
                        />
                      ) : (
                        <Film className="size-10 text-muted-foreground" />
                      )}
                    </div>

                    {/* Thumbnail Selector */}
                    {video.status === 'ready' && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">
                          Thumbnail
                        </Label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {/* Upload button */}
                          <button
                            type="button"
                            onClick={() => thumbnailFileRef.current?.click()}
                            className="aspect-video rounded border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-0.5 hover:border-primary hover:bg-muted/50 transition-colors cursor-pointer"
                            disabled={uploadThumbnailMutation.isPending}
                          >
                            {uploadThumbnailMutation.isPending ? (
                              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                            ) : (
                              <ImagePlus className="size-3.5 text-muted-foreground" />
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              Upload
                            </span>
                          </button>
                          <input
                            ref={thumbnailFileRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleUploadThumbnail}
                          />

                          {/* Thumbnail candidates */}
                          {(thumbnailsQuery.data?.data?.thumbnails ?? []).map(
                            (thumb) => {
                              const isActive = video.thumbnail_path === thumb;
                              return (
                                <button
                                  key={thumb}
                                  type="button"
                                  onClick={() => handleSelectThumbnail(thumb)}
                                  className={`aspect-video rounded overflow-hidden cursor-pointer transition-all ${
                                    isActive
                                      ? 'ring-2 ring-primary ring-offset-1'
                                      : 'border border-transparent hover:ring-2 hover:ring-muted-foreground/40'
                                  }`}
                                  disabled={setThumbnailMutation.isPending}
                                >
                                  <img
                                    src={`${siteBase}/${thumb}`}
                                    alt="Thumbnail candidate"
                                    className="size-full object-cover"
                                  />
                                </button>
                              );
                            },
                          )}
                        </div>
                      </div>
                    )}

                    {/* Meta info */}
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Duration</span>
                        <span className="font-medium">
                          {formatDuration(video.duration)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Size</span>
                        <span className="font-medium">
                          {formatBytes(
                            video.transcoded_size > 0
                              ? video.transcoded_size
                              : video.file_size,
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status</span>
                        <Badge
                          variant={STATUS_BADGE_VARIANT[video.status]}
                          appearance="light"
                          size="sm"
                        >
                          {STATUS_LABEL[video.status]}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Embeds</span>
                        <span className="font-medium">—</span>
                      </div>
                    </div>
                  </div>

                  {/* Right column */}
                  <div className="space-y-4">
                    {/* Editable Video Title */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Video Title
                      </Label>
                      {editingTitle ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={titleDraft}
                            onChange={(e) => setTitleDraft(e.target.value)}
                            className="text-sm"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleTitleSave();
                              if (e.key === 'Escape') setEditingTitle(false);
                            }}
                            autoFocus
                          />
                          <Button
                            size="sm"
                            onClick={handleTitleSave}
                            disabled={updateMutation.isPending}
                          >
                            {updateMutation.isPending ? 'Saving...' : 'Save'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingTitle(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Input
                            value={video.title}
                            readOnly
                            className="text-sm"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            mode="icon"
                            onClick={() => {
                              setTitleDraft(video.title);
                              setEditingTitle(true);
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <CopyField label="Video ID" value={video.id} />

                    <CopyField
                      label="HLS Playlist URL"
                      value={
                        video.master_playlist
                          ? `${siteBase}/${streamUrl || video.master_playlist}`
                          : '—'
                      }
                    />

                    <CopyField
                      label="Thumbnail URL"
                      value={
                        video.thumbnail_path
                          ? `${siteBase}/${video.thumbnail_path}`
                          : '—'
                      }
                    />

                    <CopyField
                      label="Embed Code"
                      value={`<iframe src="${siteBase}/embed/${video.id}" width="640" height="360" frameborder="0" allowfullscreen></iframe>`}
                    />

                    <CopyField
                      label="Direct Play URL"
                      value={`${typeof window !== 'undefined' ? window.location.origin : ''}/watch/${video.slug}`}
                    />

                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="text-sm font-medium">
                          Allow Video Download
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Enable direct file download for viewers
                        </p>
                      </div>
                      <Switch
                        checked={video.allow_download}
                        onCheckedChange={handleToggleDownload}
                        disabled={updateMutation.isPending}
                      />
                    </div>
                  </div>
                </div>

                {/* Transcode Jobs */}
                {jobs.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      Transcode Jobs
                      {hasActiveJobs && (
                        <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                      )}
                    </h4>
                    <div className="space-y-2">
                      {jobs.map((job) => {
                        const badge = JOB_BADGE[job.status];
                        return (
                          <div
                            key={job.id}
                            className="flex flex-col gap-2 rounded-lg border p-3"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {job.status === 'processing' && (
                                  <Loader2 className="size-3.5 animate-spin text-yellow-500" />
                                )}
                                {job.status === 'completed' && (
                                  <CheckCircle2 className="size-3.5 text-green-500" />
                                )}
                                {job.status === 'failed' && (
                                  <AlertCircle className="size-3.5 text-red-500" />
                                )}
                                {(job.status === 'pending' ||
                                  job.status === 'cancelled') && (
                                  <Clock className="size-3.5 text-muted-foreground" />
                                )}
                                <span className="text-xs font-medium font-mono">
                                  {job.preset_id.slice(0, 8)}
                                </span>
                                <Badge
                                  variant={badge.variant}
                                  appearance="light"
                                  size="sm"
                                >
                                  {badge.label}
                                </Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                Attempt {job.attempts}/{job.max_attempts}
                              </span>
                            </div>
                            {(job.status === 'processing' ||
                              job.status === 'pending') && (
                              <div className="flex items-center gap-3">
                                <Progress
                                  value={job.progress}
                                  className="flex-1 h-1.5"
                                />
                                <span className="text-xs font-medium tabular-nums w-10 text-right">
                                  {Math.round(job.progress)}%
                                </span>
                              </div>
                            )}
                            {job.status === 'failed' && job.error_message && (
                              <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 rounded px-3 py-1.5">
                                {job.error_message}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Bottom actions */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="size-4 mr-1.5" />
                    Delete Video
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetranscode}
                      disabled={retranscodeMutation.isPending || hasActiveJobs}
                    >
                      <RefreshCw className="size-4 mr-1.5" />
                      {retranscodeMutation.isPending
                        ? 'Starting...'
                        : 'Re-transcode'}
                    </Button>
                    <Button size="sm" onClick={handleCopyEmbed}>
                      <Copy className="size-4 mr-1.5" />
                      Copy Embed Code
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="caption" className="mt-4 space-y-4">
                {/* Attached subtitles */}
                {videoSubtitles.data?.data &&
                  videoSubtitles.data.data.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Attached Subtitles
                      </p>
                      <div className="space-y-1">
                        {videoSubtitles.data.data.map((sub) => (
                          <div
                            key={sub.id}
                            className="flex items-center justify-between rounded-lg border p-2.5 text-sm"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Badge variant="secondary" size="sm">
                                {sub.language.toUpperCase()}
                              </Badge>
                              <span className="truncate">{sub.label}</span>
                              <span className="text-xs text-muted-foreground">
                                {sub.format.toUpperCase()}
                              </span>
                              {sub.source === 'opensubtitles' && (
                                <Badge variant="outline" size="sm">
                                  OpenSub
                                </Badge>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              disabled={deleteSubtitle.isPending}
                              onClick={async () => {
                                try {
                                  await deleteSubtitle.mutateAsync({
                                    videoId: videoId!,
                                    subtitleId: sub.id,
                                  });
                                  toast.success('Subtitle removed');
                                } catch {
                                  toast.error('Failed to remove subtitle');
                                }
                              }}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Manual upload */}
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Upload Subtitle File
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Language code"
                      value={uploadSubLang}
                      onChange={(e) => setUploadSubLang(e.target.value)}
                      className="text-sm w-20"
                    />
                    <Input
                      placeholder="Label (e.g. English)"
                      value={uploadSubLabel}
                      onChange={(e) => setUploadSubLabel(e.target.value)}
                      className="text-sm flex-1"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={uploadSubtitle.isPending}
                      onClick={() => subtitleFileRef.current?.click()}
                    >
                      {uploadSubtitle.isPending ? (
                        <Loader2 className="size-4 animate-spin mr-1.5" />
                      ) : (
                        <Upload className="size-4 mr-1.5" />
                      )}
                      Upload
                    </Button>
                    <input
                      ref={subtitleFileRef}
                      type="file"
                      accept=".srt,.vtt,.ass,.sub,.ssa"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !videoId) return;
                        try {
                          await uploadSubtitle.mutateAsync({
                            videoId,
                            file,
                            language: uploadSubLang || 'en',
                            label: uploadSubLabel || uploadSubLang || 'en',
                          });
                          toast.success('Subtitle uploaded');
                          setUploadSubLabel('');
                        } catch {
                          toast.error('Failed to upload subtitle');
                        }
                        e.target.value = '';
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Supported formats: SRT, VTT, ASS, SUB, SSA (max 10 MB)
                  </p>
                </div>

                {/* Subtitle search */}
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Search OpenSubtitles
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Search subtitles (movie/series name)..."
                      value={subtitleQuery}
                      onChange={(e) => {
                        setSubtitleQuery(e.target.value);
                        setSearchEnabled(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && subtitleQuery.trim()) {
                          setSearchEnabled(true);
                        }
                      }}
                      className="text-sm"
                    />
                    <Input
                      placeholder="Lang"
                      value={subtitleLang}
                      onChange={(e) => setSubtitleLang(e.target.value)}
                      className="text-sm w-20"
                    />
                    <Button
                      size="sm"
                      onClick={() => setSearchEnabled(true)}
                      disabled={!subtitleQuery.trim()}
                    >
                      <Search className="size-4" />
                    </Button>
                  </div>

                  {subtitleSearch.isLoading && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    </div>
                  )}

                  {subtitleSearch.data && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        {subtitleSearch.data.total_count} results found
                      </p>
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {subtitleSearch.data.data?.map((sub) => (
                          <div
                            key={sub.id}
                            className="flex items-center justify-between rounded-lg border p-3 text-sm"
                          >
                            <div className="space-y-0.5 flex-1 min-w-0">
                              <p className="font-medium truncate">
                                {sub.attributes.release ||
                                  sub.attributes.feature_details?.title}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{sub.attributes.language}</span>
                                <span>·</span>
                                <span>
                                  {sub.attributes.download_count} downloads
                                </span>
                                {sub.attributes.hearing_impaired && (
                                  <>
                                    <span>·</span>
                                    <Badge variant="outline" size="sm">
                                      HI
                                    </Badge>
                                  </>
                                )}
                                {sub.attributes.ai_translated && (
                                  <>
                                    <span>·</span>
                                    <Badge variant="warning" size="sm">
                                      AI
                                    </Badge>
                                  </>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={attachSubtitle.isPending}
                              onClick={async () => {
                                const file = sub.attributes.files?.[0];
                                if (!file) return;
                                try {
                                  await attachSubtitle.mutateAsync({
                                    videoId: videoId!,
                                    fileId: file.file_id,
                                    language: sub.attributes.language,
                                    label:
                                      sub.attributes.release ||
                                      sub.attributes.feature_details?.title ||
                                      sub.attributes.language,
                                  });
                                  toast.success('Subtitle attached to video');
                                } catch {
                                  toast.error('Failed to attach subtitle');
                                }
                              }}
                            >
                              {attachSubtitle.isPending ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Download className="size-4" />
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!subtitleSearch.data && !subtitleSearch.isLoading && (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                      <p className="text-sm">
                        Search for subtitles on OpenSubtitles.
                      </p>
                      <p className="text-xs mt-1">
                        Enter a movie or series name above and press Enter.
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="chapters" className="mt-4">
                <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                  <p className="text-sm">No chapters defined yet.</p>
                  <p className="text-xs mt-1">
                    Add chapters to help viewers navigate your video.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
