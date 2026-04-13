import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AccountSession,
  ApiListResponse,
  ApiResponse,
  AuthProviders,
  WebAuthnCredential,
} from '@/types/api';
import { apiClient } from '@/lib/api-client';

export function useAccountSessions(
  params: { page?: number; per_page?: number } = {},
) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.per_page) query.set('per_page', String(params.per_page));

  const qs = query.toString();
  return useQuery({
    queryKey: ['account-sessions', params],
    queryFn: () =>
      apiClient<ApiListResponse<AccountSession>>(
        `/account/sessions${qs ? `?${qs}` : ''}`,
      ),
  });
}

export function useCreateAccountSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      device_name: string;
      device_os: string;
      browser: string;
      ip_address?: string;
      location: string;
    }) => {
      return apiClient<{ data: AccountSession }>('/account/sessions', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['account-sessions'] });
    },
  });
}

export function useDeleteAccountSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return apiClient<void>(`/account/sessions/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['account-sessions'] });
    },
  });
}

// Avatar

export function useUploadAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('avatar', file);
      return apiClient<ApiResponse<{ avatar_url: string }>>('/account/avatar', {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth-me'] });
    },
  });
}

export function useDeleteAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return apiClient<void>('/account/avatar', { method: 'DELETE' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth-me'] });
    },
  });
}

// Google Account Linking

export function useLinkGoogle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (credential: string) => {
      return apiClient<ApiResponse<{ linked: boolean }>>(
        '/account/google/link',
        { method: 'POST', body: JSON.stringify({ credential }) },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth-me'] });
    },
  });
}

export function useUnlinkGoogle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return apiClient<void>('/account/google/link', { method: 'DELETE' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth-me'] });
    },
  });
}

// Passkeys

export function usePasskeys() {
  return useQuery({
    queryKey: ['passkeys'],
    queryFn: () =>
      apiClient<ApiResponse<WebAuthnCredential[]>>('/account/passkeys'),
  });
}

export function useRenamePasskey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return apiClient<void>(`/account/passkeys/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['passkeys'] });
      qc.invalidateQueries({ queryKey: ['auth-me'] });
    },
  });
}

export function useDeletePasskey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return apiClient<void>(`/account/passkeys/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['passkeys'] });
      qc.invalidateQueries({ queryKey: ['auth-me'] });
    },
  });
}

// Auth Providers

export function useAuthProviders() {
  return useQuery({
    queryKey: ['auth-providers'],
    queryFn: () => apiClient<ApiResponse<AuthProviders>>('/auth/providers'),
    staleTime: 5 * 60 * 1000, // cache for 5 min
  });
}
