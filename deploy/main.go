package main

import (
	"fmt"
	"github.com/danielzfranklin/plantopo/deploy/internal"
	"github.com/spf13/pflag"
	"golang.org/x/exp/slices"
	"log"
	"os"
	"os/exec"
	"strings"
)

const (
	prodAppBucket       = "plantopo.com"
	prodAppDistribution = "E1T20T38SLR087"
)

var allSystems = []string{"app", "api_server", "matchmaker", "sync_backend"}

func main() {
	var staging = pflag.String("staging", "", "Deploy to staging version")
	var all = pflag.Bool("all", false, "Deploy all systems")
	var system = pflag.String("system", "", fmt.Sprintf("System to deploy (%s)", strings.Join(allSystems, ", ")))
	var excludeSystems = pflag.StringArray("exclude-system", []string{}, "Systems to exclude")
	var baseDir = pflag.String("dir", ".", "Base directory")
	var overrideVer = pflag.String("override-version", "", "Override version from git tag")
	var dryRun = pflag.Bool("dry-run", false, "Dry run")
	pflag.Parse()

	if *baseDir == "" || (*system == "" && !*all) {
		pflag.Usage()
		return
	}

	var systems []string
	if *all {
		for _, s := range allSystems {
			if !slices.Contains(*excludeSystems, s) {
				systems = append(systems, s)
			}
		}
	} else {
		if !slices.Contains(*excludeSystems, *system) {
			systems = []string{*system}
		}
	}

	var ver string
	var verPath string
	if *overrideVer != "" {
		ver = *overrideVer
		verPath = "<overridden version>"
	} else {
		ver = getGitTag(*baseDir)
		verPath = fmt.Sprintf("https://github.com/dzfranklin/plantopo/commit/%s", ver)
	}

	fmt.Printf("Deploying %s\n", strings.Join(systems, ", "))
	fmt.Println(verPath)
	if *dryRun {
		fmt.Println("Dry run")
	}

	for _, name := range systems {
		fmt.Print("\n-------------------\n\n")

		if name == "app" {
			var deployment *internal.AppDeployment
			if *staging == "" {
				deployment = &internal.AppDeployment{
					Ver:          ver,
					Bucket:       prodAppBucket,
					Distribution: prodAppDistribution,
				}
			} else {
				var err error
				deployment, err = internal.CreateStagingAppDeployment(*dryRun, *staging, ver, prodAppBucket)
				if err != nil {
					fmt.Println(fmt.Errorf("failed to create staging app deployment: %w", err))
					os.Exit(1)
				}
			}
			deployment.Run(*dryRun, *baseDir)
		} else {
			deployment := &internal.Deployment{
				Ver:     ver,
				Name:    name,
				Staging: *staging,
			}
			if err := deployment.Run(*dryRun, *baseDir); err != nil {
				fmt.Println(fmt.Errorf("failed to deploy %s: %w", deployment.Name, err))
				os.Exit(1)
			}
		}
	}
}

func getGitTag(baseDir string) string {
	cmd := exec.Command("git", "rev-parse", "--short", "HEAD")
	cmd.Dir = baseDir
	out, err := cmd.Output()
	if err != nil {
		log.Fatal(err)
	}
	return string(out[:len(out)-1])
}
