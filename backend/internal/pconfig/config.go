package pconfig

import "log/slog"

type Config struct {
	Port           int
	MetaPort       int
	Env            string
	CORSAllowHosts []string
	Logger         *slog.Logger
	Elevation      Elevation
	UserAgent      string
}

type Elevation struct {
	Endpoint string
}
