# GoMPP — Web Frontend

The Next.js frontend for the GoMPP video transcoding platform.

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| [Next.js](https://nextjs.org) | 16.2 | App Router, SSR, API routes |
| [React](https://react.dev) | 19.2 | UI framework |
| [TypeScript](https://www.typescriptlang.org) | 6.0 | Type safety |
| [Tailwind CSS](https://tailwindcss.com) | 4.2 | Utility-first styling |
| [Radix UI](https://www.radix-ui.com) | 1.4 | Accessible primitives |
| [TanStack React Query](https://tanstack.com/query) | 5.x | Server state management |
| [React Hook Form](https://react-hook-form.com) + [Zod](https://zod.dev) | — | Form validation |
| [Recharts](https://recharts.org) | 3.8 | Dashboard charts |
| [Shaka Player](https://github.com/shaka-project/shaka-player) / [Vidstack](https://vidstack.io) | — | Video playback (HLS/DASH) |
| [i18next](https://www.i18next.com) | 26.x | Internationalisation (5 languages) |
| [next-themes](https://github.com/pacocoursey/next-themes) | 0.4 | Light / dark / system themes |
| [Bun](https://bun.sh) | — | Package manager & build tooling |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (latest)
- GoMPP API server running (default `http://localhost:8080`)

### Install & Run

```bash
# Install dependencies
bun install

# Start development server (Turbopack)
bun dev
```

The app runs at **<http://localhost:3000>**.

### Environment Variables

Create a `.env.local` in this directory:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
# NEXT_PUBLIC_BASE_PATH=            # Optional: for sub-path deployments
# RECAPTCHA_SECRET_KEY=             # Optional: Google reCAPTCHA v2 secret
```

## Project Structure

```
web/
├── app/
│   ├── layout.tsx              # Root layout (providers, fonts, toasts)
│   ├── (auth)/                 # Auth pages — signin, signup, reset-password
│   ├── (landing)/              # Public marketing homepage
│   ├── (protected)/            # Dashboard (requires auth)
│   │   ├── analytics/          # Stats, charts, traffic overview
│   │   ├── library/            # Video management & player
│   │   ├── settings/           # System settings (admin only)
│   │   ├── account/            # Profile, sessions, passkeys
│   │   ├── users/              # User management (admin only)
│   │   └── presets/            # Encoding preset management
│   ├── watch/                  # Public video watch page
│   └── api/                    # Next.js API routes
├── components/
│   ├── ui/                     # 80+ reusable UI components
│   └── layouts/                # Page layout wrappers
├── config/                     # App config, menu items, types
├── hooks/                      # Custom React hooks
├── i18n/                       # i18next setup & message files
├── lib/                        # API client, helpers, utilities
├── providers/                  # React Context providers
├── public/media/               # Static assets
└── styles/                     # Global CSS & theme overrides
```

## Architecture

### Providers

The root layout wraps the app in a nested provider stack:

```
QueryProvider → AuthProvider → ThemeProvider → SettingsProvider → TooltipProvider → ThemeColorApplier
```

| Provider | Purpose |
|---|---|
| **QueryProvider** | TanStack React Query — caching, retries, global error toasts |
| **AuthProvider** | JWT token storage, automatic refresh, multi-method login |
| **ThemeProvider** | Light / dark / system mode via next-themes |
| **SettingsProvider** | UI preferences (sidebar, locale) persisted in localStorage |
| **ThemeColorApplier** | Fetches branding from the API and applies CSS custom properties |

### API Client

All backend communication uses a single `apiClient<T>()` function (`lib/api.ts`):

- Prepends `NEXT_PUBLIC_API_URL` to paths
- Attaches `Authorization: Bearer {token}` from localStorage
- Auto-retries on 401 with a single token refresh attempt
- Detects `FormData` and lets the browser set multipart boundaries

### Services

Each domain has a service file exporting React Query hooks:

| Service | Key Hooks |
|---|---|
| `videos` | `useVideos`, `useVideo`, `useUploadVideo`, `useRetranscodeVideo` |
| `analytics` | `useAnalyticsOverview`, `useTopVideos`, `useBandwidth` |
| `account` | `useAccountSessions`, `useUploadAvatar`, `usePasskeys` |
| `settings` | `useSystemSettings`, `useBulkUpdateSettings` |
| `users` | `useUsers`, `useCreateUser`, `useUpdateUser` |
| `presets` | `usePresets`, `useCreatePreset`, `useUpdatePreset` |
| `subtitles` | `useSubtitles`, `useUploadSubtitle`, `useSearchSubtitles` |
| `webhooks` | `useWebhooks`, `useCreateWebhook`, `useDeleteWebhook` |

### Internationalisation

5 languages supported: **English**, **Arabic** (RTL), **Spanish**, **German**, **Chinese**.

Language is detected from the browser and persisted in localStorage. Arabic triggers automatic RTL layout switching.

## Scripts

| Command | Description |
|---|---|
| `bun dev` | Start dev server with Turbopack |
| `bun run build` | Production build |
| `bun start` | Start production server |
| `bun run lint` | Run ESLint |
| `bun run format` | Format with Prettier |

## Key Patterns

- **Protected routes** — `AuthGuard` redirects to `/signin` if unauthenticated
- **Admin routes** — `AdminGuard` checks `user.role === 'admin'`
- **Forms** — React Hook Form + Zod schema validation
- **Mutations** — TanStack React Query with automatic cache invalidation
- **Error handling** — Global Sonner toasts + inline field errors
- **Theming** — Dynamic CSS custom properties from database system settings

## Learn More

- [Full Documentation](https://docs.gompp.net)
- [API Reference](https://docs.gompp.net/docs/api-reference)
- [Deployment Guide](https://docs.gompp.net/docs/deployment)
