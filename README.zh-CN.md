# scroll-world

[English](./README.md) | [简体中文](./README.zh-CN.md) | [日本語](./README.ja.md)

https://github.com/user-attachments/assets/b08e641e-985b-4bd4-83ff-6750272d0c37


这是一个面向 Claude Code、Codex 以及任何兼容 `SKILL.md` 的智能体的技能，可为任意行业或品牌构建沉浸式、随滚动擦洗播放的“飞越世界”落地页：随着页面滚动，镜头从每个场景外部飞入内部，再无剪辑地衔接至下一场景。整个过程是在一个生成的小世界中连续连贯的飞行（可以想象 Emons 物流网站的效果，只是可应用于任何主题）。

## 安装

### Claude Code — 作为插件安装（推荐）

```
/plugin marketplace add oso95/scroll-world
/plugin install scroll-world@scroll-world
```

然后，只需提出制作一个滚动穿越世界的落地页，或调用 `/scroll-world`。

### Codex 和其他智能体 — 通过 skills CLI 安装

使用 [Vercel 的 skills CLI](https://github.com/vercel-labs/skills)，它可以将技能安装到 Codex、Claude Code、Cursor 以及其他 20 多种智能体：

```bash
npx skills add oso95/scroll-world            # pick your agent(s) when prompted
npx skills add oso95/scroll-world -a codex   # or target Codex directly
```

在 Codex 中，使用 `$scroll-world` 调用该技能（也可以通过 `/skills` 浏览技能），或直接提出制作一个滚动穿越世界的落地页。

### 手动安装（直接放入技能目录）

将技能文件夹复制到智能体的技能目录：

```bash
git clone https://github.com/oso95/scroll-world
cp -R scroll-world/skills/scroll-world ~/.claude/skills/   # Claude Code
cp -R scroll-world/skills/scroll-world ~/.codex/skills/    # Codex
```

## 要求

- 已完成身份验证（`higgsfield auth login`）且拥有可用额度的 [Higgsfield CLI](https://higgsfield.ai)。
- `ffmpeg` / `ffprobe`，用于提取帧和编码。
- 安装了 Pillow 的 Python 3（用于移动端竖屏画布，也用于可选的透明场景背景抠图）。
- [Codex CLI](https://github.com/openai/codex)（可选）— 如果已安装，可以通过 Codex 内置的 `image_gen`（同一个 GPT Image 模型）生成场景静帧，费用计入 ChatGPT 订阅，而不是消耗 Higgsfield 额度。

## 功能

它使用 [Higgsfield](https://higgsfield.ai) 完成美术制作：生成风格统一的等距微缩场景（通过 Higgsfield 或 ChatGPT 订阅中的 Codex CLI 使用 GPT Image 2）以及镜头飞行动画（使用 Seedance 或 Kling 的图生视频功能，只采用能够锁定衔接帧的模型），再根据滚动位置擦洗播放——这与 Apple 滚动产品页面背后的技术相同。镜头确实在移动，滚动操作只负责控制时间进度。它**不依赖特定框架**：你会获得 Higgsfield 流水线、提示词模板和可移植的原生 JavaScript 擦洗引擎，可以放入纯 HTML、Next.js、Vue 或由 Python 提供服务的页面中，不预设任何技术栈。

调用该技能后，它会：

1. **向你提问** — 了解主题/行业和宣传重点、品牌素材（从 URL 导入、由你提供或让技能提出方案）、美术方向、镜头依次访问的场景、是否需要**移动端版本**（以 9:16 竖屏原生渲染第二套序列，专为手机构图，并非横屏影片的裁剪版），以及**预算**——展示各渲染档位、静帧来源和预估额度成本，并在生成任何内容之前征得批准。
2. **生成素材** — 为每个场景生成一张静帧和一段“飞入”镜头，并根据相邻场景实际渲染出的帧生成连接片段，使每处衔接的帧完全一致。若启用移动端版本，则会以同样方式并行渲染一套竖屏序列，并基于其自身的 9:16 渲染结果锁定衔接帧。
3. **完成接入** — 配置一个由配置驱动的滚动引擎，将整套序列作为一次连续飞行播放，并在手机上自动提供竖屏片段和封面图。

## 技能内容

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

## 说明

- 素材生成会消耗 Higgsfield 额度（N 个场景大约需要生成 N 张图片和 2N-1 段视频；移动端序列会使视频生成数量翻倍），并且需要一定时间——技能会在后台运行生成任务并轮询状态。CLI 不会直接显示单次生成的价格，因此技能会根据你的实时余额进行校准，并在消费额度前说明预估总成本。
- 生成的 `.mp4` / `.webp` 素材按项目制作，不会随本仓库分发。

## Star 历史

<a href="https://www.star-history.com/?type=date&repos=oso95%2Fscroll-world">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=oso95/scroll-world&type=date&theme=dark&legend=top-left&sealed_token=rsHNX9eWfbhlu820oC1dzsc66Y8UZI4dawuHvAUlbn36F0gwOWXRDi-Qq4QFopkoEJE7bzgXPUkAmSnmMcglxAo_rM7TvGDKFehk5MzprmeT2euDRbHnTQZIxEWwjjpGQ3nodpdblW6WjTssURtDxXO2MCVL_WgJ_WnCIoVbV8qhsB_Z-Eeo8KCyVerC" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=oso95/scroll-world&type=date&legend=top-left&sealed_token=rsHNX9eWfbhlu820oC1dzsc66Y8UZI4dawuHvAUlbn36F0gwOWXRDi-Qq4QFopkoEJE7bzgXPUkAmSnmMcglxAo_rM7TvGDKFehk5MzprmeT2euDRbHnTQZIxEWwjjpGQ3nodpdblW6WjTssURtDxXO2MCVL_WgJ_WnCIoVbV8qhsB_Z-Eeo8KCyVerC" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=oso95/scroll-world&type=date&legend=top-left&sealed_token=rsHNX9eWfbhlu820oC1dzsc66Y8UZI4dawuHvAUlbn36F0gwOWXRDi-Qq4QFopkoEJE7bzgXPUkAmSnmMcglxAo_rM7TvGDKFehk5MzprmeT2euDRbHnTQZIxEWwjjpGQ3nodpdblW6WjTssURtDxXO2MCVL_WgJ_WnCIoVbV8qhsB_Z-Eeo8KCyVerC" />
 </picture>
</a>

## 许可证

MIT — 详见 [LICENSE](LICENSE)。
