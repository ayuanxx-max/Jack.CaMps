# Changelog · 更新记录

All notable changes to **DSH 会话交互折叠功能 / DSH Session Turn Accordion**.

## 2.5.3 — 2026-10-30

- Linux / macOS 兼容性：README 增加 bash 安装路径（绝对路径符号链接）、按宿主区分 `desktop` / `web` profile；卸载补充 `rm` 写法。
- 新增 `scripts/install.sh`（POSIX）与 `scripts/install.ps1`（Windows），支持 `--dry-run` / `--apply`，改 `package.json` 前先备份。
- 新增 `scripts/check.mjs` 与 GitHub Actions `ci`：在 ubuntu / macos / windows × node 20/22 上校验语法、清单、LF/BOM、`bash -n`、打包与安装冒烟。
- `package.json` 增加 `engines.node >= 18`，`files` 收录安装脚本。
- Linux/macOS compatibility: bash install path with an absolute symlink, `desktop` vs `web` profile guidance, `rm` uninstall.
- Added `scripts/install.sh` (POSIX) and `scripts/install.ps1` (Windows) with `--dry-run` / `--apply` and a package.json backup.
- Added `scripts/check.mjs` and a GitHub Actions `ci` workflow covering ubuntu, macOS and Windows on node 20/22: syntax, manifest, LF/BOM, `bash -n`, pack and install smoke tests.
- `package.json` gains `engines.node >= 18`; `files` now ships the installers.

## 2.5.2 — 2026-10-29

- 仓库更名为 `dsh-session-accordion`（kebab-case，满足 dsh.so 等市场的仓库命名规则）；`package.json` 补 `repository` / `homepage` / `bugs`。
- Renamed the repository to `dsh-session-accordion` (kebab-case, required by marketplaces such as dsh.so) and added `repository` / `homepage` / `bugs` to `package.json`.

## 2.5.1 — 2026-10-29

- 修复 2.5.0 回归：`conversation.chat.flow` 是 `display: contents` 锚点（自身没有盒子），可见性探测恒为空 → 插件整段不工作。改为用行节点的 `getClientRects()` 探测。
- Fix the 2.5.0 regression: the `conversation.chat.flow` anchor is `display: contents` (it has no box of its own), so the visibility probe always reported hidden and the plugin became a no-op. Visibility is now probed from a row node.

## 2.5.0 — 2026-10-29

- 展开态由「每条轮次各记一个布尔值」改为**全局唯一的 `expandedId`**：打开任何会话只展开最近一条。
- 会话切换 / 历史节点消失 / 新轮追加三种事件都会把展开态重置到最新一轮；此前手动展开的轮次在新交互出现时一律折叠。
- The open state is now a single global `expandedId` instead of a per-turn map: opening any session expands only the newest turn.
- Session switch, vanished history nodes and an appended new turn all re-point the open state to the latest turn; previously manual expansions fold when a new interaction starts.

## 2.4.0 — 2026-10-28

- 视觉打磨：时间胶囊（定宽 86px、tabular-nums）、摘要独立列、右侧 chevron、hover/active 状态、展开 0.16s 淡入。
- Polish: fixed-width time pill with tabular numerals, dedicated summary column, chevron affordance, hover/active states, 0.16 s fade-in on expand.

## 2.3.0 — 2026-10-28

- 折叠态改为**整行自绘**（`MM-DD HH:mm  提问摘要…`），原气泡 `visibility:hidden`，行高固定。
- 时间改从 React fiber 的 `props.node.data.time` 读取，修复「没有日期时间」。
- Folded state becomes a self-drawn single row; the original bubble is `visibility:hidden`.
- Timestamp now read from the React fiber node data, fixing the missing date/time.

## 2.2.0 — 2026-10-28

- 折叠行加时间角标（先取原生时钟文本）。
- Time badge on folded rows (native clock text first).

## 2.1.0 — 2026-10-28

- 折叠焦点改为「我的提问」气泡；展开态只显示回答正文，执行过程交还核心（回答结束后收起）。
- The folded row's focus becomes the user question bubble; expanded turns show the answer only, and the process folds natively on completion.

## 2.0.0 — 2026-10-28

- 重写为整轮手风琴：每轮按 `data-chat-turn` 分组，只保留最后一轮展开。
- Rewritten as a whole-turn accordion: turns are grouped by `data-chat-turn`, only the latest stays open.

## 1.0.0 — 2026-10-28

- 初始实验版：点击轨迹视图的「收起所有轮次」按钮。
- Initial experiment: click the trajectory view's "collapse all turns" button.
