package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// ResolutionEntry represents a single resolution variant within a preset.
type ResolutionEntry struct {
	Label  string `json:"label"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
}

// Preset represents an encoding preset.
type Preset struct {
	ID            uuid.UUID         `json:"id"`
	Name          string            `json:"name"`
	Codec         string            `json:"codec"`
	Container     string            `json:"container"`
	Resolution    string            `json:"resolution"`  // legacy single resolution (kept for compat)
	Width         int               `json:"width"`       // legacy
	Height        int               `json:"height"`      // legacy
	Resolutions   []ResolutionEntry `json:"resolutions"` // multi-resolution array
	VideoBitrate  string            `json:"video_bitrate"`
	AudioCodec    string            `json:"audio_codec"`
	AudioBitrate  string            `json:"audio_bitrate"`
	AudioChannels int               `json:"audio_channels"`
	Framerate     *int              `json:"framerate,omitempty"`
	PixelFormat   string            `json:"pixel_format"`
	PresetSpeed   string            `json:"preset_speed"`
	CRF           int               `json:"crf"`
	HWAccel       string            `json:"hw_accel"`
	ExtraFlags    *string           `json:"extra_flags,omitempty"`
	// Extended encoding fields
	OutputFormat        string    `json:"output_format"`
	HLSSegmentDuration  int       `json:"hls_segment_duration"`
	Encryption          string    `json:"encryption"`
	KeyRotationInterval int       `json:"key_rotation_interval"`
	SignedURLEnabled    bool      `json:"signed_url_enabled"`
	SignedURLExpiry     int       `json:"signed_url_expiry"`
	ThumbnailEnabled    bool      `json:"thumbnail_enabled"`
	ThumbnailInterval   int       `json:"thumbnail_interval"`
	BannerEnabled       bool      `json:"banner_enabled"`
	BannerTimestamp     int       `json:"banner_timestamp"`
	Faststart           bool      `json:"faststart"`
	Movflags            string    `json:"movflags"`
	TwoPass             bool      `json:"two_pass"`
	IsDefault           bool      `json:"is_default"`
	IsActive            bool      `json:"is_active"`
	SortOrder           int       `json:"sort_order"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

// CreatePresetRequest is the payload for creating a preset.
type CreatePresetRequest struct {
	Name          string            `json:"name"`
	Codec         string            `json:"codec"`
	Container     string            `json:"container"`
	Resolutions   []ResolutionEntry `json:"resolutions"`
	VideoBitrate  string            `json:"video_bitrate"`
	AudioCodec    string            `json:"audio_codec"`
	AudioBitrate  string            `json:"audio_bitrate"`
	AudioChannels int               `json:"audio_channels"`
	Framerate     *int              `json:"framerate,omitempty"`
	PixelFormat   string            `json:"pixel_format"`
	PresetSpeed   string            `json:"preset_speed"`
	CRF           int               `json:"crf"`
	HWAccel       string            `json:"hw_accel"`
	ExtraFlags    *string           `json:"extra_flags,omitempty"`
	// Extended fields
	OutputFormat        string `json:"output_format"`
	HLSSegmentDuration  int    `json:"hls_segment_duration"`
	Encryption          string `json:"encryption"`
	KeyRotationInterval int    `json:"key_rotation_interval"`
	SignedURLEnabled    bool   `json:"signed_url_enabled"`
	SignedURLExpiry     int    `json:"signed_url_expiry"`
	ThumbnailEnabled    bool   `json:"thumbnail_enabled"`
	ThumbnailInterval   int    `json:"thumbnail_interval"`
	BannerEnabled       bool   `json:"banner_enabled"`
	BannerTimestamp     int    `json:"banner_timestamp"`
	Faststart           bool   `json:"faststart"`
	Movflags            string `json:"movflags"`
	TwoPass             bool   `json:"two_pass"`
	IsDefault           bool   `json:"is_default"`
	SortOrder           int    `json:"sort_order"`
}

// UpdatePresetRequest is the payload for updating a preset.
type UpdatePresetRequest struct {
	Name          *string            `json:"name,omitempty"`
	Codec         *string            `json:"codec,omitempty"`
	Container     *string            `json:"container,omitempty"`
	Resolutions   *[]ResolutionEntry `json:"resolutions,omitempty"`
	VideoBitrate  *string            `json:"video_bitrate,omitempty"`
	AudioCodec    *string            `json:"audio_codec,omitempty"`
	AudioBitrate  *string            `json:"audio_bitrate,omitempty"`
	AudioChannels *int               `json:"audio_channels,omitempty"`
	Framerate     *int               `json:"framerate,omitempty"`
	PixelFormat   *string            `json:"pixel_format,omitempty"`
	PresetSpeed   *string            `json:"preset_speed,omitempty"`
	CRF           *int               `json:"crf,omitempty"`
	HWAccel       *string            `json:"hw_accel,omitempty"`
	ExtraFlags    *string            `json:"extra_flags,omitempty"`
	// Extended fields
	OutputFormat        *string `json:"output_format,omitempty"`
	HLSSegmentDuration  *int    `json:"hls_segment_duration,omitempty"`
	Encryption          *string `json:"encryption,omitempty"`
	KeyRotationInterval *int    `json:"key_rotation_interval,omitempty"`
	SignedURLEnabled    *bool   `json:"signed_url_enabled,omitempty"`
	SignedURLExpiry     *int    `json:"signed_url_expiry,omitempty"`
	ThumbnailEnabled    *bool   `json:"thumbnail_enabled,omitempty"`
	ThumbnailInterval   *int    `json:"thumbnail_interval,omitempty"`
	BannerEnabled       *bool   `json:"banner_enabled,omitempty"`
	BannerTimestamp     *int    `json:"banner_timestamp,omitempty"`
	Faststart           *bool   `json:"faststart,omitempty"`
	Movflags            *string `json:"movflags,omitempty"`
	TwoPass             *bool   `json:"two_pass,omitempty"`
	IsDefault           *bool   `json:"is_default,omitempty"`
	IsActive            *bool   `json:"is_active,omitempty"`
	SortOrder           *int    `json:"sort_order,omitempty"`
}

// PrimaryResolution returns the first (highest) resolution entry, or falls back to legacy fields.
func (p *Preset) PrimaryResolution() ResolutionEntry {
	if len(p.Resolutions) > 0 {
		return p.Resolutions[0]
	}
	return ResolutionEntry{Label: p.Resolution, Width: p.Width, Height: p.Height}
}

// ResolutionsJSON marshals the resolutions slice to JSON bytes for database storage.
func ResolutionsJSON(r []ResolutionEntry) ([]byte, error) {
	if r == nil {
		r = []ResolutionEntry{}
	}
	return json.Marshal(r)
}
