package service

import (
	"github.com/gompp/gompp/internal/storage"
)

// StorageService wraps the storage backend for use in handlers.
type StorageService struct {
	Backend storage.Backend
}

func NewStorageService(backend storage.Backend) *StorageService {
	return &StorageService{Backend: backend}
}
