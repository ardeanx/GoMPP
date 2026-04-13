import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

// Types

export interface SubtitleResult {
  id: string;
  type: string;
  attributes: {
    subtitle_id: string;
    language: string;
    download_count: number;
    new_download_count: number;
    hearing_impaired: boolean;
    hd: boolean;
    fps: number;
    votes: number;
    points: number;
    ratings: number;
    from_trusted: boolean;
    foreign_parts_only: boolean;
    ai_translated: boolean;
    machine_translated: boolean;
    upload_date: string;
    release: string;
    comments: string;
    legacy_subtitle_id: number;
    feature_details: {
      feature_id: number;
      feature_type: string;
      year: number;
      title: string;
      movie_name: string;
      imdb_id: number;
      tmdb_id: number;
      season_number?: number;
      episode_number?: number;
    };
    files: Array<{
      file_id: number;
      cd_number: number;
      file_name: string;
    }>;
  };
}

export interface SubtitleSearchResponse {
  total_pages: number;
  total_count: number;
  per_page: number;
  page: number;
  data: SubtitleResult[];
}

export interface SubtitleDownloadResponse {
  link: string;
  file_name: string;
  requests: number;
  remaining: number;
  message: string;
  reset_time: string;
  reset_time_utc: string;
}

export interface SubtitleLanguage {
  language_code: string;
  language_name: string;
}

// Hooks

export function useSubtitleSearch(params: {
  query?: string;
  languages?: string;
  imdb_id?: string;
  tmdb_id?: string;
  season_number?: string;
  episode_number?: string;
  page?: number;
  enabled?: boolean;
}) {
  const searchParams = new URLSearchParams();
  if (params.query) searchParams.set('query', params.query);
  if (params.languages) searchParams.set('languages', params.languages);
  if (params.imdb_id) searchParams.set('imdb_id', params.imdb_id);
  if (params.tmdb_id) searchParams.set('tmdb_id', params.tmdb_id);
  if (params.season_number)
    searchParams.set('season_number', params.season_number);
  if (params.episode_number)
    searchParams.set('episode_number', params.episode_number);
  if (params.page) searchParams.set('page', String(params.page));

  const qs = searchParams.toString();

  return useQuery({
    queryKey: ['subtitles', 'search', qs],
    queryFn: () => apiClient<SubtitleSearchResponse>(`/subtitles/search?${qs}`),
    enabled: params.enabled !== false && qs.length > 0,
  });
}

export function useSubtitleDownload() {
  return useMutation({
    mutationFn: (fileId: number) =>
      apiClient<SubtitleDownloadResponse>('/subtitles/download', {
        method: 'POST',
        body: JSON.stringify({ file_id: fileId }),
      }),
  });
}

export function useSubtitleLanguages() {
  return useQuery({
    queryKey: ['subtitles', 'languages'],
    queryFn: () =>
      apiClient<{ data: SubtitleLanguage[] }>('/subtitles/languages'),
    staleTime: 24 * 60 * 60 * 1000, // cache 24h
  });
}

// Video subtitle track

export interface VideoSubtitle {
  id: string;
  video_id: string;
  language: string;
  label: string;
  format: string;
  source: string;
  created_at: string;
}

export interface SubtitleTrack {
  id: string;
  language: string;
  label: string;
  format: string;
  url: string;
}

export function useVideoSubtitles(videoId: string | undefined) {
  return useQuery({
    queryKey: ['video-subtitles', videoId],
    queryFn: () =>
      apiClient<{ data: VideoSubtitle[] }>(`/videos/${videoId}/subtitles`),
    enabled: !!videoId,
  });
}

export function useAttachSubtitle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      videoId,
      fileId,
      language,
      label,
    }: {
      videoId: string;
      fileId: number;
      language: string;
      label: string;
    }) =>
      apiClient<{ data: VideoSubtitle }>(`/videos/${videoId}/subtitles`, {
        method: 'POST',
        body: JSON.stringify({ file_id: fileId, language, label }),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['video-subtitles', variables.videoId],
      });
    },
  });
}

export function useDeleteSubtitle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      videoId,
      subtitleId,
    }: {
      videoId: string;
      subtitleId: string;
    }) =>
      apiClient(`/videos/${videoId}/subtitles/${subtitleId}`, {
        method: 'DELETE',
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['video-subtitles', variables.videoId],
      });
    },
  });
}

export function useUploadSubtitle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      videoId,
      file,
      language,
      label,
    }: {
      videoId: string;
      file: File;
      language: string;
      label: string;
    }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('language', language);
      formData.append('label', label);
      return apiClient<{ data: VideoSubtitle }>(
        `/videos/${videoId}/subtitles/upload`,
        {
          method: 'POST',
          body: formData,
        },
      );
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['video-subtitles', variables.videoId],
      });
    },
  });
}

export function usePublicSubtitles(videoId: string | undefined) {
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') ||
    'http://localhost:8080';
  return useQuery({
    queryKey: ['public-subtitles', videoId],
    queryFn: async () => {
      const resp = await fetch(`${apiBase}/subtitles/public/${videoId}`);
      if (!resp.ok) throw new Error('Failed to fetch subtitles');
      const body = await resp.json();
      return body.data as SubtitleTrack[];
    },
    enabled: !!videoId,
  });
}
