package storage

import (
	"context"
	"fmt"
	"io"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// S3Backend stores files in an S3-compatible object store.
type S3Backend struct {
	client   *s3.Client
	bucket   string
	prefix   string
	endpoint string // public base URL for generating links
}

// S3Config holds S3-specific connection settings.
type S3Config struct {
	Bucket          string
	Region          string
	Endpoint        string // custom endpoint for MinIO/R2/etc. (optional)
	AccessKeyID     string
	SecretAccessKey string
	UsePathStyle    bool   // true for MinIO/R2
	PublicURL       string // public base URL (optional, defaults to endpoint/bucket)
	Prefix          string // key prefix (e.g. "media/")
}

func NewS3Backend(ctx context.Context, cfg S3Config) (*S3Backend, error) {
	opts := []func(*awsconfig.LoadOptions) error{
		awsconfig.WithRegion(cfg.Region),
	}

	if cfg.AccessKeyID != "" && cfg.SecretAccessKey != "" {
		opts = append(opts, awsconfig.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
		))
	}

	awsCfg, err := awsconfig.LoadDefaultConfig(ctx, opts...)
	if err != nil {
		return nil, fmt.Errorf("loading AWS config: %w", err)
	}

	var s3opts []func(*s3.Options)
	if cfg.Endpoint != "" {
		s3opts = append(s3opts, func(o *s3.Options) {
			o.BaseEndpoint = aws.String(cfg.Endpoint)
			o.UsePathStyle = cfg.UsePathStyle
		})
	}

	client := s3.NewFromConfig(awsCfg, s3opts...)

	prefix := strings.TrimRight(cfg.Prefix, "/")
	if prefix != "" {
		prefix += "/"
	}

	publicURL := cfg.PublicURL
	if publicURL == "" && cfg.Endpoint != "" {
		if cfg.UsePathStyle {
			publicURL = strings.TrimRight(cfg.Endpoint, "/") + "/" + cfg.Bucket
		} else {
			publicURL = strings.TrimRight(cfg.Endpoint, "/")
		}
	}

	return &S3Backend{
		client:   client,
		bucket:   cfg.Bucket,
		prefix:   prefix,
		endpoint: strings.TrimRight(publicURL, "/"),
	}, nil
}

func (s *S3Backend) key(path string) string {
	return s.prefix + path
}

func (s *S3Backend) Put(path string, reader io.Reader) error {
	_, err := s.client.PutObject(context.Background(), &s3.PutObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(s.key(path)),
		Body:   reader,
	})
	if err != nil {
		return fmt.Errorf("s3 put %s: %w", path, err)
	}
	return nil
}

func (s *S3Backend) Get(path string) (io.ReadCloser, error) {
	out, err := s.client.GetObject(context.Background(), &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(s.key(path)),
	})
	if err != nil {
		return nil, fmt.Errorf("s3 get %s: %w", path, err)
	}
	return out.Body, nil
}

func (s *S3Backend) Delete(path string) error {
	_, err := s.client.DeleteObject(context.Background(), &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(s.key(path)),
	})
	if err != nil {
		return fmt.Errorf("s3 delete %s: %w", path, err)
	}
	return nil
}

func (s *S3Backend) Exists(path string) (bool, error) {
	_, err := s.client.HeadObject(context.Background(), &s3.HeadObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(s.key(path)),
	})
	if err != nil {
		// If the error message contains "NotFound" or "404", the object doesn't exist.
		if strings.Contains(err.Error(), "NotFound") || strings.Contains(err.Error(), "404") {
			return false, nil
		}
		return false, fmt.Errorf("s3 head %s: %w", path, err)
	}
	return true, nil
}

func (s *S3Backend) Size(path string) (int64, error) {
	out, err := s.client.HeadObject(context.Background(), &s3.HeadObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(s.key(path)),
	})
	if err != nil {
		return 0, fmt.Errorf("s3 head %s: %w", path, err)
	}
	if out.ContentLength != nil {
		return *out.ContentLength, nil
	}
	return 0, nil
}

func (s *S3Backend) DirSize(path string) (int64, error) {
	var total int64
	prefix := s.key(path)
	if !strings.HasSuffix(prefix, "/") {
		prefix += "/"
	}
	paginator := s3.NewListObjectsV2Paginator(s.client, &s3.ListObjectsV2Input{
		Bucket: aws.String(s.bucket),
		Prefix: aws.String(prefix),
	})
	for paginator.HasMorePages() {
		page, err := paginator.NextPage(context.Background())
		if err != nil {
			return 0, fmt.Errorf("s3 list %s: %w", path, err)
		}
		for _, obj := range page.Contents {
			if obj.Size != nil {
				total += *obj.Size
			}
		}
	}
	return total, nil
}

func (s *S3Backend) URL(path string) string {
	if s.endpoint != "" {
		return s.endpoint + "/" + s.key(path)
	}
	return fmt.Sprintf("https://%s.s3.amazonaws.com/%s", s.bucket, s.key(path))
}

// List returns all object keys under the given prefix (relative to storage prefix).
func (s *S3Backend) List(prefix string) ([]string, error) {
	fullPrefix := s.key(prefix)
	if !strings.HasSuffix(fullPrefix, "/") {
		fullPrefix += "/"
	}
	var paths []string
	paginator := s3.NewListObjectsV2Paginator(s.client, &s3.ListObjectsV2Input{
		Bucket: aws.String(s.bucket),
		Prefix: aws.String(fullPrefix),
	})
	for paginator.HasMorePages() {
		page, err := paginator.NextPage(context.Background())
		if err != nil {
			return nil, fmt.Errorf("s3 list %s: %w", prefix, err)
		}
		for _, obj := range page.Contents {
			if obj.Key != nil {
				rel := strings.TrimPrefix(*obj.Key, s.prefix)
				paths = append(paths, rel)
			}
		}
	}
	return paths, nil
}
