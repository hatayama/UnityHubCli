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
- `--output-path-on-exit`: Output the last opened project path to stdout when exiting. Used for shell integration.
- `--shell-init`: Output shell function for integration (bash/zsh, fish, or PowerShell syntax).

## Shell Integration

You can add a shell function to automatically `cd` to the project directory after opening Unity.

Run the following command to add the function to your shell config:

```bash
# For zsh
npx unity-hub-cli --shell-init >> ~/.zshrc

# For bash
npx unity-hub-cli --shell-init >> ~/.bashrc

# For fish
npx unity-hub-cli --shell-init >> ~/.config/fish/config.fish

# For PowerShell
npx unity-hub-cli --shell-init >> $PROFILE
```

Or manually add the following to your shell config:

```bash
unity-hub() {
  local path
  path=$(npx unity-hub-cli --output-path-on-exit)
  if [ -n "$path" ]; then
    cd "$path"
  fi
}
```

The function name can be anything you like (e.g., `unity-hub`, `uhub`, `uh`).

Now you can use `unity-hub` to:
1. Browse and select Unity projects
2. Press `o` to launch Unity
3. Your terminal automatically `cd`s to the project directory

## Security

This project implements supply chain attack prevention measures:

- **ignore-scripts**: Disables automatic script execution during `npm install`
- **@lavamoat/allow-scripts**: Explicitly controls which packages can run install scripts
- **Dependabot**: Automated weekly security updates
- **Security audit CI**: Runs `npm audit`, `lockfile-lint`, and OSV-Scanner on every PR
- **Pinned versions**: All dependencies use exact versions (no `^` or `~`)

## License

MIT
