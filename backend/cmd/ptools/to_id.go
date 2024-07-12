package main

import (
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/google/uuid"
	"github.com/spf13/cobra"
	"os"
	"strconv"
)

var toIDKind string
var toIDType string

var toIDCmd = &cobra.Command{
	Use:  "to-id <value>",
	Args: cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		switch toIDType {
		case "uuid":
			v, err := uuid.Parse(args[0])
			if err != nil {
				fmt.Println("Expected <value> to be a valid uuid")
				os.Exit(1)
			}
			fmt.Println(prepo.UUIDToID(toIDKind, v))
		case "serial":
			v, err := strconv.ParseInt(args[0], 10, 64)
			if err != nil {
				fmt.Println("Expected <value> to be a valid base-10 number")
				os.Exit(1)
			}
			fmt.Println(prepo.SerialToID(toIDKind, v))
		default:
			fmt.Println("Invalid --kind")
			os.Exit(1)
		}
	},
}

func init() {
	toIDCmd.Flags().StringVar(&toIDKind, "kind", "", "")
	must(toIDCmd.MarkFlagRequired("kind"))

	toIDCmd.Flags().StringVar(&toIDType, "type", "uuid", "")

	rootCmd.AddCommand(toIDCmd)
}
