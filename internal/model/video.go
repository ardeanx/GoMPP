package model

import (
	"time"

	"github.com/google/uuid"
)

// Video represents a video record.
type Video struct {
	ID               uuid.UUID  `json:"id"`
	UserID           uuid.UUID  `json:"user_id"`
	Title            string     `json:"title"`
	Description      *string    `json:"description,omitempty"`
	Slug             string     `json:"slug"`
	OriginalFilename string     `json:"original_filename"`
	MimeType         string     `json:"mime_type"`
	FileSize         int64      `json:"file_size"`
	Duration         *float64   `json:"duration,omitempty"`
	Width            *int       `json:"width,omitempty"`
	Height           *int       `json:"height,omitempty"`
	Status           string     `json:"status"`
	SourcePath       string     `json:"-"`
	ThumbnailPath    *string    `json:"thumbnail_path,omitempty"`
	PreviewPath      *string    `json:"-"`
	MasterPlaylist   *string    `json:"master_playlist,omitempty"`
	ErrorMessage     *string    `json:"error_message,omitempty"`
	ViewCount        int64      `json:"view_count"`
	IsPublic         bool       `json:"is_public"`
	AllowDownload    bool       `json:"allow_download"`
	Metadata         any        `json:"metadata,omitempty"`
	TranscodedSize   int64      `json:"transcoded_size"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
	DeletedAt        *time.Time `json:"-"`
}

// VideoListParams holds query parameters for listing videos.
type VideoListParams struct {
	Page    int
	PerPage int
	Status  string
	Search  string
	Sort    string
	Order   string
	UserID  *uuid.UUID
}

// UpdateVideoRequest is the payload for updating video metadata.
type UpdateVideoRequest struct {
	Title         *string `json:"title,omitempty"`
	Description   *string `json:"description,omitempty"`
	IsPublic      *bool   `json:"is_public,omitempty"`
	AllowDownload *bool   `json:"allow_download,omitempty"`
}

// RetranscodeRequest is the payload for re-triggering transcoding.
type RetranscodeRequest struct {
	PresetIDs []uuid.UUID `json:"preset_ids,omitempty"`
}

const (
	VideoStatusUploading  = "uploading"
	VideoStatusUploaded   = "uploaded"
	VideoStatusProcessing = "processing"
	VideoStatusReady      = "ready"
	VideoStatusFailed     = "failed"
	VideoStatusDeleted    = "deleted"
)
