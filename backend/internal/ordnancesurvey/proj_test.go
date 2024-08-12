package ordnancesurvey

import (
	"bytes"
	"fmt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/twpayne/go-proj/v10"
	"os"
	"os/exec"
	"strings"
	"testing"
)

func TestNewFromBNG(t *testing.T) {
	srcX := 216666.0
	srcY := 771288.0

	pj := newFromBNG()
	lnglat, err := pj.Forward(proj.NewCoord(srcX, srcY, 0, 0))
	require.NoError(t, err)
	// We use a large delta so this test passes on proj 8 (what we get if we apt install libproj-dev on GitHub actions)
	assert.InDelta(t, lnglat.Y(), -5.0037, 0.00009) // longitude
	assert.InDelta(t, lnglat.X(), 56.7969, 0.00009) // latitude

	if t.Failed() {
		cmd := exec.Command("proj")
		var outBuf bytes.Buffer
		cmd.Stderr = &outBuf
		if err := cmd.Run(); err != nil {
			t.Error(err)
		}
		fmt.Printf("proj: %s\n", strings.Split(outBuf.String(), "\n")[0])

		cmd = exec.Command("cs2cs", "+init=epsg:27700", "+to", "+init=epsg:4326", "-f", "%.6f")
		cmd.Stdin = strings.NewReader(fmt.Sprintf("%f %f", srcX, srcY))
		outBuf = bytes.Buffer{}
		cmd.Stdout = &outBuf
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			t.Error(err)
		}
		fmt.Printf("%s: %s\n", strings.Join(cmd.Args, " "), outBuf.String())
	}
}
