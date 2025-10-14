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

### Initial Setup Notes

- If existing releases are present, set the latest release commit in `bootstrap-sha` of `release-please-config.json`
- The workflow uses GitHub's `GITHUB_TOKEN` and operates with `contents`/`pull-requests` permissions

### Manual Execution

You can manually trigger the `release-please` workflow from the Actions tab by selecting `Run workflow`

## Controls

- Arrow keys / `j` / `k`: Navigate selection
- Enter: Launch selected project in Unity
- Ctrl + C (twice): Exit

The display includes Git branch (if present), Unity version, project path, and last modified time (`lastModified`).

## License

MIT
