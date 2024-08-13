package main

import (
	"context"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/ordnancesurvey"
	"github.com/spf13/cobra"
	"os"
)

var osFindNamesCmd = &cobra.Command{
	Use:  "os-find-names <query>",
	Args: cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		apiKey := os.Getenv("OS_API_KEY")
		if apiKey == "" {
			panic("Missing OS_API_KEY")
		}
		client := ordnancesurvey.New(apiKey)

		results, err := client.FindNames(context.Background(), args[0], &ordnancesurvey.FindNamesOptions{
			MaxResults: 5,
		})
		if err != nil {
			panic(err)
		}

		for _, entry := range results {
			fmt.Printf("%s, %s [%s %s]\n", entry.Name1, entry.Region, entry.Type, entry.LocalType)
		}
	},
}

func init() {
	rootCmd.AddCommand(osFindNamesCmd)
}
