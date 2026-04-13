package service

import (
	"context"
	"crypto/sha256"
	"fmt"
	"io"
	"strings"

	"github.com/google/uuid"

	"github.com/gompp/gompp/internal/metrics"
	"github.com/gompp/gompp/internal/model"
	"github.com/gompp/gompp/internal/repository"
	"github.com/gompp/gompp/internal/storage"
)

type VideoService struct {
	videoRepo  *repository.VideoRepository
	jobRepo    *repository.JobRepository
	presetRepo *repository.PresetRepository
	storage    storage.Backend
	webhookSvc *WebhookService
	signer     *MediaSigner
}

func NewVideoService(
	videoRepo *repository.VideoRepository,
	jobRepo *repository.JobRepository,
	presetRepo *repository.PresetRepository,
	store storage.Backend,
	webhookSvc *WebhookService,
	signer *MediaSigner,
) *VideoService {
	return &VideoService{
		videoRepo:  videoRepo,
		jobRepo:    jobRepo,
		presetRepo: presetRepo,
		storage:    store,
		webhookSvc: webhookSvc,
		signer:     signer,
	}
}

func (s *VideoService) Upload(ctx context.Context, userID uuid.UUID, filename string, mimeType string, fileSize int64, body io.Reader) (*model.Video, error) {
	videoID := uuid.New()
	slug := generateSlug(filename, videoID)
	sourcePath := fmt.Sprintf("source/%s/%s", videoID, filename)

	if err := s.storage.Put(sourcePath, body); err != nil {
		return nil, fmt.Errorf("storing video: %w", err)
	}

	video := &model.Video{
		UserID:           userID,
		Title:            strings.TrimSuffix(filename, "."+fileExtension(filename)),
		Slug:             slug,
		OriginalFilename: filename,
		MimeType:         mimeType,
		FileSize:         fileSize,
		SourcePath:       sourcePath,
		Status:           model.VideoStatusUploaded,
	}
	if err := s.videoRepo.Create(ctx, video); err != nil {
		// Clean up orphaned file
		_ = s.storage.Delete(sourcePath)
		return nil, err
	}

	// Enqueue transcoding jobs for default presets
	presets, err := s.presetRepo.ListDefaults(ctx)
	if err != nil {
		return nil, err
	}
	for _, p := range presets {
		job := &model.TranscodeJob{VideoID: video.ID, PresetID: p.ID}
		if err := s.jobRepo.Create(ctx, job); err != nil {
			return nil, err
		}
	}

	if len(presets) > 0 {
		_ = s.videoRepo.UpdateStatus(ctx, video.ID, model.VideoStatusProcessing, nil)
		video.Status = model.VideoStatusProcessing
	}

	// Fire video.uploaded webhook
	s.webhookSvc.Fire(ctx, "video.uploaded", map[string]any{
		"video_id":  video.ID,
		"title":     video.Title,
		"file_size": video.FileSize,
		"mime_type": video.MimeType,
	})

	metrics.VideoUploadsTotal.Inc()
	metrics.VideoUploadBytes.Add(float64(video.FileSize))

	return video, nil
}

func (s *VideoService) Get(ctx context.Context, id uuid.UUID) (*model.Video, error) {
	v, err := s.videoRepo.GetByID(ctx, id)
	if err != nil || v == nil {
		return v, err
	}
	s.enrichContentSize(v)
	return v, nil
}

func (s *VideoService) List(ctx context.Context, params model.VideoListParams) ([]model.Video, int, error) {
	if params.Page < 1 {
		params.Page = 1
	}
	if params.PerPage < 1 || params.PerPage > 100 {
		params.PerPage = 20
	}
	videos, total, err := s.videoRepo.List(ctx, params)
	if err != nil {
		return nil, 0, err
	}
	for i := range videos {
		s.enrichContentSize(&videos[i])
	}
	return videos, total, nil
}

// VideoOutputDir reproduces the same path convention as transcoder.VideoOutputDir
// without importing the transcoder package (avoids circular deps).
func VideoOutputDir(v *model.Video) string {
	h := sha256.Sum256([]byte(v.ID.String()))
	hash8 := fmt.Sprintf("%x", h[:4])
	return fmt.Sprintf("transcoded/%s_%s", hash8, v.ID)
}

// videoOutputDir is the unexported alias for internal use.
func videoOutputDir(v *model.Video) string {
	return VideoOutputDir(v)
}

// enrichContentSize sets TranscodedSize from the actual content folder on
// storage when the DB-sourced value is 0 and the video is ready.
func (s *VideoService) enrichContentSize(v *model.Video) {
	if v.Status != model.VideoStatusReady {
		return
	}
	if v.TranscodedSize > 0 {
		return // DB value is already populated
	}
	dir := videoOutputDir(v)
	size, err := s.storage.DirSize(dir)
	if err == nil && size > 0 {
		v.TranscodedSize = size
	}
}

func (s *VideoService) Update(ctx context.Context, id uuid.UUID, req model.UpdateVideoRequest) (*model.Video, error) {
	video, err := s.videoRepo.GetByID(ctx, id)
	if err != nil || video == nil {
		return nil, err
	}
	if req.Title != nil {
		video.Title = *req.Title
	}
	if req.Description != nil {
		video.Description = req.Description
	}
	if req.IsPublic != nil {
		video.IsPublic = *req.IsPublic
	}
	if req.AllowDownload != nil {
		video.AllowDownload = *req.AllowDownload
	}
	if err := s.videoRepo.Update(ctx, video); err != nil {
		return nil, err
	}
	return video, nil
}

func (s *VideoService) Delete(ctx context.Context, id uuid.UUID) error {
	err := s.videoRepo.SoftDelete(ctx, id)
	if err == nil {
		s.webhookSvc.Fire(ctx, "video.deleted", map[string]any{
			"video_id": id,
		})
	}
	return err
}

func (s *VideoService) Retranscode(ctx context.Context, videoID uuid.UUID, presetIDs []uuid.UUID) ([]uuid.UUID, error) {
	var presets []model.Preset
	if len(presetIDs) == 0 {
		var err error
		presets, err = s.presetRepo.ListDefaults(ctx)
		if err != nil {
			return nil, err
		}
	} else {
		for _, pid := range presetIDs {
			p, err := s.presetRepo.GetByID(ctx, pid)
			if err != nil {
				return nil, err
			}
			if p != nil {
				presets = append(presets, *p)
			}
		}
	}

	var jobIDs []uuid.UUID
	for _, p := range presets {
		job := &model.TranscodeJob{VideoID: videoID, PresetID: p.ID}
		if err := s.jobRepo.Create(ctx, job); err != nil {
			return nil, err
		}
		jobIDs = append(jobIDs, job.ID)
	}

	_ = s.videoRepo.UpdateStatus(ctx, videoID, model.VideoStatusProcessing, nil)
	return jobIDs, nil
}

func (s *VideoService) GetJobs(ctx context.Context, videoID uuid.UUID) ([]model.TranscodeJob, error) {
	return s.jobRepo.GetByVideoID(ctx, videoID)
}

// StreamURL returns the master playlist URL for a video.
// If the video's preset has signed_url_enabled, the URL includes HMAC signature.
// The returned path is relative (e.g. "transcoded/.../playlist.m3u8?sig=...&exp=...").
func (s *VideoService) StreamURL(ctx context.Context, video *model.Video) string {
	if video.MasterPlaylist == nil || *video.MasterPlaylist == "" {
		return ""
	}
	path := *video.MasterPlaylist

	if s.signer == nil {
		return path
	}

	// Look up the preset via the most recent completed job
	jobs, err := s.jobRepo.GetByVideoID(ctx, video.ID)
	if err != nil {
		return path
	}
	for _, j := range jobs {
		if j.Status != model.JobStatusCompleted {
			continue
		}
		preset, err := s.presetRepo.GetByID(ctx, j.PresetID)
		if err != nil || preset == nil {
			continue
		}
		if preset.SignedURLEnabled {
			expiry := preset.SignedURLExpiry
			if expiry <= 0 {
				expiry = 3600
			}
			return path + "?" + s.signer.SignQuery(path, expiry)
		}
		break
	}
	return path
}

func generateSlug(filename string, id uuid.UUID) string {
	name := strings.TrimSuffix(filename, "."+fileExtension(filename))
	name = strings.ToLower(name)
	name = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			return r
		}
		return '-'
	}, name)
	name = strings.Trim(name, "-")
	short := id.String()[:8]
	return name + "-" + short
}

func fileExtension(name string) string {
	parts := strings.Split(name, ".")
	if len(parts) > 1 {
		return parts[len(parts)-1]
	}
	return ""
}
