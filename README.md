# Foundry Agent Frontend Sample

Azure AI Foundry Agent Service と Azure Static Web Apps を組み合わせて、AI エージェントとチャットできる最小構成のフロントエンドサンプルです。

レトロピクセル × 夕焼けの世界観で、CRTモニター風の入力欄と、ふきだし型のメッセージ表示でやり取りします。

## 構成

```
ブラウザ ── /api/chat ── SWA Managed Functions ── Foundry Agent Service
  React           Node.js                  ↑
                  Service Principal で Entra ID トークン取得
```

- **フロント**: React 18 + Vite + Framer Motion（アニメーション）
- **API中継**: Static Web Apps の Managed Functions（Node.js 20）
- **認証**: Service Principal（クライアント資格情報フロー）→ Entra ID Bearer トークン
- **AI**: Azure AI Foundry Agent Service（File Search で文書を RAG）

シークレットはサーバ側（Functions）にのみ保存され、ブラウザには露出しません。

> **重要**: Foundry Agent Service は API キー認証をサポートしません（[公式マトリクス](https://learn.microsoft.com/azure/foundry/concepts/authentication-authorization-foundry#feature-support-matrix)）。Entra ID 必須のため、本サンプルは Service Principal を使います。

---

## デプロイ手順

### 1. Entra ID でアプリ登録を作成

Azure Portal → Microsoft Entra ID → アプリの登録 → 新規登録。
登録後に表示される **アプリケーション (クライアント) ID** と **ディレクトリ (テナント) ID** をメモ。

### 2. クライアントシークレットを発行

同アプリ画面 → 「証明書とシークレット」 → 新しいクライアントシークレット。
表示された「**値**」をコピー（画面を離れると見えなくなる）。

### 3. Foundry プロジェクトにロール付与

Foundry プロジェクト（Cognitive Services account の配下） → アクセス制御 (IAM) → ロールの割り当ての追加。
ロール: **Azure AI User**、メンバー: 上で作ったアプリ登録を選択。

### 4. リポジトリを GitHub にアップロード

このリポジトリ全体を自分の GitHub アカウントの新しいリポジトリにアップロードします。

### 5. Static Web Apps を作成

Azure Portal で「Static Web Apps」リソースを作成し、以下を設定します。

| 項目 | 値 |
|---|---|
| プラン | Free |
| デプロイソース | GitHub |
| リポジトリ | 自分のリポジトリ |
| ブランチ | `main` |
| ビルドプリセット | カスタム |
| アプリの場所 | `/` |
| API の場所 | `api` |
| 出力先 | `dist` |

### 6. SWA の環境変数を設定

SWA リソースの「環境変数」から以下を追加します。

| 名前 | 値 |
|---|---|
| `FOUNDRY_ENDPOINT` | `https://<account>.services.ai.azure.com/api/projects/<project>` |
| `FOUNDRY_AGENT_ID` | エージェントの ID（`asst_xxx` 形式）または名前 |
| `AZURE_TENANT_ID` | Step 1 でメモしたディレクトリ ID |
| `AZURE_CLIENT_ID` | Step 1 でメモしたアプリケーション ID |
| `AZURE_CLIENT_SECRET` | Step 2 でコピーしたシークレットの「値」 |

### 7. 動作確認

GitHub Actions のデプロイ完了後、SWA リソースの URL（`https://<random>.azurestaticapps.net`）にアクセス。
質問を送ってエージェントが回答すれば成功です。

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
- 不特定多数の悪用による課金リスクを下げるため、Foundry プロジェクト側でコスト予算アラート（数百円〜数千円）を設定してください。
- 会話履歴は `threadId` をブラウザ側で保持する形になっています。タブを閉じるとリセットされます。
- クライアントシークレットには有効期限があります。期限切れ前に再発行して環境変数を更新してください。

---

## ライセンス

MIT
