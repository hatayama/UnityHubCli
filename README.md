# UnityHub CLI

[日本語版はこちら / Japanese version](README_ja.md)

A CLI tool that displays the same content as Unity Hub in an Ink-based TUI, allows navigation with arrow keys/`j`/`k`, and launches Unity Editor by pressing `o`.

<img width="1678" height="1460" alt="スクリーンショット 2025-10-27 23 44 40" src="https://github.com/user-attachments/assets/db3cc995-820e-490b-a43b-393893197ab4" />

## Requirements

- macOS or Windows 10/11
- Node.js 20+
- Unity Hub
  - macOS: `~/Library/Application Support/UnityHub/projects-v1.json`
  - Windows: `%APPDATA%\UnityHub\projects-v1.json`
  - Windows Editor path (default): `C:\\Program Files\\Unity\\Hub\\Editor\\<version>\\Editor\\Unity.exe`

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

On Windows, it works from PowerShell and CMD. Git Bash is supported when running inside a ConPTY-based terminal (Windows Terminal or VS Code/Cursor integrated terminal). On standalone Git Bash (MinTTY), raw mode is not supported; use PowerShell/CMD/Windows Terminal. If you must use MinTTY Git Bash, run one of the following:

- `winpty cmd.exe /c npx unity-hub-cli`
- `winpty powershell.exe -NoProfile -Command npx unity-hub-cli`
- If already built: `npm run build && winpty node dist/index.js`

See `https://github.com/vadimdemedes/ink/#israwmodesupported`.

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
- `o`: Launch selected project in Unity
- Ctrl + C (twice): Exit

The display includes Git branch (if present), Unity version, project path, and last modified time (`lastModified`).

## License

MIT
