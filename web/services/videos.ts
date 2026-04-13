import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiListResponse,
  ApiResponse,
  UpdateVideoRequest,
  Video,
  VideoDetailResponse,
  VideoListParams,
} from '@/types/api';
import { apiClient } from '@/lib/api-client';

export function useVideos(params: VideoListParams = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.per_page) query.set('per_page', String(params.per_page));
  if (params.status) query.set('status', params.status);
  if (params.search) query.set('search', params.search);
  if (params.sort) query.set('sort', params.sort);
  if (params.order) query.set('order', params.order);

  const qs = query.toString();
  return useQuery({
    queryKey: ['videos', params],
    queryFn: () =>
      apiClient<ApiListResponse<Video>>(`/videos${qs ? `?${qs}` : ''}`),
  });
}

export function useVideo(id: string, polling = false) {
  return useQuery({
    queryKey: ['videos', id],
    queryFn: () => apiClient<ApiResponse<VideoDetailResponse>>(`/videos/${id}`),
    enabled: !!id,
    refetchInterval: polling ? 3000 : false,
  });
}

export function useUploadVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      return apiClient<ApiResponse<Video>>('/videos/upload', {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['videos'] });
    },
  });
}

export function useUpdateVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateVideoRequest;
    }) => {
      return apiClient<ApiResponse<Video>>(`/videos/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['videos', variables.id] });
      qc.invalidateQueries({ queryKey: ['videos'] });
    },
  });
}

export function useDeleteVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return apiClient<void>(`/videos/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['videos'] });
    },
  });
}

export function useRetranscodeVideo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      presetIds,
    }: {
      id: string;
      presetIds?: string[];
    }) => {
      return apiClient<
        ApiResponse<{ jobs_created: number; job_ids: string[] }>
      >(`/videos/${id}/retranscode`, {
        method: 'POST',
        body: presetIds ? JSON.stringify({ preset_ids: presetIds }) : undefined,
      });
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['videos', variables.id] });
    },
  });
}

// Thumbnail management

export interface ThumbnailsResponse {
  thumbnails: string[];
  current: string | null;
}

export function useVideoThumbnails(videoId: string) {
  return useQuery({
    queryKey: ['videos', videoId, 'thumbnails'],
    queryFn: () =>
      apiClient<ApiResponse<ThumbnailsResponse>>(
        `/videos/${videoId}/thumbnails`,
      ),
    enabled: !!videoId,
  });
}

export function useSetThumbnail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, path }: { id: string; path: string }) => {
      return apiClient<{ thumbnail_path: string }>(`/videos/${id}/thumbnail`, {
        method: 'PUT',
        body: JSON.stringify({ path }),
      });
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['videos', variables.id] });
      qc.invalidateQueries({
        queryKey: ['videos', variables.id, 'thumbnails'],
      });
    },
  });
}

export function useUploadThumbnail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiClient<{ thumbnail_path: string }>(
        `/videos/${id}/thumbnail/upload`,
        {
          method: 'POST',
          body: formData,
        },
      );
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['videos', variables.id] });
      qc.invalidateQueries({
        queryKey: ['videos', variables.id, 'thumbnails'],
      });
    },
  });
}

// Public video (no auth)

export interface PublicVideoResponse {
  video: {
    id: string;
    title: string;
    slug: string;
    description?: string;
    duration?: number;
    width?: number;
    height?: number;
    thumbnail_path?: string;
    view_count: number;
    allow_download: boolean;
    created_at: string;
  };
  stream_url: string;
  embed_url: string;
}

export function usePublicVideo(slug: string) {
  const API_BASE =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

  return useQuery({
    queryKey: ['public-video', slug],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/public/videos/${slug}`);
      if (!res.ok) {
        throw new Error('Video not found');
      }
      const body = await res.json();
      return body.data as PublicVideoResponse;
    },
    enabled: !!slug,
  });
}
