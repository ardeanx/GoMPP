package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gompp/gompp/internal/model"
)

type VideoRepository struct {
	db *pgxpool.Pool
}

func NewVideoRepository(db *pgxpool.Pool) *VideoRepository {
	return &VideoRepository{db: db}
}

func (r *VideoRepository) Create(ctx context.Context, v *model.Video) error {
	query := `INSERT INTO videos (user_id, title, description, slug, original_filename, mime_type, file_size, source_path, status, is_public, metadata)
	          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	          RETURNING id, created_at, updated_at`
	return r.db.QueryRow(ctx, query,
		v.UserID, v.Title, v.Description, v.Slug, v.OriginalFilename,
		v.MimeType, v.FileSize, v.SourcePath, v.Status, v.IsPublic, v.Metadata,
	).Scan(&v.ID, &v.CreatedAt, &v.UpdatedAt)
}

func (r *VideoRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Video, error) {
	query := `SELECT id, user_id, title, description, slug, original_filename, mime_type, file_size,
	          duration, width, height, status, source_path, thumbnail_path, preview_path,
	          master_playlist, error_message, view_count, is_public, allow_download, metadata, created_at, updated_at, deleted_at,
	          COALESCE((SELECT SUM(output_size) FROM transcode_jobs WHERE video_id = videos.id AND status = 'completed'), 0) AS transcoded_size
	          FROM videos WHERE id = $1 AND deleted_at IS NULL`
	v := &model.Video{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&v.ID, &v.UserID, &v.Title, &v.Description, &v.Slug, &v.OriginalFilename,
		&v.MimeType, &v.FileSize, &v.Duration, &v.Width, &v.Height, &v.Status,
		&v.SourcePath, &v.ThumbnailPath, &v.PreviewPath, &v.MasterPlaylist,
		&v.ErrorMessage, &v.ViewCount, &v.IsPublic, &v.AllowDownload, &v.Metadata,
		&v.CreatedAt, &v.UpdatedAt, &v.DeletedAt, &v.TranscodedSize,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return v, err
}

func (r *VideoRepository) List(ctx context.Context, p model.VideoListParams) ([]model.Video, int, error) {
	where := "WHERE deleted_at IS NULL"
	args := []any{}
	argIdx := 1

	if p.UserID != nil {
		where += fmt.Sprintf(" AND user_id = $%d", argIdx)
		args = append(args, *p.UserID)
		argIdx++
	}
	if p.Status != "" {
		where += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, p.Status)
		argIdx++
	}
	if p.Search != "" {
		where += fmt.Sprintf(" AND title ILIKE $%d", argIdx)
		args = append(args, "%"+p.Search+"%")
		argIdx++
	}

	var total int
	if err := r.db.QueryRow(ctx, "SELECT COUNT(*) FROM videos "+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	sortCol := "created_at"
	if p.Sort == "title" || p.Sort == "status" || p.Sort == "file_size" || p.Sort == "view_count" {
		sortCol = p.Sort
	}
	order := "DESC"
	if p.Order == "asc" {
		order = "ASC"
	}

	query := fmt.Sprintf(`SELECT id, user_id, title, description, slug, original_filename, mime_type, file_size,
	          duration, width, height, status, source_path, thumbnail_path, preview_path,
	          master_playlist, error_message, view_count, is_public, allow_download, metadata, created_at, updated_at, deleted_at,
	          COALESCE((SELECT SUM(output_size) FROM transcode_jobs WHERE video_id = videos.id AND status = 'completed'), 0) AS transcoded_size
	          FROM videos %s ORDER BY %s %s LIMIT $%d OFFSET $%d`,
		where, sortCol, order, argIdx, argIdx+1)
	args = append(args, p.PerPage, (p.Page-1)*p.PerPage)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var videos []model.Video
	for rows.Next() {
		var v model.Video
		if err := rows.Scan(
			&v.ID, &v.UserID, &v.Title, &v.Description, &v.Slug, &v.OriginalFilename,
			&v.MimeType, &v.FileSize, &v.Duration, &v.Width, &v.Height, &v.Status,
			&v.SourcePath, &v.ThumbnailPath, &v.PreviewPath, &v.MasterPlaylist,
			&v.ErrorMessage, &v.ViewCount, &v.IsPublic, &v.AllowDownload, &v.Metadata,
			&v.CreatedAt, &v.UpdatedAt, &v.DeletedAt, &v.TranscodedSize,
		); err != nil {
			return nil, 0, err
		}
		videos = append(videos, v)
	}
	return videos, total, rows.Err()
}

func (r *VideoRepository) Update(ctx context.Context, v *model.Video) error {
	query := `UPDATE videos SET title = $2, description = $3, is_public = $4, allow_download = $5
	          WHERE id = $1 AND deleted_at IS NULL RETURNING updated_at`
	return r.db.QueryRow(ctx, query, v.ID, v.Title, v.Description, v.IsPublic, v.AllowDownload).Scan(&v.UpdatedAt)
}

func (r *VideoRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status string, errorMsg *string) error {
	query := `UPDATE videos SET status = $2, error_message = $3 WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id, status, errorMsg)
	return err
}

func (r *VideoRepository) SetMasterPlaylist(ctx context.Context, id uuid.UUID, path string) error {
	query := `UPDATE videos SET master_playlist = $2 WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id, path)
	return err
}

func (r *VideoRepository) SetThumbnail(ctx context.Context, id uuid.UUID, path string) error {
	query := `UPDATE videos SET thumbnail_path = $2 WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id, path)
	return err
}

func (r *VideoRepository) SetPreview(ctx context.Context, id uuid.UUID, path string) error {
	query := `UPDATE videos SET preview_path = $2 WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id, path)
	return err
}

func (r *VideoRepository) SetMediaInfo(ctx context.Context, id uuid.UUID, duration float64, width, height int) error {
	query := `UPDATE videos SET duration = $2, width = $3, height = $4 WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id, duration, width, height)
	return err
}

func (r *VideoRepository) SoftDelete(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE videos SET deleted_at = NOW(), status = 'deleted' WHERE id = $1 AND deleted_at IS NULL`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *VideoRepository) GetBySlug(ctx context.Context, slug string) (*model.Video, error) {
	query := `SELECT id, user_id, title, description, slug, original_filename, mime_type, file_size,
	          duration, width, height, status, source_path, thumbnail_path, preview_path,
	          master_playlist, error_message, view_count, is_public, allow_download, metadata, created_at, updated_at, deleted_at,
	          COALESCE((SELECT SUM(output_size) FROM transcode_jobs WHERE video_id = videos.id AND status = 'completed'), 0) AS transcoded_size
	          FROM videos WHERE slug = $1 AND deleted_at IS NULL`
	v := &model.Video{}
	err := r.db.QueryRow(ctx, query, slug).Scan(
		&v.ID, &v.UserID, &v.Title, &v.Description, &v.Slug, &v.OriginalFilename,
		&v.MimeType, &v.FileSize, &v.Duration, &v.Width, &v.Height, &v.Status,
		&v.SourcePath, &v.ThumbnailPath, &v.PreviewPath, &v.MasterPlaylist,
		&v.ErrorMessage, &v.ViewCount, &v.IsPublic, &v.AllowDownload, &v.Metadata,
		&v.CreatedAt, &v.UpdatedAt, &v.DeletedAt, &v.TranscodedSize,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return v, err
}

func (r *VideoRepository) IncrementViewCount(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE videos SET view_count = view_count + 1 WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}
