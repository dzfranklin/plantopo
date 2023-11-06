package internal

import (
	"context"
	"errors"
	"fmt"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/cloudfront"
	cfTypes "github.com/aws/aws-sdk-go-v2/service/cloudfront/types"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3Types "github.com/aws/aws-sdk-go-v2/service/s3/types"
	"log"
	"mime"
	"net/http"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"strings"
	"time"
)

const bucketRegion = "eu-west-2"

var entrypointNames = []string{"index.html", "index.txt", "404.html"}

type AppDeployment struct {
	Ver          string
	Bucket       string
	Distribution string
	staging      bool
	apiDomain    string
}

func CreateStagingAppDeployment(dryRun bool, staging string, ver string, templateBucket string) (*AppDeployment, error) {
	ctx := context.Background()

	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(bucketRegion))
	if err != nil {
		log.Fatal(err)
	}

	if dryRun {
		fmt.Println("Would setup bucket (dry run)")
	} else {
		err = ensureBucket(ctx, cfg, staging, templateBucket)
		if err != nil {
			return nil, fmt.Errorf("ensure staging bucket: %w", err)
		}
	}

	return &AppDeployment{
		Ver:       ver,
		Bucket:    stagingBucket(staging),
		staging:   true,
		apiDomain: fmt.Sprintf("%s.api.pt-staging.dfusercontent.com", staging),
	}, nil
}

func ensureBucket(
	ctx context.Context, cfg aws.Config, staging string, templateBucket string,
) error {
	s3Client := s3.NewFromConfig(cfg)
	bucket := stagingBucket(staging)
	fmt.Printf("Setting up bucket %s\n", bucket)
	_, err := s3Client.CreateBucket(ctx, &s3.CreateBucketInput{
		Bucket: &bucket,
		CreateBucketConfiguration: &s3Types.CreateBucketConfiguration{
			LocationConstraint: bucketRegion,
		},
	})
	var alreadyOwned *s3Types.BucketAlreadyOwnedByYou
	if err != nil && !errors.As(err, &alreadyOwned) {
		return fmt.Errorf("create staging app bucket: %w", err)
	}

	bWebsiteTmpl, err := s3Client.GetBucketWebsite(ctx, &s3.GetBucketWebsiteInput{Bucket: &templateBucket})
	if err != nil {
		return fmt.Errorf("get template bucket website: %w", err)
	}
	_, err = s3Client.PutBucketWebsite(ctx, &s3.PutBucketWebsiteInput{
		Bucket: &bucket,
		WebsiteConfiguration: &s3Types.WebsiteConfiguration{
			ErrorDocument:         bWebsiteTmpl.ErrorDocument,
			IndexDocument:         bWebsiteTmpl.IndexDocument,
			RedirectAllRequestsTo: bWebsiteTmpl.RedirectAllRequestsTo,
			RoutingRules:          bWebsiteTmpl.RoutingRules,
		},
	})
	if err != nil {
		return fmt.Errorf("configure staging app bucket as website: %w", err)
	}

	_, err = s3Client.DeletePublicAccessBlock(ctx, &s3.DeletePublicAccessBlockInput{Bucket: &bucket})
	if err != nil {
		return fmt.Errorf("delete staging app bucket public access block: %w", err)
	}

	bPolicyTmpl, err := s3Client.GetBucketPolicy(ctx, &s3.GetBucketPolicyInput{Bucket: &templateBucket})
	if err != nil {
		return fmt.Errorf("get template bucket policy: %w", err)
	}
	if bPolicyTmpl.Policy != nil {
		policy := strings.Replace(
			*bPolicyTmpl.Policy,
			fmt.Sprintf("arn:aws:s3:::%s", templateBucket),
			fmt.Sprintf("arn:aws:s3:::%s", bucket),
			-1,
		)
		_, err = s3Client.PutBucketPolicy(ctx, &s3.PutBucketPolicyInput{
			Bucket: &bucket,
			Policy: &policy,
		})
		if err != nil {
			log.Printf("bucket %s, policy: %s", bucket, policy)
			return fmt.Errorf("configure staging app bucket policy: %w", err)
		}
	}
	return nil
}

func stagingBucket(staging string) string {
	return fmt.Sprintf("%s.app.pt-staging.dfusercontent.com", staging)
}

func (d *AppDeployment) Run(dryRun bool, baseDir string) {
	fmt.Println("Deploying app (" + d.Ver + ")")

	cfg, err := config.LoadDefaultConfig(context.Background(), config.WithRegion(bucketRegion))
	if err != nil {
		log.Fatal(err)
	}
	s3Client := s3.NewFromConfig(cfg)

	// List existing

	preexistingObjects := listExisting(s3Client, d.Bucket)

	// Build
	apiDomain := d.apiDomain
	if apiDomain == "" {
		apiDomain = "api.plantopo.com"
	}
	apiEndpoint := fmt.Sprintf("https://%s/api/v1/", apiDomain)
	output := doBuild(d.Ver, baseDir, apiEndpoint)

	// Upload

	// We skip uploading preexistingObjects resources because the names are unique.
	// This mostly avoids re-uploading media like the font.

	fmt.Println("Uploading app: resources")
	doUpload(dryRun, s3Client, d.Bucket, &preexistingObjects, true, output.outDir, output.resources)

	fmt.Println("Uploading app: entrypoints")
	doUpload(dryRun, s3Client, d.Bucket, &preexistingObjects, false, output.outDir, output.entrypoints)

	deleteUnusedPreexisting(dryRun, s3Client, d.Bucket, preexistingObjects)

	// Invalidate

	if !d.staging {
		if dryRun {
			fmt.Println("Would invalidate app (dry run)")
		} else {
			fmt.Println("Invalidating app")
			cfClient := cloudfront.NewFromConfig(cfg)
			callerReference := fmt.Sprintf("deploy-%s-%s", d.Distribution, time.Now().Format("20060102150405"))
			invalidatePaths := []string{"/*"}
			invalidatePathsQuantity := int32(len(invalidatePaths))
			_, err = cfClient.CreateInvalidation(context.Background(), &cloudfront.CreateInvalidationInput{
				DistributionId: &d.Distribution,
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
		}
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

func doBuild(ver string, baseDir string, apiEndpoint string) *buildOutput {
	imageTag := fmt.Sprintf("pt-app:%s", ver)

	cmd := exec.Command("docker", "build",
		"--file", "app.Dockerfile",
		"--tag", imageTag,
		"--build-arg", "VER="+ver,
		"--build-arg", "API_ENDPOINT="+apiEndpoint,
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
	dryRun bool, client *s3.Client, bucket string, preexisting *map[string]struct{}, skipPreexisting bool,
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

		if dryRun {
			fmt.Printf("Would upload %s (dry run)\n", key)
		} else {
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
}

func deleteUnusedPreexisting(dryRun bool, client *s3.Client, bucket string, objects map[string]struct{}) {
	for key := range objects {
		if dryRun {
			fmt.Printf("Would delete unused preexisting object %s (dry run) \n", key)
		} else {
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
}
