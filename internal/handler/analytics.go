package handler

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AnalyticsHandler struct {
	db *pgxpool.Pool
}

func NewAnalyticsHandler(db *pgxpool.Pool) *AnalyticsHandler {
	return &AnalyticsHandler{db: db}
}

func (h *AnalyticsHandler) Overview(w http.ResponseWriter, r *http.Request) {
	period := r.URL.Query().Get("period")
	if period == "" {
		period = "30d"
	}
	days := periodToDays(period)

	var totalVideos, totalViews, activeJobs int
	var totalBandwidth, storageUsed int64

	ctx := r.Context()
	_ = h.db.QueryRow(ctx, `SELECT COUNT(*) FROM videos WHERE deleted_at IS NULL`).Scan(&totalVideos)
	_ = h.db.QueryRow(ctx, `SELECT COALESCE(COUNT(*),0) FROM video_analytics WHERE event_type='view' AND created_at > NOW() - make_interval(days := $1)`, days).Scan(&totalViews)
	_ = h.db.QueryRow(ctx, `SELECT COALESCE(SUM(bytes_transferred),0) FROM video_analytics WHERE created_at > NOW() - make_interval(days := $1)`, days).Scan(&totalBandwidth)
	_ = h.db.QueryRow(ctx, `SELECT COALESCE(SUM(file_size),0) FROM videos WHERE deleted_at IS NULL`).Scan(&storageUsed)
	_ = h.db.QueryRow(ctx, `SELECT COUNT(*) FROM transcode_jobs WHERE status IN ('pending','processing')`).Scan(&activeJobs)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"total_videos":          totalVideos,
		"total_views":           totalViews,
		"total_bandwidth_bytes": totalBandwidth,
		"storage_used_bytes":    storageUsed,
		"active_jobs":           activeJobs,
		"period":                period,
	})
}

func (h *AnalyticsHandler) VideoAnalytics(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid video ID")
		return
	}

	ctx := r.Context()
	var totalViews int
	var totalBandwidth int64
	var avgDuration float64
	var completionRate float64

	_ = h.db.QueryRow(ctx, `SELECT COALESCE(COUNT(*),0) FROM video_analytics WHERE video_id=$1 AND event_type='view'`, id).Scan(&totalViews)
	_ = h.db.QueryRow(ctx, `SELECT COALESCE(SUM(bytes_transferred),0) FROM video_analytics WHERE video_id=$1`, id).Scan(&totalBandwidth)
	_ = h.db.QueryRow(ctx, `SELECT COALESCE(AVG(duration_watched),0) FROM video_analytics WHERE video_id=$1 AND duration_watched IS NOT NULL`, id).Scan(&avgDuration)

	var totalPlays, totalCompletes int
	_ = h.db.QueryRow(ctx, `SELECT COALESCE(COUNT(*),0) FROM video_analytics WHERE video_id=$1 AND event_type='play'`, id).Scan(&totalPlays)
	_ = h.db.QueryRow(ctx, `SELECT COALESCE(COUNT(*),0) FROM video_analytics WHERE video_id=$1 AND event_type='complete'`, id).Scan(&totalCompletes)
	if totalPlays > 0 {
		completionRate = float64(totalCompletes) / float64(totalPlays)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"video_id":              id.String(),
		"total_views":           totalViews,
		"total_bandwidth_bytes": totalBandwidth,
		"avg_watch_duration":    avgDuration,
		"completion_rate":       completionRate,
	})
}

func (h *AnalyticsHandler) TopVideos(w http.ResponseWriter, r *http.Request) {
	period := r.URL.Query().Get("period")
	if period == "" {
		period = "7d"
	}
	days := periodToDays(period)

	limit := parseIntQuery(r, "limit", 10)
	if limit > 100 {
		limit = 100
	}

	rows, err := h.db.Query(r.Context(),
		`SELECT va.video_id, v.title, COUNT(*) AS view_count, COALESCE(SUM(va.bytes_transferred),0) AS bandwidth_bytes
		 FROM video_analytics va
		 JOIN videos v ON v.id = va.video_id
		 WHERE va.event_type = 'view' AND va.created_at > NOW() - make_interval(days := $1)
		 GROUP BY va.video_id, v.title
		 ORDER BY view_count DESC
		 LIMIT $2`, days, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to query top videos")
		return
	}
	defer rows.Close()

	type topVideo struct {
		VideoID        string `json:"video_id"`
		Title          string `json:"title"`
		ViewCount      int    `json:"view_count"`
		BandwidthBytes int64  `json:"bandwidth_bytes"`
	}
	results := []topVideo{}
	for rows.Next() {
		var tv topVideo
		if err := rows.Scan(&tv.VideoID, &tv.Title, &tv.ViewCount, &tv.BandwidthBytes); err != nil {
			continue
		}
		results = append(results, tv)
	}
	writeJSON(w, http.StatusOK, results)
}

func (h *AnalyticsHandler) Bandwidth(w http.ResponseWriter, r *http.Request) {
	period := r.URL.Query().Get("period")
	if period == "" {
		period = "30d"
	}
	days := periodToDays(period)

	granularity := r.URL.Query().Get("granularity")
	if granularity == "" {
		granularity = "day"
	}

	var trunc string
	switch granularity {
	case "hour":
		trunc = "hour"
	case "week":
		trunc = "week"
	case "month":
		trunc = "month"
	default:
		trunc = "day"
	}

	rows, err := h.db.Query(r.Context(),
		`SELECT date_trunc($1, created_at)::date AS d, COALESCE(SUM(bytes_transferred),0)
		 FROM video_analytics
		 WHERE created_at > NOW() - make_interval(days := $2)
		 GROUP BY d ORDER BY d`, trunc, days)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to query bandwidth")
		return
	}
	defer rows.Close()

	type bwEntry struct {
		Date  string `json:"date"`
		Bytes int64  `json:"bytes"`
	}
	results := []bwEntry{}
	for rows.Next() {
		var entry bwEntry
		if err := rows.Scan(&entry.Date, &entry.Bytes); err != nil {
			continue
		}
		results = append(results, entry)
	}
	writeJSON(w, http.StatusOK, results)
}

func periodToDays(period string) int {
	if len(period) < 2 {
		return 30
	}
	n, err := strconv.Atoi(period[:len(period)-1])
	if err != nil {
		return 30
	}
	return n
}

// DeviceTypes returns a breakdown of views by device type
func (h *AnalyticsHandler) DeviceTypes(w http.ResponseWriter, r *http.Request) {
	period := r.URL.Query().Get("period")
	if period == "" {
		period = "30d"
	}
	days := periodToDays(period)

	rows, err := h.db.Query(r.Context(),
		`SELECT COALESCE(device_type, 'Unknown') AS dt, COUNT(*) AS cnt
		 FROM video_analytics
		 WHERE event_type = 'view' AND created_at > NOW() - make_interval(days := $1)
		 GROUP BY dt
		 ORDER BY cnt DESC`, days)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to query device types")
		return
	}
	defer rows.Close()

	type deviceEntry struct {
		DeviceType string `json:"device_type"`
		Count      int    `json:"count"`
	}
	results := []deviceEntry{}
	for rows.Next() {
		var entry deviceEntry
		if err := rows.Scan(&entry.DeviceType, &entry.Count); err != nil {
			continue
		}
		results = append(results, entry)
	}
	writeJSON(w, http.StatusOK, results)
}

// TrafficSeries returns time-series view count data for the traffic chart.
func (h *AnalyticsHandler) TrafficSeries(w http.ResponseWriter, r *http.Request) {
	period := r.URL.Query().Get("period")
	if period == "" {
		period = "30d"
	}
	days := periodToDays(period)

	granularity := r.URL.Query().Get("granularity")
	if granularity == "" {
		granularity = "day"
	}

	var trunc string
	switch granularity {
	case "hour":
		trunc = "hour"
	case "week":
		trunc = "week"
	case "month":
		trunc = "month"
	default:
		trunc = "day"
	}

	rows, err := h.db.Query(r.Context(),
		`SELECT date_trunc($1, created_at)::date AS d, COUNT(*) AS views,
		        COALESCE(SUM(bytes_transferred),0) AS bandwidth
		 FROM video_analytics
		 WHERE event_type = 'view' AND created_at > NOW() - make_interval(days := $2)
		 GROUP BY d ORDER BY d`, trunc, days)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to query traffic")
		return
	}
	defer rows.Close()

	type trafficEntry struct {
		Date      string `json:"date"`
		Views     int    `json:"views"`
		Bandwidth int64  `json:"bandwidth"`
	}
	results := []trafficEntry{}
	for rows.Next() {
		var entry trafficEntry
		if err := rows.Scan(&entry.Date, &entry.Views, &entry.Bandwidth); err != nil {
			continue
		}
		results = append(results, entry)
	}
	writeJSON(w, http.StatusOK, results)
}
