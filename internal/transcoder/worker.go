package transcoder

import (
	"context"
	"fmt"
	"io"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/gompp/gompp/internal/metrics"
	"github.com/gompp/gompp/internal/model"
	"github.com/gompp/gompp/internal/repository"
	"github.com/gompp/gompp/internal/service"
	"github.com/gompp/gompp/internal/storage"
)

// WorkerPool manages a pool of transcoding workers.
type WorkerPool struct {
	numWorkers int
	ffmpeg     *FFmpeg
	jobRepo    *repository.JobRepository
	videoRepo  *repository.VideoRepository
	presetRepo *repository.PresetRepository
	webhookSvc *service.WebhookService
	storage    storage.Backend
	cancel     context.CancelFunc
	wg         sync.WaitGroup
}

func NewWorkerPool(
	numWorkers int,
	ffmpeg *FFmpeg,
	jobRepo *repository.JobRepository,
	videoRepo *repository.VideoRepository,
	presetRepo *repository.PresetRepository,
	webhookSvc *service.WebhookService,
	store storage.Backend,
) *WorkerPool {
	return &WorkerPool{
		numWorkers: numWorkers,
		ffmpeg:     ffmpeg,
		jobRepo:    jobRepo,
		videoRepo:  videoRepo,
		presetRepo: presetRepo,
		webhookSvc: webhookSvc,
		storage:    store,
	}
}

// Start launches all workers.
func (wp *WorkerPool) Start(ctx context.Context) {
	ctx, wp.cancel = context.WithCancel(ctx)
	for i := 0; i < wp.numWorkers; i++ {
		wp.wg.Add(1)
		go wp.run(ctx, fmt.Sprintf("worker-%d", i))
	}
	log.Info().Int("workers", wp.numWorkers).Msg("transcoding worker pool started")
}

// Stop gracefully shuts down the worker pool.
func (wp *WorkerPool) Stop() {
	if wp.cancel != nil {
		wp.cancel()
	}
	wp.wg.Wait()
	log.Info().Msg("transcoding worker pool stopped")
}

func (wp *WorkerPool) run(ctx context.Context, workerID string) {
	defer wp.wg.Done()
	logger := log.With().Str("worker", workerID).Logger()

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		job, err := wp.jobRepo.ClaimPending(ctx, workerID)
		if err != nil {
			logger.Error().Err(err).Msg("failed to claim job")
			time.Sleep(5 * time.Second)
			continue
		}
		if job == nil {
			time.Sleep(3 * time.Second)
			continue
		}

		logger.Info().
			Str("job_id", job.ID.String()).
			Str("video_id", job.VideoID.String()).
			Msg("processing transcode job")

		wp.processJob(ctx, job, workerID)
	}
}

func (wp *WorkerPool) processJob(ctx context.Context, job *model.TranscodeJob, workerID string) {
	metrics.TranscodeWorkersActive.Inc()
	defer metrics.TranscodeWorkersActive.Dec()
	jobStart := time.Now()

	video, err := wp.videoRepo.GetByID(ctx, job.VideoID)
	if err != nil || video == nil {
		_ = wp.jobRepo.Fail(ctx, job.ID, "video not found", "")
		return
	}

	preset, err := wp.presetRepo.GetByID(ctx, job.PresetID)
	if err != nil || preset == nil {
		_ = wp.jobRepo.Fail(ctx, job.ID, "preset not found", "")
		return
	}

	// Fire transcode.started webhook
	wp.webhookSvc.Fire(ctx, "transcode.started", map[string]any{
		"video_id": video.ID,
		"job_id":   job.ID,
		"preset":   preset.Name,
	})

	// Probe source video for duration/dimensions if not already known.
	if video.Duration == nil || *video.Duration == 0 {
		probe, err := wp.ffmpeg.Probe(ctx, video)
		if err != nil {
			log.Warn().Err(err).Str("video_id", video.ID.String()).Msg("ffprobe failed, progress will be unavailable")
		} else {
			if probe.Duration > 0 {
				video.Duration = &probe.Duration
			}
			if probe.Width > 0 && probe.Height > 0 {
				video.Width = &probe.Width
				video.Height = &probe.Height
			}
			_ = wp.videoRepo.SetMediaInfo(ctx, video.ID, probe.Duration, probe.Width, probe.Height)
		}
	}

	resolutions := preset.Resolutions
	if len(resolutions) == 0 {
		resolutions = []model.ResolutionEntry{preset.PrimaryResolution()}
	}

	var totalSize int64
	var lastDuration float64

	for i, res := range resolutions {
		progressCb := func(progress float64) {
			base := float64(i) / float64(len(resolutions))
			chunk := 1.0 / float64(len(resolutions))
			_ = wp.jobRepo.UpdateProgress(ctx, job.ID, base+progress*chunk)
		}

		outputDir, outputSize, duration, err := wp.ffmpeg.Transcode(ctx, video, preset, res, progressCb)
		if err != nil {
			log.Error().Err(err).
				Str("job_id", job.ID.String()).
				Int("height", res.Height).
				Msg("transcode failed for resolution")
			_ = wp.jobRepo.Fail(ctx, job.ID, err.Error(), "")

			metrics.TranscodeJobsTotal.WithLabelValues("failed").Inc()

			wp.webhookSvc.Fire(ctx, "transcode.failed", map[string]any{
				"video_id":   video.ID,
				"job_id":     job.ID,
				"preset":     preset.Name,
				"resolution": res.Height,
				"error":      err.Error(),
			})
			return
		}

		totalSize += outputSize
		lastDuration = duration
		_ = outputDir // directory per resolution, base dir computed from VideoOutputDir
	}

	parentDir := VideoOutputDir(video)

	if err := wp.jobRepo.Complete(ctx, job.ID, parentDir, totalSize, lastDuration); err != nil {
		log.Error().Err(err).Msg("failed to complete job")
		return
	}

	metrics.TranscodeJobsTotal.WithLabelValues("completed").Inc()
	metrics.TranscodeJobDuration.WithLabelValues(preset.Codec, preset.Resolution).Observe(time.Since(jobStart).Seconds())

	wp.webhookSvc.Fire(ctx, "transcode.completed", map[string]any{
		"video_id":          video.ID,
		"job_id":            job.ID,
		"preset":            preset.Name,
		"duration_seconds":  lastDuration,
		"output_size_bytes": totalSize,
	})

	// Check if all jobs for video are done
	allDone, err := wp.jobRepo.AllCompleteForVideo(ctx, job.VideoID)
	if err == nil && allDone {
		_ = wp.videoRepo.UpdateStatus(ctx, job.VideoID, model.VideoStatusReady, nil)
		// Generate master playlist
		wp.generateMasterPlaylist(ctx, video)

		// Generate thumbnail, preview, and banner
		wp.generateThumbnailAndPreview(ctx, video)
		wp.generateBanner(ctx, video)

		// Generate meta.json
		if err := wp.ffmpeg.GenerateMetaJSON(ctx, video, preset, resolutions); err != nil {
			log.Warn().Err(err).Str("video_id", video.ID.String()).Msg("meta.json generation failed")
		}

		wp.webhookSvc.Fire(ctx, "video.ready", map[string]any{
			"video_id": video.ID,
		})
	}
}

func (wp *WorkerPool) generateMasterPlaylist(ctx context.Context, video *model.Video) {
	jobs, err := wp.jobRepo.GetByVideoID(ctx, video.ID)
	if err != nil {
		return
	}

	// Collect all resolution variants across all completed jobs
	type variant struct {
		bandwidth  int
		width      int
		height     int
		folderName string
	}
	var variants []variant

	for _, job := range jobs {
		if job.Status != model.JobStatusCompleted || job.OutputPath == nil {
			continue
		}
		preset, err := wp.presetRepo.GetByID(ctx, job.PresetID)
		if err != nil || preset == nil {
			continue
		}
		bw := parseBitrate(preset.VideoBitrate)

		resolutions := preset.Resolutions
		if len(resolutions) == 0 {
			resolutions = []model.ResolutionEntry{preset.PrimaryResolution()}
		}
		for _, res := range resolutions {
			variants = append(variants, variant{
				bandwidth:  bw,
				width:      res.Width,
				height:     res.Height,
				folderName: fmt.Sprintf("%d", res.Height),
			})
		}
	}

	playlist := "#EXTM3U\n#EXT-X-VERSION:3\n"
	for _, v := range variants {
		playlist += fmt.Sprintf("#EXT-X-STREAM-INF:BANDWIDTH=%d,RESOLUTION=%dx%d\n", v.bandwidth, v.width, v.height)
		playlist += fmt.Sprintf("%s/playlist.m3u8\n", v.folderName)
	}

	masterPath := fmt.Sprintf("%s/playlist.m3u8", VideoOutputDir(video))
	_ = wp.storage.Put(masterPath, stringReader(playlist))
	_ = wp.videoRepo.SetMasterPlaylist(ctx, video.ID, masterPath)
}

func parseBitrate(s string) int {
	s = strings.TrimSuffix(s, "k")
	s = strings.TrimSuffix(s, "K")
	val := 0
	fmt.Sscanf(s, "%d", &val)
	return val * 1000
}

func (wp *WorkerPool) generateThumbnailAndPreview(ctx context.Context, video *model.Video) {
	seekSec := 2.0
	if video.Duration != nil && *video.Duration > 20 {
		seekSec = *video.Duration * 0.1
	}

	thumbPath, err := wp.ffmpeg.GenerateThumbnail(ctx, video, seekSec)
	if err != nil {
		log.Warn().Err(err).Str("video_id", video.ID.String()).Msg("thumbnail generation failed")
	} else {
		_ = wp.videoRepo.SetThumbnail(ctx, video.ID, thumbPath)
	}

	// Generate additional thumbnail candidates for the picker UI
	if _, err := wp.ffmpeg.GenerateThumbnailCandidates(ctx, video, 6); err != nil {
		log.Warn().Err(err).Str("video_id", video.ID.String()).Msg("thumbnail candidates generation failed")
	}

	previewPath, err := wp.ffmpeg.GeneratePreview(ctx, video, seekSec)
	if err != nil {
		log.Warn().Err(err).Str("video_id", video.ID.String()).Msg("preview generation failed")
	} else {
		_ = wp.videoRepo.SetPreview(ctx, video.ID, previewPath)
	}
}

func (wp *WorkerPool) generateBanner(ctx context.Context, video *model.Video) {
	seekSec := 5.0
	if video.Duration != nil && *video.Duration > 20 {
		seekSec = *video.Duration * 0.1
	}

	_, err := wp.ffmpeg.GenerateBanner(ctx, video, seekSec)
	if err != nil {
		log.Warn().Err(err).Str("video_id", video.ID.String()).Msg("banner generation failed")
	}
}

func stringReader(s string) *stringReaderImpl {
	return &stringReaderImpl{data: []byte(s), pos: 0}
}

type stringReaderImpl struct {
	data []byte
	pos  int
}

func (r *stringReaderImpl) Read(p []byte) (n int, err error) {
	if r.pos >= len(r.data) {
		return 0, io.EOF
	}
	n = copy(p, r.data[r.pos:])
	r.pos += n
	return n, nil
}
