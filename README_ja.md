# UnityHub CLI

[English version](README.md)

Unity Hubと同じ内容をInkベースのTUIで表示し、上下キー/`j`/`k`でプロジェクトを選択して`o`でUnity Editorを起動するCLIです。
<img width="1678" height="1460" alt="スクリーンショット 2025-10-27 23 44 40" src="https://github.com/user-attachments/assets/f880f5ba-4334-46a6-ac59-1ea5611213b8" />


## 必要環境

- macOS または Windows 10/11
- Node.js 20+
- Unity Hub
  - macOS: `~/Library/Application Support/UnityHub/projects-v1.json`
  - Windows: `%APPDATA%\\UnityHub\\projects-v1.json`
  - WindowsのEditor既定パス: `C:\\Program Files\\Unity\\Hub\\Editor\\<version>\\Editor\\Unity.exe`

## 使い方

### 開発

```bash
npm install
npm run dev
```

### ビルド

```bash
npm run build
```

### 実行

ビルド後、`dist/index.js` が生成されます。npx経由で直接実行も可能です。

```bash
npx unity-hub-cli
# または
node dist/index.js
```

Windowsでは PowerShell / CMD で動作します。Git Bash は ConPTY ベースのターミナル（Windows Terminal / VS Code・Cursor の統合ターミナル）内であれば動作します。スタンドアロンの Git Bash（MinTTY）では Raw mode が非対応のため、PowerShell / CMD / Windows Terminal をお使いください。どうしても Git Bash（MinTTY）を使う場合は、次のいずれかを利用できます：

- `winpty cmd.exe /c npx unity-hub-cli`
- `winpty powershell.exe -NoProfile -Command npx unity-hub-cli`
- （ビルド済みの場合）`npm run build && winpty node dist/index.js`

参考: `https://github.com/vadimdemedes/ink/#israwmodesupported`。

利用可能な場合、デフォルトでGitリポジトリのルートフォルダ名を使って一覧を表示します。

### 起動オプション

- `--no-git-root-name`: Gitルートフォルダ名ではなくUnityプロジェクト名を表示します。
- `--hide-branch`: Gitブランチ列を非表示にします。
- `--hide-path`: プロジェクトパスを非表示にします。

## Release Automation

release-please と GitHub Actions でバージョン/リリース管理を自動化しています。

- `main` への push または手動トリガーで `.github/workflows/release-please.yml` が実行される
- アクションは `release-please-config.json` と `.release-please-manifest.json` を参照し、リリース PR の作成やタグ付けを行う
- PR がマージされると GitHub Releases と changelog の更新が行われる
- **npm への公開は provenance 付きで自動化されています**（サプライチェーン攻撃対策）

### 初回実行時のメモ

- 既存リリースがある場合は `release-please-config.json` の `bootstrap-sha` に最新リリースコミットを設定する
- ワークフローは GitHub が付与する `GITHUB_TOKEN` を利用し、`contents`/`pull-requests` 権限で動作する

### 手動実行

Actions タブから `release-please` ワークフローを選び、`Run workflow` で手動起動できる

## セキュリティ

このパッケージは、サプライチェーン攻撃から保護するために複数のセキュリティ対策を実装しています：

1. **Provenance 付き自動公開**: すべての npm リリースは GitHub Actions 経由で `--provenance` フラグ付きで公開され、ビルド環境の暗号学的証明を提供します
2. **最小限の依存関係**: ランタイム依存は 2 つのみ（`ink` と `react`）で、いずれも信頼性の高いソースからのものです
3. **依存関係の固定**: `package-lock.json` をコミットすることで、再現可能なビルドを保証します
4. **定期的なセキュリティ監査**: 依存関係は `npm audit` で定期的にチェックされます

### パッケージの真正性検証

公開されたパッケージの真正性を検証できます：

```bash
# provenance 情報の確認
npm view unity-hub-cli --json | jq .dist.attestations

# パッケージ整合性の検証
npm audit signatures
```

## 操作方法

- 上下矢印 / `j` / `k`: 選択移動
 - `o`: 選択中のプロジェクトをUnityで起動
- Ctrl + C（2回）: 終了

表示内容にはGitブランチ（存在する場合）、Unityバージョン、プロジェクトパス、最終更新日時（`lastModified`）が含まれます。

## ライセンス

MIT
