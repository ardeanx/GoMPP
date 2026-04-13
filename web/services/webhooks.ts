import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiListResponse, ApiResponse, Webhook } from '@/types/api';
import { apiClient } from '@/lib/api-client';

export function useWebhooks() {
  return useQuery({
    queryKey: ['webhooks'],
    queryFn: () => apiClient<ApiListResponse<Webhook>>('/webhooks'),
  });
}

export function useCreateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      url: string;
      events: string[];
    }) => {
      return apiClient<ApiResponse<Webhook & { secret: string }>>('/webhooks', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });
}

export function useUpdateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{
        name: string;
        url: string;
        events: string[];
        is_active: boolean;
      }>;
    }) => {
      return apiClient<ApiResponse<Webhook>>(`/webhooks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });
}

export function useDeleteWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return apiClient<void>(`/webhooks/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });
}

export function useRegenerateWebhookSecret() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return apiClient<ApiResponse<{ secret: string }>>(
        `/webhooks/${id}/regenerate-secret`,
        { method: 'POST' },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] });
    },
  });
}

export function useWebhookDeliveries(id: string) {
  return useQuery({
    queryKey: ['webhooks', id, 'deliveries'],
    queryFn: () =>
      apiClient<{
        data: Array<{
          id: string;
          event: string;
          status_code: number;
          success: boolean;
          attempted_at: string;
        }>;
      }>(`/webhooks/${id}/deliveries`),
    enabled: !!id,
  });
}
