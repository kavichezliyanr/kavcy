## Summary
Describe what this pull request changes and why.

## Security & Verification Checklist
- [ ] `npm run test:crypto` passes (ML-KEM-768 + AES-256-GCM round-trip & tamper test)
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] No plaintext user data is persisted unencrypted or sent to external origins without explicit user opt-in
- [ ] Tested on desktop and mobile/iPad viewport widths
