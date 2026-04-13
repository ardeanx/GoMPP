package storage

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// LocalBackend stores files on the local filesystem.
type LocalBackend struct {
	BasePath string
}

func NewLocalBackend(basePath string) (*LocalBackend, error) {
	abs, err := filepath.Abs(basePath)
	if err != nil {
		return nil, fmt.Errorf("resolving storage path: %w", err)
	}
	if err := os.MkdirAll(abs, 0750); err != nil {
		return nil, fmt.Errorf("creating storage directory: %w", err)
	}
	return &LocalBackend{BasePath: abs}, nil
}

// safePath resolves a relative path and ensures it stays under BasePath.
func (l *LocalBackend) safePath(path string) (string, error) {
	full := filepath.Join(l.BasePath, filepath.Clean(path))
	if !strings.HasPrefix(full, l.BasePath+string(os.PathSeparator)) && full != l.BasePath {
		return "", fmt.Errorf("path traversal blocked: %s", path)
	}
	return full, nil
}

func (l *LocalBackend) Put(path string, reader io.Reader) error {
	full, err := l.safePath(path)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(full), 0750); err != nil {
		return err
	}
	f, err := os.Create(full)
	if err != nil {
		return err
	}
	defer f.Close()
	if _, err = io.Copy(f, reader); err != nil {
		return err
	}
	return f.Sync()
}

func (l *LocalBackend) Get(path string) (io.ReadCloser, error) {
	full, err := l.safePath(path)
	if err != nil {
		return nil, err
	}
	return os.Open(full)
}

func (l *LocalBackend) Delete(path string) error {
	full, err := l.safePath(path)
	if err != nil {
		return err
	}
	return os.RemoveAll(full)
}

func (l *LocalBackend) Exists(path string) (bool, error) {
	full, err := l.safePath(path)
	if err != nil {
		return false, err
	}
	_, err = os.Stat(full)
	if os.IsNotExist(err) {
		return false, nil
	}
	return err == nil, err
}

func (l *LocalBackend) Size(path string) (int64, error) {
	full, err := l.safePath(path)
	if err != nil {
		return 0, err
	}
	info, err := os.Stat(full)
	if err != nil {
		return 0, err
	}
	return info.Size(), nil
}

func (l *LocalBackend) DirSize(path string) (int64, error) {
	full, err := l.safePath(path)
	if err != nil {
		return 0, err
	}
	var total int64
	err = filepath.Walk(full, func(_ string, info os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return nil // skip inaccessible files
		}
		if !info.IsDir() {
			total += info.Size()
		}
		return nil
	})
	return total, err
}

func (l *LocalBackend) URL(path string) string {
	return "/" + path
}

// List returns all file paths under the given prefix (relative storage paths).
func (l *LocalBackend) List(prefix string) ([]string, error) {
	full, err := l.safePath(prefix)
	if err != nil {
		return nil, err
	}
	if _, err := os.Stat(full); os.IsNotExist(err) {
		return nil, nil
	}
	var paths []string
	err = filepath.Walk(full, func(p string, info os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return nil
		}
		if !info.IsDir() {
			rel, _ := filepath.Rel(l.BasePath, p)
			paths = append(paths, filepath.ToSlash(rel))
		}
		return nil
	})
	return paths, err
}

// FullPath returns the absolute filesystem path for internal use (e.g. FFmpeg).
func (l *LocalBackend) FullPath(path string) string {
	full, err := l.safePath(path)
	if err != nil {
		return filepath.Join(l.BasePath, filepath.Clean(path))
	}
	return full
}
