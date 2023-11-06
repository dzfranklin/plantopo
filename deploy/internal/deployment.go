package internal

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path"
	"runtime"
	"strings"
	"text/template"
)

type Deployment struct {
	Name    string
	Ver     string
	Staging string
}

func (d *Deployment) Run(dryRun bool, baseDir string) error {
	imageTag := fmt.Sprintf("ghcr.io/dzfranklin/pt-%s:%s", d.Name, d.Ver)
	if d.Staging != "" {
		imageTag = fmt.Sprintf("ghcr.io/dzfranklin/pt-%s:staging-%s-%s", d.Name, d.Staging, d.Ver)
	}

	fmt.Println("Deploying", d.Name, d.Ver, "("+imageTag+")")

	// Build image

	cmd := exec.Command("docker", "build",
		"--file", fmt.Sprintf("%s.Dockerfile", d.Name),
		"--tag", imageTag,
		".",
	)

	// Build cross-platform if necessary
	//goland:noinspection GoBoolExpressions
	if runtime.GOARCH != "amd64" {
		baseArgs := cmd.Args
		cmd.Args = []string{}
		for _, arg := range baseArgs {
			if arg == "build" {
				cmd.Args = append(cmd.Args, "buildx", "build", "--platform", "linux/amd64")
			} else {
				cmd.Args = append(cmd.Args, arg)
			}
		}
	}

	cmd.Dir = baseDir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	fmt.Println("Building image")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("build image: %w", err)
	}

	// Push image

	cmd = exec.Command("docker", "push", imageTag)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if dryRun {
		fmt.Println("Would push image (dry run)")
	} else {
		fmt.Println("Pushing image")
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("push image: %w", err)
		}
	}

	// Create k8s spec

	specName := fmt.Sprintf("%s.yaml", d.Name)

	specFile := path.Join(baseDir, "infra", specName)
	specBase, err := os.ReadFile(specFile)
	if err != nil {
		return fmt.Errorf("failed to read spec file %s: %w", specFile, err)
	}

	specTmpl, err := template.New(specName).Parse(string(specBase))
	if err != nil {
		return fmt.Errorf("failed to parse spec file %s as template: %w", specFile, err)
	}

	env := "prod"
	if d.Staging != "" {
		env = "staging"
	}
	apiDomain := "api.plantopo.com"
	if d.Staging != "" {
		apiDomain = fmt.Sprintf("%s.api.pt-staging.dfusercontent.com", d.Staging)
	}
	importUploadBucket := "pt-import-uploads"
	if d.Staging != "" {
		importUploadBucket = "pt-staging-import-uploads"
	}
	var permittedOrigins string
	if d.Staging != "" {
		permittedOrigins = fmt.Sprintf("https://%s.app.pt-staging.dfusercontent.com", d.Staging)
	} else {
		permittedOrigins = "https://app.plantopo.com"
	}
	// permit localhost to connect to prod
	permittedOrigins += ",http://dev-local.plantopo.com:3000,https://dev-local.plantopo.com:3000,https://dev-local.plantopo.com"

	specValues := map[string]string{
		"ver":                d.Ver,
		"image":              imageTag,
		"env":                env,
		"apiDomain":          apiDomain,
		"permittedOrigins":   permittedOrigins,
		"importUploadBucket": importUploadBucket,
	}

	var spec strings.Builder
	err = specTmpl.Execute(&spec, map[string]any{"Values": specValues})
	if err != nil {
		return fmt.Errorf("failed to template spec %s: %w", specFile, err)
	}

	// Deploy to k8s

	clusterNs := "pt"
	if d.Staging != "" {
		clusterNs = "pt-staging-" + d.Staging

		if dryRun {
			fmt.Printf("Would create namespace %s if not present (dry run)\n", clusterNs)
		} else {
			cmd = exec.Command("kubectl", "apply", "-f", "-")
			cmd.Stdin = strings.NewReader(fmt.Sprintf(`
apiVersion: v1
kind: Namespace
metadata:
  name: %s
`, clusterNs))
			cmd.Stdout = os.Stdout
			cmd.Stderr = os.Stderr
			if err := cmd.Run(); err != nil {
				return fmt.Errorf("failed to setup namespace: %w", err)
			}
		}

		if dryRun {
			fmt.Println("Would copy staging secrets (dry run)")
		} else {
			fmt.Println("Copying staging secrets")
			if err := copyStagingSecrets(clusterNs); err != nil {
				return err
			}
		}
	}

	if dryRun {
		fmt.Printf("Would deploy to k8s (namespace %s, dry run)\n", clusterNs)
	} else {
		fmt.Printf("Deploying to k8s (namespace %s)\n", clusterNs)
		cmd = exec.Command("kubectl", "apply", "-f", "-", "--namespace", clusterNs)
		cmd.Stdin = strings.NewReader(spec.String())
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("failed to run kubectl apply: %w", err)
		}
	}

	return nil
}

func copyStagingSecrets(ns string) error {
	cmd := exec.Command("kubectl", "get", "secrets",
		"--namespace", "pt-staging",
		"--selector", "staging-secret",
		"--output", "json")
	cmd.Stderr = os.Stderr
	secretsSourceBytes, err := cmd.Output()
	if err != nil {
		return fmt.Errorf("failed to get staging secrets: %w", err)
	}
	var secrets map[string]interface{}
	if err := json.Unmarshal(secretsSourceBytes, &secrets); err != nil {
		return fmt.Errorf("failed to parse staging secrets: %w", err)
	}
	for _, item := range secrets["items"].([]interface{}) {
		itemMap := item.(map[string]interface{})
		metaMap := itemMap["metadata"].(map[string]interface{})

		delete(metaMap, "namespace")
		delete(metaMap, "creationTimestamp")
		delete(metaMap, "resourceVersion")
		delete(metaMap, "uid")
	}
	secretsBytes, err := json.Marshal(secrets)
	if err != nil {
		return fmt.Errorf("failed to marshal secrets: %w", err)
	}

	cmd = exec.Command("kubectl", "apply", "-f", "-", "--namespace", ns)
	cmd.Stdin = strings.NewReader(string(secretsBytes))
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to apply staging secrets: %w", err)
	}

	return nil
}
