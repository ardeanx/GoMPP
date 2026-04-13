import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiListResponse, ApiResponse, User } from '@/types/api';
import { apiClient } from '@/lib/api-client';

export function useUsers(
  params: {
    page?: number;
    per_page?: number;
    search?: string;
    role?: string;
    status?: string;
  } = {},
) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.per_page) query.set('per_page', String(params.per_page));
  if (params.search) query.set('search', params.search);
  if (params.role) query.set('role', params.role);
  if (params.status) query.set('status', params.status);

  const qs = query.toString();
  return useQuery({
    queryKey: ['users', params],
    queryFn: () =>
      apiClient<ApiListResponse<User>>(`/users${qs ? `?${qs}` : ''}`),
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => apiClient<ApiResponse<User>>(`/users/${id}`),
    enabled: !!id,
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Pick<User, 'email' | 'username' | 'role' | 'is_active'>>;
    }) => {
      return apiClient<ApiResponse<User>>(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['users', variables.id] });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async ({
      id,
      newPassword,
    }: {
      id: string;
      newPassword: string;
    }) => {
      return apiClient<void>(`/users/${id}/password`, {
        method: 'PUT',
        body: JSON.stringify({ new_password: newPassword }),
      });
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      return apiClient<void>(`/users/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      email: string;
      username: string;
      password: string;
      role: string;
    }) => {
      return apiClient<ApiResponse<User>>('/users', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
