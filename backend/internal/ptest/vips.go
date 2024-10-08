package ptest

import (
	"github.com/davidbyttow/govips/v2/vips"
	"strings"
	"sync"
	"testing"
)

var vipsMu sync.Mutex
var vipsInitialized = false

func VipsTest(t *testing.T) {
	vipsMu.Lock()
	defer vipsMu.Unlock()

	if !vipsInitialized {
		vips.LoggingSettings(func(domain string, level vips.LogLevel, msg string) {
			if !strings.HasPrefix(msg, "threadpool completed with ") &&
				!strings.HasPrefix(msg, "loading ") &&
				!strings.HasPrefix(msg, "registered ") &&
				!strings.HasPrefix(msg, "created imageRef ") {
				t.Log("vips:", msg)
			}
		}, vips.LogLevelDebug)

		vips.Startup(nil)

		vipsInitialized = true
	}
}
