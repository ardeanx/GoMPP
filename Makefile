APP_NAME    := gompp
VERSION     := $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
BUILD_TIME  := $(shell date -u +"%Y-%m-%dT%H:%M:%SZ")
LDFLAGS     := -s -w -X main.version=$(VERSION) -X main.buildTime=$(BUILD_TIME)
GO          := go
GOFLAGS     :=

.PHONY: all build run test bench lint fmt vet clean docker-up docker-down docker-build help

all: lint test build ## Default: lint, test, build

build: ## Build the API binary
	$(GO) build $(GOFLAGS) -ldflags='$(LDFLAGS)' -o bin/$(APP_NAME) ./server

run: build ## Build and run locally
	./bin/$(APP_NAME)

test: ## Run all tests
	$(GO) test ./... -v -count=1

bench: ## Run benchmarks
	$(GO) test ./internal/handler/ -bench Benchmark -benchmem
	$(GO) test ./internal/middleware/ -bench Benchmark -benchmem

lint: vet ## Run linters (requires golangci-lint)
	@which golangci-lint > /dev/null 2>&1 && golangci-lint run ./... || echo "golangci-lint not installed, skipping"

vet: ## Run go vet
	$(GO) vet ./...

fmt: ## Format code
	gofmt -s -w .

clean: ## Remove build artifacts
	rm -rf bin/

docker-build: ## Build Docker images
	docker compose -f deployments/docker-compose.yml build

docker-up: ## Start all services
	docker compose -f deployments/docker-compose.yml up -d

docker-down: ## Stop all services
	docker compose -f deployments/docker-compose.yml down

docker-logs: ## Tail service logs
	docker compose -f deployments/docker-compose.yml logs -f

migrate: ## Run database migrations
	$(GO) run ./server

backup: ## Run backup script
	bash scripts/backup.sh

restore: ## Run restore script (requires BACKUP_DIR arg)
	bash scripts/restore.sh $(BACKUP_DIR)

loadtest: ## Run k6 load test (requires k6)
	k6 run scripts/loadtest.js

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
