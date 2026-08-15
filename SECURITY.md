# Security Policy

## Sensitive Files

The following files in this repository contain credentials or secrets and must **never** be committed to version control:

- `.env`
- `service-account.json`
- `firebase-applet-config.json` (contains public Firebase config, but should still be reviewed before sharing)

## Local Development

- Copy `.env.example` to `.env` and fill in real values locally.
- Place Firebase Admin SDK credentials at `service-account.json` **outside** this repository whenever possible, or ensure the file is excluded by `.gitignore`.
- Never share or commit these files.

## Production

- Inject secrets via environment variables or a secret manager.
- Do not ship `service-account.json` with the application artifact.

## Incident Response

If any of these files are accidentally committed:
1. Rotate the exposed key/secret immediately.
2. Remove the file from git history (e.g. `git filter-repo` or BFG).
3. Audit access logs for misuse.
