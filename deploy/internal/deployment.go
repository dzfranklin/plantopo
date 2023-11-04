package internal

import (
	"fmt"
	"os"
	"os/exec"
	"path"
	"runtime"
	"strings"
	"text/template"
)

type Deployment struct {
	Name string
	Ver  string
}

func (d *Deployment) Run(dryRun bool, baseDir string) error {
	imageTag := fmt.Sprintf("ghcr.io/dzfranklin/pt-%s:%s", d.Name, d.Ver)

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

	specValues := map[string]string{
		"ver":   d.Ver,
		"image": imageTag,
	}

	var spec strings.Builder
	err = specTmpl.Execute(&spec, map[string]any{"Values": specValues})
	if err != nil {
		return fmt.Errorf("failed to template spec %s: %w", specFile, err)
	}

	// Deploy to k8s

	if dryRun {
		fmt.Println("Would deploy to k8s (dry run)")
	} else {
		fmt.Println("Deploying to k8s")

		cmd = exec.Command("kubectl", "apply", "-f", "-")
		cmd.Stdin = strings.NewReader(spec.String())
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("failed to run kubectl apply: %w", err)
		}
	}

	return nil
}
