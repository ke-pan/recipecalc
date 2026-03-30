# RFC-002: V1.1 — 变现与付费功能

| Field | Value |
|-------|-------|
| **RFC** | 002 |
| **Title** | V1.1 — 变现与付费功能 |
| **Status** | Approved |
| **Author** | Claude Code & panke |
| **Created** | 2026-03-30 |
| **Updated** | 2026-03-30 |
| **Depends on** | RFC-001 (MVP), LemonSqueezy 账户, Umami Analytics |
| **Reviewed by** | OpenAI Codex (independent review, 13 findings, all addressed) |
| **Epic Issue** | #13 |

---

## 1. Background & Motivation

RFC-001 的免费计算器 MVP 已上线并验证了核心体验（wizard + reveal）。所有功能（含推荐售价、滑块、复制）对所有用户完全开放，目的是最快获取社区反馈。

本 RFC 在 MVP 基础上叠加**变现层**。核心策略来自设计文档已确定的免费/付费边界：

> Step 4（THE REVEAL）对所有人完全免费 —— 这是产品的核心价值交付时刻，不能锁在付费墙后面。付费墙解决的是**重复使用的便利性**问题。类比：TurboTax 让你免费看税款数字，付费才能提交和保存。

**看到问题**免费，**获得答案**付费。推荐售价、滑块、复制、保存 → 付费解锁。

商业模式：**$19 一次性买断**，通过 LemonSqueezy 生成 license key。**多渠道首发** —— 自有网站 + Etsy + Gumroad 同步上线，因为 Etsy 已有被验证的需求（1,000+ reviews 的同类模板）。

## 2. Goals

1. LemonSqueezy 集成：$19 一次性买断 → 生成 license key
2. `/activate` 页面：粘贴 key → 客户端验证 → 解锁付费功能；自有网站购买支持 URL 参数自动激活
3. 付费墙 UI：Step 4 拆分为 4a（免费 reveal）+ 4b（付费行动区），推荐售价模糊、滑块锁定
4. 配方保存：localStorage `recipecalc_recipes` 数组（付费）+ JSON 导入/导出作为数据安全网
5. `/recipes` 页面：已保存配方列表 + CRUD
6. Umami Analytics：全漏斗事件追踪（含购买完成事件）
7. Edge case nudges：隐藏成本全 $0 / 人工时间 = 0 时温和提醒
8. 多渠道首发：Etsy + Gumroad listing 同步上线，含具体履约流程

## 3. Non-Goals

- **V1.2 (fast-follow)**: PDF 导出（html2canvas + jsPDF）、多配方对比（`/recipes/compare`）
- **Phase 2**: Supabase 后端、用户账户系统、跨设备同步、配方分享链接
- **Phase 2**: SEO 落地页矩阵、博客引擎、内容营销
- **远期**: 多语言、营养标签、发票 AI 解析、POS 集成
- 反作弊基础设施（不追踪使用次数、不做指纹识别）
- 服务端 license 验证（Phase 2 加 Supabase 后考虑）
- 百分比 platform fees 循环求解（已知简化，见 5.9）

## 4. User Stories

| ID | As a... | I want to... | So that... |
|----|---------|-------------|-----------|
| US-9 | 首次用户 | 免费看到食材成本 vs 真实成本的 reveal | 理解定价差距而无需付费 |
| US-10 | 首次用户 | 看到推荐售价的模糊预览 + 解锁提示 | 决定是否值得 $19 购买 |
| US-11 | 购买者 | 在任一渠道（网站/Etsy/Gumroad）购买后获得 license key | 不受购买渠道限制 |
| US-12 | 网站购买者 | 支付完成后自动跳转到已激活状态 | 零摩擦开始使用 |
| US-13 | Etsy/Gumroad 购买者 | 在 `/activate` 粘贴 key 并看到即时验证 | 立刻开始使用付费功能 |
| US-14 | 付费用户 | 看到清晰的推荐售价 + 可调滑块 | 找到合适的定价 |
| US-15 | 付费用户 | 保存当前配方到配方库 | 下次不用重新输入 |
| US-16 | 付费用户 | 在配方列表页查看、编辑、删除已保存配方 | 管理多个产品的定价 |
| US-17 | 付费用户 | 导出/导入配方 JSON | 备份数据或迁移浏览器 |
| US-18 | 所有用户 | 被温和提醒漏填了隐藏成本 | 避免自欺欺人地低估 |

## 5. Technical Design

### 5.1 免费/付费边界

**原则**: 来自设计文档 —— Reveal 是核心价值交付时刻（看到问题），永远免费。推荐售价是答案（获得解决方案），付费解锁。

| 功能 | 免费 | 付费 ($19) |
|------|------|-----------|
| Step 1-3 完整输入 | ✅ | ✅ |
| Step 4a: 食材成本 vs 真实成本 reveal | ✅ | ✅ |
| Step 4a: 成本差距金额 + gap bar | ✅ | ✅ |
| Step 4b: 推荐售价 | ❌ 模糊 "$?.??" | ✅ 清晰显示 |
| Step 4b: Target cost ratio 滑块 | ❌ 锁定 | ✅ 可调节 |
| Step 4b: 复制结果 | ❌ 触发付费墙 | ✅ |
| Step 4b: 保存配方 | ❌ 触发付费墙 | ✅ |
| `/recipes` 配方列表 | ❌ 重定向 `/activate` | ✅ |
| JSON 导出配方数据 | ❌ 触发付费墙 | ✅ |
| 调整数字（返回前步） | ✅ | ✅ |
| 开始新配方 | ✅ | ✅ |

**MVP → V1.1 过渡**: 这是一次功能降级（MVP 推荐售价免费，V1.1 锁定）。不做文案粉饰。事实：MVP 是验证期全免费，V1.1 是正式商业版本。早期社区用户如果有强烈负面反馈，可考虑给首批 N 个社区帖子里的用户免费 key 作为感谢。

### 5.2 License Key 系统

**LemonSqueezy License API 流程**（基于官方文档 2026-03）:

License key 有两个端点，语义不同：
- **`/activate`**: 首次激活 key，创建 instance，传 `instance_name`，返回 `instance_id`
- **`/validate`**: 验证已激活的 key，传 `instance_id`（可选）

**首次激活流程**:
```
POST https://api.lemonsqueezy.com/v1/licenses/activate
Content-Type: application/x-www-form-urlencoded

license_key=xxx-xxx-xxx&instance_name=recipecalc-web
```

响应 200 包含：`license_key`、`instance`（含 `id`）、`meta`（含 `store_id`、`product_id`、`variant_id`）。

**关键校验** —— 不能只检查 key 是否 valid，还必须验证它属于正确的产品：
```typescript
const EXPECTED_STORE_ID = process.env.PUBLIC_LS_STORE_ID;
const EXPECTED_PRODUCT_ID = process.env.PUBLIC_LS_PRODUCT_ID;

if (response.meta.store_id !== EXPECTED_STORE_ID ||
    response.meta.product_id !== EXPECTED_PRODUCT_ID) {
  throw new Error('This key is not for RecipeCalc');
}
```

否则任何 LemonSqueezy 产品的 key 都能解锁本应用。

**后续验证**（页面加载时，可选）:
```
POST https://api.lemonsqueezy.com/v1/licenses/validate
Content-Type: application/x-www-form-urlencoded

license_key=xxx-xxx-xxx&instance_id=saved-instance-id
```

**注意**: LemonSqueezy License API 使用 **form-encoded** 而非 JSON，且无需 API key（设计为客户端安全调用）。

**信任模型**: Honor system，不变。理由同 RFC 初稿。

### 5.3 `/activate` 页面

Astro 静态页 + React island（`client:load`）。

**两种激活路径**:

1. **自有网站购买 → 自动激活（Lemon.js overlay）**: 使用 [Lemon.js](https://docs.lemonsqueezy.com/help/lemonjs/handling-events) 在页面内打开 checkout overlay。支付完成后通过 JS 事件回调获取 license key：
   ```javascript
   LemonSqueezy.Setup({ eventHandler: ({ event, data }) => {
     if (event === 'Checkout.Success') {
       const licenseKey = data.order.first_order_item.license_key;
       // 直接调用 activate API，不经过 URL
       activateLicense(licenseKey);
     }
   }});
   ```
   Key 在内存中传递，**不暴露到 URL**（避免浏览器历史、Referer header、analytics 日志泄露凭证）。用户全程不离开页面。

2. **Etsy/Gumroad 购买 → 手动粘贴**: 用户收到 key 后访问 `/activate`，粘贴 key。

**状态机**:
```
IDLE → VALIDATING → SUCCESS | ERROR

IDLE:
  → 输入框 + placeholder "Paste your license key"
  → 说明文字："Enter the license key from your purchase email"
  → "Activate" 按钮（disabled until input non-empty）
  → Etsy/Gumroad 用户手动粘贴 key

VALIDATING:
  → 按钮变为 "Activating..." + spinner
  → 输入框 disabled

SUCCESS:
  → 绿色 checkmark + "You're unlocked!"
  → confetti 微动画（尊重 prefers-reduced-motion）
  → "Start calculating →" 按钮
  → 自动保存 license + instance_id 到 localStorage

ERROR (4 种):
  → 无效 key: "Invalid key. Double-check your purchase email."
  → 错误产品: "This key is for a different product."
  → 已达激活上限: "This key has reached its activation limit. Contact support."
  → 网络失败: "Connection error. Please try again."
  → 均可重试
```

### 5.4 License 生命周期

localStorage 不可靠（可被清除、不跨浏览器）。$19 买断用户需要安全网：

| 场景 | 处理方式 |
|------|---------|
| 浏览器清除数据 | 用户重新粘贴 key → 调用 `/activate` 再次激活（LemonSqueezy 支持多 instance） |
| 换设备/浏览器 | 同上 —— key 不绑定设备 |
| 退款 | LemonSqueezy 自动禁用 key → 下次 validate 失败 → 功能重新锁定 |
| Key 泄露 | 用户联系 support → LemonSqueezy 后台禁用旧 key + 生成新 key |
| 启动时 revalidation | **不做**（离线友好）。仅在用户手动点击 "Re-validate license" 时调用 validate API |

**LemonSqueezy 激活上限**: 创建产品时设置 activation_limit（建议 5），允许同一 key 在多台设备/浏览器使用。

### 5.5 付费墙 UI — Step 4 拆分

**当前 MVP**: Step 4 = reveal + 推荐售价 + 滑块 + 复制 + "Start new recipe"，全部免费。

**V1.1 拆分**:

```
Step 4a: THE REVEAL（所有用户）
  ┌─────────────────────────────────────────────┐
  │  动画序列不变（skeleton → count-up → gap）  │
  │  左: "Ingredients Only: $8.50"              │
  │  右: "True Cost: $52.50"                    │
  │  Gap bar: "Hidden costs: $44.00"            │
  │  成本明细分解（ingredients/labor/pkg/etc）    │
  │                                             │
  │  CTA: "What can I do about this? ↓"         │
  └─────────────────────────────────────────────┘

Step 4b: PRICING & ACTIONS（付费墙分界）
  ┌─────────────────────────────────────────────┐
  │ 免费用户:                                    │
  │  推荐售价: "$?.??" (模糊 + blur filter)      │
  │  滑块: 锁定 + 🔒 图标                       │
  │  [Copy] [Save] → 触发付费墙                  │
  │                                             │
  │  ┌─ Paywall Card (dashed border) ──────┐    │
  │  │ Unlock Full Pricing — $19           │    │
  │  │ one-time, not a subscription        │    │
  │  │                                     │    │
  │  │ ✓ Recommended pricing + slider      │    │
  │  │ ✓ Save unlimited recipes            │    │
  │  │ ✓ Copy & export results             │    │
  │  │                                     │    │
  │  │ [Get Your Price →]                  │    │
  │  │ Already have a key? /activate       │    │
  │  └─────────────────────────────────────┘    │
  │                                             │
  │ 付费用户:                                    │
  │  推荐售价: "$7.29/cookie · $175/batch"       │
  │  Target cost ratio 滑块 (20%-50%)            │
  │  [Copy results] [Save recipe]                │
  └─────────────────────────────────────────────┘

共享区域（所有用户）:
  [← Adjust numbers]  [Start a new recipe]
```

**Paywall Card 设计原则**:
- 融入流程（dashed border 内联卡片），不是 modal 中断
- 强调 "one-time, not a subscription" 消除订阅恐惧
- "Already have a key?" 链接到 `/activate`
- 初期不放 social proof 数字（X=0 时虚假硬编码比没有更差）—— 首次付费后再加

**模糊推荐售价实现**:
```css
.blurred-price {
  filter: blur(8px);
  user-select: none;
  pointer-events: none;
}
```
DOM 中渲染真实数字，CSS blur 覆盖。技术用户可通过 DevTools 看到 —— honor system 的延伸。

### 5.6 配方保存

**数据模型** — `localStorage.recipecalc_recipes`:
```json
[
  {
    "id": "crypto.randomUUID()",
    "version": 1,
    "savedAt": "2026-03-30T12:00:00Z",
    "updatedAt": "2026-03-30T12:00:00Z",
    "recipe": {
      "name": "Chocolate Chip Cookies",
      "quantity": 24,
      "quantityUnit": "cookies",
      "batchTimeHours": 2.5,
      "ingredients": [/* 同 RFC-001 */],
      "laborAndOverhead": {/* 同 RFC-001 — 统一用此命名 */}
    },
    "targetCostRatio": 0.30
  }
]
```

**`targetCostRatio` 持久化**: 每个配方保存用户选择的 target cost ratio（默认 0.30）。`/recipes` 页面使用此值计算推荐售价显示。

**不存储其他 `results`**（Codex #9 修正）: 其余派生数据（ingredientCost、trueTotalCost 等）不持久化。加载配方时从 recipe 数据 + targetCostRatio 实时计算。这避免了公式变更后的数据不一致问题。

**Schema 命名统一**: 全部使用 `laborAndOverhead`（与 RFC-001 一致），不使用设计文档早期的 `hiddenCosts`。

**操作**:
- **Save**: Step 4b "Save recipe" → 序列化当前 recipe 数据 → 追加到数组
- **Update**: 编辑已保存配方 → 加载到 wizard → 完成后覆盖原条目（by id）
- **Delete**: `/recipes` 页面删除（确认弹窗）
- **Load**: `/recipes` 页面点击配方 → **检测 `recipecalc_current` 是否有未保存草稿** → 有则提示 "You have unsaved changes. Load this recipe anyway?" → 确认后覆盖

**JSON 导入/导出**（localStorage 安全网）:
- `/recipes` 页面提供 "Export all recipes" → 下载 `recipecalc-backup-YYYY-MM-DD.json`
- "Import recipes" → 上传 JSON → 合并到现有列表（by id 去重）
- 导出文件**只含配方数据，不含 license key**（key 是凭证不是数据，避免文件分享导致 key 泄露）
- License key 丢失后的恢复路径：重新粘贴 key 到 `/activate`（key 在购买邮件中）

**容量**: 单个配方约 1-2KB，localStorage 5-10MB，足够 2,500+ 配方。

### 5.7 `/recipes` 页面

Astro 静态页 + React island。

**状态**:
- **Empty**: 无已保存配方 → 插画 + "No recipes yet. Calculate your first recipe →" 链接到 `/calculator`
- **Normal**: 配方列表

**每张配方卡片显示**:
- 配方名
- Yield（24 cookies）
- 真实总成本（实时计算）
- 推荐售价（从 recipe 数据 + 保存的 `targetCostRatio` 实时计算）
- 保存日期
- [Edit] [Delete] 操作

**工具栏**:
- "Export all" → JSON 备份下载
- "Import" → JSON 文件上传

### 5.8 多渠道首发 — Etsy & Gumroad

**核心决策**: 不等网站验证转化率，多渠道同步首发。理由：Etsy 上同类模板已有 1,000+ reviews 证明需求存在。

**LemonSqueezy 作为唯一 key 源**: 所有渠道的 key 都由 LemonSqueezy 生成，确保 `/activate` 只需对接一个 API。

**方案 A: 预生成 key 批次分发**:

```
1. 在 LemonSqueezy 后台批量生成 key（50 个一批）
2. 下载 CSV → 上传到 Etsy/Gumroad 作为数字交付内容
3. 每个 Etsy 订单自动发送一个 key（Etsy 数字商品自动履约）
4. 定期检查库存 → 补货
```

**履约工作流**:

| 步骤 | 自有网站 | Etsy | Gumroad |
|------|---------|------|---------|
| 购买 | LemonSqueezy checkout | Etsy 原生结账 | Gumroad 原生结账 |
| Key 生成 | 自动（购买即生成） | 预生成批次 | 预生成批次 |
| Key 交付 | 自动重定向 `/activate?license_key=` | Etsy 数字文件（含 key + 使用说明 PDF） | Gumroad 数字文件（同上） |
| 激活 | 自动（URL 参数） | 手动粘贴到 `/activate` | 手动粘贴到 `/activate` |

**Etsy/Gumroad 交付文件内容**（单页 PDF + 纯文本）:
```
🔑 Your RecipeCalc License Key: XXXX-XXXX-XXXX-XXXX

How to activate:
1. Go to https://recipecalc.com/activate
2. Paste your key above
3. Click "Activate" — you're done!

What you get:
✓ Recommended pricing with adjustable slider
✓ Save unlimited recipes
✓ Copy & export results

Questions? Email support@recipecalc.com
```

**运营流程**:

| 事项 | 处理方式 |
|------|---------|
| 库存管理 | 每批预生成 50 keys。当 Etsy/Gumroad 库存 < 10 时补货。初期手动，量大后脚本化 |
| 退款 | Etsy/Gumroad 退款后，手动在 LemonSqueezy 后台禁用对应 key。用户下次 validate 时功能锁定 |
| 重复/争议 | 一个 key 只能激活 5 次（LemonSqueezy activation_limit）。超限 → 提示联系 support |
| 客服 | 单一邮箱 support@recipecalc.com。MVP 阶段手动处理，量小可控 |
| 定价差异 | 自有网站 $19，Etsy 可定 $15-19（Etsy 抽 15% 交易费），Gumroad $19 |

**风险承认**: 预生成 key 方案在 LemonSqueezy 文档中非标准路径（正常是购买即生成）。需要测试 LemonSqueezy 是否支持批量生成未关联订单的 key。**如果不支持**，备选方案：Etsy/Gumroad listing 引导买家到自有网站完成支付（Etsy listing 不直接卖 key，而是卖"购买入口"）。

### 5.9 已知简化 — Platform Fees

RFC-001 将 `platformFees` 设计为固定金额输入（非售价百分比），以避免推荐价的循环依赖。V1.1 延续此简化。

**对用户的影响**: 在 Etsy（15% 交易费）或 Facebook Marketplace 上卖的烘焙师，如果输入固定 $0 的 platform fees，推荐价会偏低。

**UI 处理**: Step 3 的 platform fees 字段增加 helper text："Enter a fixed dollar estimate. For percentage-based fees (like Etsy's 15%), estimate based on your expected selling price."

**V1.2 可考虑**: 增加"百分比模式"选项，通过迭代求解避免循环依赖。

### 5.10 Umami Analytics

**集成方式**: Umami Cloud 或自托管，`<script>` 标签在 Astro 全局 layout 中引入。

**选择理由**: 开源、GDPR-compliant、无 cookie。可自托管（免费，如 Cloudflare Workers / Vercel / Railway）或用 Umami Cloud（免费 tier 10K events/月，足够 MVP）。

**自定义事件**:

| 事件 | 触发时机 | 附加属性 |
|------|---------|---------|
| `step_complete` | 用户完成每一步并前进 | `step: 1\|2\|3\|4` |
| `wizard_complete` | 到达 Step 4（reveal 完成） | — |
| `paywall_view` | 付费墙进入视口（IntersectionObserver） | — |
| `paywall_click` | 点击 "Get Your Price" | — |
| `purchase_complete` | LemonSqueezy checkout 成功回调 | `channel: website` |
| `activate_success` | License key 激活成功 | `channel: website\|manual` |
| `activate_fail` | License key 激活失败 | `reason: invalid\|wrong_product\|limit\|network` |
| `copy_result` | 复制结果到剪贴板 | — |
| `save_recipe` | 保存配方 | — |
| `export_json` | 导出配方 JSON | — |
| `resume_recipe` | 从 localStorage 恢复配方 | — |
| `new_recipe` | 开始新配方 | — |

**漏斗**:
```
step_1 → step_2 → step_3 → wizard_complete → paywall_view → paywall_click → purchase_complete → activate_success
```

注意 `purchase_complete` 和 `activate_success` 之间可能有时间差（Etsy/Gumroad 用户购买后不会立即激活）。Umami 不追踪用户身份，所以跨会话归因不可能 —— 这是已知限制，Etsy/Gumroad 的转化率通过平台自身的 dashboard 追踪。

### 5.11 Edge Case Nudges

设计文档中定义的边界情况处理，MVP 未实现。

| 场景 | Nudge 行为 |
|------|-----------|
| 所有隐藏成本 = $0 | Step 3 → Step 4 过渡时显示温和提醒："Are you sure there are no labor or packaging costs? Most bakers have at least $X." 不阻断流程，可关闭 |
| 人工时间 = 0 小时 | 同上："A batch time of 0 means your time is free. Sure about that?" |
| 食材成本 ≥ 真实成本 | Reveal 变体 B（低差距版）：两个 box 均为中性色（灰色 border），文案变为 "Your hidden costs are unusually low — double-check your labor and packaging?" CTA 优先 "Revisit hidden costs →" |
| 推荐售价 < $1/unit | 提示 "This seems very low — consider whether your batch size is accurate." |

**Nudge 组件**: 遵循 DESIGN.md 风格 —— caution 色调背景 + 小图标的内联提示条。非 `border-left: 3px solid`。

### 5.12 数据模型总览

```json
{
  "recipecalc_current": {
    "version": 1,
    "step": 2,
    "recipe": { /* 同 RFC-001，字段名统一用 laborAndOverhead */ }
  },
  "recipecalc_recipes": [
    {
      "id": "uuid",
      "version": 1,
      "savedAt": "ISO-8601",
      "updatedAt": "ISO-8601",
      "recipe": { /* 同 recipecalc_current.recipe */ },
      "targetCostRatio": 0.30
    }
  ],
  "recipecalc_license": {
    "key": "xxx-xxx-xxx",
    "instanceId": "lemonsqueezy-instance-id",
    "activatedAt": "ISO-8601",
    "storeId": "12345",
    "productId": "67890"
  }
}
```

**与 RFC-001 schema 的差异**: 无。`laborAndOverhead` 命名已在 RFC-001 中确定。设计文档早期使用的 `hiddenCosts` 不采纳。

### 5.13 新增 React Context

**`LicenseContext`**: 全局 license 状态管理。

```typescript
interface LicenseState {
  isUnlocked: boolean;
  license: {
    key: string;
    instanceId: string;
    activatedAt: string;
  } | null;
}

interface LicenseActions {
  activate: (key: string) => Promise<ActivateResult>;
  deactivate: () => void;
}

type ActivateResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'wrong_product' | 'limit_reached' | 'network' };
```

- Provider 在 Wizard island 和 Recipes island 的顶层包裹
- 启动时从 localStorage 读取 license 数据
- `isUnlocked` 驱动所有付费墙条件渲染
- 不做启动时自动 re-validate（离线友好）
- 提供手动 "Re-validate" 按钮（在 `/recipes` 页面底部）

### 5.14 新增页面与路由

```
/                → 落地页（不变）
/calculator      → 计算器 wizard（Step 4 拆分）
/activate        → License key 激活页（新增）
/recipes         → 配方列表页（新增，付费功能）
```

### 5.15 新增依赖

无新增 npm 依赖。

- `crypto.randomUUID()` 替代 `uuid` 包（所有现代浏览器支持）
- LemonSqueezy 无需 SDK，直接 `fetch` + form-encoded
- Umami 通过 `<script>` 标签引入，无 npm 包

## 6. Implementation Plan

| Phase | Focus | Tickets | 前置依赖 |
|-------|-------|---------|---------|
| **P1: 基础设施** | LicenseContext + localStorage recipes hook + Umami script | 3 tickets | 无 |
| **P2: 激活流程** | `/activate` 页面 + LemonSqueezy activate/validate API 集成 + URL 参数自动激活 | 2 tickets | P1 |
| **P3: 付费墙** | Step 4 拆分 + Paywall Card + 模糊推荐售价 + LemonSqueezy checkout 按钮 | 3 tickets | P1 |
| **P4: 配方管理** | Save recipe + `/recipes` 页面 + CRUD + JSON 导入/导出 + 草稿冲突检测 | 3 tickets | P1, P3 |
| **P5: 收尾** | Edge case nudges + 全部 analytics 事件 + 测试 | 3 tickets | P1-P4 |
| **P6: 多渠道** | LemonSqueezy 产品配置 + 预生成 key 测试 + Etsy/Gumroad listing 创建 + 交付文件制作 | 运营 tickets | P2 |

**P2 和 P3 可并行**（都依赖 P1 但彼此独立）。
**P6 和 P1-P5 可部分并行**（运营准备不依赖代码完成）。

## 7. Acceptance Criteria

### 付费墙 & License

- [ ] 免费用户：Step 4a reveal 完整可见（动画 + 数据 + gap bar）
- [ ] 免费用户：推荐售价显示为模糊 "$?.??"，滑块锁定，复制/保存按钮触发付费墙
- [ ] 付费墙卡片在 Step 4b 内联显示（dashed border，非 modal），包含功能列表 + 价格 + CTA
- [ ] "Get Your Price" 按钮正确打开 LemonSqueezy checkout
- [ ] `/activate` 页面：手动粘贴 key → activate API → 验证 store_id + product_id → 成功解锁
- [ ] 自有网站购买：Lemon.js overlay checkout 完成后通过 JS 回调自动激活（key 不经过 URL）
- [ ] 4 种错误状态（invalid / wrong_product / limit / network）均有明确提示
- [ ] 付费用户：推荐售价 + 滑块 + 复制 + 保存全部可用
- [ ] 刷新页面 / 关闭重开后 license 状态保持
- [ ] 浏览器清除数据后重新粘贴 key 可再次激活

### 配方管理

- [ ] Step 4b "Save recipe" 成功保存到 `recipecalc_recipes`（仅 recipe 数据，不存派生 results）
- [ ] `/recipes` 页面正确列出所有已保存配方，成本和推荐售价实时计算显示
- [ ] 点击配方可加载到 wizard 编辑；如有未保存草稿则提示确认
- [ ] 删除配方有确认弹窗
- [ ] JSON 导出：下载仅含配方数据的备份文件（不含 license key）
- [ ] JSON 导入：上传备份文件，合并到现有列表（by id 去重）
- [ ] 空状态显示引导文案和链接

### Analytics

- [ ] Umami tracking script 在所有页面加载
- [ ] 漏斗事件完整：step_complete → wizard_complete → paywall_view → paywall_click → purchase_complete → activate_success
- [ ] `purchase_complete` 在 LemonSqueezy checkout 成功回调时触发

### Edge Case Nudges

- [ ] 所有隐藏成本 = $0 时显示温和提醒（不阻断流程）
- [ ] 人工时间 = 0 时显示温和提醒
- [ ] 食材成本 ≥ 真实成本时 reveal 使用变体 B（中性色调）
- [ ] Nudge 组件遵循 DESIGN.md 风格

### 多渠道

- [ ] LemonSqueezy 产品创建（$19，activation_limit=5）
- [ ] 预生成 key 批次可在 `/activate` 正常激活
- [ ] Etsy listing 上架（数字产品，含交付文件）
- [ ] Gumroad listing 上架（数字产品，含交付文件）

### 响应式 & 可访问性

- [ ] `/activate`、`/recipes` 均为 mobile-first 响应式
- [ ] 付费墙卡片在 375px 下正常显示
- [ ] 所有新增 UI 键盘可操作
- [ ] 付费墙和锁定状态对屏幕阅读器有适当 aria 标注

## 8. Open Questions

1. ~~**免费/付费边界**~~ → 已决策：遵循设计文档，推荐售价付费
2. ~~**V1.1 范围**~~ → 已决策：PDF 导出和多配方对比推迟到 V1.2
3. ~~**多渠道时机**~~ → 已决策：首发多渠道，Etsy/Gumroad 同步上线
4. ~~**LemonSqueezy checkout 形式**~~ → 已决策：Lemon.js overlay + `Checkout.Success` 回调自动激活
5. **LemonSqueezy 批量 key 预生成**: 官方是否支持？需要实际测试。不支持则 Etsy/Gumroad 改为引流到网站
6. ~~**Analytics 选型**~~ → 已决策：使用 Umami（开源、免费自托管或 Cloud 免费 tier）
7. **Etsy 定价**: $15 还是 $19？$15 扣除 Etsy 15% 手续费后到手 $12.75。是否值得为了平台竞争力降价？

## 9. Codex Review Findings — Disposition

| # | Finding | Severity | Disposition |
|---|---------|----------|-------------|
| 1 | LemonSqueezy API 端点和格式错误 | Critical | **Fixed** — 5.2 节改用 `/activate` + form-encoded |
| 2 | 未校验 store_id/product_id | Critical | **Fixed** — 5.2 节增加 product 校验 |
| 3 | 免费/付费边界与产品 wedge 矛盾 | Design | **Acknowledged** — 设计文档已做此 tradeoff 决策，RFC 遵循 |
| 4 | MVP 迁移是功能降级 | Medium | **Fixed** — 5.1 节诚实承认降级，不做文案粉饰 |
| 5 | 自有网站激活摩擦过高 | High | **Fixed** — 5.3 节改用 Lemon.js overlay + JS 回调自动激活（R2: 不再用 URL 参数，避免凭证泄露） |
| 6 | 多渠道计划空洞 | High | **Fixed** — 5.8 节补全履约工作流、退款、库存、客服 |
| 7 | localStorage "无限配方" 不可靠 | Medium | **Fixed** — 5.6 节增加 JSON 导入/导出安全网（R2: 备份不含 license key，避免凭证泄露） |
| 8 | 卖简化数学的推荐价 | Low | **Acknowledged** — 5.9 节新增，承认简化并增加 UI 提示 |
| 9 | Schema 命名不一致 + 派生数据问题 | Medium | **Fixed** — 统一用 `laborAndOverhead`，不存储 results |
| 10 | License 生命周期缺失 | Medium | **Fixed** — 5.4 节新增完整生命周期表 |
| 11 | 保存/加载草稿冲突 | Medium | **Fixed** — 5.6 节 Load 操作增加草稿冲突检测 |
| 12 | V1.1 范围膨胀 | High | **Fixed** — PDF 导出和多配方对比移至 V1.2 |
| 13 | 漏斗缺少购买事件 | Medium | **Fixed** — 5.10 节增加 `purchase_complete` 事件（R2: 触发时机明确为 Lemon.js `Checkout.Success` 回调） |

### Codex R2 — 新发现处置

| # | Finding | Disposition |
|---|---------|-------------|
| R2-1 | URL 参数传递 license key 是凭证泄露 | **Fixed** — 改用 Lemon.js JS 回调，key 不经过 URL |
| R2-2 | 备份文件含 license key 增加泄露路径 | **Fixed** — 备份只含配方数据，不含 key |
| R2-3 | `/recipes` 引用未存储的 `targetCostRatio` | **Fixed** — schema 增加 `targetCostRatio` 字段持久化 |
