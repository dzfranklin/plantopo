package pgeophotos

import (
	"context"
	"errors"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/pstrings"
	"os/exec"
)

func (s *Service) tilePoints(ctx context.Context, input string, out string) error {
	cmd := exec.CommandContext(ctx, "tippecanoe",
		"--output", out,
		"--layer=default",
		"--drop-rate=1",
		"--cluster-densest-as-needed",
		"--cluster-distance=10",
		"--base-zoom=g",
		"--minimum-zoom=0",
		"--maximum-zoom=14",
		input)

	runOut, runErr := cmd.CombinedOutput()
	if errors.Is(runErr, context.Canceled) {
		return runErr
	} else if runErr != nil {
		msg := pstrings.TruncateASCIIFromEnd(string(runOut), 500)
		return fmt.Errorf("tippecanoe: %s", msg)
	}

	return nil
}
