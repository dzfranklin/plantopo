package importers

import (
	"context"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"io"
	"time"
)

var s3Bucket = "plantopo-import-uploads"

type S3ObjectStore struct {
	client        *s3.Client
	presignClient *s3.PresignClient
}

func NewS3ObjectStore(client *s3.Client) *S3ObjectStore {
	return &S3ObjectStore{
		client:        client,
		presignClient: s3.NewPresignClient(client),
	}
}

func (s *S3ObjectStore) CreatePresignedUploadURL(ctx context.Context, id string) (string, error) {
	req, err := s.presignClient.PresignPutObject(
		ctx,
		&s3.PutObjectInput{
			Bucket: &s3Bucket,
			Key:    &id,
		},
		func(options *s3.PresignOptions) {
			options.Expires = 1 * time.Hour
		},
	)
	if err != nil {
		return "", err
	}
	return req.URL, nil
}

func (s *S3ObjectStore) GetUpload(ctx context.Context, id string) (io.ReadCloser, error) {
	req := s3.GetObjectInput{
		Bucket: &s3Bucket,
		Key:    &id,
	}
	resp, err := s.client.GetObject(ctx, &req)
	if err != nil {
		return nil, err
	}
	return resp.Body, nil
}
