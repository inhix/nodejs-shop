# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report privately through GitHub: **Security** tab → **Report a vulnerability**
(<https://github.com/inhix/nodejs-shop/security/advisories/new>). Include what you found,
how to reproduce it, and the impact you expect. You will get a reply within a few days.

## Supported versions

Only the `main` branch is supported. There are no released versions yet.

## How this repository is checked

- CodeQL scans the code on every pull request and weekly.
- Trivy scans the API container image on every pull request and weekly.
- Dependency review blocks pull requests that add vulnerable or strong-copyleft dependencies.
- Renovate keeps dependencies current; only versions at least 7 days old are installed.
- Secret scanning with push protection is enabled; GitHub Actions are pinned by commit SHA.
