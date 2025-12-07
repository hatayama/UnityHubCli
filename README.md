# UnityHub CLI

[日本語版はこちら / Japanese version](README_ja.md)

A CLI tool that displays the same content as Unity Hub in an Ink-based TUI, allows navigation with arrow keys/`j`/`k`, and launches Unity Editor by pressing `o`.

<img width="1678" height="1460" alt="Screenshot 2025-10-27 23 44 40" src="https://github.com/user-attachments/assets/db3cc995-820e-490b-a43b-393893197ab4" />

## Requirements

- macOS or Windows 10/11
- Node.js 20+

## Installation & Run

```bash
npx unity-hub-cli
```

Or install globally to use the `unity-hub-cli` command directly:

```bash
npm install -g unity-hub-cli
unity-hub-cli
```

<details>
<summary>Notes for Windows</summary>

Works from PowerShell and CMD. Git Bash is supported when running inside a ConPTY-based terminal (Windows Terminal or VS Code/Cursor integrated terminal).

On standalone Git Bash (MinTTY), raw mode is not supported; use PowerShell/CMD/Windows Terminal. If you must use MinTTY Git Bash, run one of the following:

- `winpty cmd.exe /c npx unity-hub-cli`
- `winpty powershell.exe -NoProfile -Command npx unity-hub-cli`

</details>

## Controls

| Key | Action |
|-----|--------|
| `↑` / `↓` / `j` / `k` | Navigate selection |
| `o` | Launch selected project in Unity |
| `O` (Shift+O) | Launch Unity + external editor (e.g., Rider) |
| `i` | Launch external editor only |
| `q` | Quit Unity for selected project |
| `r` | Refresh project list |
| `c` | Copy project path to clipboard |
| `s` | Open sort settings panel |
| `v` | Open visibility settings panel |
| `Ctrl + C` | Exit |

In settings panels, use `j`/`k` to navigate, `Space` to toggle, and `Esc` to close.

The display includes Git branch (if present), Unity version, project path, and last modified time. By default, the project list uses the Git repository root folder name when available.

## CLI Options

- `--no-git-root-name`: Display Unity project titles instead of Git repository root folder names.
- `--shell-init`: Install shell function for automatic `cd` integration (with confirmation prompt).
- `--shell-init --dry-run`: Preview the shell function without installing.

## Shell Integration

You can add a shell function to automatically `cd` to the project directory after opening Unity.

### Setup

1. Install globally:
```bash
npm install -g unity-hub-cli
```

2. Run the shell init command (auto-detects your shell):
```bash
unity-hub-cli --shell-init
```

This automatically adds the `unity-hub` function to your shell config file (`.zshrc`, `.bashrc`, `config.fish`, or PowerShell profile).

3. Reload your shell:
```bash
source ~/.zshrc  # or restart your terminal
```

### Usage

Now you can use `unity-hub` to:
1. Browse and select Unity projects
2. Press `o` to launch Unity
3. Your terminal automatically `cd`s to the project directory

### Notes

- Running `--shell-init` multiple times is safe - it updates the existing function using marker comments
- The function uses absolute paths detected from your environment
- **Windows**: Shell integration supports PowerShell only. CMD is not supported because it lacks shell functions required for automatic `cd` after launching Unity

## Security

This project implements supply chain attack prevention measures:

- **ignore-scripts**: Disables automatic script execution during `npm install`
- **@lavamoat/allow-scripts**: Explicitly controls which packages can run install scripts
- **Dependabot**: Automated weekly security updates
- **Security audit CI**: Runs `npm audit`, `lockfile-lint`, and OSV-Scanner on every PR
- **Pinned versions**: All dependencies use exact versions (no `^` or `~`)

## License

MIT
