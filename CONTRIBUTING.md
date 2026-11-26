# Contributing to Kavcy

Thank you for helping make private, post-quantum personal AI accessible to everyone.

## Development Setup

```bash
git clone https://github.com/kavichezliyanr/kavcy.git
cd kavcy
npm install
npm run dev
```

- Web App: `http://localhost:5173/`
- Landing Page: `http://localhost:5173/landing.html`

## Required Verification Before Opening a PR

```bash
npm run test:crypto
npm run build
```

1. All cryptographic tests (`ML-KEM-768 + AES-256-GCM` round-trip and 1-bit tamper rejection) must pass.
2. TypeScript compilation (`tsc --noEmit`) and production build (`vite build`) must succeed with zero errors.
3. No plaintext user data, telemetry beacons, or external third-party scripts may be introduced.

## Commit Conventions (Automatic Semantic Versioning)
Kavcy uses Conventional Commits to drive automatic semantic releases on `main`:

- `fix: ...` → Patch release (`v1.0.1`)
- `feat: ...` → Minor release (`v1.1.0`)
- `feat!: ...` or `BREAKING CHANGE:` in commit body → Major release (`v2.0.0`)
- `docs: ...` / `chore: ...` → Patch release or documentation update

## Security Vulnerabilities
Please do **not** open a public GitHub issue for security vulnerabilities. Follow the disclosure instructions in [SECURITY.md](./SECURITY.md).
