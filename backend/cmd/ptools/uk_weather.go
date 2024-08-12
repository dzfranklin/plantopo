package main

import (
	"context"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/pweather"
	"github.com/spf13/cobra"
	"os"
)

var ukWeatherCmd = &cobra.Command{
	Use:  "uk-weather <query>",
	Args: cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		osAPIKey := os.Getenv("OS_API_KEY")
		if osAPIKey == "" {
			panic("Missing OS_API_KEY")
		}

		metAPIKey := os.Getenv("MET_OFFICE_DATAPOINT_API_KEY")
		if metAPIKey == "" {
			panic("Missing MET_OFFICE_DATAPOINT_API_KEY")
		}

		query := args[0]

		svc := pweather.New(&pconfig.Env{
			Config: &pconfig.Config{
				UserAgent:      userAgent,
				OrdnanceSurvey: pconfig.OrdnanceSurvey{APIKey: osAPIKey},
				MetOffice:      pconfig.MetOffice{DataPointAPIKey: metAPIKey},
			},
		})

		msg, err := svc.FindUKShortForecast(context.Background(), query)
		if err != nil {
			panic(err)
		}
		fmt.Println(msg)
	},
}

func init() {
	rootCmd.AddCommand(ukWeatherCmd)
}
