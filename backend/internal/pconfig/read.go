package pconfig

import (
	"fmt"
	"github.com/throttled/throttled/v2"
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	minPasswordStrength = 1 // Since we throttle tries
)

func Read() *Config {
	return &Config{
		Env: getEnvString("APP_ENV"),
		Server: Server{
			Port:           getEnvInt("PORT"),
			MetaPort:       getEnvInt("META_PORT"),
			CORSAllowHosts: getEnvStrings("CORS_ALLOW_HOSTS"),
		},
		Elevation: Elevation{
			Endpoint: getEnvString("ELEVATION_API_ENDPOINT"),
		},
		Postgres: Postgres{
			URL: getEnvString("DATABASE_URL"),
		},
		Redis: Redis{
			Addr:     getEnvString("REDIS_ADDR"),
			Password: os.Getenv("REDIS_PASSWORD"),
			DB:       getOptionalEnvInt("REDIS_DB", 0),
		},
		S3: S3{
			Endpoint:  getEnvString("S3_ENDPOINT"),
			AccessKey: getEnvString("S3_ACCESS_KEY"),
			SecretKey: getEnvString("S3_SECRET_KEY"),
		},
		Session: Session{
			SessionIdleExpiry: 24 * time.Hour * 30, // WatchStatus: implement
		},
		Users: Users{
			LoginThrottle:       throttled.RateQuota{MaxRate: throttled.PerMin(10), MaxBurst: 20},
			MinPasswordStrength: getOptionalEnvInt("MIN_PASSWORD_STRENGTH", minPasswordStrength),
			PasswordHashCost:    12,
		},
		OrdnanceSurvey: OrdnanceSurvey{
			APIKey: getEnvString("OS_API_KEY"),
		},
		MetOffice: MetOffice{
			DataPointAPIKey: getEnvString("MET_OFFICE_DATAPOINT_API_KEY"),
		},
		DFTBusOpenData: DFTBusOpenData{
			Username: getEnvString("DFT_BUS_OPEN_DATA_USERNAME"),
			Password: getEnvString("DFT_BUS_OPEN_DATA_PASSWORD"),
		},
		Twilio: Twilio{
			AccountSID: getEnvString("TWILIO_ACCOUNT_SID"),
			AuthToken:  getEnvString("TWILIO_AUTH_TOKEN"),
		},
		Imgproxy: Imgproxy{
			Key:  getEnvString("IMGPROXY_KEY"),
			Salt: getEnvString("IMGPROXY_SALT"),
		},
		SMTPRelay: SMTPRelay{
			Server:   getEnvString("SMTP_RELAY_SERVER"),
			Port:     getEnvInt("SMTP_RELAY_PORT"),
			Username: getEnvString("SMTP_RELAY_USERNAME"),
			Password: getEnvString("SMTP_RELAY_PASSWORD"),
		},
		Mapbox: Mapbox{
			PrivateToken: getEnvString("MAPBOX_PRIVATE_TOKEN"),
			PublicToken:  getEnvString("MAPBOX_PUBLIC_TOKEN"),
		},
		Flickr: Flickr{
			APIKey: getEnvString("FLICKR_API_KEY"),
		},
	}
}

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
