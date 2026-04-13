package transcoder

import (
	"context"
	cryptoRand "crypto/rand"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"

	"github.com/gompp/gompp/internal/model"
	"github.com/gompp/gompp/internal/storage"
)

// FFmpeg handles video transcoding.
type FFmpeg struct {
	BinPath   string
	ProbePath string
	TempDir   string
	Storage   storage.Backend
}

func NewFFmpeg(binPath, probePath, tempDir string, store storage.Backend) *FFmpeg {
	return &FFmpeg{BinPath: binPath, ProbePath: probePath, TempDir: tempDir, Storage: store}
}

// VideoOutputDir returns the base output directory for a video using the {hash8}_{id} format.
func VideoOutputDir(video *model.Video) string {
	h := sha256.Sum256([]byte(video.ID.String()))
	hash8 := fmt.Sprintf("%x", h[:4])
	return fmt.Sprintf("transcoded/%s_%s", hash8, video.ID)
}

// ProbeResult holds metadata extracted from a media file via ffprobe.
type ProbeResult struct {
	Duration float64
	Width    int
	Height   int
}

// Probe runs ffprobe to extract duration, width, and height from the source video.
// It derives the ffprobe path from the ffmpeg binary path (same directory).
func (f *FFmpeg) Probe(ctx context.Context, video *model.Video) (*ProbeResult, error) {
	inputPath, cleanup, err := f.resolveInput(video)
	if err != nil {
		return nil, err
	}
	if cleanup != nil {
		defer cleanup()
	}

	// Use configured probe path, or derive from ffmpeg path
	probeBin := f.ProbePath
	if probeBin == "" {
		probeBin = strings.Replace(f.BinPath, "ffmpeg", "ffprobe", 1)
		if probeBin == f.BinPath {
			probeBin = "ffprobe"
		}
	}

	args := []string{
		"-v", "error",
		"-select_streams", "v:0",
		"-show_entries", "stream=width,height",
		"-show_entries", "format=duration",
		"-of", "json",
		inputPath,
	}

	out, err := exec.CommandContext(ctx, probeBin, args...).Output()
	if err != nil {
		return nil, fmt.Errorf("ffprobe failed: %w", err)
	}

	var data struct {
		Streams []struct {
			Width  int `json:"width"`
			Height int `json:"height"`
		} `json:"streams"`
		Format struct {
			Duration string `json:"duration"`
		} `json:"format"`
	}
	if err := json.Unmarshal(out, &data); err != nil {
		return nil, fmt.Errorf("parsing ffprobe output: %w", err)
	}

	result := &ProbeResult{}
	if data.Format.Duration != "" {
		result.Duration, _ = strconv.ParseFloat(data.Format.Duration, 64)
	}
	if len(data.Streams) > 0 {
		result.Width = data.Streams[0].Width
		result.Height = data.Streams[0].Height
	}
	return result, nil
}

// Transcode runs FFmpeg to transcode a video file for the given preset and resolution entry.
// It returns the output directory path (relative to storage), output file size, and duration.
func (f *FFmpeg) Transcode(ctx context.Context, video *model.Video, preset *model.Preset, res model.ResolutionEntry, progressCb func(float64)) (string, int64, float64, error) {
	baseDir := VideoOutputDir(video)
	outputDir := fmt.Sprintf("%s/%d", baseDir, res.Height)

	// Resolve input/output to local filesystem paths.
	// If the backend supports local paths (LocalBackend) use them directly;
	// otherwise download the source to a temp file and transcode into a temp dir,
	// then upload results back to the remote backend.
	var inputPath, absOutputDir string
	var uploadAfter bool

	if resolver, ok := f.Storage.(storage.LocalPathResolver); ok {
		inputPath = resolver.FullPath(video.SourcePath)
		absOutputDir = resolver.FullPath(outputDir)
	} else {
		// Remote backend: download source to temp file
		rc, err := f.Storage.Get(video.SourcePath)
		if err != nil {
			return "", 0, 0, fmt.Errorf("downloading source from storage: %w", err)
		}
		defer rc.Close()

		tmpFile, err := os.CreateTemp(f.TempDir, "gompp-src-*"+filepath.Ext(video.SourcePath))
		if err != nil {
			return "", 0, 0, fmt.Errorf("creating temp source file: %w", err)
		}
		defer os.Remove(tmpFile.Name())

		if _, err := io.Copy(tmpFile, rc); err != nil {
			tmpFile.Close()
			return "", 0, 0, fmt.Errorf("writing temp source file: %w", err)
		}
		tmpFile.Close()

		inputPath = tmpFile.Name()
		absOutputDir = filepath.Join(f.TempDir, fmt.Sprintf("gompp-out-%s-%d", video.ID.String(), res.Height))
		uploadAfter = true
	}

	if err := os.MkdirAll(absOutputDir, 0750); err != nil {
		return "", 0, 0, fmt.Errorf("creating output dir: %w", err)
	}

	segmentPath := filepath.Join(absOutputDir, "segment_%03d.ts")
	playlistPath := filepath.Join(absOutputDir, "playlist.m3u8")

	args := buildFFmpegArgs(inputPath, preset, res, segmentPath, playlistPath)

	cmd := exec.CommandContext(ctx, f.BinPath, args...)
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return "", 0, 0, fmt.Errorf("creating stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return "", 0, 0, fmt.Errorf("starting ffmpeg: %w", err)
	}

	// CRITICAL: stderr MUST be fully drained before calling cmd.Wait(),
	// otherwise FFmpeg blocks when the OS pipe buffer fills (~64KB) and
	// the process appears hung with 0% CPU/GPU usage.
	var stderrWg sync.WaitGroup
	var stderrTail []string
	stderrWg.Add(1)
	go func() {
		defer stderrWg.Done()
		totalDuration := video.Duration
		if totalDuration != nil && *totalDuration > 0 {
			stderrTail = ParseProgress(stderr, *totalDuration, progressCb)
		} else {
			// No duration known — still must drain stderr to prevent deadlock.
			stderrTail = DrainStderr(stderr)
		}
	}()

	// Wait for stderr reader to finish (FFmpeg EOF) before calling cmd.Wait().
	stderrWg.Wait()

	if err := cmd.Wait(); err != nil {
		// Include last stderr lines in the error for diagnostics
		detail := strings.Join(stderrTail, "\n")
		if detail != "" {
			return "", 0, 0, fmt.Errorf("ffmpeg failed: %w\nstderr:\n%s", err, detail)
		}
		return "", 0, 0, fmt.Errorf("ffmpeg failed: %w", err)
	}

	// Upload output files to remote backend if needed
	if uploadAfter {
		if err := f.uploadDir(absOutputDir, outputDir); err != nil {
			return "", 0, 0, fmt.Errorf("uploading transcoded output: %w", err)
		}
		defer os.RemoveAll(absOutputDir)
	}

	size := dirSize(absOutputDir)
	dur := float64(0)
	if video.Duration != nil {
		dur = *video.Duration
	}

	return outputDir, size, dur, nil
}

// uploadDir walks a local directory and uploads every file to the remote storage backend.
func (f *FFmpeg) uploadDir(localDir, storagePrefix string) error {
	return filepath.Walk(localDir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return err
		}
		rel, _ := filepath.Rel(localDir, path)
		key := storagePrefix + "/" + filepath.ToSlash(rel)

		file, err := os.Open(path)
		if err != nil {
			return fmt.Errorf("open %s: %w", rel, err)
		}
		defer file.Close()
		return f.Storage.Put(key, file)
	})
}

func buildFFmpegArgs(input string, preset *model.Preset, res model.ResolutionEntry, segmentPath, playlistPath string) []string {
	hwAccel := strings.ToLower(preset.HWAccel)
	codec := strings.ToLower(preset.Codec)

	var args []string

	// Hardware acceleration input flags
	switch hwAccel {
	case "nvenc":
		args = append(args, "-hwaccel", "cuda", "-hwaccel_output_format", "cuda")
	case "quicksync", "qsv":
		args = append(args, "-hwaccel", "qsv", "-hwaccel_output_format", "qsv")
	case "vaapi":
		args = append(args, "-hwaccel", "vaapi", "-hwaccel_output_format", "vaapi",
			"-hwaccel_device", "/dev/dri/renderD128")
	}

	args = append(args, "-y", "-i", input, "-c:v")

	// Choose encoder based on codec + hw_accel
	encoder := resolveEncoder(codec, hwAccel)
	args = append(args, encoder)

	// Preset speed — NVENC uses p1-p7, software uses ultrafast..veryslow
	presetSpeed := preset.PresetSpeed
	if hwAccel == "nvenc" {
		presetSpeed = mapNvencPresetSpeed(presetSpeed)
	}
	args = append(args, "-preset", presetSpeed)

	// Quality control — NVENC uses -cq instead of -crf, QSV uses -global_quality
	switch hwAccel {
	case "nvenc":
		args = append(args, "-cq", fmt.Sprintf("%d", preset.CRF), "-rc", "vbr")
	case "quicksync", "qsv":
		args = append(args, "-global_quality", fmt.Sprintf("%d", preset.CRF))
	default:
		args = append(args, "-crf", fmt.Sprintf("%d", preset.CRF))
	}

	// Scale filter — hardware accelerated encoders need their own scale filter.
	// Use -2 for width to auto-compute from source aspect ratio with even dimensions.
	// Height is taken from the preset (1080, 720, etc.).
	h := res.Height
	if h%2 != 0 {
		h--
	}
	switch hwAccel {
	case "nvenc":
		args = append(args, "-vf", fmt.Sprintf("scale_cuda=-2:%d", h))
	case "vaapi":
		args = append(args, "-vf", fmt.Sprintf("scale_vaapi=w=-2:h=%d", h))
	case "quicksync", "qsv":
		args = append(args, "-vf", fmt.Sprintf("scale_qsv=w=-2:h=%d", h))
	default:
		args = append(args, "-vf", fmt.Sprintf("scale=-2:%d", h))
	}

	args = append(args,
		"-b:v", preset.VideoBitrate,
		"-maxrate", preset.VideoBitrate,
		"-bufsize", preset.VideoBitrate,
	)

	// Pixel format — skip for hardware surfaces
	if hwAccel == "" || hwAccel == "none" {
		args = append(args, "-pix_fmt", preset.PixelFormat)
	}

	args = append(args,
		"-c:a", preset.AudioCodec,
		"-b:a", preset.AudioBitrate,
		"-ac", fmt.Sprintf("%d", preset.AudioChannels),
	)

	if preset.Framerate != nil && *preset.Framerate > 0 {
		args = append(args, "-r", fmt.Sprintf("%d", *preset.Framerate))
	}

	if preset.ExtraFlags != nil && *preset.ExtraFlags != "" {
		args = append(args, strings.Fields(*preset.ExtraFlags)...)
	}

	// Movflags (e.g. +faststart for MP4)
	if preset.Movflags != "" {
		args = append(args, "-movflags", preset.Movflags)
	} else if preset.Faststart {
		args = append(args, "-movflags", "+faststart")
	}

	// HLS segment duration from preset (default 6 if not set)
	hlsTime := 6
	if preset.HLSSegmentDuration > 0 {
		hlsTime = preset.HLSSegmentDuration
	}

	// HLS output
	args = append(args,
		"-f", "hls",
		"-hls_time", fmt.Sprintf("%d", hlsTime),
		"-hls_playlist_type", "vod",
		"-hls_segment_filename", segmentPath,
	)

	// HLS Encryption
	encryption := strings.ToLower(preset.Encryption)
	if encryption == "aes-128" || encryption == "sample-aes" {
		// Generate key file path alongside the output
		keyInfoPath := filepath.Join(filepath.Dir(playlistPath), "enc.keyinfo")
		keyPath := filepath.Join(filepath.Dir(playlistPath), "enc.key")

		// Generate random 16-byte key
		keyData := make([]byte, 16)
		if _, err := io.ReadFull(cryptoRand.Reader, keyData); err == nil {
			// Write key file
			os.WriteFile(keyPath, keyData, 0600)

			// Build keyinfo file: key URI, key path, IV (random)
			keyURI := "enc.key" // relative URI — served alongside segments
			ivBytes := make([]byte, 16)
			_, _ = io.ReadFull(cryptoRand.Reader, ivBytes)
			iv := fmt.Sprintf("%032x", ivBytes)
			keyInfo := fmt.Sprintf("%s\n%s\n%s\n", keyURI, keyPath, iv)
			os.WriteFile(keyInfoPath, []byte(keyInfo), 0600)

			args = append(args, "-hls_key_info_file", keyInfoPath)

			// Key rotation: rotate the encryption key every N segments.
			// FFmpeg's -hls_enc_key_url is not needed — we use a single key file URI.
			// The key_rotation_interval maps to -hls_flags periodic_rekey by writing
			// multiple key-info files. However, FFmpeg's native approach is
			// -hls_flags periodic_rekey which re-reads the keyinfo file every segment.
			// So enable periodic_rekey and FFmpeg will generate a new key per segment.
			if preset.KeyRotationInterval > 0 {
				args = append(args, "-hls_flags", "periodic_rekey")
			}

			if encryption == "sample-aes" {
				args = append(args, "-hls_enc", "1")
			}
		}
	}

	args = append(args, playlistPath)

	return args
}

// resolveEncoder maps codec + hw_accel to the correct FFmpeg encoder name.
func resolveEncoder(codec, hwAccel string) string {
	switch hwAccel {
	case "nvenc":
		switch codec {
		case "h265", "hevc":
			return "hevc_nvenc"
		case "av1":
			return "av1_nvenc"
		default:
			return "h264_nvenc"
		}
	case "quicksync", "qsv":
		switch codec {
		case "h265", "hevc":
			return "hevc_qsv"
		case "av1":
			return "av1_qsv"
		case "vp9":
			return "vp9_qsv"
		default:
			return "h264_qsv"
		}
	case "vaapi":
		switch codec {
		case "h265", "hevc":
			return "hevc_vaapi"
		case "vp9":
			return "vp9_vaapi"
		case "av1":
			return "av1_vaapi"
		default:
			return "h264_vaapi"
		}
	default:
		// Software encoders
		switch codec {
		case "h265", "hevc":
			return "libx265"
		case "vp9":
			return "libvpx-vp9"
		case "av1":
			return "libaom-av1"
		default:
			return "libx264"
		}
	}
}

// mapNvencPresetSpeed converts x264/x265 preset names to NVENC equivalents.
func mapNvencPresetSpeed(speed string) string {
	switch strings.ToLower(speed) {
	case "ultrafast", "superfast":
		return "p1"
	case "veryfast":
		return "p2"
	case "faster":
		return "p3"
	case "fast":
		return "p4"
	case "medium":
		return "p5"
	case "slow":
		return "p6"
	case "slower", "veryslow", "placebo":
		return "p7"
	default:
		return speed // already p1-p7 or custom
	}
}

// GenerateMetaJSON creates a meta.json file in the video output directory.
func (f *FFmpeg) GenerateMetaJSON(ctx context.Context, video *model.Video, preset *model.Preset, resolutions []model.ResolutionEntry) error {
	baseDir := VideoOutputDir(video)

	meta := map[string]any{
		"id":                video.ID.String(),
		"title":             video.Title,
		"original_filename": video.OriginalFilename,
		"duration":          video.Duration,
		"resolutions":       resolutions,
		"codec":             preset.Codec,
		"hw_accel":          preset.HWAccel,
		"container":         preset.Container,
	}

	data, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return fmt.Errorf("marshalling meta.json: %w", err)
	}

	metaPath := baseDir + "/meta.json"
	return f.Storage.Put(metaPath, strings.NewReader(string(data)))
}

func dirSize(path string) int64 {
	var size int64
	filepath.Walk(path, func(_ string, info os.FileInfo, _ error) error {
		if info != nil && !info.IsDir() {
			size += info.Size()
		}
		return nil
	})
	return size
}

// GenerateThumbnail extracts a single frame from the video at the given seek time (seconds).
// Returns the storage path of the thumbnail.
func (f *FFmpeg) GenerateThumbnail(ctx context.Context, video *model.Video, seekSeconds float64) (string, error) {
	inputPath, cleanup, err := f.resolveInput(video)
	if err != nil {
		return "", err
	}
	if cleanup != nil {
		defer cleanup()
	}

	storagePath := fmt.Sprintf("%s/thumbnail/thumb.jpg", VideoOutputDir(video))
	localOutput := filepath.Join(f.TempDir, fmt.Sprintf("thumb-%s.jpg", video.ID))
	defer os.Remove(localOutput)

	args := []string{
		"-y",
		"-ss", fmt.Sprintf("%.2f", seekSeconds),
		"-i", inputPath,
		"-frames:v", "1",
		"-q:v", "2",
		"-vf", "scale=640:-1",
		localOutput,
	}

	cmd := exec.CommandContext(ctx, f.BinPath, args...)
	if out, err := cmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("ffmpeg thumbnail failed: %w: %s", err, string(out))
	}

	file, err := os.Open(localOutput)
	if err != nil {
		return "", err
	}
	defer file.Close()

	if err := f.Storage.Put(storagePath, file); err != nil {
		return "", fmt.Errorf("storing thumbnail: %w", err)
	}
	return storagePath, nil
}

// GenerateThumbnailCandidates extracts multiple thumbnail frames spread across the video.
// Returns the list of storage paths for each candidate.
func (f *FFmpeg) GenerateThumbnailCandidates(ctx context.Context, video *model.Video, count int) ([]string, error) {
	if count < 1 {
		count = 6
	}

	duration := 30.0 // fallback
	if video.Duration != nil && *video.Duration > 0 {
		duration = *video.Duration
	}

	inputPath, cleanup, err := f.resolveInput(video)
	if err != nil {
		return nil, err
	}
	if cleanup != nil {
		defer cleanup()
	}

	baseDir := VideoOutputDir(video)
	var paths []string

	for i := 0; i < count; i++ {
		// Spread timestamps evenly, skipping the very start and end
		seek := (duration / float64(count+1)) * float64(i+1)
		name := fmt.Sprintf("thumb_%d.jpg", i)
		storagePath := fmt.Sprintf("%s/thumbnail/%s", baseDir, name)
		localOutput := filepath.Join(f.TempDir, fmt.Sprintf("thumb-%s-%d.jpg", video.ID, i))

		args := []string{
			"-y",
			"-ss", fmt.Sprintf("%.2f", seek),
			"-i", inputPath,
			"-frames:v", "1",
			"-q:v", "2",
			"-vf", "scale=320:-1",
			localOutput,
		}

		cmd := exec.CommandContext(ctx, f.BinPath, args...)
		if out, err := cmd.CombinedOutput(); err != nil {
			os.Remove(localOutput)
			// Skip failed frames, don't abort the whole batch
			continue
		} else {
			_ = out
		}

		file, err := os.Open(localOutput)
		if err != nil {
			os.Remove(localOutput)
			continue
		}

		if err := f.Storage.Put(storagePath, file); err != nil {
			file.Close()
			os.Remove(localOutput)
			continue
		}
		file.Close()
		os.Remove(localOutput)
		paths = append(paths, storagePath)
	}
	return paths, nil
}

// GeneratePreview creates a short animated GIF preview from the video.
// Returns the storage path of the preview.
func (f *FFmpeg) GeneratePreview(ctx context.Context, video *model.Video, seekSeconds float64) (string, error) {
	inputPath, cleanup, err := f.resolveInput(video)
	if err != nil {
		return "", err
	}
	if cleanup != nil {
		defer cleanup()
	}

	storagePath := fmt.Sprintf("%s/thumbnail/preview.gif", VideoOutputDir(video))
	localOutput := filepath.Join(f.TempDir, fmt.Sprintf("preview-%s.gif", video.ID))
	defer os.Remove(localOutput)

	args := []string{
		"-y",
		"-ss", fmt.Sprintf("%.2f", seekSeconds),
		"-t", "4",
		"-i", inputPath,
		"-vf", "fps=10,scale=320:-1:flags=lanczos",
		"-loop", "0",
		localOutput,
	}

	cmd := exec.CommandContext(ctx, f.BinPath, args...)
	if out, err := cmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("ffmpeg preview failed: %w: %s", err, string(out))
	}

	file, err := os.Open(localOutput)
	if err != nil {
		return "", err
	}
	defer file.Close()

	if err := f.Storage.Put(storagePath, file); err != nil {
		return "", fmt.Errorf("storing preview: %w", err)
	}
	return storagePath, nil
}

// GenerateBanner extracts a high-resolution banner frame from the video.
// Returns the storage path of the banner.
func (f *FFmpeg) GenerateBanner(ctx context.Context, video *model.Video, seekSeconds float64) (string, error) {
	inputPath, cleanup, err := f.resolveInput(video)
	if err != nil {
		return "", err
	}
	if cleanup != nil {
		defer cleanup()
	}

	storagePath := fmt.Sprintf("%s/banner.jpg", VideoOutputDir(video))
	localOutput := filepath.Join(f.TempDir, fmt.Sprintf("banner-%s.jpg", video.ID))
	defer os.Remove(localOutput)

	args := []string{
		"-y",
		"-ss", fmt.Sprintf("%.2f", seekSeconds),
		"-i", inputPath,
		"-frames:v", "1",
		"-q:v", "2",
		"-vf", "scale=1920:-1",
		localOutput,
	}

	cmd := exec.CommandContext(ctx, f.BinPath, args...)
	if out, err := cmd.CombinedOutput(); err != nil {
		return "", fmt.Errorf("ffmpeg banner failed: %w: %s", err, string(out))
	}

	file, err := os.Open(localOutput)
	if err != nil {
		return "", err
	}
	defer file.Close()

	if err := f.Storage.Put(storagePath, file); err != nil {
		return "", fmt.Errorf("storing banner: %w", err)
	}
	return storagePath, nil
}

// resolveInput returns a local file path for FFmpeg to read from.
// For local storage it's the direct path; for remote storage it downloads to a temp file.
// Returns (path, cleanup func, error). The caller MUST call cleanup if non-nil.
func (f *FFmpeg) resolveInput(video *model.Video) (string, func(), error) {
	if resolver, ok := f.Storage.(storage.LocalPathResolver); ok {
		return resolver.FullPath(video.SourcePath), nil, nil
	}

	rc, err := f.Storage.Get(video.SourcePath)
	if err != nil {
		return "", nil, fmt.Errorf("downloading source: %w", err)
	}
	defer rc.Close()

	tmpFile, err := os.CreateTemp(f.TempDir, "gompp-src-*"+filepath.Ext(video.SourcePath))
	if err != nil {
		return "", nil, fmt.Errorf("creating temp file: %w", err)
	}
	if _, err := io.Copy(tmpFile, rc); err != nil {
		tmpFile.Close()
		os.Remove(tmpFile.Name())
		return "", nil, fmt.Errorf("writing temp file: %w", err)
	}
	tmpFile.Close()

	cleanup := func() { os.Remove(tmpFile.Name()) }
	return tmpFile.Name(), cleanup, nil
}
