# scroll-world

[English](./README.md) | [简体中文](./README.zh-CN.md) | [日本語](./README.ja.md)

https://github.com/user-attachments/assets/b08e641e-985b-4bd4-83ff-6750272d0c37


Claude Code、Codex、および `SKILL.md` に対応するあらゆるエージェント向けのスキルです。業界やブランドを問わず、没入感のある、スクロール連動でスクラブ再生される「世界を飛び抜ける」ランディングページを構築します。スクロールすると、カメラは各シーンの外側から内部へ飛び込み、カットを挟まずに次のシーンへ流れていきます。生成された小さな世界を、ひと続きの飛行で巡ります（Emons の物流サイトの演出を、好きなテーマに応用するイメージです）。

## インストール

### Claude Code — プラグインとして（推奨）

```
/plugin marketplace add oso95/scroll-world
/plugin install scroll-world@scroll-world
```

あとは、スクロールで世界を巡るランディングページを依頼するか、`/scroll-world` を実行するだけです。

### Codex とその他のエージェント — skills CLI 経由

[Vercel の skills CLI](https://github.com/vercel-labs/skills) を使用します。Codex、Claude Code、Cursor、および 20 種類以上のエージェントにインストールできます。

```bash
npx skills add oso95/scroll-world            # pick your agent(s) when prompted
npx skills add oso95/scroll-world -a codex   # or target Codex directly
```

Codex では `$scroll-world` で実行します（`/skills` から探すこともできます）。または、スクロールで世界を巡るランディングページを作るよう、そのまま依頼してください。

### 手動（ドロップインスキル）

スキルフォルダーをエージェントのスキルディレクトリへコピーします。

```bash
git clone https://github.com/oso95/scroll-world
cp -R scroll-world/skills/scroll-world ~/.claude/skills/   # Claude Code
cp -R scroll-world/skills/scroll-world ~/.codex/skills/    # Codex
```

## 必要なもの

- 認証済み（`higgsfield auth login`）で、利用可能なクレジットがある [Higgsfield CLI](https://higgsfield.ai)。
- フレーム抽出とエンコードに使用する `ffmpeg` / `ffprobe`。
- Pillow をインストールした Python 3（モバイル向け縦長キャンバス、および任意の透過シーン背景抜きに使用）。
- [Codex CLI](https://github.com/openai/codex)（任意）— インストールされている場合、シーンの静止画は Codex 内蔵の `image_gen`（同じ GPT Image モデル）でも生成できます。Higgsfield クレジットの代わりに ChatGPT サブスクリプションへ課金されます。

## 機能

[Higgsfield](https://higgsfield.ai) を使って、統一感のあるアイソメトリックなジオラマシーン（Higgsfield、または ChatGPT サブスクリプション上の Codex CLI を介した GPT Image 2）と、カメラの飛行映像（Seedance または Kling の image-to-video。継ぎ目のフレームを固定できるモデルのみ）を制作し、スクロール位置に応じてスクラブ再生します。Apple のスクロール連動型製品ページと同じ手法です。カメラは実際に移動し、スクロールは時間だけを制御します。**フレームワークには依存しません**。Higgsfield パイプライン、プロンプトテンプレート、移植可能な Vanilla JavaScript のスクラブエンジンが提供され、プレーン HTML、Next.js、Vue、Python で配信するページのいずれにも組み込めます。特定の技術スタックは前提としていません。

実行すると、このスキルは次の処理を行います。

1. **ヒアリング** — 題材や業界と訴求内容、ブランドキット（URL からの取り込み、手渡し、または提案）、アートディレクション、カメラが順番に訪れるシーン、**モバイル版**が必要かどうか（横長映像を切り抜くのではなく、スマートフォン向けに 9:16 の縦長で構成した第 2 のシーケンスをネイティブレンダリング）、そして**予算**を確認します。レンダリングの各プランと静止画の生成元を推定クレジット費用とともに提示し、何かを生成する前に承認を得ます。
2. **アセット生成** — 各シーンにつき 1 枚の静止画と 1 本の「飛び込み」カメラクリップを生成します。さらに、隣接するシーンで実際にレンダリングされたフレームから、連続するシーンをつなぐ接続クリップを生成し、すべての継ぎ目でフレームを完全に一致させます。モバイル版を有効にした場合も、独自の 9:16 レンダリング結果に対してフレームを固定し、同じ方法で縦長シーケンスを並行生成します。
3. **組み込み** — 設定駆動のスクロールエンジンでシーケンス全体をひと続きの飛行として再生し、スマートフォンでは縦長クリップとポスター画像を自動的に配信します。

## スキルの内容

```
skills/scroll-world/
├── SKILL.md                    the procedure + the seam rule + gotchas
└── references/
    ├── prompts.md              intake checklist + every Higgsfield prompt template
    ├── pipeline.md             copy-paste batch scripts (generate → frames → connectors → encode)
    ├── scrub-engine.js         portable, config-driven scrub engine (blob-seek, lazy load, seam crossfade)
    ├── index-template.html     a minimal standalone page that mounts the engine
    └── knockout.py             background knockout for floating scenes
```

## 注意事項

- アセット生成には Higgsfield クレジットが必要です（N 個のシーンに対して、画像生成は約 N 回、動画生成は約 2N-1 回。モバイル用シーケンスを追加すると動画生成回数は 2 倍になります）。また、完了まで時間がかかるため、スキルはバックグラウンドで生成を実行し、状態をポーリングします。CLI では生成 1 回ごとの料金が公開されていないため、スキルは現在の残高から費用を算出し、クレジットを消費する前に推定総額を提示します。
- 生成される `.mp4` / `.webp` アセットはプロジェクトごとに作られるため、このリポジトリには同梱されません。

## Star 履歴

<a href="https://www.star-history.com/?type=date&repos=oso95%2Fscroll-world">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=oso95/scroll-world&type=date&theme=dark&legend=top-left&sealed_token=rsHNX9eWfbhlu820oC1dzsc66Y8UZI4dawuHvAUlbn36F0gwOWXRDi-Qq4QFopkoEJE7bzgXPUkAmSnmMcglxAo_rM7TvGDKFehk5MzprmeT2euDRbHnTQZIxEWwjjpGQ3nodpdblW6WjTssURtDxXO2MCVL_WgJ_WnCIoVbV8qhsB_Z-Eeo8KCyVerC" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=oso95/scroll-world&type=date&legend=top-left&sealed_token=rsHNX9eWfbhlu820oC1dzsc66Y8UZI4dawuHvAUlbn36F0gwOWXRDi-Qq4QFopkoEJE7bzgXPUkAmSnmMcglxAo_rM7TvGDKFehk5MzprmeT2euDRbHnTQZIxEWwjjpGQ3nodpdblW6WjTssURtDxXO2MCVL_WgJ_WnCIoVbV8qhsB_Z-Eeo8KCyVerC" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=oso95/scroll-world&type=date&legend=top-left&sealed_token=rsHNX9eWfbhlu820oC1dzsc66Y8UZI4dawuHvAUlbn36F0gwOWXRDi-Qq4QFopkoEJE7bzgXPUkAmSnmMcglxAo_rM7TvGDKFehk5MzprmeT2euDRbHnTQZIxEWwjjpGQ3nodpdblW6WjTssURtDxXO2MCVL_WgJ_WnCIoVbV8qhsB_Z-Eeo8KCyVerC" />
 </picture>
</a>

## ライセンス

MIT — 詳細は [LICENSE](LICENSE) を参照してください。
