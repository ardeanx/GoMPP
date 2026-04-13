package handler

import (
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"mime"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gompp/gompp/internal/model"
	"github.com/gompp/gompp/internal/repository"
	"github.com/gompp/gompp/internal/service"
	"github.com/gompp/gompp/internal/storage"
)

type EmbedHandler struct {
	videoRepo    *repository.VideoRepository
	subtitleRepo *repository.SubtitleRepository
	storage      storage.Backend
	db           *pgxpool.Pool
	signer       *service.MediaSigner
}

func NewEmbedHandler(videoRepo *repository.VideoRepository, subtitleRepo *repository.SubtitleRepository, store storage.Backend, db *pgxpool.Pool, signer *service.MediaSigner) *EmbedHandler {
	return &EmbedHandler{videoRepo: videoRepo, subtitleRepo: subtitleRepo, storage: store, db: db, signer: signer}
}

// playerSettings holds the resolved player configuration for the embed template.
type playerSettings struct {
	PlayerType     string
	ThemeColor     string
	Autoplay       bool
	Resumable      bool
	DefaultQuality string
	Preload        string
	// Controls
	ShowPlayPause  bool
	ShowVolume     bool
	ShowFullscreen bool
	ShowProgress   bool
	ShowSubtitles  bool
	ShowSettings   bool
	ShowPIP        bool
	ShowBigPlay    bool
	ShowForward    bool
	ShowBackward   bool
}

func (h *EmbedHandler) getPlayerSettings(r *http.Request) playerSettings {
	ps := playerSettings{
		PlayerType:     "shaka",
		ThemeColor:     "#0011ff",
		Autoplay:       true,
		DefaultQuality: "auto",
		Preload:        "auto",
		ShowPlayPause:  true,
		ShowVolume:     true,
		ShowFullscreen: true,
		ShowProgress:   true,
		ShowSubtitles:  true,
		ShowSettings:   true,
		ShowPIP:        true,
		ShowBigPlay:    true,
		ShowForward:    true,
		ShowBackward:   true,
	}

	if h.db == nil {
		return ps
	}

	// Fetch relevant settings in one query
	rows, err := h.db.Query(r.Context(),
		`SELECT key, value FROM system_settings WHERE key = ANY($1)`,
		[]string{
			"player_type", "player_theme_color", "player_autoplay",
			"player_resumable", "player_default_quality", "player_preload",
			"ctrl_play_pause", "ctrl_volume", "ctrl_fullscreen", "ctrl_progress_bar",
			"ctrl_subtitles", "ctrl_settings", "ctrl_pip", "ctrl_big_play",
			"ctrl_forward", "ctrl_backward",
		})
	if err != nil {
		return ps
	}
	defer rows.Close()

	settings := map[string]string{}
	for rows.Next() {
		var key string
		var rawVal []byte
		if err := rows.Scan(&key, &rawVal); err != nil {
			continue
		}
		var val interface{}
		if json.Unmarshal(rawVal, &val) == nil {
			settings[key] = fmt.Sprintf("%v", val)
		}
	}

	if v, ok := settings["player_type"]; ok && v != "" {
		ps.PlayerType = v
	}
	if v, ok := settings["player_theme_color"]; ok && v != "" {
		ps.ThemeColor = v
	}
	if v, ok := settings["player_autoplay"]; ok {
		ps.Autoplay = v == "true"
	}
	if v, ok := settings["player_resumable"]; ok {
		ps.Resumable = v == "true"
	}
	if v, ok := settings["player_default_quality"]; ok && v != "" {
		ps.DefaultQuality = v
	}
	if v, ok := settings["player_preload"]; ok && v != "" {
		ps.Preload = v
	}
	if v, ok := settings["ctrl_play_pause"]; ok {
		ps.ShowPlayPause = v != "false"
	}
	if v, ok := settings["ctrl_volume"]; ok {
		ps.ShowVolume = v != "false"
	}
	if v, ok := settings["ctrl_fullscreen"]; ok {
		ps.ShowFullscreen = v != "false"
	}
	if v, ok := settings["ctrl_progress_bar"]; ok {
		ps.ShowProgress = v != "false"
	}
	if v, ok := settings["ctrl_subtitles"]; ok {
		ps.ShowSubtitles = v != "false"
	}
	if v, ok := settings["ctrl_settings"]; ok {
		ps.ShowSettings = v != "false"
	}
	if v, ok := settings["ctrl_pip"]; ok {
		ps.ShowPIP = v != "false"
	}
	if v, ok := settings["ctrl_big_play"]; ok {
		ps.ShowBigPlay = v != "false"
	}
	if v, ok := settings["ctrl_forward"]; ok {
		ps.ShowForward = v != "false"
	}
	if v, ok := settings["ctrl_backward"]; ok {
		ps.ShowBackward = v != "false"
	}

	return ps
}

// Player serves a self-contained embed player page driven by settings.
func (h *EmbedHandler) Player(w http.ResponseWriter, r *http.Request) {
	videoID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "invalid video id", http.StatusBadRequest)
		return
	}

	video, err := h.videoRepo.GetByID(r.Context(), videoID)
	if err != nil || video == nil {
		http.Error(w, "video not found", http.StatusNotFound)
		return
	}

	if !video.IsPublic && video.Status != model.VideoStatusReady {
		http.Error(w, "video not available", http.StatusForbidden)
		return
	}

	ps := h.getPlayerSettings(r)
	playlistURL := fmt.Sprintf("/embed/%s/stream/master.m3u8", video.ID)

	// Fetch subtitle tracks
	type subtitleTrack struct {
		ID       string
		Language string
		Label    string
		Format   string
		URL      string
		MimeType string
	}
	var subtitles []subtitleTrack
	if h.subtitleRepo != nil {
		subs, err := h.subtitleRepo.ListByVideoID(r.Context(), videoID)
		if err == nil {
			for _, s := range subs {
				mime := "text/vtt"
				switch s.Format {
				case "srt":
					mime = "text/srt"
				case "ass", "ssa":
					mime = "text/x-ssa"
				}
				subtitles = append(subtitles, subtitleTrack{
					ID:       s.ID.String(),
					Language: s.Language,
					Label:    s.Label,
					Format:   s.Format,
					URL:      fmt.Sprintf("/subtitles/serve/%s", s.ID),
					MimeType: mime,
				})
			}
		}
	}

	data := struct {
		Title       string
		PlaylistURL string
		Settings    playerSettings
		Subtitles   []subtitleTrack
	}{
		Title:       video.Title,
		PlaylistURL: playlistURL,
		Settings:    ps,
		Subtitles:   subtitles,
	}

	var tmpl *template.Template
	switch ps.PlayerType {
	case "vidstack":
		tmpl = template.Must(template.New("embed").Parse(vidstackPlayerHTML))
	default:
		tmpl = template.Must(template.New("embed").Parse(shakaPlayerHTML))
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("X-Frame-Options", "ALLOWALL")
	if err := tmpl.Execute(w, data); err != nil {
		http.Error(w, "render error", http.StatusInternalServerError)
	}
}

// Stream serves HLS playlist and segment files for the embed player.
func (h *EmbedHandler) Stream(w http.ResponseWriter, r *http.Request) {
	videoID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "invalid video id", http.StatusBadRequest)
		return
	}

	video, err := h.videoRepo.GetByID(r.Context(), videoID)
	if err != nil || video == nil {
		http.Error(w, "video not found", http.StatusNotFound)
		return
	}

	// Build the file path from the wildcard
	filePath := chi.URLParam(r, "*")
	if filePath == "" {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	// Prevent directory traversal
	if strings.Contains(filePath, "..") {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}

	storagePath := fmt.Sprintf("transcoded/%s/%s", videoID, filePath)

	rc, err := h.storage.Get(storagePath)
	if err != nil {
		http.Error(w, "file not found", http.StatusNotFound)
		return
	}
	defer rc.Close()

	// Set content type based on extension
	ext := filepath.Ext(filePath)
	contentType := mime.TypeByExtension(ext)
	switch ext {
	case ".m3u8":
		contentType = "application/vnd.apple.mpegurl"
	case ".ts":
		contentType = "video/mp2t"
	case ".key":
		contentType = "application/octet-stream"
	}
	if contentType != "" {
		w.Header().Set("Content-Type", contentType)
	}

	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Cache-Control", "public, max-age=31536000")

	io.Copy(w, rc)
}

// ── Shaka Player embed template ──

const shakaPlayerHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{.Title}} - GoMPP Player</title>
<script src="https://cdn.jsdelivr.net/npm/shaka-player@4/dist/shaka-player.compiled.min.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/shaka-player@4/dist/controls.min.css">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:#000;overflow:hidden}
#player-container{width:100%;height:100%}
video{width:100%;height:100%;object-fit:contain}
.shaka-controls-container .shaka-seek-bar-container input[type=range]::-webkit-slider-thumb{background:{{.Settings.ThemeColor}}}
.shaka-controls-container .shaka-play-button-container button{color:{{.Settings.ThemeColor}}}
</style>
</head>
<body>
<div id="player-container" data-shaka-player-container>
  <video id="player" data-shaka-player {{if .Settings.Autoplay}}autoplay{{end}} playsinline></video>
</div>
<script>
(function(){
  var manifestUri = '{{.PlaylistURL}}';
  var videoEl = document.getElementById('player');
  var container = document.getElementById('player-container');

  shaka.polyfill.installAll();
  if (!shaka.Player.isBrowserSupported()) {
    document.body.innerHTML = '<p style="color:#fff;text-align:center;padding:2em">Browser not supported.</p>';
    return;
  }

  var player = new shaka.Player();
  player.attach(videoEl).then(function(){
    var ui = new shaka.ui.Overlay(player, container, videoEl);
    var controls = ui.getControls();

    var uiConfig = {
      controlPanelElements: [
        {{if .Settings.ShowPlayPause}}'play_pause',{{end}}
        {{if .Settings.ShowBackward}}'rewind',{{end}}
        {{if .Settings.ShowForward}}'fast_forward',{{end}}
        {{if .Settings.ShowVolume}}'mute',{{end}}
        {{if .Settings.ShowVolume}}'volume',{{end}}
        'spacer',
        {{if .Settings.ShowSubtitles}}'captions',{{end}}
        {{if .Settings.ShowSettings}}'overflow_menu',{{end}}
        {{if .Settings.ShowPIP}}'picture_in_picture',{{end}}
        {{if .Settings.ShowFullscreen}}'fullscreen',{{end}}
      ],
      seekBarColors: {
        base: 'rgba(255,255,255,0.3)',
        buffered: 'rgba(255,255,255,0.54)',
        played: '{{.Settings.ThemeColor}}'
      },
      addBigPlayButton: {{.Settings.ShowBigPlay}},
      addSeekBar: {{.Settings.ShowProgress}},
    };
    ui.configure(uiConfig);

    player.configure({
      streaming: {
        bufferingGoal: 30,
        rebufferingGoal: 2
      }
    });

    player.load(manifestUri).then(function(){
      {{range .Subtitles}}
      player.addTextTrackAsync('{{.URL}}', '{{.Language}}', 'subtitle', '{{.MimeType}}', '', '{{.Label}}');
      {{end}}
    }).catch(function(e){
      console.error('Shaka load error:', e);
    });
  });
})();
</script>
</body>
</html>`

// ── Vidstack Player embed template ──

const vidstackPlayerHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{.Title}} - GoMPP Player</title>
<link rel="stylesheet" href="https://cdn.vidstack.io/player/theme.css">
<link rel="stylesheet" href="https://cdn.vidstack.io/player/video.css">
<script type="module" src="https://cdn.vidstack.io/player"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100%;height:100%;background:#000;overflow:hidden}
media-player{width:100%;height:100%}
media-player{--media-brand:{{.Settings.ThemeColor}}}
</style>
</head>
<body>
<media-player
  src="{{.PlaylistURL}}"
  {{if .Settings.Autoplay}}autoplay{{end}}
  playsinline
  title="{{.Title}}"
>
  <media-provider>
    {{range .Subtitles}}
    <track src="{{.URL}}" kind="subtitles" srclang="{{.Language}}" label="{{.Label}}" />
    {{end}}
  </media-provider>
  <media-video-layout></media-video-layout>
</media-player>
</body>
</html>`
