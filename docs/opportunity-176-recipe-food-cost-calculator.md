# Research Report: Recipe & Food Cost Calculator

> **NOTE**: This is the original market research document. The approved implementation
> spec is in `docs/design-recipecalc-pricing-therapist.md`. Where they differ (pricing
> model, tech stack, feature tiers), the design doc is authoritative. This document is
> retained as historical context for demand validation and competitive analysis.

## Opportunity Summary

| Field | Value |
|---|---|
| ID | #176 (合并 #83) |
| Score | 8/10 |
| Category | tool-site → freemium SaaS |
| Discovery | Marketplace (Etsy 1K+ reviews) + SERP Gap + Reddit (4 社区) |
| Target User | 家庭烘焙师、Cottage Food 经营者、小型餐厅 |
| Adjacent | #62 BBQ Calculator, #76 Nutrition Label Generator, #88 Craft Calculator |

---

## 1. 需求验证 (三重交叉验证)

### 1.1 Marketplace 验证 — Etsy/Gumroad

| 来源 | 证据 |
|---|---|
| Etsy: Recipe Cost Calculator | **1,000+ reviews**, 4.9 stars, 单一 listing |
| Etsy: Recipe Cost (Google Sheets 版) | 112 reviews, 4.8 stars |
| Etsy: Recipe Cost & Pricing Calculator | 多个 Star Seller 标记 |
| Etsy: 同类竞品卖家数量 | **8-10 个独立卖家**卖同类模板 |
| 价格区间 | $5-$15/份 |

**推算销量**: Etsy reviews ≈ 10-20% of sales → 1,000 reviews ≈ 5,000-10,000 份销售。按 $10 均价 = **$50K-$100K 已验证市场规模**（仅单一卖家）。

**用户为什么买 spreadsheet 而不用免费工具？** 因为现有免费工具要么需要注册、要么功能太简陋、要么是 SaaS lead-gen 页面（故意限制功能引导付费）。Spreadsheet 给了"拥有感"——下载就是自己的，可以自定义。

### 1.2 SERP 验证 — 搜索量与商业价值

| 关键词 | 月搜索量 | CPC | 竞争度 |
|---|---|---|---|
| food cost calculator | 2,400 | **$9.75** | MEDIUM |
| menu pricing calculator | 2,400 | **$9.75** | MEDIUM |
| food cost formula | 1,600 | $7.98 | LOW |
| recipe cost calculator | 880 | **$8.88** | LOW |
| food cost percentage calculator | 480 | $4.28 | LOW |
| food budget calculator | 480 | $2.34 | LOW |
| restaurant food cost calculator | 390 | **$13.37** | MEDIUM |
| recipe cost calculator free | 390 | $4.34 | LOW |
| baking cost calculator | 260 | $7.45 | LOW |
| ingredient cost calculator | 260 | $6.73 | LOW |
| recipe price calculator | 210 | **$9.53** | LOW |
| **集群总计** | **~10,000+/月** | **均值 $7-8** | **大部分 LOW** |

**CPC 对比**（为什么这个 niche 的广告价值极高）:
- Recipe cost calculator: $8.88 — 比 mulch calculator ($0.75) 高 **12 倍**
- Restaurant food cost: $13.37 — 比 fence calculator ($3.65) 高 **3.7 倍**
- 原因：搜索这些词的人是**做生意的人**（餐厅老板、烘焙师），不是消费者。广告主（食品供应商、POS 系统、SaaS 工具）愿意花大钱触达他们。

### 1.3 Reddit 验证 — 痛点深度

| 社区 | 帖子 | 核心痛点 |
|---|---|---|
| r/BBQ | 420pts/143c "ever price out a brisket plate and realize you've been undercharging for years?" | **系统性低估成本**: 生肉 $3.99/lb → 修剪烟熏后 $9.32/lb → 需要 3x 售价才达 30% food cost 目标 |
| r/BakingPhilippines | 908pts/43c "The Importance of Proper Costing" | **定价恐惧**: "Takot na takot mag costing"（害怕做成本核算）。有人主动分享自己的成本表格。国际需求验证。 |
| r/cookiedecorating | 8pts/14c "Pricing for more cookies?" | **Imposter syndrome**: "I have a hard time charging what I should because I know I couldn't afford it" |
| r/restaurateur | 0pts/20c (原 #83 来源帖) | MarginEdge $300+/mo 太贵，xtraCHEF $279/mo 太复杂。有人自己做了 app 获得正面反馈。 |

**痛点本质**: 不是"没有工具"，而是**人们害怕面对真实成本**，因为：
1. 算出来发现自己一直在亏钱 → 心理冲击
2. 涉及复杂的单位换算（盎司→磅、毫升→杯）→ 容易算错
3. 需要考虑损耗率（trim loss, cook shrinkage）→ 大多数人忽略这一步
4. 需要分摊人工和间接成本（电费、包装、运输）→ 大多数人跳过

---

## 2. 竞品分析

### 2.1 竞品矩阵

| 竞品 | 定位 | 定价 | 免费功能 | 需登录 | 弱点 |
|---|---|---|---|---|---|
| **recipecostcalculator.net** | 餐厅级 SaaS | $29/月起 | 有限 | ✅ | 太重——含库存、发票、营养标签。中小用户被功能淹没 |
| **cakecost.net** | 家庭烘焙 | 未公开 | 不明 | ✅ | 纯 JS 渲染无法评估，SEO 弱（无内容页） |
| **foodmaths.com** | 免费工具 | 免费 | 全部免费 | ❌ | 功能齐全但**无保存功能**，每次从零开始。靠广告变现 |
| **bakeprofit.com** | 家庭烘焙 freemium | $6.99/月 | 计算器+5配方 | ❌ (基础) | 免费版限 5 配方 15 订单/月。UI 一般 |
| **menubly.com** | 餐厅菜单系统 | 免费工具 | 计算器 | ❌ | 计算器是 lead-gen，引导注册菜单系统。功能单一 |
| **cookkeepbook.com** | 全功能配方管理 | $9/月 | 无限配方 | ✅ | 免费版不错但无利润率告警、无导出、无营养数据 |
| **supy.io** | 餐厅采购 SaaS | 免费工具 | 计算器 | ❌ | 同 menubly，计算器是 lead-gen。引导购买采购系统 |

### 2.2 竞争格局分析

**没有赢家**。这个市场高度碎片化：

- **专业 SaaS（$29-330/月）**: recipecostcalculator.net, MarginEdge, xtraCHEF → 功能强大但**对家庭烘焙师太贵太复杂**
- **免费 lead-gen 工具**: menubly, supy → 功能故意受限，目的是卖 SaaS
- **独立工具站**: foodmaths.com, bakeprofit.com → 最接近的竞品，但**一个无保存，一个限配方数**
- **Etsy 模板 ($5-15)**: 证明需求存在，但用户体验差（Excel/Google Sheets）

**核心竞争空白**:

> 没有一个工具同时满足：**免费 + 无需注册 + 能保存配方 + 支持家庭烘焙师和小餐厅 + 有升级路径**。

- foodmaths.com 最接近（免费无登录）但不能保存
- bakeprofit.com 有保存但限 5 配方
- cookkeepbook.com 功能全但必须注册

### 2.3 竞品流量估计

| 竞品 | 预估月流量 | 主要流量来源 |
|---|---|---|
| recipecostcalculator.net | 10K-50K | 品牌搜索 + "recipe cost calculator" |
| foodmaths.com | 5K-20K | "food cost calculator" SEO |
| bakeprofit.com | 5K-15K | "baking cost calculator" + 长尾 |
| cakecost.net | 2K-10K | "cake cost calculator" |
| menubly.com/tools | 10K-30K | 多工具矩阵 + 品牌 |
| cookkeepbook.com | 5K-15K | "recipe cost" 长尾 |

*注: 无 SimilarWeb 精确数据，基于 SERP 排名和关键词 volume 推算。*

---

## 3. 目标用户画像

### 画像 A: 家庭烘焙师 / Cottage Food (体量大)

- **谁**: 在家做蛋糕、饼干、面包出售的人。美国 cottage food 法律允许居家小规模食品销售
- **痛点**: "我做了一批饼干花了 $40 原料 + 3 小时工时，卖 $30 一打，感觉在赚钱但其实在亏"
- **当前方案**: $10 Etsy 模板 或 自己搞的 Google Sheets 或 纸笔 或 凭感觉
- **付费意愿**: $0-7/月（从免费 Etsy 模板到 bakeprofit $6.99/月的价格锚定）
- **规模**: 美国 cottage food 经营者估计 100K-300K 人（每个州法律不同但趋势放宽）
- **发现渠道**: Google 搜索、Instagram/TikTok 烘焙社区、Etsy 卖家论坛、Reddit

### 画像 B: 小型餐厅/Food Truck (高价值)

- **谁**: 独立餐厅老板、food truck 经营者、小型 catering 公司
- **痛点**: "MarginEdge 要 $330/月但我只需要算 food cost percentage 和定价"
- **当前方案**: Excel 或 自制 Google Sheets 或 在发票上手算
- **付费意愿**: $10-30/月（锚定在 "比 MarginEdge 便宜 10x"）
- **规模**: 美国约 100 万家独立餐厅
- **发现渠道**: Google 搜索、r/restaurateur、行业论坛

### 画像 C: 国际烘焙师 (扩展)

- **谁**: 菲律宾、拉美、东南亚的小型烘焙生意
- **痛点**: 同画像 A，但更敏感于价格，更需要多币种支持
- **当前方案**: 纸笔 或 简单 Excel
- **付费意愿**: $0-3/月
- **规模**: 巨大但 ARPU 低
- **发现渠道**: Facebook 群组、本地烘焙社区

---

## 4. 产品定义

### 4.1 核心功能 (MVP — Free, No Login)

| 功能 | 描述 | 竞品对标 |
|---|---|---|
| **配方成本计算器** | 输入食材名称、购买价格、包装量、配方用量 → 自动算单份成本 | foodmaths 有，但无保存 |
| **单位自动换算** | oz↔g, cup↔ml, lb↔kg, 支持常见烘焙/烹饪单位 | 多数竞品有 |
| **成本可视化** | 饼图显示各食材成本占比，一眼看出最贵食材 | foodmaths/bakeprofit 有 |
| **定价建议** | 输入目标利润率 → 输出建议售价。支持 cost-plus / food-cost-% 两种模式 | 多数竞品有 |
| **配方缩放** | 1x → 2x → 5x，自动调整所有食材量和成本 | recipecostcalculator 有 |
| **损耗率计算** | 输入 trim/cook shrinkage % → 自动调整真实单位成本 | **多数竞品缺失，这是差异点** |

**为什么 MVP 就能赢**: 免费 + 无需注册 + 损耗率 + 即时可用。比 foodmaths 多"损耗率"，比 bakeprofit 没有 5 配方限制。

### 4.2 增值功能 (Free with Account)

| 功能 | 描述 | 为什么免费给 |
|---|---|---|
| **保存配方** | 注册后可保存无限配方 | 建立用户粘性，制造切换成本 |
| **配方库** | 所有保存的配方一览，按类别/成本排序 | 用户回访率 |
| **分享配方** | 生成公开链接分享给合伙人/员工 | 口碑传播 |
| **多币种** | USD/EUR/GBP/PHP 等 | 覆盖国际用户 (画像 C) |

### 4.3 付费功能 (Pro — $7/月 或 $49/年)

| 功能 | 描述 | 为什么付费 |
|---|---|---|
| **菜单/产品线管理** | 多配方对比，整体 food cost % 仪表板 | 餐厅用户核心需求 |
| **食材价格历史** | 追踪同一食材随时间的价格变化 | 采购优化 |
| **PDF/Excel 导出** | 导出配方卡、成本报告 | 专业用途 (给投资人/银行) |
| **营养标签生成** | 基于 USDA FoodData Central API 自动生成 | cottage food 合规需求 |
| **批量定价工具** | 输入订单数量 → 计算总原料需求 + 总成本 + 报价 | catering 场景 |

### 4.4 未来功能 (Business — $20-25/月)

| 功能 | 描述 |
|---|---|
| 发票 AI 解析 | 拍照/上传供应商发票 → 自动更新食材价格 |
| 多用户 | 老板 + 厨师分别登录 |
| POS 集成 | 对接 Square/Toast 等 POS 数据 |
| 库存追踪 | 实时原料库存，低库存告警 |

---

## 5. 商业化路径

### 5.1 收入模型

```
                     用户旅程
                        │
     ┌──────────────────┼──────────────────┐
     │                  │                  │
  Google 搜索       社交媒体/Reddit     Etsy 模板用户迁移
  (10K+/月)        (分享/推荐)         (看到"免费在线版")
     │                  │                  │
     └──────────────────┼──────────────────┘
                        │
                   免费计算器 (无需注册)
                   ← 广告收入 ($8-13 CPM 行业)
                        │
                   注册 (保存配方)
                   ← 用户数据 → 留存率
                        │
              ┌─────────┼─────────┐
              │                   │
         家庭烘焙师              餐厅老板
         (量大, 低 ARPU)         (量小, 高 ARPU)
              │                   │
         Pro $7/月              Pro $7/月
         (导出, 营养标签)       (菜单管理, 价格历史)
              │                   │
              │              Business $25/月
              │              (发票解析, 多用户, POS)
              │                   │
              └─────────┬─────────┘
                        │
                  年度收入目标
```

### 5.2 收入预测 (保守)

| 阶段 | 时间 | 月流量 | 注册用户 | 付费用户 | 月收入 |
|---|---|---|---|---|---|
| Launch | 0-3 月 | 500 | 50 | 0 | ~$50 (广告) |
| Growth | 3-6 月 | 3,000 | 500 | 15 | ~$200 (广告 + Pro) |
| Traction | 6-12 月 | 10,000 | 2,000 | 80 | ~$800 |
| Scale | 12-24 月 | 30,000 | 8,000 | 300 | ~$3,000 |

*假设: 2% 访客注册, 4% 注册用户付费 Pro ($7/月), RPM $5 广告收入*

### 5.3 Go-to-Market 策略

**Phase 1: SEO Landing (月 0-3)**
- 构建免费计算器，目标关键词: "recipe cost calculator", "food cost calculator", "baking cost calculator"
- 每个细分做独立页面: cake cost calculator, cookie pricing calculator, BBQ cost calculator
- 配套内容: "How to Price Baked Goods: Complete Guide", "Food Cost Percentage Explained"
- 技术 SEO: schema markup, fast loading, mobile-first

**Phase 2: Community Seeding (月 1-3)**
- r/Baking, r/cookiedecorating, r/BakingPhilippines, r/BBQ — 以 helpful 身份参与定价讨论，自然提及工具
- Facebook 群组: "Cottage Food Business", "Home Bakers" 等
- 不做硬推广，回答"怎么定价"问题时附带工具链接

**Phase 3: Content Flywheel (月 3-6)**
- 博客: "Why You're Undercharging for Your Cakes (And How to Fix It)"
- 工具化内容: "Brisket Trim Loss Calculator", "Cake Serving Size & Price Chart"
- 每个内容页面都嵌入计算器 widget

**Phase 4: Upgrade Push (月 6-12)**
- 用户保存 5+ 配方后提示 Pro
- Email 序列: 免费定价指南 → 高级技巧 → Pro 功能介绍
- Catering/餐厅用户触达: "food cost calculator for restaurants" 专用 landing page

### 5.4 竞争策略

| 对手 | 我们的优势 |
|---|---|
| Etsy 模板 ($5-15) | 免费 + 更好的 UX + 自动计算 + 不需要 Excel |
| foodmaths.com (免费) | 能保存配方 + 损耗率计算 |
| bakeprofit.com ($6.99/月) | 免费版无配方数限制 |
| recipecostcalculator.net ($29/月) | 免费入门 + 只为需要的功能付费 |
| menubly/supy (lead-gen) | 真正的独立工具，不是某个 SaaS 的鱼饵 |

---

## 6. 技术方案

### 6.1 架构

```
Frontend (静态站, SEO-first)
├── 计算器页面 (React/Next.js, SSR for SEO)
├── 内容/博客页面 (MDX)
└── 用户仪表板 (CSR, 登录后)

Backend (轻量级)
├── Auth (Supabase Auth 或类似)
├── 配方数据存储 (Supabase Postgres)
├── USDA FoodData Central API (营养数据, 免费)
└── Stripe (支付)

部署
├── Cloudflare Workers + Assets (前端)
└── Supabase (后端 + 数据库)
```

### 6.2 数据来源

| 数据 | 来源 | 更新频率 | 成本 |
|---|---|---|---|
| 营养数据 | USDA FoodData Central API | 年度 | 免费 |
| 单位换算 | 内置数据库 (1000+ 食材) | 一次性 | 免费 |
| 食材默认价格 | 用户输入为主，可选参考价格 | 用户驱动 | 免费 |
| 地区 food cost benchmarks | BLS + 行业报告 | 年度 | 免费 |

### 6.3 AI Build Leverage

| 组件 | AI 能做 | 预估时间 |
|---|---|---|
| 计算引擎 | ✅ 全部 | 1-2 天 |
| 单位换算数据库 | ✅ 生成 + 验证 | 半天 |
| UI 组件 | ✅ 大部分 | 2-3 天 |
| SEO 内容页 | ✅ 生成框架 + 人工审核 | 1-2 天 |
| USDA API 集成 | ✅ 全部 | 半天 |
| Auth + 数据库 | ✅ 全部 (Supabase boilerplate) | 1 天 |
| **MVP 总计** | | **~1-2 周** |

---

## 7. 风险与缓解

| 风险 | 严重性 | 缓解措施 |
|---|---|---|
| OmniCalculator 做一个更好的 food cost 页面 | 中 | 他们做通用计算器，我们做垂直深度（配方库、损耗率、多配方管理）|
| foodmaths.com 加保存功能 | 中 | 先发优势 + 社区运营 + Pro 功能差异化 |
| 大 SaaS (Toast, Square) 内置 food cost 工具 | 低 | 他们服务企业客户，不会做免费工具给 cottage food 用户 |
| SEO 排名上不去 | 中 | 多页面矩阵策略 + 长尾关键词 + 内容营销 |
| 用户不付费转 Pro | 高 | 广告收入作为基础，Pro 是锦上添花。$5 RPM × 30K 访客 = $150/月广告底线 |

---

## 8. 最终评估

### 机会评分卡

| 维度 | 评分 | 依据 |
|---|---|---|
| 痛点验证 | **强** | 4 个 Reddit 社区 + 908pts 帖子 + 420pts 帖子 |
| 付费意愿 | **强** | Etsy 1,000+ reviews，$5-15 模板销售 |
| 搜索需求 | **强** | 10K+/月集群，$7-13 CPC |
| 竞争 | **低-中** | 碎片化，无主导者，空白点清晰 |
| Solo-dev 适配 | **强** | AI build 1-2 周，ops 近零（用户供数据）|
| 升级路径 | **清晰** | 免费工具 → Pro $7/月 → Business $25/月 |

| 三维评估 | 评分 | 说明 |
|---|---|---|
| AI Build Leverage | 4/5 | 配方计算 + UI + USDA API，AI 可完成 90% |
| Complexity Moat | 3/5 | 单位换算库 + 损耗率 + 多配方管理 = 中等护城河 |
| Ops Burden | 5/5 | 用户输入自己的食材价格，无需维护价格数据库 |
| Trust Burden | 5/5 | 计算器，不是建议。无需信任 |

### 最终 Score: 8/10

**Confidence: High**

**推荐下一步**: 立即进入开发。MVP 可在 1-2 周内完成（免费计算器 + 基础 SEO 页面）。与 #12 GDD Calculator 共享部署基础设施。

**关键差异化**: 免费 + 无需注册 + 损耗率计算 + 无配方数限制 = 击败所有现有竞品的免费版。

**最大风险**: SEO 排名需要时间。建议在 community seeding（Reddit/Facebook）和 SEO 双线并行。
