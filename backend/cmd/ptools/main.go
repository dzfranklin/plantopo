package main

import (
	"fmt"
	"github.com/spf13/cobra"
	"os"
)

const (
	userAgent = "github.com/dzfranklin/plantopo ptools <daniel@danielzfranklin.org>"
)

var rootCmd = &cobra.Command{
	Use: "ptools",
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		_, _ = fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
