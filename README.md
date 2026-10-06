# dsh-plugin-obsidian-push

> 🧩 **dsh 插件家族**（22 件）：总目录 **[dsh-plugin-family](https://github.com/121212165/dsh-plugin-family)** ｜ 明星插件：**[ide-hub](https://github.com/121212165/dsh-plugin-ide-hub)** 跨 IDE 统一管理 · **[task-forge](https://github.com/121212165/dsh-plugin-task-forge)** 跨窗口无损交接 · **[quota](https://github.com/121212165/dsh-plugin-quota)** 实时用量仪表


**EN** · Pushes archived transcripts (from dsh-plugin-transcript) into an Obsidian vault as Markdown with YAML frontmatter, filename `YYYY-MM-DD-<short session id>.md`, deduped by content hash so a re-run skips what has not changed (`/obsidian-push`). and `/archive` walks the whole chain (归档检查 → 推送 → 检索面) in one command. · 21 `node --test` green (incl. YAML quote escaping) · load path shared with sibling plugins that were mounted; this plugin itself not live-mounted.

DeepSeek Harness (dsh) 插件：把归档的会话转录推送成 Obsidian 笔记——YAML frontmatter（title/date/session/tags，Obsidian 属性面板直接可读）、正文按时间排序渲染用户/助手/工具行，按内容哈希幂等去重。数据源是 [dsh-plugin-transcript](https://github.com/121212165/dsh-plugin-transcript) 的 JSONL 边车（同 schema 同默认目录，契约互通）。

同系列：[cost-ledger](https://github.com/121212165/dsh-plugin-cost-ledger) · [session-insights](https://github.com/121212165/dsh-plugin-session-insights) · [transcript-search](https://github.com/121212165/dsh-plugin-transcript-search) · [relay-quota](https://github.com/121212165/dsh-plugin-relay-quota)。

## 功能

- **`/obsidian-push [sessionId|all]`**：把一个或全部会话渲染为 `vaultDir/subfolder/日期-会话短id.md`。
- **幂等**：内容没变的会话跳过（哈希比对），转录更新过的会话覆盖写入——反复推送安全。
- **只读边车**：本插件从不写 transcript 的 JSONL，只往库里写 Markdown。

## /archive：整条链一步走完

推送只是链条的中段。单独跑 `/obsidian-push` 看不出"有没有会话根本没归档"，也看不出"检索面通不通"，所以 `/archive` 按三步各出一行状态（`✓/△/⚠`），需要时给下一步动作：

1. **transcript 归档检查** — 数 `transcript-YYYY-MM.jsonl` 里的会话与行数，和 `<dataDir>/markdown/<short12>.md` 对账；没落 markdown 的就是崩在 dispose 之前的会话，直接列出短 id 让你去 `/transcript-export` 补。
2. **Obsidian 推送** — 原来的推送（内容哈希去重、未变跳过），但把"多少篇新写 / 多少篇已一致"放进步骤行。
3. **检索面** — 报告有多少行可被 dsh-plugin-transcript-search 检索，并如实说明**它每次查询都重建索引、磁盘上没有索引文件可"刷新"**——这一步不假装做"刷新"，只报可检索面和两个坑（它的短 id 取 8 位，本插件的 markdown 文件名取 12 位）。

最后 `判定：` 一句话说清链上哪一环卡住。

顺带修了一个真 bug：`/obsidian-push <短 id>` 以前**永远匹配不到**（过滤器拿完整 sessionId 做 `startsWith`），现在完整 id、任意前缀、8 位或 12 位短 id 都认。


```yaml
- insert:
    - id: obsidian-push
      name: dsh-plugin-obsidian-push
      config:
        enabled: true
        vaultDir: "~/obsidian/MyVault"  # 必填
        subfolder: dsh-sessions
        tags: [dsh, session]
        # dataDir: ~/.dsh/transcripts   # 默认与 transcript 一致
```

## 安装

三步，实测于 `@deepseek-ai/dsh@0.1.7-alpha.1`（需 `pnpm` 在 PATH 上）：

```sh
# ① 装进 profile：dsh plugin 把参数原样转发给 pnpm，git 包会自动跑 prepare 构建 lib/
dsh plugin --profile web add github:121212165/dsh-plugin-obsidian-push
```

② 把本仓库根目录 `cordis.patch.yml` 的内容**并进** `$DSH_HOME/profiles/web/cordis.patch.yml`。
该文件默认是 `[]`，所以要么整份替换，要么把 insert 条目并进同一个数组；**不要直接追加**——
追加会形成两个 YAML 文档，启动即报
`failed to parse overlay ... end of the stream or a document separator is expected`（本机实测踩过）。

③ 重启 dsh。配置层与 client 半都要重启才生效（客户端按 boot 时算出的内容 rev 下发，硬刷新浏览器没用）。

自检挂载：`dsh --profile web --dump-config | grep dsh-plugin-obsidian-push`，应看到该条目。
## 验证状态

- 21 个 `node --test` 全绿：`push.test.ts`（计划笔记/文件名/内容哈希去重/frontmatter 转义）、`plugin.test.ts`（装配层：真临时 sidecar + 真临时 vault 驱动推送、跳过与更新）、`archive.test.ts`（`shortId` / `sessionMatches` / `checkArchive` / `renderSteps` / `archiveVerdict` 纯函数 + 三步链端到端：两缺 → 全齐 → 再跑全跳过、空目录、坏过滤、短 id 回归）。

- frontmatter/文件名/排序/幂等决策为纯函数，5 个 node --test 测试全绿（含 YAML 引号转义）。
- **装配层（plugin.ts）测试已补齐**（新增 5 条，共 12 条）：`test/harness.ts` 用脚本化 mock ctx（commands 捕获）驱动真实 `apply()`，推送路径跑在 `mkdtempSync` 临时 vault + 临时 transcript 边车上，绝不触碰真实 `~/.dsh` 或真实 vault——覆盖 disabled/空 vaultDir 不注册、注册清单、无边车报错、按会话前缀过滤推送落盘、幂等去重（字节级不变）与转录更新后覆盖写入。harness 方法论借鉴 dsh-auto-review（222★，PerryLink）的 mountHarness，实现为 node:test 版、移植自 dsh-plugin-task-forge（本家族首个落地的装配层测试模板）。
- 未在运行中的 dsh 里 live mount 验证本插件自身（同系列已验证同一加载路径）。
