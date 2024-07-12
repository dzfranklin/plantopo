package main

import (
	"github.com/dzfranklin/plantopo/backend/internal/papi"
	"net/http"
	"strings"
)

const swaggerVersion = "5.17.14"

var docsHTML = []byte(strings.ReplaceAll(`
    <!DOCTYPE html>
    <html>
    <head>
    	<title>PlanTopo API - Docs</title>
    	<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@SWAGGER_VERSION/swagger-ui.css" />
    </head>
    <body>
		<div id="swagger-ui"></div>
		<script src="https://unpkg.com/swagger-ui-dist@SWAGGER_VERSION/swagger-ui-bundle.js" crossorigin></script>
		<script src="https://unpkg.com/swagger-ui-dist@SWAGGER_VERSION/swagger-ui-standalone-preset.js" crossorigin></script>
		<script>
			const ui = SwaggerUIBundle({
				"url": 'openapi.json',
				"dom_id": "#swagger-ui",
				"layout": "BaseLayout",
				"deepLinking": true,
				"showExtensions": true,
				"showCommonExtensions": true,
				"oauth2RedirectUrl": window.location.origin + '/docs/oauth2-redirect',
				"presets": [
					SwaggerUIBundle.presets.apis,
					SwaggerUIBundle.SwaggerUIStandalonePreset
				],
				"displayRequestDuration": true,
				"onComplete": () => {
					// Hack: Switch to the localhost server if we are on localhost
					const serversSelect = document.querySelector(".servers select")
					if (location.hostname === "localhost") {
						const options = Array.from(serversSelect.options).map(el => el.value);
						let chosen = null;
						for (const candidate of options) {
							if (candidate.startsWith("http://localhost")) {
								chosen = candidate;
								break;
							}
						}
						if (chosen !== null) {
							serversSelect.value = chosen;
							serversSelect.dispatchEvent(new Event('change', {bubbles: true}));
						}
					}
				}
			})
		</script>
    </body>
    </html>
`, "SWAGGER_VERSION", swaggerVersion))

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
