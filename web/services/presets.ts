import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiListResponse,
  ApiResponse,
  CreatePresetRequest,
  Preset,
} from '@/types/api';
import { apiClient } from '@/lib/api-client';

export function usePresets() {
  return useQuery({
    queryKey: ['presets'],
    queryFn: () => apiClient<ApiListResponse<Preset>>('/presets'),
  });
}

export function usePreset(id: string) {
  return useQuery({
    queryKey: ['presets', id],
    queryFn: () => apiClient<ApiResponse<Preset>>(`/presets/${id}`),
    enabled: !!id,
  });
}

export function useCreatePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreatePresetRequest) => {
      return apiClient<ApiResponse<Preset>>('/presets', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['presets'] });
    },
  });
}

export function useUpdatePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<CreatePresetRequest>;
    }) => {
      return apiClient<ApiResponse<Preset>>(`/presets/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['presets', variables.id] });
      qc.invalidateQueries({ queryKey: ['presets'] });
    },
  });
}

export function useDeletePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return apiClient<void>(`/presets/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['presets'] });
    },
  });
}
