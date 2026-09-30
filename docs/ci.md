# CI & Branching for DiffSense

This document explains the CI split between the image/package workflow and the VSCode extension workflow, plus required secrets and validation steps.

Branches and responsibilities

- main / release/**
  - Runs `.github/workflows/diffsense-image.yml`.
  - Purpose: run tests, build Docker image (using `diffsense/Dockerfile.ci`), and optionally publish PyPI on tags.

- vscode-extension
  - Runs `.github/workflows/diffsense-vscode.yml`.
  - Purpose: build website assets and package/publish VSCode extension (VSIX) to Marketplace or upload VSIX artifacts.

Required repository secrets

- PYPI_API_TOKEN: (optional) token to publish package to PyPI. Required only if you enable automatic PyPI publishing.
- MARKETPLACE_PAT: (optional) VSCE / Marketplace Personal Access Token for publishing VSIX. Leave empty to skip auto-publish.
- GHCR_TOKEN or use repository permissions: credentials for pushing images to GitHub Container Registry. If using GitHub Actions default permissions with `packages: write`, explicit token may not be required.
- DIFFSENSE_TOKEN: token used by the tool for platform API calls during audit runs (if any CI steps run audits against repos).

Validation checklist (for PRs changing CI)

- [ ] Workflows linted (use act or GitHub actions workflow editor).
- [ ] Secrets configured in repository settings (if relevant to publishing steps).
- [ ] Tests pass in `test-and-build` job locally or via CI.
- [ ] Image push target (GHCR or Docker Hub) is reachable and repo permissions are set.

Notes

- The image workflow builds context from `diffsense/` and uses `Dockerfile.ci`. Adjust tags or registry settings if you prefer Docker Hub.
- The VSCode workflow expects a `vscode/` directory containing packaging scripts; if your extension lives elsewhere, update the job steps.