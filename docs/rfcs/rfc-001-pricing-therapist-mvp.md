# RFC-001: Pricing Therapist MVP

| Field | Value |
|-------|-------|
| **RFC** | 001 |
| **Title** | Pricing Therapist — 免费计算器 MVP |
| **Status** | Draft |
| **Author** | Claude Code & panke |
| **Created** | 2026-03-26 |
| **Updated** | 2026-03-26 |
| **Depends on** | Cloudflare 账户 + 域名 |
| **Epic Issue** | #1 |

---

## 1. Background & Motivation

详见 `docs/design-recipecalc-pricing-therapist.md`。

家庭烘焙师需要为产品定价，但害怕面对真实成本。RecipeCalc 是**定价信心工具**：引导式 4 步流程，核心时刻 = "食材成本 vs 真实成本" 视觉对比 reveal。

**本 RFC 范围**: 纯免费计算器 MVP —— 验证核心体验（wizard + reveal），不含支付、licensing、保存、导出。所有功能对所有用户完全开放。目标是最快上线，投放社区获取真实用户反馈。

## 2. Goals

1. 上线完整的 4 步 wizard + reveal，全功能免费，部署到 Cloudflare
2. 推荐售价 + target cost ratio 滑块对所有用户可用（无付费墙）
3. localStorage 持久化当前编辑进度（resume 未完成配方）
4. Mobile-first 响应式设计，基础 WCAG AA 可访问性
5. 可投放到 Reddit/Facebook 社区获取反馈

## 3. Non-Goals

- **V1.1 (fast-follow)**: LemonSqueezy 支付、license key、付费墙 UI、保存配方、PDF 导出、多配方对比
- **Phase 2**: Plausible Analytics、SEO 落地页矩阵、博客引擎、Supabase 后端
- **远期**: 多语言、营养标签、发票 AI 解析、POS 集成

## 4. User Stories

| ID | As a... | I want to... | So that... |
|----|---------|-------------|-----------|
| US-1 | 家庭烘焙师 | 输入产品信息（名称、数量、制作时间） | 开始定价流程 |
| US-2 | 家庭烘焙师 | 逐个添加食材并自动换算单位 | 准确计算食材成本 |
| US-3 | 家庭烘焙师 | 输入人工、包装、间接费用 | 看到隐藏成本 |
| US-4 | 家庭烘焙师 | 看到食材成本 vs 真实成本的视觉对比 | 理解定价差距 |
| US-5 | 家庭烘焙师 | 调节 target cost ratio 滑块看推荐售价 | 找到可以开口要的价格 |
| US-6 | 家庭烘焙师 | 复制计算结果 | 分享或记录 |
| US-7 | 家庭烘焙师 | 恢复上次未完成的配方 | 不用从头重新输入 |
| US-8 | 访客 | 在首屏看到产品价值主张 | 决定是否使用 |

## 5. Technical Design

### 5.1 Architecture

- **框架**: Astro + React islands，Cloudflare Workers + Assets 部署
- **UI**: React island（`client:load`）实现 wizard，Astro 静态页处理首屏 hero
- **状态**: React useReducer 管理 wizard 状态，容器组件管理步骤切换和动画
- **持久化**: localStorage 仅存 `recipecalc_current`（当前编辑进度），无配方库、无 license
- **样式**: 遵循 DESIGN.md 设计系统（Fraunces/DM Sans/Geist Mono，parchment 调色板）

### 5.2 Data Model

localStorage 单 key `recipecalc_current`:
```json
{
  "version": 1,
  "step": 2,
  "recipe": {
    "name": "Chocolate Chip Cookies",
    "quantity": 24,
    "quantityUnit": "cookies",
    "batchTimeHours": 2.5,
    "ingredients": [
      {
        "id": "uuid",
        "name": "All-purpose flour",
        "purchaseAmount": 5,
        "purchaseUnit": "lb",
        "purchasePrice": 3.49,
        "usedAmount": 2.5,
        "usedUnit": "cup",
        "wastePercent": 0
      }
    ],
    "laborAndOverhead": {
      "hourlyRate": 15,
      "packaging": 4.00,
      "overhead": 2.50,
      "platformFees": 0
    }
  }
}
```

### 5.3 单位换算

| 类别 | 单位 | 互转 |
|------|------|------|
| 重量 | g, oz, lb, kg | 标准换算 |
| 体积 | ml, cup, tsp, tbsp, fl oz, quart, gallon, liter | 标准换算 |
| 计数 | each, dozen | 1 dozen = 12 each |

**跨类别（重量↔体积）**: 20 个常见烘焙食材内置密度数据。数据源：USDA FoodData Central + King Arthur Baking weight chart。每个食材需测试用例覆盖。未收录食材提示用户使用相同类别单位。

**平台费用**: MVP 中作为固定金额输入（非售价百分比），避免推荐价循环依赖。

### 5.4 成本计算公式

```
ingredient_cost = sum(each: purchasePrice × (usedAmount / purchaseAmount) × (1 + wastePercent/100))
labor_cost = batchTimeHours × hourlyRate
true_total_cost = ingredient_cost + labor_cost + packaging + overhead + platformFees
cost_per_unit = true_total_cost / quantity
recommended_price_per_unit = cost_per_unit / target_cost_ratio
```

`target_cost_ratio` 默认 0.30，滑块范围 0.20–0.50。

### 5.5 Key Flows

Hero → Step 1（产品信息）→ Step 2（食材）→ Step 3（人工/间接费用）→ Step 4（Reveal + 推荐售价 + 行动区）

**MVP 中 Step 4 = 4a + 4b 合并**: reveal 对比 + 推荐售价 + 滑块 + 复制结果 + "Start new recipe"，全部免费可用。无付费墙。

## 6. Implementation Plan

| Phase | Focus | Tickets |
|-------|-------|---------|
| 1 | 基础设施 | 项目脚手架、单位换算引擎、成本计算逻辑 |
| 2 | Wizard UI | Wizard shell、Step 1-3 表单、Step 4 Reveal |
| 3 | 落地页 + 集成 | Hero 首屏、localStorage 持久化 |

## 7. Acceptance Criteria

- [ ] `pnpm build` 成功，Cloudflare 部署可访问
- [ ] 4 步 wizard 完整可走通（Step 1 → 2 → 3 → 4），前进/后退导航正确
- [ ] Step 4 reveal 动画序列完整（skeleton → 数字 count-up → gap bar → 推荐价）
- [ ] 推荐售价 + target cost ratio 滑块对所有用户可用
- [ ] 单位换算：同类别换算 100% 正确，20 个食材跨类别换算有测试覆盖
- [ ] localStorage resume：刷新页面后恢复到上次步骤和数据
- [ ] 响应式：375px 单列堆叠 reveal / 768px+ 并排 reveal / 1024px+ 居中 640px
- [ ] 复制结果到剪贴板功能正常
- [ ] `prefers-reduced-motion` 禁用所有动画
- [ ] 键盘可完整操作 wizard（Tab / Enter / Esc）

## 8. Open Questions

1. Hero 首屏照片素材来源？（Unsplash？AI 生成？自拍？）
2. 50 个 autocomplete 食材列表的确切内容需要确定
3. 是否需要 "edge case nudge"（所有隐藏成本 = $0 时的温和提醒）在 MVP 中实现？
