'use client';

import { useParams } from 'next/navigation';
import { Code, Download, Eye, Loader2, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePublicSubtitles } from '@/services/subtitles';
import { usePublicVideo } from '@/services/videos';
import { Button } from '@/components/ui/button';
import { VideoPlayer } from '@/components/video-player';

function formatDuration(seconds?: number): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0)
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K views`;
  return `${n} views`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function WatchPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { data, isLoading, error } = usePublicVideo(slug);
  const subtitlesQuery = usePublicSubtitles(data?.video?.id);

  const apiBase =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
  const siteBase = apiBase.replace('/api/v1', '');

  const handleCopyEmbed = () => {
    if (!data) return;
    const embedUrl = `${siteBase}${data.embed_url}`;
    const code = `<iframe src="${embedUrl}" width="640" height="360" frameborder="0" allowfullscreen></iframe>`;
    navigator.clipboard.writeText(code);
    toast.success('Embed code copied to clipboard');
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: data?.video.title, url });
      } catch {
        // user cancelled
      }
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard');
    }
  };

  const handleDownload = () => {
    if (!data) return;
    window.open(
      `${apiBase}/public/videos/${data.video.slug}/download`,
      '_blank',
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-center px-4">
        <h1 className="text-2xl font-bold mb-2">Video Not Found</h1>
        <p className="text-muted-foreground">
          This video may have been removed or is not publicly available.
        </p>
      </div>
    );
  }

  const { video, stream_url } = data;

  // Build subtitle track list with full URLs
  const subtitleTracks = (subtitlesQuery.data ?? []).map((t) => ({
    id: t.id,
    language: t.language,
    label: t.label,
    format: t.format,
    url: `${siteBase}${t.url}`,
  }));

  return (
    <div className="h-screen w-screen bg-black flex items-center justify-center overflow-hidden">
      <div className="flex flex-col items-center w-[95vw] max-w-6xl">
        {/* Player */}
        <div className="w-full aspect-video">
          <VideoPlayer
            src={`${siteBase}/${stream_url}`}
            title={video.title}
            poster={
              video.thumbnail_path
                ? `${siteBase}/${video.thumbnail_path}`
                : undefined
            }
            subtitles={subtitleTracks}
            className="size-full"
          />
        </div>

        {/* Info bar */}
        <div className="w-full flex items-center justify-between gap-4 pt-3 px-1">
          <div className="min-w-0">
            <h1 className="text-sm font-medium text-white truncate">
              {video.title}
            </h1>
            <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
              <span className="flex items-center gap-1">
                <Eye className="size-3" />
                {formatViews(video.view_count)}
              </span>
              <span className="text-neutral-600">·</span>
              <span>{formatDate(video.created_at)}</span>
              {video.duration != null && video.duration > 0 && (
                <>
                  <span className="text-neutral-600">·</span>
                  <span>{formatDuration(video.duration)}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {video.allow_download && (
              <Button
                variant="ghost"
                size="sm"
                className="text-neutral-400 hover:text-white hover:bg-white/10"
                onClick={handleDownload}
              >
                <Download className="size-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-neutral-400 hover:text-white hover:bg-white/10"
              onClick={handleCopyEmbed}
            >
              <Code className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-neutral-400 hover:text-white hover:bg-white/10"
              onClick={handleShare}
            >
              <Share2 className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
