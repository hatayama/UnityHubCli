# UnityHub CLI

[English version](README.md)

Unity Hubと同じ内容をInkベースのTUIで表示し、上下キー/`j`/`k`でプロジェクトを選択して`o`でUnity Editorを起動するCLIです。

<img width="1678" height="1460" alt="スクリーンショット 2025-10-27 23 44 40" src="https://github.com/user-attachments/assets/f880f5ba-4334-46a6-ac59-1ea5611213b8" />

## 必要環境

- macOS または Windows 10/11
- Node.js 20+

## インストール・実行

```bash
npx unity-hub-cli
```

または、グローバルインストールすると `unity-hub-cli` コマンドで直接起動できます：

```bash
npm install -g unity-hub-cli
unity-hub-cli
```

<details>
<summary>Windowsでの注意事項</summary>

PowerShell / CMD で動作します。Git Bash は ConPTY ベースのターミナル（Windows Terminal / VS Code・Cursor の統合ターミナル）内であれば動作します。

スタンドアロンの Git Bash（MinTTY）では Raw mode が非対応のため、PowerShell / CMD / Windows Terminal をお使いください。どうしても使う場合は以下のコマンドを利用できます：

- `winpty cmd.exe /c npx unity-hub-cli`
- `winpty powershell.exe -NoProfile -Command npx unity-hub-cli`

</details>

## 操作方法

| キー | 動作 |
|------|------|
| `↑` / `↓` / `j` / `k` | 選択移動 |
| `o` | 選択中のプロジェクトをUnityで起動 |
| `O` (Shift+O) | Unity + 外部エディタ（Rider等）を同時起動 |
| `i` | 外部エディタのみ起動 |
| `q` | 選択中のプロジェクトのUnityを終了 |
| `r` | プロジェクト一覧を更新 |
| `c` | プロジェクトパスをクリップボードにコピー |
| `s` | ソート設定パネルを開く |
| `v` | 表示設定パネルを開く |
| `Ctrl + C` | 終了 |

設定パネル内では `j`/`k` で移動、`Space` で切り替え、`Esc` で閉じます。

表示内容にはGitブランチ（存在する場合）、Unityバージョン、プロジェクトパス、最終更新日時が含まれます。利用可能な場合、デフォルトでGitリポジトリのルートフォルダ名を使って一覧を表示します。

## CLIオプション

- `--no-git-root-name`: Gitリポジトリのルートフォルダ名ではなく、Unityプロジェクトのタイトルを表示します
- `--output-path-on-exit`: 終了時に最後に開いたプロジェクトのパスを標準出力に出力します。シェル統合用。
- `--shell-init`: シェル統合用の関数を出力します（bash/zsh または fish 構文）。

## シェル統合

Unity起動後、自動的にそのプロジェクトディレクトリに `cd` するシェル関数を追加できます。

以下のコマンドでシェル設定に関数を追加：

```bash
# zsh の場合
npx unity-hub-cli --shell-init >> ~/.zshrc

# bash の場合
npx unity-hub-cli --shell-init >> ~/.bashrc

# fish の場合
npx unity-hub-cli --shell-init >> ~/.config/fish/config.fish
```

または、シェル設定に以下を手動で追加：

```bash
unity-hub() {
  local path
  path=$(npx unity-hub-cli --output-path-on-exit)
  if [ -n "$path" ]; then
    cd "$path"
  fi
}
```

関数名は自由に変更できます（例：`unity-hub`、`uhub`、`uh`）。

これで `unity-hub` 関数を使うと：
1. Unityプロジェクト一覧を表示・選択
2. `o` でUnityを起動
3. ターミナルがプロジェクトのディレクトリに自動で `cd` される

## セキュリティ

このプロジェクトはサプライチェーン攻撃対策を実装しています：

- **ignore-scripts**: `npm install` 時のスクリプト自動実行を無効化
- **Dependabot**: 週次の自動セキュリティアップデート
- **Security audit CI**: PR ごとに `npm audit` と `lockfile-lint` を実行
- **Pinned versions**: すべての依存関係で正確なバージョンを指定（`^` や `~` なし）

## ライセンス

MIT
