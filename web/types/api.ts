// API response envelope types matching Go backend
export interface ApiResponse<T> {
  data: T;
}

export interface ApiListResponse<T> {
  data: T[];
  meta: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

// User 
export interface User {
  id: string;
  email: string;
  username: string;
  role: 'super_admin' | 'admin' | 'staff' | 'user';
  is_active: boolean;
  avatar_url?: string;
  has_google: boolean;
  passkey_count: number;
  last_login_at?: string;
  password_changed_at?: string;
  created_at: string;
  updated_at: string;
  total_videos_uploaded: number;
}

// WebAuthn Credential (Passkey)
export interface WebAuthnCredential {
  id: string;
  user_id: string;
  sign_count: number;
  name: string;
  created_at: string;
}

// Auth Providers
export interface AuthProviders {
  google: boolean;
  passkey: boolean;
  google_client_id?: string;
}

// Account Session
export interface AccountSession {
  id: string;
  user_id: string;
  device_name: string;
  device_os: string;
  browser: string;
  ip_address?: string;
  location: string;
  last_session_at: string;
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

export interface RefreshResponse {
  access_token: string;
  expires_in: number;
}

// Video
export type VideoStatus =
  | 'uploading'
  | 'uploaded'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'deleted';

export interface Video {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  description?: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  transcoded_size: number;
  duration?: number;
  width?: number;
  height?: number;
  status: VideoStatus;
  master_playlist?: string;
  thumbnail_path?: string;
  error_message?: string;
  view_count: number;
  is_public: boolean;
  allow_download: boolean;
  metadata?: unknown;
  created_at: string;
  updated_at: string;
}

export interface VideoListParams {
  page?: number;
  per_page?: number;
  status?: string;
  search?: string;
  sort?: string;
  order?: string;
}

export interface UpdateVideoRequest {
  title?: string;
  description?: string;
  allow_download?: boolean;
}

export interface VideoDetailResponse {
  video: Video;
  jobs: TranscodeJob[];
  stream_url?: string;
}

// Preset
export interface ResolutionEntry {
  label: string;
  width: number;
  height: number;
}

export interface Preset {
  id: string;
  name: string;
  codec: string;
  container: string;
  resolution: string;
  width: number;
  height: number;
  resolutions: ResolutionEntry[];
  video_bitrate: string;
  audio_codec: string;
  audio_bitrate: string;
  audio_channels: number;
  framerate?: number;
  pixel_format: string;
  preset_speed: string;
  crf: number;
  extra_flags?: string;
  output_format?: string;
  hls_segment_duration?: number;
  encryption?: string;
  key_rotation_interval?: number;
  hw_accel?: string;
  signed_url_enabled?: boolean;
  signed_url_expiry?: number;
  thumbnail_enabled?: boolean;
  thumbnail_interval?: number;
  banner_enabled?: boolean;
  banner_timestamp?: number;
  faststart?: boolean;
  movflags?: string;
  two_pass?: boolean;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreatePresetRequest {
  name: string;
  codec: string;
  container?: string;
  resolutions: ResolutionEntry[];
  video_bitrate?: string;
  audio_codec?: string;
  audio_bitrate?: string;
  audio_channels?: number;
  framerate?: number;
  pixel_format?: string;
  preset_speed?: string;
  crf?: number;
  extra_flags?: string;
  // Extended fields
  output_format?: string;
  hls_segment_duration?: number;
  encryption?: string;
  key_rotation_interval?: number;
  hw_accel?: string;
  signed_url_enabled?: boolean;
  signed_url_expiry?: number;
  thumbnail_enabled?: boolean;
  thumbnail_interval?: number;
  banner_enabled?: boolean;
  banner_timestamp?: number;
  faststart?: boolean;
  movflags?: string;
  two_pass?: boolean;
  is_default?: boolean;
  sort_order?: number;
}

// TranscodeJob
export type JobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface TranscodeJob {
  id: string;
  video_id: string;
  preset_id: string;
  status: JobStatus;
  progress: number;
  output_path?: string;
  output_size?: number;
  duration?: number;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  attempts: number;
  max_attempts: number;
  worker_id?: string;
  created_at: string;
  updated_at: string;
}

// Webhook
export interface Webhook {
  id: string;
  user_id: string;
  name: string;
  url: string;
  events: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Analytics
export interface AnalyticsOverview {
  total_videos: number;
  total_views: number;
  total_bandwidth_bytes: number;
  storage_used_bytes: number;
  active_jobs: number;
  period: string;
}

// Settings
export interface SystemSetting {
  key: string;
  value: unknown;
  description?: string;
  updated_at?: string;
}
