package main

import (
	"fmt"
	"github.com/spf13/cobra"
	"golang.org/x/crypto/bcrypt"
)

var pwHashCmd = &cobra.Command{
	Use:  "pwhash <password>",
	Args: cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		input := args[0]
		hash, err := bcrypt.GenerateFromPassword([]byte(input), 12)
		if err != nil {
			panic(err)
		}
		fmt.Println(string(hash))
	},
}

func init() {
	rootCmd.AddCommand(pwHashCmd)
}
