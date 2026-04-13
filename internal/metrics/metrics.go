package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// HTTP metrics
var (
	HTTPRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "gompp_http_requests_total",
		Help: "Total number of HTTP requests.",
	}, []string{"method", "path", "status"})

	HTTPRequestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "gompp_http_request_duration_seconds",
		Help:    "HTTP request latency in seconds.",
		Buckets: []float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10},
	}, []string{"method", "path"})

	HTTPRequestsInFlight = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "gompp_http_requests_in_flight",
		Help: "Number of HTTP requests currently being processed.",
	})
)

// Transcoding metrics
var (
	TranscodeJobsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "gompp_transcode_jobs_total",
		Help: "Total number of transcode jobs by status.",
	}, []string{"status"})

	TranscodeJobDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "gompp_transcode_job_duration_seconds",
		Help:    "Transcode job duration in seconds.",
		Buckets: []float64{1, 5, 10, 30, 60, 120, 300, 600, 1800, 3600},
	}, []string{"codec", "resolution"})

	TranscodeQueueDepth = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "gompp_transcode_queue_depth",
		Help: "Number of pending transcode jobs in the queue.",
	})

	TranscodeWorkersActive = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "gompp_transcode_workers_active",
		Help: "Number of workers currently processing a job.",
	})
)

// Video metrics
var (
	VideosTotal = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "gompp_videos_total",
		Help: "Total number of videos in the system.",
	})

	VideoUploadsTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "gompp_video_uploads_total",
		Help: "Total number of video uploads.",
	})

	VideoUploadBytes = promauto.NewCounter(prometheus.CounterOpts{
		Name: "gompp_video_upload_bytes_total",
		Help: "Total bytes uploaded.",
	})
)

// Storage metrics
var (
	StorageOperationsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "gompp_storage_operations_total",
		Help: "Total number of storage operations.",
	}, []string{"operation", "backend"})

	StorageOperationDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "gompp_storage_operation_duration_seconds",
		Help:    "Storage operation latency in seconds.",
		Buckets: []float64{.001, .005, .01, .05, .1, .5, 1, 5},
	}, []string{"operation", "backend"})

	StorageOperationErrors = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "gompp_storage_operation_errors_total",
		Help: "Total number of failed storage operations.",
	}, []string{"operation", "backend"})
)

// Webhook metrics
var (
	WebhookDeliveriesTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "gompp_webhook_deliveries_total",
		Help: "Total webhook deliveries by event and success status.",
	}, []string{"event", "success"})

	WebhookDeliveryDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "gompp_webhook_delivery_duration_seconds",
		Help:    "Webhook delivery latency in seconds.",
		Buckets: []float64{.01, .05, .1, .25, .5, 1, 2.5, 5, 10},
	}, []string{"event"})
)

// Database metrics
var (
	DBQueryDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "gompp_db_query_duration_seconds",
		Help:    "Database query latency in seconds.",
		Buckets: []float64{.001, .005, .01, .025, .05, .1, .25, .5, 1},
	}, []string{"query"})

	DBConnectionsActive = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "gompp_db_connections_active",
		Help: "Number of active database connections.",
	})

	DBConnectionsIdle = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "gompp_db_connections_idle",
		Help: "Number of idle database connections.",
	})
)

// Auth metrics
var (
	AuthAttemptsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "gompp_auth_attempts_total",
		Help: "Total authentication attempts.",
	}, []string{"method", "result"})
)
