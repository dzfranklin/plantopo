package main

import (
	"github.com/dzfranklin/plantopo/backend/internal/papi"
	"net/http"
)

var docsHTML = []byte(`
    <!DOCTYPE html>
    <html>
    <head>
    <link type="text/css" rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.9.0/swagger-ui.css">
    <link rel="shortcut icon" href="https://fastapi.tiangolo.com/img/favicon.png">
    <title>PlanTopo API - Docs</title>
    </head>
    <body>
    <div id="swagger-ui">
    </div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
    <script>
    const ui = SwaggerUIBundle({
		"url": 'openapi.json',
		"dom_id": "#swagger-ui",
		"layout": "BaseLayout",
		"deepLinking": true,
		"showExtensions": true,
		"showCommonExtensions": true,
		"useUnsafeMarkdown": true,
		"oauth2RedirectUrl": window.location.origin + '/docs/oauth2-redirect',
		"presets": [
			SwaggerUIBundle.presets.apis,
			SwaggerUIBundle.SwaggerUIStandalonePreset
		],
	})
    </script>
    </body>
    </html>

`)

func docsRoutes() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		_, _ = w.Write(docsHTML)
	})

	mux.HandleFunc("GET /openapi.json", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(papi.SchemaJSON))
	})

	return mux
}
