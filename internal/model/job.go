package model

import (
	"time"

	"github.com/google/uuid"
)

// TranscodeJob represents a transcoding job record.
type TranscodeJob struct {
	ID           uuid.UUID  `json:"id"`
	VideoID      uuid.UUID  `json:"video_id"`
	PresetID     uuid.UUID  `json:"preset_id"`
	Status       string     `json:"status"`
	Progress     float64    `json:"progress"`
	OutputPath   *string    `json:"output_path,omitempty"`
	OutputSize   *int64     `json:"output_size,omitempty"`
	Duration     *float64   `json:"duration,omitempty"`
	StartedAt    *time.Time `json:"started_at,omitempty"`
	CompletedAt  *time.Time `json:"completed_at,omitempty"`
	ErrorMessage *string    `json:"error_message,omitempty"`
	Attempts     int        `json:"attempts"`
	MaxAttempts  int        `json:"max_attempts"`
	WorkerID     *string    `json:"worker_id,omitempty"`
	FFmpegLog    *string    `json:"-"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

const (
	JobStatusPending    = "pending"
	JobStatusProcessing = "processing"
	JobStatusCompleted  = "completed"
	JobStatusFailed     = "failed"
	JobStatusCancelled  = "cancelled"
)
