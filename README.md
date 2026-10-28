# DSH 会话交互折叠功能 · DSH Session Turn Accordion

把 DSH Web 会话里的每一次交互压成一行，只保留最近一次展开；点提问行展开，执行过程另行单独点开。

Fold every interaction in a DSH Web chat into a single line and keep only the latest one open. Click a question row to expand it; the execution process opens only when you click its own header.

[中文](#中文) · [English](#english)

---

## 中文

### 这是什么

一个 DSH（DeepSeek Harness）客户端插件。它不修改 `app.asar`、不碰核心 UI 源码，只在渲染层做三件事：

1. 每个历史交互整轮收起，折叠成**固定一行**：左侧时间胶囊 `MM-DD HH:mm` + 单行提问摘要（超出省略）。
2. 只保留**最近一次交互**展开；进入会话、切换会话、出现新一轮都自动收敛。
3. 点折叠行 → 该轮展开，同时把其它已展开的轮收起；再点提问 → 收回去。

执行过程（思考、工具调用、步骤）不跟着展开：核心本身在回答结束时会收起过程，只有你单独点「过程摘要」那一行才会展开。

### 效果

```
┌──────────────────────────────────────────────────────────┐
│ 10-28 13:12   把这批日志按时间排序、去重，然后…        › │   ← 折叠（一行）
├──────────────────────────────────────────────────────────┤
│ 10-28 12:58   帮我看下 esp32 的引脚冲突                  › │
├──────────────────────────────────────────────────────────┤
│ 你的提问（全文）                                          │   ← 展开（最近一次）
│ …回答正文…                                                │
│ ▸ 12 步 · 思考 8s · 工具 4 次（点开才展开）               │
└──────────────────────────────────────────────────────────┘
```

### 安装

前置：DSH 桌面版（Web UI），已有一个可用 profile（默认 `desktop`）。

```powershell
# 1. 取得代码
git clone https://github.com/<owner>/dsh-session-accordion.git
$repo = "<克隆下来的目录绝对路径>"

# 2. 在 profile 里登记为本地包（junction 链接，不复制）
$nm = "$env:USERPROFILE\.dsh\profiles\desktop\node_modules"
New-Item -ItemType Junction -Path "$nm\dsh-session-accordion" -Target $repo
```

```jsonc
// 3. 编辑 %USERPROFILE%\.dsh\profiles\desktop\package.json
{
  "dependencies": {
    "dsh-session-accordion": "link:<repo 绝对路径>"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "dsh-session-accordion"   // 加到数组里
      ]
    }
  }
}
```

4. **完全退出 DSH 再启动**（改的是 profile 层，刷新网页无效）。
5. 设置 → 对话 → **工作步骤收起时机 = 回答结束后**（插件依赖这个前置，过程才会自动收起）。

> 也可以把仓库目录复制进 `node_modules` 再登记，但 junction 方式升级更方便：`git pull` 后重启即可。

### 卸载

1. 从 `package.json` 的 `dependencies` 与 `dsh.profile.bundles` 中删掉 `dsh-session-accordion`。
2. 删除 `node_modules\dsh-session-accordion`（junction 删除不会删源目录）。
3. 重启 DSH。

### 工作原理

| 关键点 | 说明 |
| --- | --- |
| 挂载点 | 客户端插件（`dsh.client`，`platform: web`，`immediately: true`），随 Web 应用加载一次，天然覆盖所有工作区与会话 |
| 轮次分组 | 聊天流容器 `[data-slot="conversation.chat.flow"]` 下，每个渲染节点带 `[data-chat-turn="<turnId>"]`；同 turnId 归为一轮 |
| 提问识别 | 轮内包含 `class` 以 `_bubble` 结尾的元素（用户/steering 气泡共用）的节点 |
| 过程识别 | `data-chat-flow-kind="turn-process"` 的节点，其内部 `button[aria-expanded]` 是核心原生折叠开关 |
| 折叠方式 | 给整轮除提问外的节点打 `data-ac-hidden`（`display:none`），提问行用伪元素画时间胶囊与摘要，原内容 `visibility:hidden` |
| 状态 | 按 `turnId` 存在内存 `Map`；未知轮次默认「最后一轮展开」，因此切换会话、历史回看都自动收敛 |
| 时间 | 优先读 React fiber 上的 `props.node.data.time`（不受悬停影响），退回原生时钟文本，都没有就不显示 |
| 自愈 | `MutationObserver` + 1.5 秒兜底巡检，React 重渲染后重新贴状态 |

设计取向：**只叠加，不侵入**。核心的折叠状态、流式输出、滚动锚定都不接管；结构认不出时插件什么都不做，只在 console 打一条 `warn`。

### 诊断

页面 DevTools Console：

```js
__acReport()
```

输出每一轮的 `id / expanded / stamp / summary / items`。结构变化（DSH 升级后 DOM 改名）时，看这个能立刻定位是「分组失败」还是「时间取不到」。

### 已知限制

- 依赖 DSH 聊天面板的内部 DOM 属性（`data-chat-turn` 等），属**非公开契约**，上游改版可能失效；失效时插件静默不动作，不会破坏界面。
- 折叠行是自绘的一行，行内链接需先展开再点。
- 时间取自提问节点的事件时间；极少数节点没有 `time` 时不显示时间，只显示摘要。
- 未发布到 npm，按上面的本地 link 方式安装。

### 许可证

MIT，见 [LICENSE](LICENSE)。

---

## English

### What it is

A client plugin for DSH (DeepSeek Harness). It never edits `app.asar` or any core UI source; it only layers three behaviours on top of the rendered transcript:

1. Every finished interaction collapses into **one fixed line**: a time pill (`MM-DD HH:mm`) plus a single-line summary of your question, ellipsized when long.
2. Only the **latest interaction** stays open. Entering a session, switching sessions, or a new turn all converge to that state automatically.
3. Clicking a collapsed row expands that turn and folds any other open turn; clicking the question again folds it back.

The execution process (thinking, tool calls, steps) does not expand with the turn: DSH folds it when the answer completes, and it opens only when you click its own summary row.

### What it looks like

```
┌──────────────────────────────────────────────────────────┐
│ 10-28 13:12   Sort these logs by time, dedupe, then…   › │   ← folded (one line)
├──────────────────────────────────────────────────────────┤
│ 10-28 12:58   Check the ESP32 pin conflicts             › │
├──────────────────────────────────────────────────────────┤
│ Your full question                                       │   ← expanded (latest)
│ …answer body…                                            │
│ ▸ 12 steps · 8s thinking · 4 tool calls (click to open)  │
└──────────────────────────────────────────────────────────┘
```

### Install

Requires the DSH desktop app (Web UI) with a working profile (default: `desktop`).

```powershell
# 1. Get the code
git clone https://github.com/<owner>/dsh-session-accordion.git
$repo = "<absolute path of the clone>"

# 2. Register it in the profile as a local package (junction, no copy)
$nm = "$env:USERPROFILE\.dsh\profiles\desktop\node_modules"
New-Item -ItemType Junction -Path "$nm\dsh-session-accordion" -Target $repo
```

```jsonc
// 3. Edit %USERPROFILE%\.dsh\profiles\desktop\package.json
{
  "dependencies": {
    "dsh-session-accordion": "link:<absolute repo path>"
  },
  "dsh": {
    "profile": {
      "bundles": [
        "dsh-session-accordion"   // add to the array
      ]
    }
  }
}
```

4. **Quit DSH completely and start it again** (this is a profile-layer change; refreshing the page is not enough).
5. Settings → Chat → **When to collapse work details = On completion**. The plugin relies on this so the process folds by itself.

> You can also copy the repo into `node_modules` and register it, but the junction keeps upgrades to `git pull` + restart.

### Uninstall

1. Remove `dsh-session-accordion` from `dependencies` and `dsh.profile.bundles`.
2. Delete `node_modules\dsh-session-accordion` (deleting the junction leaves the source directory untouched).
3. Restart DSH.

### How it works

| Point | Detail |
| --- | --- |
| Mount | A client plugin (`dsh.client`, `platform: web`, `immediately: true`) loaded once with the web app, so it covers every workspace and session |
| Turn grouping | Inside `[data-slot="conversation.chat.flow"]`, each rendered node carries `[data-chat-turn="<turnId>"]`; nodes sharing a turn id form one turn |
| User node | The node whose subtree contains an element with a class ending in `_bubble` (user and steering bubbles share it) |
| Process node | The node with `data-chat-flow-kind="turn-process"`; its `button[aria-expanded]` is the built-in fold control |
| Folding | Marks every non-user node of the turn with `data-ac-hidden` (`display:none`); the user row draws its pill and summary with pseudo-elements while the real bubble is `visibility:hidden` |
| State | An in-memory `Map` keyed by `turnId`; unknown turns default to "last one expanded", which is why session switches and history reloads converge on their own |
| Timestamp | Read from the React fiber (`props.node.data.time`) first, then the native clock text; nothing is invented if neither exists |
| Self-healing | `MutationObserver` plus a 1.5 s safety sweep re-applies state after React re-renders |

Design stance: **layer, never invade**. Core folding, streaming output and scroll anchoring stay untouched; when the structure cannot be recognised the plugin does nothing and logs a single `warn`.

### Diagnostics

In the page DevTools console:

```js
__acReport()
```

It prints `id / expanded / stamp / summary / items` per turn. After an upstream UI change this tells you immediately whether grouping failed or the timestamp went missing.

### Known limitations

- Relies on internal DOM attributes of the DSH chat panel (`data-chat-turn`, …). That is a **private contract** and may break on an upstream redesign; the plugin then fails safe by doing nothing.
- The folded row is self-drawn, so links inside a question need one click to expand first.
- Timestamps come from the question node's event time; the rare node without `time` shows a summary only.
- Not published to npm; install it through the local link shown above.

### License

MIT, see [LICENSE](LICENSE).
