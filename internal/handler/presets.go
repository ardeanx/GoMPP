package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"github.com/gompp/gompp/internal/model"
	"github.com/gompp/gompp/internal/repository"
)

type PresetHandler struct {
	repo *repository.PresetRepository
}

func NewPresetHandler(repo *repository.PresetRepository) *PresetHandler {
	return &PresetHandler{repo: repo}
}

func (h *PresetHandler) List(w http.ResponseWriter, r *http.Request) {
	presets, err := h.repo.List(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to list presets")
		return
	}
	if presets == nil {
		presets = []model.Preset{}
	}
	writeJSONList(w, presets, 1, len(presets), len(presets))
}

func (h *PresetHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid preset ID")
		return
	}
	preset, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to get preset")
		return
	}
	if preset == nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "preset not found")
		return
	}
	writeJSON(w, http.StatusOK, preset)
}

func (h *PresetHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req model.CreatePresetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
		return
	}
	if req.Name == "" || req.Codec == "" {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "name and codec are required")
		return
	}
	if len(req.Resolutions) == 0 {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "at least one resolution is required")
		return
	}

	// Derive legacy scalar fields from the first (primary) resolution
	primary := req.Resolutions[0]

	preset := &model.Preset{
		Name:                req.Name,
		Codec:               req.Codec,
		Container:           req.Container,
		Resolution:          primary.Label,
		Width:               primary.Width,
		Height:              primary.Height,
		Resolutions:         req.Resolutions,
		VideoBitrate:        req.VideoBitrate,
		AudioCodec:          req.AudioCodec,
		AudioBitrate:        req.AudioBitrate,
		AudioChannels:       req.AudioChannels,
		Framerate:           req.Framerate,
		PixelFormat:         req.PixelFormat,
		PresetSpeed:         req.PresetSpeed,
		CRF:                 req.CRF,
		HWAccel:             req.HWAccel,
		ExtraFlags:          req.ExtraFlags,
		OutputFormat:        req.OutputFormat,
		HLSSegmentDuration:  req.HLSSegmentDuration,
		Encryption:          req.Encryption,
		KeyRotationInterval: req.KeyRotationInterval,
		SignedURLEnabled:    req.SignedURLEnabled,
		SignedURLExpiry:     req.SignedURLExpiry,
		ThumbnailEnabled:    req.ThumbnailEnabled,
		ThumbnailInterval:   req.ThumbnailInterval,
		BannerEnabled:       req.BannerEnabled,
		BannerTimestamp:     req.BannerTimestamp,
		Faststart:           req.Faststart,
		Movflags:            req.Movflags,
		TwoPass:             req.TwoPass,
		IsDefault:           req.IsDefault,
		SortOrder:           req.SortOrder,
	}

	if err := h.repo.Create(r.Context(), preset); err != nil {
		log.Error().Err(err).Str("preset", req.Name).Msg("failed to create preset")
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to create preset")
		return
	}
	writeJSON(w, http.StatusCreated, preset)
}

func (h *PresetHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid preset ID")
		return
	}

	preset, err := h.repo.GetByID(r.Context(), id)
	if err != nil || preset == nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "preset not found")
		return
	}

	var req model.UpdatePresetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
		return
	}

	if req.Name != nil {
		preset.Name = *req.Name
	}
	if req.Codec != nil {
		preset.Codec = *req.Codec
	}
	if req.Container != nil {
		preset.Container = *req.Container
	}
	if req.Resolutions != nil {
		preset.Resolutions = *req.Resolutions
		if len(*req.Resolutions) > 0 {
			primary := (*req.Resolutions)[0]
			preset.Resolution = primary.Label
			preset.Width = primary.Width
			preset.Height = primary.Height
		}
	}
	if req.VideoBitrate != nil {
		preset.VideoBitrate = *req.VideoBitrate
	}
	if req.AudioCodec != nil {
		preset.AudioCodec = *req.AudioCodec
	}
	if req.AudioBitrate != nil {
		preset.AudioBitrate = *req.AudioBitrate
	}
	if req.AudioChannels != nil {
		preset.AudioChannels = *req.AudioChannels
	}
	if req.Framerate != nil {
		preset.Framerate = req.Framerate
	}
	if req.PixelFormat != nil {
		preset.PixelFormat = *req.PixelFormat
	}
	if req.PresetSpeed != nil {
		preset.PresetSpeed = *req.PresetSpeed
	}
	if req.CRF != nil {
		preset.CRF = *req.CRF
	}
	if req.HWAccel != nil {
		preset.HWAccel = *req.HWAccel
	}
	if req.ExtraFlags != nil {
		preset.ExtraFlags = req.ExtraFlags
	}
	if req.OutputFormat != nil {
		preset.OutputFormat = *req.OutputFormat
	}
	if req.HLSSegmentDuration != nil {
		preset.HLSSegmentDuration = *req.HLSSegmentDuration
	}
	if req.Encryption != nil {
		preset.Encryption = *req.Encryption
	}
	if req.KeyRotationInterval != nil {
		preset.KeyRotationInterval = *req.KeyRotationInterval
	}
	if req.SignedURLEnabled != nil {
		preset.SignedURLEnabled = *req.SignedURLEnabled
	}
	if req.SignedURLExpiry != nil {
		preset.SignedURLExpiry = *req.SignedURLExpiry
	}
	if req.ThumbnailEnabled != nil {
		preset.ThumbnailEnabled = *req.ThumbnailEnabled
	}
	if req.ThumbnailInterval != nil {
		preset.ThumbnailInterval = *req.ThumbnailInterval
	}
	if req.BannerEnabled != nil {
		preset.BannerEnabled = *req.BannerEnabled
	}
	if req.BannerTimestamp != nil {
		preset.BannerTimestamp = *req.BannerTimestamp
	}
	if req.Faststart != nil {
		preset.Faststart = *req.Faststart
	}
	if req.Movflags != nil {
		preset.Movflags = *req.Movflags
	}
	if req.TwoPass != nil {
		preset.TwoPass = *req.TwoPass
	}
	if req.IsDefault != nil {
		preset.IsDefault = *req.IsDefault
	}
	if req.IsActive != nil {
		preset.IsActive = *req.IsActive
	}
	if req.SortOrder != nil {
		preset.SortOrder = *req.SortOrder
	}

	if err := h.repo.Update(r.Context(), preset); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to update preset")
		return
	}
	writeJSON(w, http.StatusOK, preset)
}

func (h *PresetHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid preset ID")
		return
	}
	if err := h.repo.Delete(r.Context(), id); err != nil {
		writeError(w, http.StatusConflict, "CONFLICT", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
