import { useQuery } from '@tanstack/react-query';
import { AnalyticsOverview, ApiResponse } from '@/types/api';
import { apiClient } from '@/lib/api-client';

export function useAnalyticsOverview(period: string = '30d') {
  return useQuery({
    queryKey: ['analytics', 'overview', period],
    queryFn: () =>
      apiClient<ApiResponse<AnalyticsOverview>>(
        `/analytics/overview?period=${period}`,
      ),
  });
}

export function useTopVideos(period: string = '7d', limit: number = 10) {
  return useQuery({
    queryKey: ['analytics', 'top-videos', period, limit],
    queryFn: () =>
      apiClient<{
        data: Array<{
          video_id: string;
          title: string;
          view_count: number;
          bandwidth_bytes: number;
        }>;
      }>(`/analytics/top-videos?period=${period}&limit=${limit}`),
  });
}

export function useBandwidth(
  period: string = '30d',
  granularity: string = 'day',
) {
  return useQuery({
    queryKey: ['analytics', 'bandwidth', period, granularity],
    queryFn: () =>
      apiClient<{
        data: Array<{ date: string; bytes: number }>;
      }>(`/analytics/bandwidth?period=${period}&granularity=${granularity}`),
  });
}

export function useDeviceTypes(period: string = '30d') {
  return useQuery({
    queryKey: ['analytics', 'device-types', period],
    queryFn: () =>
      apiClient<{
        data: Array<{ device_type: string; count: number }>;
      }>(`/analytics/device-types?period=${period}`),
  });
}

export function useTrafficSeries(
  period: string = '30d',
  granularity: string = 'day',
) {
  return useQuery({
    queryKey: ['analytics', 'traffic', period, granularity],
    queryFn: () =>
      apiClient<{
        data: Array<{ date: string; views: number; bandwidth: number }>;
      }>(`/analytics/traffic?period=${period}&granularity=${granularity}`),
  });
}
