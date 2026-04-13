package repository

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gompp/gompp/internal/model"
)

type PresetRepository struct {
	db *pgxpool.Pool
}

func NewPresetRepository(db *pgxpool.Pool) *PresetRepository {
	return &PresetRepository{db: db}
}

var presetCols = `id, name, codec, container, resolution, width, height, resolutions, video_bitrate,
	audio_codec, audio_bitrate, audio_channels, framerate, pixel_format, preset_speed,
	crf, hw_accel, extra_flags, output_format, hls_segment_duration, encryption,
	key_rotation_interval, signed_url_enabled, signed_url_expiry, thumbnail_enabled,
	thumbnail_interval, banner_enabled, banner_timestamp, faststart, movflags, two_pass,
	is_default, is_active, sort_order, created_at, updated_at`

func scanPreset(row pgx.Row) (*model.Preset, error) {
	p := &model.Preset{}
	var resJSON []byte
	err := row.Scan(
		&p.ID, &p.Name, &p.Codec, &p.Container, &p.Resolution, &p.Width, &p.Height,
		&resJSON,
		&p.VideoBitrate, &p.AudioCodec, &p.AudioBitrate, &p.AudioChannels, &p.Framerate,
		&p.PixelFormat, &p.PresetSpeed, &p.CRF, &p.HWAccel, &p.ExtraFlags,
		&p.OutputFormat, &p.HLSSegmentDuration, &p.Encryption,
		&p.KeyRotationInterval, &p.SignedURLEnabled, &p.SignedURLExpiry, &p.ThumbnailEnabled,
		&p.ThumbnailInterval, &p.BannerEnabled, &p.BannerTimestamp, &p.Faststart, &p.Movflags, &p.TwoPass,
		&p.IsDefault, &p.IsActive,
		&p.SortOrder, &p.CreatedAt, &p.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return p, err
	}
	if len(resJSON) > 0 {
		_ = json.Unmarshal(resJSON, &p.Resolutions)
	}
	if p.Resolutions == nil {
		p.Resolutions = []model.ResolutionEntry{}
	}
	return p, nil
}

func (r *PresetRepository) Create(ctx context.Context, p *model.Preset) error {
	resJSON, err := model.ResolutionsJSON(p.Resolutions)
	if err != nil {
		return err
	}
	query := `INSERT INTO encoding_presets (name, codec, container, resolution, width, height, resolutions,
	          video_bitrate, audio_codec, audio_bitrate, audio_channels, framerate, pixel_format,
	          preset_speed, crf, hw_accel, extra_flags, output_format, hls_segment_duration,
	          encryption, key_rotation_interval, signed_url_enabled, signed_url_expiry,
	          thumbnail_enabled, thumbnail_interval, banner_enabled, banner_timestamp,
	          faststart, movflags, two_pass, is_default, sort_order)
	          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32)
	          RETURNING id, is_active, created_at, updated_at`
	return r.db.QueryRow(ctx, query,
		p.Name, p.Codec, p.Container, p.Resolution, p.Width, p.Height, resJSON,
		p.VideoBitrate, p.AudioCodec, p.AudioBitrate, p.AudioChannels, p.Framerate,
		p.PixelFormat, p.PresetSpeed, p.CRF, p.HWAccel, p.ExtraFlags,
		p.OutputFormat, p.HLSSegmentDuration, p.Encryption, p.KeyRotationInterval,
		p.SignedURLEnabled, p.SignedURLExpiry, p.ThumbnailEnabled, p.ThumbnailInterval,
		p.BannerEnabled, p.BannerTimestamp, p.Faststart, p.Movflags, p.TwoPass,
		p.IsDefault, p.SortOrder,
	).Scan(&p.ID, &p.IsActive, &p.CreatedAt, &p.UpdatedAt)
}

func (r *PresetRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Preset, error) {
	query := `SELECT ` + presetCols + ` FROM encoding_presets WHERE id = $1`
	return scanPreset(r.db.QueryRow(ctx, query, id))
}

func (r *PresetRepository) List(ctx context.Context) ([]model.Preset, error) {
	query := `SELECT ` + presetCols + ` FROM encoding_presets ORDER BY sort_order, name`
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var presets []model.Preset
	for rows.Next() {
		var p model.Preset
		var resJSON []byte
		if err := rows.Scan(
			&p.ID, &p.Name, &p.Codec, &p.Container, &p.Resolution, &p.Width, &p.Height,
			&resJSON,
			&p.VideoBitrate, &p.AudioCodec, &p.AudioBitrate, &p.AudioChannels, &p.Framerate,
			&p.PixelFormat, &p.PresetSpeed, &p.CRF, &p.HWAccel, &p.ExtraFlags,
			&p.OutputFormat, &p.HLSSegmentDuration, &p.Encryption,
			&p.KeyRotationInterval, &p.SignedURLEnabled, &p.SignedURLExpiry, &p.ThumbnailEnabled,
			&p.ThumbnailInterval, &p.BannerEnabled, &p.BannerTimestamp, &p.Faststart, &p.Movflags, &p.TwoPass,
			&p.IsDefault, &p.IsActive,
			&p.SortOrder, &p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, err
		}
		if len(resJSON) > 0 {
			_ = json.Unmarshal(resJSON, &p.Resolutions)
		}
		if p.Resolutions == nil {
			p.Resolutions = []model.ResolutionEntry{}
		}
		presets = append(presets, p)
	}
	return presets, rows.Err()
}

func (r *PresetRepository) ListDefaults(ctx context.Context) ([]model.Preset, error) {
	query := `SELECT ` + presetCols + ` FROM encoding_presets WHERE is_default = true AND is_active = true ORDER BY sort_order`
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var presets []model.Preset
	for rows.Next() {
		var p model.Preset
		var resJSON []byte
		if err := rows.Scan(
			&p.ID, &p.Name, &p.Codec, &p.Container, &p.Resolution, &p.Width, &p.Height,
			&resJSON,
			&p.VideoBitrate, &p.AudioCodec, &p.AudioBitrate, &p.AudioChannels, &p.Framerate,
			&p.PixelFormat, &p.PresetSpeed, &p.CRF, &p.HWAccel, &p.ExtraFlags,
			&p.OutputFormat, &p.HLSSegmentDuration, &p.Encryption,
			&p.KeyRotationInterval, &p.SignedURLEnabled, &p.SignedURLExpiry, &p.ThumbnailEnabled,
			&p.ThumbnailInterval, &p.BannerEnabled, &p.BannerTimestamp, &p.Faststart, &p.Movflags, &p.TwoPass,
			&p.IsDefault, &p.IsActive,
			&p.SortOrder, &p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return nil, err
		}
		if len(resJSON) > 0 {
			_ = json.Unmarshal(resJSON, &p.Resolutions)
		}
		if p.Resolutions == nil {
			p.Resolutions = []model.ResolutionEntry{}
		}
		presets = append(presets, p)
	}
	return presets, rows.Err()
}

func (r *PresetRepository) Update(ctx context.Context, p *model.Preset) error {
	resJSON, err := model.ResolutionsJSON(p.Resolutions)
	if err != nil {
		return err
	}
	query := `UPDATE encoding_presets SET name=$2, codec=$3, container=$4, resolution=$5,
	          width=$6, height=$7, resolutions=$8, video_bitrate=$9, audio_codec=$10, audio_bitrate=$11,
	          audio_channels=$12, framerate=$13, pixel_format=$14, preset_speed=$15,
	          crf=$16, hw_accel=$17, extra_flags=$18,
	          output_format=$19, hls_segment_duration=$20, encryption=$21,
	          key_rotation_interval=$22, signed_url_enabled=$23, signed_url_expiry=$24,
	          thumbnail_enabled=$25, thumbnail_interval=$26, banner_enabled=$27,
	          banner_timestamp=$28, faststart=$29, movflags=$30, two_pass=$31,
	          is_default=$32, is_active=$33, sort_order=$34
	          WHERE id=$1 RETURNING updated_at`
	return r.db.QueryRow(ctx, query,
		p.ID, p.Name, p.Codec, p.Container, p.Resolution, p.Width, p.Height, resJSON,
		p.VideoBitrate, p.AudioCodec, p.AudioBitrate, p.AudioChannels, p.Framerate,
		p.PixelFormat, p.PresetSpeed, p.CRF, p.HWAccel, p.ExtraFlags,
		p.OutputFormat, p.HLSSegmentDuration, p.Encryption, p.KeyRotationInterval,
		p.SignedURLEnabled, p.SignedURLExpiry, p.ThumbnailEnabled, p.ThumbnailInterval,
		p.BannerEnabled, p.BannerTimestamp, p.Faststart, p.Movflags, p.TwoPass,
		p.IsDefault, p.IsActive, p.SortOrder,
	).Scan(&p.UpdatedAt)
}

func (r *PresetRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM encoding_presets WHERE id = $1
	          AND NOT EXISTS (SELECT 1 FROM transcode_jobs WHERE preset_id = $1)`
	tag, err := r.db.Exec(ctx, query, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errors.New("preset is referenced by transcode jobs or does not exist")
	}
	return nil
}
