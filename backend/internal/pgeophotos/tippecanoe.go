package pgeophotos

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"io"
	"os/exec"
)

func (s *Service) tilePoints(ctx context.Context, input string, out string) error {
	l := s.l.WithGroup("tilePoints").With("input", input, "out", out)

	cmd := exec.CommandContext(ctx, "tippecanoe",
		"--output", out,
		"--layer=default",
		"--drop-rate=1",
		"--cluster-densest-as-needed",
		"--cluster-distance=10",
		"--base-zoom=g",
		"--minimum-zoom=0",
		"--maximum-zoom=14",
		"--use-attribute-for-id=id",
		"--progress-interval=30",
		"--json-progress",
		input)
	stderr, stderrErr := cmd.StderrPipe()
	if stderrErr != nil {
		return stderrErr
	}

	go func() {
		br := bufio.NewReader(stderr)
		for {
			line, readErr := br.ReadString('\n')
			if errors.Is(readErr, io.EOF) {
				break
			} else if readErr != nil {
				l.Error("failed to read from stderr", "error", readErr)
				break
			}

			var update struct {
				Progress float64 `json:"progress"`
			}

			if err := json.Unmarshal([]byte(line), &update); err != nil {
				// if it fails to unmarshal it is probably a plaintext warning
				l.Warn(line)
			} else {
				l.Info("working", "progress", update.Progress)
			}
		}
	}()

	return cmd.Run()
}
