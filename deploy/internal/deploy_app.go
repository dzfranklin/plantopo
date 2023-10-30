package internal

import (
	"context"
	"fmt"
	cfTypes "github.com/aws/aws-sdk-go-v2/service/cloudfront/types"
	"log"
	"mime"
	"net/http"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/cloudfront"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

const bucketRegion = "us-east-2"

var entrypointNames = []string{"index.html", "index.txt", "404.html"}

func DeployApp(ver string, baseDir string, bucket string, distribution string) {
	fmt.Println("Deploying app (" + ver + ")")

	cfg, err := config.LoadDefaultConfig(context.Background(), config.WithRegion(bucketRegion))
	if err != nil {
		log.Fatal(err)
	}
	s3Client := s3.NewFromConfig(cfg)

	// List existing

	preexistingObjects := listExisting(s3Client, bucket)

	// Build
	output := doBuild(ver, baseDir)

	// Upload

	// We skip uploading preexistingObjects resources because the names are unique.
	// This mostly avoids re-uploading media like the font.

	fmt.Println("Uploading app: resources")
	doUpload(s3Client, bucket, &preexistingObjects, true, output.outDir, output.resources)

	fmt.Println("Uploading app: entrypoints")
	doUpload(s3Client, bucket, &preexistingObjects, false, output.outDir, output.entrypoints)

	deleteUnusedPreexisting(s3Client, bucket, preexistingObjects)

	// Invalidate

	fmt.Println("Invalidating app")
	cfClient := cloudfront.NewFromConfig(cfg)
	callerReference := fmt.Sprintf("deploy-%s-%s", distribution, time.Now().Format("20060102150405"))
	invalidatePaths := []string{"/*"}
	invalidatePathsQuantity := int32(len(invalidatePaths))
	_, err = cfClient.CreateInvalidation(context.Background(), &cloudfront.CreateInvalidationInput{
		DistributionId: &distribution,
		InvalidationBatch: &cfTypes.InvalidationBatch{
			CallerReference: &callerReference,
			Paths: &cfTypes.Paths{
				Quantity: &invalidatePathsQuantity,
				Items:    invalidatePaths,
			},
		},
	})
	if err != nil {
		log.Fatal(err)
	}

	output.Cleanup()

	fmt.Println("Done deploying app")
}

func listExisting(client *s3.Client, bucket string) map[string]struct{} {
	fmt.Println("Listing existing objects")
	set := make(map[string]struct{})
	p := s3.NewListObjectsV2Paginator(client, &s3.ListObjectsV2Input{
		Bucket: &bucket,
	})
	for p.HasMorePages() {
		page, err := p.NextPage(context.Background())
		if err != nil {
			log.Fatal(err)
		}
		for _, obj := range page.Contents {
			set[*obj.Key] = struct{}{}
		}
	}
	return set
}

type buildOutput struct {
	resources   []string
	entrypoints []string
	outDir      string
}

func doBuild(ver string, baseDir string) *buildOutput {
	imageTag := fmt.Sprintf("pt-app:%s", ver)

	cmd := exec.Command("docker", "build",
		"--file", "app.Dockerfile",
		"--tag", imageTag,
		"--build-arg", "VER="+ver,
		".",
	)

	cmd.Dir = baseDir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	fmt.Println("Building")
	if err := cmd.Run(); err != nil {
		log.Fatal(fmt.Errorf("build: %w", err))
	}

	// Copy output

	outDir, err := os.MkdirTemp("", fmt.Sprintf("pt-deploy-app-%s", ver))
	if err != nil {
		log.Fatal(err)
	}

	containerName := fmt.Sprintf("pt-deploy-app-%s", ver)
	cmd = exec.Command("docker", "create", "--name", containerName, imageTag)
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		log.Fatal(err)
	}

	cmd = exec.Command("docker", "cp", fmt.Sprintf("%s:/build/out/.", containerName), outDir)
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		log.Fatal(fmt.Errorf("copy out: %w", err))
	}

	cmd = exec.Command("docker", "rm", containerName)
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		log.Fatal(err)
	}

	cmd = exec.Command("docker", "rmi", imageTag)
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		log.Fatal(err)
	}

	// List

	var resources []string
	var entrypoints []string

	err = filepath.Walk(outDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		for _, entrypointName := range entrypointNames {
			if info.Name() == entrypointName {
				entrypoints = append(entrypoints, path)
				return nil
			}
		}
		resources = append(resources, path)
		return nil
	})
	if err != nil {
		log.Fatal(err)
	}

	return &buildOutput{
		resources:   resources,
		entrypoints: entrypoints,
		outDir:      outDir,
	}
}

func (o *buildOutput) Cleanup() {
	if err := os.RemoveAll(o.outDir); err != nil {
		log.Println(fmt.Errorf("failed to cleanup build outputs: %w", err))
	}
}

func doUpload(
	client *s3.Client, bucket string, preexisting *map[string]struct{}, skipPreexisting bool,
	base string, files []string,
) {
	for _, fname := range files {
		file, err := os.Open(fname)
		if err != nil {
			log.Fatal(err)
		}

		if !strings.HasPrefix(fname, base) {
			log.Fatalf("base must be a prefix of fname (base is %s, fname is %s)", base, fname)
		}
		key := fname[len(base)+1:]

		if _, ok := (*preexisting)[key]; ok {
			delete(*preexisting, key)
			if skipPreexisting {
				fmt.Printf("Skipping upload of %s\n", key)
				continue
			}
		}

		var contentType string
		ext := path.Ext(key)
		switch ext {
		case ".map":
			contentType = "application/json"
		default:
			contentType = mime.TypeByExtension(ext)
		}
		if contentType == "" {
			fmt.Println("Sniffing content-type for", key)
			bytes := make([]byte, 512)
			_, err = file.Read(bytes)
			if err != nil {
				log.Fatal(err)
			}
			contentType = http.DetectContentType(bytes)
		}

		fmt.Printf("Uploading %s\n", key)
		_, err = client.PutObject(context.Background(), &s3.PutObjectInput{
			Bucket:      &bucket,
			Key:         &key,
			ContentType: &contentType,
			Body:        file,
		})
		if err != nil {
			log.Fatal(err)
		}
	}
}

func deleteUnusedPreexisting(client *s3.Client, bucket string, objects map[string]struct{}) {
	for key := range objects {
		fmt.Printf("Deleting unused preexisting object %s\n", key)
		_, err := client.DeleteObject(context.Background(), &s3.DeleteObjectInput{
			Bucket: &bucket,
			Key:    &key,
		})
		if err != nil {
			log.Fatal(err)
		}
	}
}
