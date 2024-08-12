package main

import (
	"crypto/rand"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/google/uuid"
	"github.com/spf13/cobra"
	"math"
	"math/big"
	"os"
)

var randomIDKind string
var randomIDType string

var randomIDCmd = &cobra.Command{
	Use: "random-id",
	Run: func(cmd *cobra.Command, args []string) {
		switch randomIDType {
		case "uuid":
			v, err := uuid.NewV7FromReader(rand.Reader)
			if err != nil {
				panic(err)
			}
			fmt.Println(prepo.UUIDToID(randomIDKind, v))
		case "serial":
			v, err := rand.Int(rand.Reader, big.NewInt(math.MaxInt64))
			if err != nil {
				panic(err)
			}
			fmt.Println(prepo.SerialToID(randomIDKind, v.Int64()))
		default:
			fmt.Println("Invalid --kind")
			os.Exit(1)
		}
	},
}

func init() {
	randomIDCmd.Flags().StringVar(&randomIDKind, "kind", "", "")
	must(randomIDCmd.MarkFlagRequired("kind"))

	randomIDCmd.Flags().StringVar(&randomIDType, "type", "uuid", "")

	rootCmd.AddCommand(randomIDCmd)
}
