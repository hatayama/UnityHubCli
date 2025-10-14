# UnityHub CLI

Unity Hubの`projects-v1.json`を読み取り、InkベースのTUIで一覧表示し、上下キー/`j`/`k`でプロジェクトを選択してEnterでUnity Editorを起動するCLIです。

## 必要環境

- macOS
- Node.js 20+
- Unity Hub（`~/Library/Application Support/UnityHub/projects-v1.json`が存在すること）

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
npx unityhubcli
# または
node dist/index.js
```

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

### 初回実行時のメモ

- 既存リリースがある場合は `release-please-config.json` の `bootstrap-sha` に最新リリースコミットを設定する
- ワークフローは GitHub が付与する `GITHUB_TOKEN` を利用し、`contents`/`pull-requests` 権限で動作する

### 手動実行

Actions タブから `release-please` ワークフローを選び、`Run workflow` で手動起動できる

## 操作方法

- 上下矢印 / `j` / `k`: 選択移動
- Enter: 選択中のプロジェクトをUnityで起動
- Ctrl + C（2回）: 終了

表示内容にはGitブランチ（存在する場合）、Unityバージョン、プロジェクトパス、最終更新日時（`lastModified`）が含まれます。

## ライセンス

MIT
