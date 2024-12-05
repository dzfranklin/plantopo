.DELETE_ON_ERROR:

MOCKERY_VERSION := 2.50.0
REDOCLY_VERSION := 1.25.15
SQLC_VERSION := 1.27.0
STATICCHECK_VERSION := 2024.1.1
OGEN_VERSION := 1.2.2
# TODO: specify tern version (it doesn't publish a release for darwin...)

MOCKERY := out/mockery_v$(MOCKERY_VERSION)
SQLC := out/sqlc_v$(SQLC_VERSION)
STATICCHECK := out/staticcheck_v$(STATICCHECK_VERSION)
OGEN := out/ogen_v$(OGEN_VERSION)

export NPM_CONFIG_LOGLEVEL := error
export NODE_NO_WARNINGS := 1

export REDOCLY_SUPPRESS_UPDATE_NOTICE := true

export PATH := $(realpath out):$(PATH)

.PHONY: build
build: \
	out/app_codegen.marker \
	out/backend_codegen.marker \

.PHONY: clean
clean:
	test ! -d out || rm -r out

.PHONY: test
test: backend_test staticmap_test app_test

.PHONY: sql
sql: $(SQLC) backend/sqlc.yaml backend/migrations backend/internal/psqlc/queries
	$(eval scratch := $(shell mktemp -d))
	cd backend && env "$$(cat .env .env.local | grep DATABASE_URL | xargs)" "$(shell realpath $(SQLC))" generate
	printf '[database]\n$(shell cat backend/.env backend/.env.local | grep DATABASE_URL | tail -n 1 | sed 's/DATABASE_URL/conn_string/')' >$(scratch)/tern.conf
	tern gengen --migrations backend/migrations --config $(scratch)/tern.conf \
		--output backend/internal/pmigrate/migrations_gen.sql

out/app_codegen.marker: \
	app/.env.local.example \
	app/dependencyReport.json \
	app/api/v1.d.ts

	mkdir -p out && touch out/app_codegen.marker

out/backend_codegen.marker: \
	backend/.env.local.example \
	out/backend_mockery.marker \
	out/backend_ogen.marker

	mkdir -p out && touch out/backend_codegen.marker

.PHONY: backend_test
backend_test: \
	out/backend_go_test.marker \
	out/backend_staticcheck.marker \
	out/backend_gofmt.marker \
	out/backend_go_mod_tidy.marker

out/backend_go_test.marker: $(TERN) out/backend_codegen.marker backend
	cd backend && go test -race -timeout 1m -short ./...
	mkdir -p out && touch out/backend_go_test.marker

out/backend_staticcheck.marker: $(STATICCHECK) out/backend_codegen.marker backend
	cd backend && "$(shell realpath $(STATICCHECK))" ./...
	mkdir -p out && touch out/backend_staticcheck.marker

out/backend_gofmt.marker: out/backend_codegen.marker backend
	cd backend && test -z "$$(gofmt -l .)"
	mkdir -p out && touch out/backend_gofmt.marker

out/backend_go_mod_tidy.marker: out/backend_codegen.marker backend
	cd backend && go mod tidy -diff
	mkdir -p out && touch out/backend_go_mod_tidy.marker

.PHONY: staticmap_test
staticmap_test: \
	out/staticmap_go_test.marker \
	out/staticmap_staticcheck.marker \
	out/staticmap_gofmt.marker \
	out/staticmap_go_mod_tidy.marker

out/staticmap_go_test.marker: staticmap
	cd staticmap && go test -race ./...
	mkdir -p out && touch out/staticmap_go_test.marker

out/staticmap_staticcheck.marker: $(STATICCHECK) staticmap
	cd staticmap && "$(shell realpath $(STATICCHECK))" ./...
	mkdir -p out && touch out/staticmap_staticcheck.marker

out/staticmap_gofmt.marker: staticmap
	cd staticmap && test -z "$$(gofmt -l .)"
	mkdir -p out && touch out/staticmap_gofmt.marker

out/staticmap_go_mod_tidy.marker: staticmap
	cd staticmap && go mod tidy -diff
	mkdir -p out && touch out/staticmap_go_mod_tidy.marker

$(STATICCHECK):
	mkdir -p out
	$(eval scratch := $(shell mktemp -d))
	curl "https://github.com/dominikh/go-tools/releases/download/$(STATICCHECK_VERSION)/staticcheck_$(shell uname -s | tr '[:upper:]' '[:lower:]')_$(shell uname -m | sed s/x86_64/amd64/).tar.gz" \
		--proto '=https' --tlsv1.2 -sLSf -o $(scratch)/staticcheck.tar.gz
	tar --extract --file $(scratch)/staticcheck.tar.gz --to-stdout staticcheck >$(STATICCHECK)
	chmod +x $(STATICCHECK)
	rm -r $(scratch)

.PHONY: app_test
app_test: \
	out/app_prettier.marker \
	out/app_next_lint.marker \
	out/app_typecheck.marker \
	out/app_vitest.marker

out/app_vitest.marker: app out/app_codegen.marker app/node_modules
	cd app && npm exec vitest -- --run
	mkdir -p out && touch out/app_vitest.marker

out/app_prettier.marker: app out/app_codegen.marker app/node_modules
	cd app && npm exec prettier -- --check --log-level warn .
	mkdir -p out && touch out/app_prettier.marker

out/app_next_lint.marker: app out/app_codegen.marker app/node_modules
	cd app && ../scripts/quiet-success.sh npm exec next -- lint --max-warnings 0 --quiet
	mkdir -p out && touch out/app_next_lint.marker

out/app_typecheck.marker: app out/app_codegen.marker app/node_modules
	cd app && tsc --noEmit --project tsconfig.json
	mkdir -p out && touch out/app_typecheck.marker

backend/.env.local: # (file not required)
backend/.env.local.example: backend/.env.local
	test ! -f backend/.env.local || \
	cat backend/.env.local | \
	cut -d '=' -f 1 | \
	xargs -I {} echo {}= >backend/.env.local.example

app/.env.local: # (file not required)
app/.env.local.example: app/.env.local
	test ! -f app/.env.local || \
	cat app/.env.local | \
	cut -d '=' -f 1 | \
	xargs -I {} echo {}= >app/.env.local.example

app/node_modules: app/package.json app/package-lock.json
	cd app && npm ci

app/dependencyReport.json: app/node_modules app/scripts/buildDependencyReport.ts
	./app/scripts/buildDependencyReport.ts

$(MOCKERY):
	mkdir -p out
	$(eval scratch := $(shell mktemp -d))
	curl "https://github.com/vektra/mockery/releases/download/v$(MOCKERY_VERSION)/mockery_$(MOCKERY_VERSION)_$(shell uname -s)_$(shell uname -m).tar.gz" \
		--proto '=https' --tlsv1.2 -sLSf -o $(scratch)/mockery.tar.gz
	tar --extract --file $(scratch)/mockery.tar.gz --to-stdout mockery >$(MOCKERY)
	chmod +x $(MOCKERY)
	rm -r $(scratch)

out/backend_mockery.marker: $(MOCKERY) $(shell find backend -name '*.go' ! -name 'mock_*' ! -name '*_gen.go')
	@ # Requirement: .mockery.yaml does not specify mocks for generated code
	cd backend && "$(shell realpath $(MOCKERY))" --log-level=warn
	mkdir -p out && touch out/backend_mockery.marker

out/api_schema.json: api/schema
	./scripts/quiet-success.sh npm exec --package=@redocly/cli@$(REDOCLY_VERSION) --yes -- \
		redocly lint
	./scripts/quiet-success.sh npm exec --package=@redocly/cli@$(REDOCLY_VERSION) --yes -- \
		redocly bundle v1 --lint-config warn -o out/api_schema.json

$(OGEN):
	mkdir -p out
	$(eval scratch := $(shell mktemp -d))
	curl "https://github.com/ogen-go/ogen/archive/refs/tags/v$(OGEN_VERSION).zip" \
		--proto '=https' --tlsv1.2 -sLSf -o $(scratch)/ogen.zip
	unzip $(scratch)/ogen.zip -d $(scratch)
	cd $(scratch)/ogen-$(OGEN_VERSION) && CGO_ENABLED=0 go build -o $(scratch)/ogen ./cmd/ogen/main.go
	mv $(scratch)/ogen $(OGEN)
	rm -r $(scratch)

out/backend_ogen.marker: out/api_schema.json $(OGEN)
	cp out/api_schema.json backend/internal/papi/schema.gen.json
	cd backend && "$(shell realpath $(OGEN))" \
		-loglevel warn \
		-target internal/papi -package papi \
		-clean \
		./internal/papi/schema.gen.json
	touch out/backend_ogen.marker

app/api/v1.d.ts: app/node_modules out/api_schema.json
	./app/scripts/generateAPI.ts out/api_schema.json app/api/v1.d.ts
	cd app && npm exec prettier -- --log-level warn --write api/v1.d.ts

$(SQLC):
	mkdir -p out
	$(eval scratch := $(shell mktemp -d))
	curl "https://downloads.sqlc.dev/sqlc_$(SQLC_VERSION)_$(shell uname -s | tr '[:upper:]' '[:lower:]')_$(shell uname -m | sed s/x86_64/amd64/).tar.gz" \
		--proto '=https' --tlsv1.2 -sLSf -o $(scratch)/sqlc.tar.gz
	tar --extract --file $(scratch)/sqlc.tar.gz --to-stdout sqlc >$(SQLC)
	chmod +x $(SQLC)
	rm -r $(scratch)
