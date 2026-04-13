package storage

import "io"

// Backend is the interface all storage implementations must satisfy.
type Backend interface {
	Put(path string, reader io.Reader) error
	Get(path string) (io.ReadCloser, error)
	Delete(path string) error
	Exists(path string) (bool, error)
	Size(path string) (int64, error)
	DirSize(path string) (int64, error)
	URL(path string) string
	List(prefix string) ([]string, error)
}

// LocalPathResolver is an optional interface for backends that can resolve
// a storage path to a local filesystem path (needed by FFmpeg).
type LocalPathResolver interface {
	FullPath(path string) string
}
