package transcoder

import (
	"context"

	"github.com/gompp/gompp/internal/model"
	"github.com/gompp/gompp/internal/repository"
)

// DefaultH264Presets returns the basic Phase 2 H.264 presets (360p, 720p, 1080p).
func DefaultH264Presets() []model.CreatePresetRequest {
	return []model.CreatePresetRequest{
		{
			Name:      "360p Standard",
			Codec:     "h264",
			Container: "mp4",
			Resolutions: []model.ResolutionEntry{
				{Label: "640x360", Width: 640, Height: 360},
			},
			VideoBitrate:  "800k",
			AudioCodec:    "aac",
			AudioBitrate:  "128k",
			AudioChannels: 2,
			PixelFormat:   "yuv420p",
			PresetSpeed:   "medium",
			CRF:           23,
			IsDefault:     true,
			SortOrder:     1,
		},
		{
			Name:      "720p Standard",
			Codec:     "h264",
			Container: "mp4",
			Resolutions: []model.ResolutionEntry{
				{Label: "1280x720", Width: 1280, Height: 720},
			},
			VideoBitrate:  "2500k",
			AudioCodec:    "aac",
			AudioBitrate:  "128k",
			AudioChannels: 2,
			PixelFormat:   "yuv420p",
			PresetSpeed:   "medium",
			CRF:           23,
			IsDefault:     true,
			SortOrder:     2,
		},
		{
			Name:      "1080p Standard",
			Codec:     "h264",
			Container: "mp4",
			Resolutions: []model.ResolutionEntry{
				{Label: "1920x1080", Width: 1920, Height: 1080},
			},
			VideoBitrate:  "5000k",
			AudioCodec:    "aac",
			AudioBitrate:  "128k",
			AudioChannels: 2,
			PixelFormat:   "yuv420p",
			PresetSpeed:   "medium",
			CRF:           23,
			IsDefault:     true,
			SortOrder:     3,
		},
	}
}

// AdvancedPresets returns H.265, VP9, and AV1 presets for advanced encoding.
func AdvancedPresets() []model.CreatePresetRequest {
	return []model.CreatePresetRequest{
		// H.265 / HEVC
		{
			Name:      "720p H.265",
			Codec:     "h265",
			Container: "mp4",
			Resolutions: []model.ResolutionEntry{
				{Label: "1280x720", Width: 1280, Height: 720},
			},
			VideoBitrate:  "1500k",
			AudioCodec:    "aac",
			AudioBitrate:  "128k",
			AudioChannels: 2,
			PixelFormat:   "yuv420p",
			PresetSpeed:   "medium",
			CRF:           28,
			IsDefault:     false,
			SortOrder:     10,
		},
		{
			Name:      "1080p H.265",
			Codec:     "h265",
			Container: "mp4",
			Resolutions: []model.ResolutionEntry{
				{Label: "1920x1080", Width: 1920, Height: 1080},
			},
			VideoBitrate:  "3000k",
			AudioCodec:    "aac",
			AudioBitrate:  "128k",
			AudioChannels: 2,
			PixelFormat:   "yuv420p",
			PresetSpeed:   "medium",
			CRF:           28,
			IsDefault:     false,
			SortOrder:     11,
		},
		{
			Name:      "4K H.265",
			Codec:     "h265",
			Container: "mp4",
			Resolutions: []model.ResolutionEntry{
				{Label: "3840x2160", Width: 3840, Height: 2160},
			},
			VideoBitrate:  "10000k",
			AudioCodec:    "aac",
			AudioBitrate:  "192k",
			AudioChannels: 2,
			PixelFormat:   "yuv420p",
			PresetSpeed:   "slow",
			CRF:           28,
			IsDefault:     false,
			SortOrder:     12,
		},
		// VP9
		{
			Name:      "720p VP9",
			Codec:     "vp9",
			Container: "webm",
			Resolutions: []model.ResolutionEntry{
				{Label: "1280x720", Width: 1280, Height: 720},
			},
			VideoBitrate:  "1500k",
			AudioCodec:    "libopus",
			AudioBitrate:  "128k",
			AudioChannels: 2,
			PixelFormat:   "yuv420p",
			PresetSpeed:   "good",
			CRF:           31,
			IsDefault:     false,
			SortOrder:     20,
		},
		{
			Name:      "1080p VP9",
			Codec:     "vp9",
			Container: "webm",
			Resolutions: []model.ResolutionEntry{
				{Label: "1920x1080", Width: 1920, Height: 1080},
			},
			VideoBitrate:  "3000k",
			AudioCodec:    "libopus",
			AudioBitrate:  "128k",
			AudioChannels: 2,
			PixelFormat:   "yuv420p",
			PresetSpeed:   "good",
			CRF:           31,
			IsDefault:     false,
			SortOrder:     21,
		},
		// AV1
		{
			Name:      "720p AV1",
			Codec:     "av1",
			Container: "mp4",
			Resolutions: []model.ResolutionEntry{
				{Label: "1280x720", Width: 1280, Height: 720},
			},
			VideoBitrate:  "1200k",
			AudioCodec:    "libopus",
			AudioBitrate:  "128k",
			AudioChannels: 2,
			PixelFormat:   "yuv420p",
			PresetSpeed:   "5",
			CRF:           30,
			IsDefault:     false,
			SortOrder:     30,
		},
		{
			Name:      "1080p AV1",
			Codec:     "av1",
			Container: "mp4",
			Resolutions: []model.ResolutionEntry{
				{Label: "1920x1080", Width: 1920, Height: 1080},
			},
			VideoBitrate:  "2500k",
			AudioCodec:    "libopus",
			AudioBitrate:  "128k",
			AudioChannels: 2,
			PixelFormat:   "yuv420p",
			PresetSpeed:   "5",
			CRF:           30,
			IsDefault:     false,
			SortOrder:     31,
		},
	}
}

// SeedDefaultPresets inserts the default presets if none exist.
func SeedDefaultPresets(ctx context.Context, repo *repository.PresetRepository) error {
	existing, err := repo.List(ctx)
	if err != nil {
		return err
	}
	if len(existing) > 0 {
		return nil
	}

	allPresets := append(DefaultH264Presets(), AdvancedPresets()...)
	for _, req := range allPresets {
		primary := req.Resolutions[0]
		p := &model.Preset{
			Name:          req.Name,
			Codec:         req.Codec,
			Container:     req.Container,
			Resolution:    primary.Label,
			Width:         primary.Width,
			Height:        primary.Height,
			Resolutions:   req.Resolutions,
			VideoBitrate:  req.VideoBitrate,
			AudioCodec:    req.AudioCodec,
			AudioBitrate:  req.AudioBitrate,
			AudioChannels: req.AudioChannels,
			PixelFormat:   req.PixelFormat,
			PresetSpeed:   req.PresetSpeed,
			CRF:           req.CRF,
			HWAccel:       "none",
			IsDefault:     req.IsDefault,
			SortOrder:     req.SortOrder,
		}
		if err := repo.Create(ctx, p); err != nil {
			return err
		}
	}
	return nil
}
