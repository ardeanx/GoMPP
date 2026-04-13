package model

import (
	"time"

	"github.com/google/uuid"
)

// VideoSubtitle represents a subtitle track attached to a video.
type VideoSubtitle struct {
	ID        uuid.UUID `json:"id"`
	VideoID   uuid.UUID `json:"video_id"`
	Language  string    `json:"language"`
	Label     string    `json:"label"`
	FilePath  string    `json:"-"`
	Format    string    `json:"format"`
	Source    string    `json:"source"`
	CreatedAt time.Time `json:"created_at"`
}
