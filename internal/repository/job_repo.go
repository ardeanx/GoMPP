package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gompp/gompp/internal/model"
)

type JobRepository struct {
	db *pgxpool.Pool
}

func NewJobRepository(db *pgxpool.Pool) *JobRepository {
	return &JobRepository{db: db}
}

func (r *JobRepository) Create(ctx context.Context, j *model.TranscodeJob) error {
	query := `INSERT INTO transcode_jobs (video_id, preset_id) VALUES ($1, $2)
	          RETURNING id, status, progress, attempts, max_attempts, created_at, updated_at`
	return r.db.QueryRow(ctx, query, j.VideoID, j.PresetID).Scan(
		&j.ID, &j.Status, &j.Progress, &j.Attempts, &j.MaxAttempts, &j.CreatedAt, &j.UpdatedAt,
	)
}

// ClaimPending atomically claims the next pending job using SELECT FOR UPDATE SKIP LOCKED.
func (r *JobRepository) ClaimPending(ctx context.Context, workerID string) (*model.TranscodeJob, error) {
	query := `UPDATE transcode_jobs SET status = 'processing', worker_id = $1, started_at = NOW(),
	          attempts = attempts + 1
	          WHERE id = (
	              SELECT id FROM transcode_jobs
	              WHERE status = 'pending'
	              ORDER BY created_at
	              FOR UPDATE SKIP LOCKED
	              LIMIT 1
	          ) RETURNING id, video_id, preset_id, status, progress, attempts, max_attempts, worker_id, started_at, created_at, updated_at`
	j := &model.TranscodeJob{}
	err := r.db.QueryRow(ctx, query, workerID).Scan(
		&j.ID, &j.VideoID, &j.PresetID, &j.Status, &j.Progress,
		&j.Attempts, &j.MaxAttempts, &j.WorkerID, &j.StartedAt, &j.CreatedAt, &j.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return j, err
}

func (r *JobRepository) UpdateProgress(ctx context.Context, id uuid.UUID, progress float64) error {
	query := `UPDATE transcode_jobs SET progress = $2 WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id, progress)
	return err
}

func (r *JobRepository) Complete(ctx context.Context, id uuid.UUID, outputPath string, outputSize int64, duration float64) error {
	query := `UPDATE transcode_jobs SET status = 'completed', progress = 100,
	          output_path = $2, output_size = $3, duration = $4, completed_at = NOW()
	          WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id, outputPath, outputSize, duration)
	return err
}

func (r *JobRepository) Fail(ctx context.Context, id uuid.UUID, errMsg string, ffmpegLog string) error {
	// If attempts < max_attempts, set back to pending for retry
	query := `UPDATE transcode_jobs SET
	          status = CASE WHEN attempts < max_attempts THEN 'pending' ELSE 'failed' END,
	          error_message = $2, ffmpeg_log = $3,
	          completed_at = CASE WHEN attempts >= max_attempts THEN NOW() ELSE NULL END
	          WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id, errMsg, ffmpegLog)
	return err
}

func (r *JobRepository) GetByVideoID(ctx context.Context, videoID uuid.UUID) ([]model.TranscodeJob, error) {
	query := `SELECT id, video_id, preset_id, status, progress, output_path, output_size,
	          duration, started_at, completed_at, error_message, attempts, max_attempts,
	          worker_id, ffmpeg_log, created_at, updated_at
	          FROM transcode_jobs WHERE video_id = $1 ORDER BY created_at`
	rows, err := r.db.Query(ctx, query, videoID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var jobs []model.TranscodeJob
	for rows.Next() {
		var j model.TranscodeJob
		if err := rows.Scan(
			&j.ID, &j.VideoID, &j.PresetID, &j.Status, &j.Progress, &j.OutputPath,
			&j.OutputSize, &j.Duration, &j.StartedAt, &j.CompletedAt, &j.ErrorMessage,
			&j.Attempts, &j.MaxAttempts, &j.WorkerID, &j.FFmpegLog, &j.CreatedAt, &j.UpdatedAt,
		); err != nil {
			return nil, err
		}
		jobs = append(jobs, j)
	}
	return jobs, rows.Err()
}

// AllCompleteForVideo checks if all transcode jobs for a video are completed.
func (r *JobRepository) AllCompleteForVideo(ctx context.Context, videoID uuid.UUID) (bool, error) {
	query := `SELECT COUNT(*) = 0 FROM transcode_jobs
	          WHERE video_id = $1 AND status NOT IN ('completed', 'cancelled')
	          AND EXISTS (SELECT 1 FROM transcode_jobs WHERE video_id = $1)`
	var allDone bool
	err := r.db.QueryRow(ctx, query, videoID).Scan(&allDone)
	return allDone, err
}

func (r *JobRepository) CountPending(ctx context.Context) (int, error) {
	var count int
	err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM transcode_jobs WHERE status = 'pending'`).Scan(&count)
	return count, err
}
