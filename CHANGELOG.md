# Changelog · 更新记录

All notable changes to **DSH 会话交互折叠功能 / DSH Session Turn Accordion**.

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
