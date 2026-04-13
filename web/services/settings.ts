import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiResponse, SystemSetting } from '@/types/api';
import { apiClient } from '@/lib/api-client';

export function useSystemSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => apiClient<{ data: SystemSetting[] }>('/settings'),
  });
}

export function useSystemSetting(key: string) {
  return useQuery({
    queryKey: ['settings', key],
    queryFn: () => apiClient<ApiResponse<SystemSetting>>(`/settings/${key}`),
    enabled: !!key,
  });
}

export function useUpdateSystemSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      return apiClient<ApiResponse<SystemSetting>>(`/settings/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useBulkUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Array<{ key: string; value: unknown }>) => {
      return apiClient<{ data: { updated: number } }>('/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useVerifyFFmpeg() {
  return useMutation({
    mutationFn: async (path: string) => {
      return apiClient<{
        data: { valid: boolean; error: string; version: string };
      }>('/settings/verify-ffmpeg', {
        method: 'POST',
        body: JSON.stringify({ path }),
      });
    },
  });
}
