package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gompp/gompp/internal/model"
)

type SubtitleRepository struct {
	db *pgxpool.Pool
}

func NewSubtitleRepository(db *pgxpool.Pool) *SubtitleRepository {
	return &SubtitleRepository{db: db}
}

func (r *SubtitleRepository) Create(ctx context.Context, s *model.VideoSubtitle) error {
	return r.db.QueryRow(ctx,
		`INSERT INTO video_subtitles (video_id, language, label, file_path, format, source)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, created_at`,
		s.VideoID, s.Language, s.Label, s.FilePath, s.Format, s.Source,
	).Scan(&s.ID, &s.CreatedAt)
}

func (r *SubtitleRepository) ListByVideoID(ctx context.Context, videoID uuid.UUID) ([]*model.VideoSubtitle, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, video_id, language, label, file_path, format, source, created_at
		 FROM video_subtitles WHERE video_id = $1 ORDER BY language, created_at`, videoID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subs []*model.VideoSubtitle
	for rows.Next() {
		s := &model.VideoSubtitle{}
		if err := rows.Scan(&s.ID, &s.VideoID, &s.Language, &s.Label, &s.FilePath, &s.Format, &s.Source, &s.CreatedAt); err != nil {
			return nil, err
		}
		subs = append(subs, s)
	}
	return subs, rows.Err()
}

func (r *SubtitleRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.VideoSubtitle, error) {
	s := &model.VideoSubtitle{}
	err := r.db.QueryRow(ctx,
		`SELECT id, video_id, language, label, file_path, format, source, created_at
		 FROM video_subtitles WHERE id = $1`, id,
	).Scan(&s.ID, &s.VideoID, &s.Language, &s.Label, &s.FilePath, &s.Format, &s.Source, &s.CreatedAt)
	if err != nil {
		return nil, err
	}
	return s, nil
}

func (r *SubtitleRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM video_subtitles WHERE id = $1`, id)
	return err
}
