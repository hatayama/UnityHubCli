# UnityHub CLI

A CLI tool that reads Unity Hub's `projects-v1.json`, displays projects in an Ink-based TUI, allows navigation with arrow keys/`j`/`k`, and launches Unity Editor by pressing Enter.

## Requirements

- macOS
- Node.js 20+
- Unity Hub (with `~/Library/Application Support/UnityHub/projects-v1.json` present)

## Usage

### Development

```bash
npm install
npm run dev
```

### Build

```bash
npm run build
```

### Run

After building, `dist/index.js` will be generated. You can also run it directly via npx.

```bash
npx unity-hub-cli
# or
node dist/index.js
```

By default, the project list uses the Git repository root folder name when available.

### CLI Options

- `--no-git-root-name`: Display Unity project titles instead of Git repository root folder names.
- `--hide-branch`: Hide the Git branch column.
- `--hide-path`: Hide the project path column.

## Release Automation

Version and release management is automated using release-please and GitHub Actions.

- `.github/workflows/release-please.yml` runs on push to `main` or manual trigger
- The action references `release-please-config.json` and `.release-please-manifest.json` to create release PRs and tags
- When a PR is merged, GitHub Releases and changelog are automatically updated
- **npm publish is automated with provenance** for supply chain security

### Initial Setup Notes

- If existing releases are present, set the latest release commit in `bootstrap-sha` of `release-please-config.json`
- The workflow uses GitHub's `GITHUB_TOKEN` and operates with `contents`/`pull-requests` permissions

### Manual Execution

You can manually trigger the `release-please` workflow from the Actions tab by selecting `Run workflow`

## Security

This package implements multiple security measures to protect against supply chain attacks:

1. **Automated Publishing with Provenance**: All npm releases are published via GitHub Actions with `--provenance` flag, providing cryptographic proof of the build environment
2. **Minimal Dependencies**: Only 2 runtime dependencies (`ink` and `react`), both from highly trusted sources
3. **Locked Dependencies**: `package-lock.json` is committed to ensure reproducible builds
4. **Regular Security Audits**: Dependencies are regularly checked with `npm audit`

### Verifying Package Authenticity

You can verify the authenticity of published packages:

```bash
# Check provenance information
npm view unity-hub-cli --json | jq .dist.attestations

# Verify package integrity
npm audit signatures
```

## Controls

- Arrow keys / `j` / `k`: Navigate selection
- Enter: Launch selected project in Unity
- Ctrl + C (twice): Exit

The display includes Git branch (if present), Unity version, project path, and last modified time (`lastModified`).

## License

MIT
