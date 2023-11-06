package importers

import (
	"bytes"
	"context"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"io"
	"time"
)

type S3ObjectStore struct {
	client        *s3.Client
	presignClient *s3.PresignClient
	bucket        string
}

func NewS3ObjectStore(client *s3.Client, bucket string) *S3ObjectStore {
	return &S3ObjectStore{
		client:        client,
		presignClient: s3.NewPresignClient(client),
		bucket:        bucket,
	}
}

func (s *S3ObjectStore) CreatePresignedUploadURL(ctx context.Context, id string, contentMd5 string) (string, error) {
	req, err := s.presignClient.PresignPutObject(
		ctx,
		&s3.PutObjectInput{
			Bucket:     &s.bucket,
			Key:        &id,
			ContentMD5: &contentMd5,
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
		Bucket: &s.bucket,
		Key:    &id,
	}
	resp, err := s.client.GetObject(ctx, &req)
	if err != nil {
		return nil, err
	}
	return resp.Body, nil
}

func (s *S3ObjectStore) PutConversion(ctx context.Context, id string, content []byte) error {
	key := id + "-conversion.json"
	req := s3.PutObjectInput{
		Bucket: &s.bucket,
		Key:    &key,
		Body:   bytes.NewReader(content),
	}
	_, err := s.client.PutObject(ctx, &req)
	return err
}
