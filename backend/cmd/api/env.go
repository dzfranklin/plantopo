package main

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

func getEnvInt(key string) int {
	v := os.Getenv(key)
	if v == "" {
		panic(fmt.Sprintf("Missing environment variable %s", key))
	}
	parsed, err := strconv.ParseInt(v, 10, 32)
	if err != nil {
		panic(fmt.Sprintf("Invalid environment variable %s. Expected an integer, got %s", key, v))
	}
	return int(parsed)
}

func getOptionalEnvInt(key string, defaultValue int) int {
	v := os.Getenv(key)
	if v == "" {
		return defaultValue
	}
	parsed, err := strconv.ParseInt(v, 10, 32)
	if err != nil {
		panic(fmt.Sprintf("Invalid environment variable %s. Expected an integer, got %s", key, v))
	}
	return int(parsed)
}

func getEnvString(key string) string {
	v := os.Getenv(key)
	if v == "" {
		panic(fmt.Sprintf("Missing environment variable %s", key))
	}
	return v
}

func getEnvStrings(key string) []string {
	v := os.Getenv(key)
	if v == "" {
		panic(fmt.Sprintf("Missing environment variable %s", key))
	}
	var parsed []string
	for _, part := range strings.Split(v, ",") {
		parsed = append(parsed, strings.TrimSpace(part))
	}
	return parsed
}
