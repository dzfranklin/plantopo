package main

import (
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/spf13/cobra"
	"os"
)

var fromIDKind string
var fromIDType string

var fromIDCmd = &cobra.Command{
	Use:  "from-id <value>",
	Args: cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		switch fromIDType {
		case "uuid":
			v, err := prepo.IDToUUID(fromIDKind, args[0])
			if err != nil {
				fmt.Println("invalid id")
				os.Exit(1)
			}
			fmt.Println(v.String())
		case "serial":
			v, err := prepo.IDToInt(fromIDKind, args[0])
			if err != nil {
				fmt.Println("invalid id")
				os.Exit(1)
			}
			fmt.Println(v)
		default:
			fmt.Println("Invalid --kind")
			os.Exit(1)
		}
	},
}

func init() {
	fromIDCmd.Flags().StringVar(&fromIDKind, "kind", "", "")
	must(fromIDCmd.MarkFlagRequired("kind"))

	fromIDCmd.Flags().StringVar(&fromIDType, "type", "uuid", "")

	rootCmd.AddCommand(fromIDCmd)
}
