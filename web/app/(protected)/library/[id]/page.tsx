'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Edit,
  Film,
  HardDrive,
  Loader2,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { JobStatus, VideoStatus } from '@/types/api';
import {
  useDeleteVideo,
  useRetranscodeVideo,
  useUpdateVideo,
  useVideo,
} from '@/services/videos';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/components/layouts/main/components/toolbar';

const STATUS_COLORS: Record<VideoStatus, string> = {
  uploading: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  uploaded: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
  processing:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  ready: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  deleted: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
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

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VideoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  // Determine if we should poll (when there are active jobs)
  const [shouldPoll, setShouldPoll] = useState(false);
  const { data, isLoading } = useVideo(id, shouldPoll);
  const updateMutation = useUpdateVideo();
  const deleteMutation = useDeleteVideo();
  const retranscodeMutation = useRetranscodeVideo();

  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const video = data?.data?.video;
  const jobs = data?.data?.jobs ?? [];

  // Auto-enable polling when there are active jobs
  const hasActiveJobs = useMemo(() => {
    const active = jobs.some(
      (j) => j.status === 'pending' || j.status === 'processing',
    );
    return active;
  }, [jobs]);

  // Sync polling state
  if (hasActiveJobs !== shouldPoll) {
    setShouldPoll(hasActiveJobs);
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateMutation.mutateAsync({
        id,
        data: { title: editTitle, description: editDescription },
      });
      toast.success('Video updated');
      setEditOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this video? This cannot be undone.')) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Video deleted');
      router.push('/library');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleRetranscode = async () => {
    try {
      const res = await retranscodeMutation.mutateAsync({ id });
      toast.success(`Queued ${res.data.jobs_created} transcode job(s)`);
      setShouldPoll(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Retranscode failed');
    }
  };

  if (isLoading) {
    return (
      <>
        <Toolbar>
          <ToolbarHeading title="Video Detail" />
        </Toolbar>
        <div className="container space-y-4">
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      </>
    );
  }

  if (!video) {
    return (
      <>
        <Toolbar>
          <ToolbarHeading title="Video Not Found" />
        </Toolbar>
        <div className="container text-center py-20">
          <Film className="size-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            This video does not exist or you don&apos;t have access.
          </p>
          <Button asChild className="mt-4">
            <Link href="/library">Back to Library</Link>
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <Toolbar>
        <ToolbarHeading title={video.title} />
        <ToolbarActions>
          <Button variant="outline" size="sm" asChild>
            <Link href="/library">
              <ArrowLeft className="size-4 mr-1.5" />
              Back
            </Link>
          </Button>
          <Dialog
            open={editOpen}
            onOpenChange={(open) => {
              setEditOpen(open);
              if (open) {
                setEditTitle(video.title);
                setEditDescription(video.description ?? '');
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Edit className="size-4 mr-1.5" />
                Edit
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Video</DialogTitle>
                <DialogDescription>
                  Update the video title and description.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleEdit}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-title">Title</Label>
                    <Input
                      id="edit-title"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-desc">Description</Label>
                    <Textarea
                      id="edit-desc"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={4}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? 'Saving...' : 'Save'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetranscode}
            disabled={retranscodeMutation.isPending}
          >
            <RefreshCw className="size-4 mr-1.5" />
            Retranscode
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="size-4 mr-1.5" />
            Delete
          </Button>
        </ToolbarActions>
      </Toolbar>

      <div className="container space-y-6">
        {/* Overview */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge
                className={STATUS_COLORS[video.status] ?? ''}
                variant="outline"
              >
                {video.status}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
                <HardDrive className="size-3.5" /> File Size
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-xl font-bold">
                {formatBytes(video.file_size)}
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Clock className="size-3.5" /> Duration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-xl font-bold">
                {formatDuration(video.duration)}
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Resolution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-xl font-bold">
                {video.width && video.height
                  ? `${video.width}x${video.height}`
                  : '—'}
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Transcode Jobs */}
        {jobs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Transcode Jobs
                {hasActiveJobs && (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {jobs.map((job) => {
                  const badge = JOB_BADGE[job.status];
                  return (
                    <div
                      key={job.id}
                      className="flex flex-col gap-2 rounded-lg border p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          {job.status === 'processing' && (
                            <Loader2 className="size-4 animate-spin text-yellow-500" />
                          )}
                          {job.status === 'completed' && (
                            <CheckCircle2 className="size-4 text-green-500" />
                          )}
                          {job.status === 'failed' && (
                            <AlertCircle className="size-4 text-red-500" />
                          )}
                          {(job.status === 'pending' ||
                            job.status === 'cancelled') && (
                            <Clock className="size-4 text-muted-foreground" />
                          )}
                          <span className="text-sm font-medium font-mono">
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
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>
                            Attempt {job.attempts}/{job.max_attempts}
                          </span>
                          {job.output_size != null && job.output_size > 0 && (
                            <span>{formatBytes(job.output_size)}</span>
                          )}
                          {job.duration != null && job.duration > 0 && (
                            <span>{formatDuration(job.duration)}</span>
                          )}
                        </div>
                      </div>

                      {/* Progress bar for pending/processing */}
                      {(job.status === 'processing' ||
                        job.status === 'pending') && (
                        <div className="flex items-center gap-3">
                          <Progress
                            value={job.progress}
                            className="flex-1 h-2"
                          />
                          <span className="text-xs font-medium tabular-nums w-10 text-right">
                            {Math.round(job.progress)}%
                          </span>
                        </div>
                      )}

                      {/* Error message for failed jobs */}
                      {job.status === 'failed' && job.error_message && (
                        <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 rounded px-3 py-2">
                          {job.error_message}
                        </p>
                      )}

                      {/* Timestamps */}
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        {job.started_at && (
                          <span>
                            Started {new Date(job.started_at).toLocaleString()}
                          </span>
                        )}
                        {job.completed_at && (
                          <span>
                            Completed{' '}
                            {new Date(job.completed_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Details */}
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Original File</span>
                <p className="font-medium">{video.original_filename}</p>
              </div>
              <div>
                <span className="text-muted-foreground">MIME Type</span>
                <p className="font-medium">{video.mime_type}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Slug</span>
                <p className="font-medium">{video.slug}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Created</span>
                <p className="font-medium">
                  {new Date(video.created_at).toLocaleString()}
                </p>
              </div>
              {video.description && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Description</span>
                  <p className="font-medium">{video.description}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
