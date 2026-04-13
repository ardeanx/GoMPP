package service

import (
	"github.com/gompp/gompp/internal/repository"
)

// TranscodeService coordinates transcoding operations.
type TranscodeService struct {
	JobRepo    *repository.JobRepository
	VideoRepo  *repository.VideoRepository
	PresetRepo *repository.PresetRepository
	WebhookSvc *WebhookService
}

func NewTranscodeService(
	jobRepo *repository.JobRepository,
	videoRepo *repository.VideoRepository,
	presetRepo *repository.PresetRepository,
	webhookSvc *WebhookService,
) *TranscodeService {
	return &TranscodeService{
		JobRepo:    jobRepo,
		VideoRepo:  videoRepo,
		PresetRepo: presetRepo,
		WebhookSvc: webhookSvc,
	}
}
