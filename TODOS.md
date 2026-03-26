# TODOS

## Pre-Implementation (实现前必须完成)

### ~~运行 /design-consultation 创建设计系统~~ ✅ 已完成
- DESIGN.md 已创建（2026-03-26）：Fraunces + DM Sans + Geist Mono，parchment palette

### 更新线框以反映设计审查变更
- **What**: 重绘 `docs/wireframe-sketch.html` 以反映：wizard 布局（非卡片堆叠）、Step 4 拆分为 4a (reveal) + 4b (actions)、首屏品牌标题 + 动效轮播、食材添加内联表单、/activate 页面
- **Why**: 当前线框已标记为过时（布局结构仍可参考但视觉样式不准确）。设计审查做了 10+ 个布局和交互决策，线框未同步
- **Pros**: 实现时有准确的视觉参考，减少工程师的设计决策负担
- **Cons**: 需要 30-60 分钟重绘
- **Context**: 来自 /plan-design-review 的综合变更（Pass 1 信息架构 + Pass 2 交互状态 + Pass 4 AI Slop）
- **Depends on**: /design-consultation 完成（需要设计系统的色彩和字体才能重绘）
- **Blocks**: 无（可在实现过程中并行）
