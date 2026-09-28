# dsh-plugin-obsidian-push

DeepSeek Harness (dsh) 插件：把归档的会话转录推送成 Obsidian 笔记——YAML frontmatter（title/date/session/tags，Obsidian 属性面板直接可读）、正文按时间排序渲染用户/助手/工具行，按内容哈希幂等去重。数据源是 [dsh-plugin-transcript](https://github.com/121212165/dsh-plugin-transcript) 的 JSONL 边车（同 schema 同默认目录，契约互通）。

同系列：[cost-ledger](https://github.com/121212165/dsh-plugin-cost-ledger) · [session-insights](https://github.com/121212165/dsh-plugin-session-insights) · [transcript-search](https://github.com/121212165/dsh-plugin-transcript-search) · [relay-quota](https://github.com/121212165/dsh-plugin-relay-quota)。

## 功能

- **`/obsidian-push [sessionId|all]`**：把一个或全部会话渲染为 `vaultDir/subfolder/日期-会话短id.md`。
- **幂等**：内容没变的会话跳过（哈希比对），转录更新过的会话覆盖写入——反复推送安全。
- **只读边车**：本插件从不写 transcript 的 JSONL，只往库里写 Markdown。

## 配置

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

克隆或 npm 安装到 profile 的 node_modules；从源码安装需要先构建：`npm install` 经 `prepare` 自动产出 `lib/`。

## 验证状态

- frontmatter/文件名/排序/幂等决策为纯函数，5 个 node --test 测试全绿（含 YAML 引号转义）。
- 未在运行中的 dsh 里 live mount 验证本插件自身（同系列已验证同一加载路径）。
