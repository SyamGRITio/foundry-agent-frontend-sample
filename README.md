# Foundry Agent Frontend Sample

Azure AI Foundry Agent Service と Azure Static Web Apps を組み合わせて、AI エージェントとチャットできる最小構成のフロントエンドサンプルです。

レトロピクセル × 夕焼けの世界観で、CRTモニター風の入力欄と、ふきだし型のメッセージ表示でやり取りします。

## 構成

```
ブラウザ ── /api/chat ── SWA Managed Functions ── Foundry Agent Service
  React           Node.js
```

- **フロント**: React 18 + Vite + Framer Motion（アニメーション）
- **API中継**: Static Web Apps の Managed Functions（Node.js 20）
- **AI**: Azure AI Foundry Agent Service（File Search で社内/家族文書を RAG）

APIキーはサーバ側（Functions）にのみ保存され、ブラウザには露出しません。

---

## 必要なもの

| # | 項目 | 入手方法 |
|---|---|---|
| 1 | Azure サブスクリプション | <https://azure.microsoft.com/free/> |
| 2 | Foundry プロジェクト＋エージェント | Foundry portal で作成 |
| 3 | GitHub アカウント | このリポジトリの fork 元 |

---

## デプロイ手順

### 1. リポジトリを fork（または clone してコピー）

このリポジトリ全体を自分の GitHub アカウントの新しいリポジトリにアップロードします。

### 2. Static Web Apps を作成

Azure Portal で「Static Web Apps」リソースを作成し、以下を設定します。

| 項目 | 値 |
|---|---|
| プラン | Free |
| デプロイソース | GitHub |
| リポジトリ | 自分のリポジトリ |
| ブランチ | `main` |
| ビルドプリセット | **カスタム** |
| アプリの場所 | `/` |
| API の場所 | `api` |
| 出力先 | `dist` |

作成すると GitHub Actions ワークフローが自動生成され、push のたびに自動デプロイされます。

### 3. 環境変数を設定

Azure Portal で作成した SWA リソースの「環境変数」（または「構成」）から以下を追加します。

| 名前 | 値 |
|---|---|
| `FOUNDRY_ENDPOINT` | プロジェクトエンドポイント URL（`https://<account>.services.ai.azure.com/api/projects/<project>`） |
| `FOUNDRY_AGENT_ID` | エージェントの ID（`asst_xxx` 形式）または名前 |
| `FOUNDRY_API_KEY` | プロジェクトの API キー |

設定後、SWAを再起動するか、もう一度ワークフローを動かしてください。

### 4. アクセス

SWA リソースの URL（`https://<random>.azurestaticapps.net`）にアクセスすればチャットできます。

---

## ローカル開発（任意）

ローカルで動かす場合は Azure Functions Core Tools と Static Web Apps CLI が必要です。

```bash
# 依存インストール
npm install
cd api && npm install && cd ..

# 環境変数を api/local.settings.json に設定（リポジトリにコミットしないこと）
# {
#   "IsEncrypted": false,
#   "Values": {
#     "AzureWebJobsStorage": "",
#     "FUNCTIONS_WORKER_RUNTIME": "node",
#     "FOUNDRY_ENDPOINT": "...",
#     "FOUNDRY_AGENT_ID": "...",
#     "FOUNDRY_API_KEY": "..."
#   }
# }

# SWA エミュレータ起動（フロント＋APIを同時に）
npx @azure/static-web-apps-cli start http://localhost:5173 --api-location api --run "npm run dev"
```

---

## カスタマイズのヒント

### 色を変える

`src/index.css` の `:root` にある CSS 変数を書き換えると、夕焼けのグラデーションや CRT の発色が変わります。

### CRT に表示するコマンド文字列を変える

`src/components/Desk.jsx` の `crt-prompt` の中身を編集してください。

### エージェントを差し替える

SWA の `FOUNDRY_AGENT_ID` を別のエージェントの ID に変えるだけで OK です。コードの変更は不要です。

---

## 注意事項

- このサンプルは認証なしで動きます。本番では Static Web Apps のロールベースアクセス制御（Entra ID 連携など）を追加することを推奨します。
- 会話履歴は `threadId` をブラウザ側で保持する形になっています。タブを閉じるとリセットされます。永続化したい場合は、ブラウザストレージや Cosmos DB 等に保存してください。
- Foundry のレート制限・課金額にご注意ください。File Search はインデックス保存料がかかります。

---

## ライセンス

MIT
