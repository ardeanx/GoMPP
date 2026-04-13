# Contributing to GoMPP

Thank you for your interest in contributing to GoMPP! This document provides
guidelines and instructions to help you get started.

## Code of Conduct

By participating in this project, you agree to abide by our
[Code of Conduct](CODE_OF_CONDUCT.md). Please read it before contributing.

## How to Contribute

### Reporting Bugs

If you find a bug, please open a [GitHub Issue](https://github.com/gompp/gompp/issues)
with the following information:

- A clear and descriptive title
- Steps to reproduce the issue
- Expected behavior vs. actual behavior
- Environment details (OS, Go version, Node.js version, browser)
- Relevant logs or screenshots

### Suggesting Features

Feature requests are welcome. Please open a
[GitHub Issue](https://github.com/gompp/gompp/issues) and include:

- A clear description of the feature
- The problem it solves or the use case it addresses
- Any alternative solutions you've considered

### Submitting Pull Requests

1. **Fork** the repository and create your branch from `main`.
2. **Follow** the coding standards described below.
3. **Write** or update tests for your changes.
4. **Ensure** all tests and linters pass before submitting.
5. **Write** a clear PR description explaining _what_ and _why_.

## Development Setup

### Prerequisites

| Tool       | Version  |
| ---------- | -------- |
| Go         | 1.25+    |
| Node.js    | 22+      |
| Bun        | 1.x      |
| PostgreSQL | 16+      |
| FFmpeg     | 6+       |

### Getting Started

```bash
# Clone the repository
git clone https://github.com/gompp/gompp.git
cd gompp

# Copy environment configuration
cp .env.example .env
# Edit .env and set at least GOMPP_JWT_SECRET

# Start the API server
go run ./server

# In a separate terminal, start the frontend
cd web
bun install
bun run dev
```

### Using Docker

```bash
cd deployments
docker compose up --build
```

## Project Structure

```
gompp/
├── server/          # Go entrypoint
├── internal/        # Go backend (handlers, services, models, middleware)
│   ├── config/      # Configuration loading
│   ├── handler/     # HTTP handlers
│   ├── middleware/   # Auth, logging, rate-limiting, RBAC
│   ├── model/       # Domain models
│   ├── repository/  # Database queries
│   ├── router/      # Route definitions
│   ├── service/     # Business logic
│   ├── storage/     # Local / S3 storage backends
│   └── transcoder/  # FFmpeg worker pool
├── web/             # Next.js frontend
├── deployments/     # Docker, Nginx, Prometheus, Grafana
└── Docs/            # Documentation site
```

## Coding Standards

### Go (Backend)

- Follow the [Effective Go](https://go.dev/doc/effective_go) guidelines.
- Use `gofmt` and `go vet` before committing.
- Write table-driven tests where applicable.
- Keep handlers thin — business logic belongs in `service/`.
- Use structured logging via `zerolog`.
- All new endpoints must include middleware for authentication and authorization.

### TypeScript / React (Frontend)

- Follow the existing ESLint and Prettier configuration.
- Use functional components with hooks.
- Use `bun` as the package manager (not npm or yarn).
- Keep components small and focused.
- Co-locate component-specific types and helpers.
- Run `bun run lint` before committing.

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`,
`ci`, `chore`, `revert`

**Examples**:

```
feat(transcoder): add HLS output support
fix(auth): resolve token refresh race condition
docs(readme): update development setup instructions
```

### Branch Naming

```
feat/short-description
fix/short-description
docs/short-description
chore/short-description
```

## Database Migrations

Migrations live in `internal/database/migrations/` and are numbered sequentially:

```
00001_initial_schema.sql
00002_add_presets_table.sql
...
```

When adding a migration:

1. Create a new file with the next sequence number.
2. Write idempotent SQL (`IF NOT EXISTS`, `IF EXISTS`).
3. Test the migration against a fresh database.

## Testing

### Backend

```bash
go test ./...
```

### Frontend

```bash
cd web
bun run lint
bun run build
```

## Pull Request Checklist

Before submitting your PR, please confirm:

- [ ] Code compiles and runs without errors
- [ ] Tests pass (`go test ./...` and `bun run lint`)
- [ ] Commit messages follow Conventional Commits
- [ ] Documentation is updated if applicable
- [ ] No secrets, credentials, or API keys are committed
- [ ] Database migrations are idempotent

## License

By contributing to GoMPP, you agree that your contributions will be licensed
under the same license as the project.

## Questions?

If you have questions about contributing, feel free to open a
[Discussion](https://github.com/gompp/gompp/discussions) or reach out at
**<ardeanbimasaputra@gmail.com>**.
