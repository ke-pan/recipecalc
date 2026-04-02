# RFC-003: Ingredient Pantry + Template Mode

| Field | Value |
|-------|-------|
| **RFC** | 003 |
| **Title** | Ingredient Pantry + Template Mode |
| **Status** | Approved |
| **Author** | Claude Code & panke |
| **Created** | 2026-04-01 |
| **Updated** | 2026-04-01 |
| **Depends on** | RFC-001 (MVP), RFC-002 (付费功能) |
| **Design Doc** | `~/.gstack/projects/ke-pan-recipecalc/panke-main-design-20260401-172001.md` |
| **Epic Issue** | #29 |

---

## 1. Background & Motivation

RecipePricer 的 wizard 模式对第一次用户很好（引导式体验 + reveal），但对有 20-50 个配方的重度用户来说，每次都走一遍 4 步 wizard 很痛苦。Etsy 上同类 Excel 模板有 1,000+ reviews（$5-15），证明批量管理配方成本的需求真实存在。

"做一个在线表格"不是答案。如果和 Excel 一样，用户没有理由换过来。

**核心洞察**: web app 相比 Excel 有结构性优势 — **级联更新**。在 Excel 里，改一次黄油价格要手动修改 20 个 sheet。在 RecipePricer 里，改一次 Pantry 里的黄油价格，所有引用它的配方自动重算成本和推荐售价。这是 Excel 物理上做不到的。

## 2. Goals

1. **Ingredient Pantry**: 新增 `/pantry` 页面 — 用户的食材价格库，CRUD 食材和价格
2. **Template Mode**: 新增 `/template` 页面 — 多配方表格视图，替代 `/recipes` 的卡片视图，成本实时计算
3. **级联更新**: 改 Pantry 价格 → template 里所有引用该食材的配方自动更新成本和推荐售价
4. **Wizard 集成**: 付费用户在 Wizard Step 2 从 Pantry 自动填充价格
5. **统一付费边界**: $19 解锁一切（推荐售价 + /pantry + /template + 无限配方）
6. **JSON 导出 v2**: 导出包含 Pantry + Recipes，导入兼容 v1

## 3. Non-Goals

- **TanStack Table / 全表格体验**: 不做 inline editing 的 spreadsheet UI（Phase 2 考虑）
- **Sub-recipes / 组件配方**: 不做配方嵌套（如 buttercream 作为 cupcake 的子配方）
- **食材价格 API**: 不接入 USDA 或其他外部价格源
- **跨标签页同步**: 不做 `storage` event 监听（单标签页假设）
- ~~**数据迁移**: 产品未上线，不需要迁移旧数据~~
- **后端 / Supabase**: 继续纯 localStorage

## 4. User Stories

| ID | As a... | I want to... | So that... |
|----|---------|-------------|-----------|
| US-19 | 付费用户 | 在 Pantry 里管理我常用的食材和价格 | 不用每次添加配方都重新输入价格 |
| US-20 | 付费用户 | 在 Pantry 里改一次食材价格 | 所有用到这个食材的配方自动更新成本 |
| US-21 | 付费用户 | 在 Template 页面看到所有配方的成本和售价表格 | 一眼比较所有配方的盈利情况 |
| US-22 | 付费用户 | 展开某个配方看食材明细 | 了解该配方的成本构成 |
| US-23 | 付费用户 | 将 wizard 创建的旧配方关联到 Pantry 食材 | 旧配方也能享受级联更新 |
| US-24 | 付费用户 | 在 Wizard Step 2 看到 Pantry 里的食材 | 不用重复输入价格，直接从 Pantry 选 |
| US-25 | 免费用户 | 访问 /pantry 或 /template 时被引导到 /activate | 知道这是付费功能 |
| US-26 | 付费用户 | 导出包含 Pantry 和配方的备份 | 换设备时不丢数据 |
| US-27 | 付费用户 | 在 Template 页面直接添加配方（Quick Add） | 不用每次都走 wizard 的 4 步引导 |
| US-28 | 付费用户 | 设置默认时薪和间接费用 | 每个新配方自动用我的时薪，不用重复填 |
| US-29 | 付费用户 | 在添加配方时顺手把新食材存到 Pantry | 不用专门去 Pantry 页面维护，用着用着就积累了 |

## 5. Technical Design

### 5.1 Architecture

两个新页面（`/pantry`, `/template`），一个新数据层（Pantry localStorage），一个桥接层（hydration）。现有计算引擎 `calculateTotalCosts()` 不变。

```
┌──────────────────────────────────────────────────┐
│                  localStorage                     │
│  recipepricer_pantry    recipepricer_recipes          │
│  [PantryItem[]]       [SavedRecipe[]]             │
└──────┬───────────────────────┬────────────────────┘
       │                       │
       ▼                       ▼
┌──────────────┐      ┌────────────────┐
│  usePantry() │      │  useRecipes()  │
│  CRUD hook   │      │  existing hook │
└──────┬───────┘      └───────┬────────┘
       │                       │
       └───────────┬───────────┘
                   ▼
          ┌─────────────────┐
          │ hydrateIngredient│   Pantry + Recipe → full Ingredient
          │ (bridge layer)   │
          └────────┬────────┘
                   ▼
          ┌─────────────────┐
          │calculateTotalCosts│   existing, unchanged
          └─────────────────┘
```

### 5.2 Data Model

**新增 `localStorage.recipepricer_pantry`:**
```typescript
interface PantryItem {
  id: string;           // crypto.randomUUID()
  name: string;         // "All-Purpose Flour" — 唯一性约束，add/update 时检查重名
  ingredientKey: string; // "all-purpose-flour" — 稳定语义 key，匹配 common-ingredients.ts 和 density-data.ts
  purchaseUnit: string; // "lb" — 购买时的单位
  purchaseAmount: number; // 5 — 购买数量
  purchasePrice: number;  // 4.99 — 购买总价
  updatedAt: string;    // ISO-8601
}
// 注意: pricePerUnit 不存储，渲染时计算 purchasePrice / purchaseAmount
// 注意: 删除了 defaultUnit（Codex #8 — 无定义行为，purchaseUnit 已足够）
// 注意: name 必须唯一（Codex #6 — 防止 Link dropdown 和 autocomplete 歧义）
```

**新增 `localStorage.recipepricer_defaults`:**
```typescript
interface UserDefaults {
  hourlyRate: number;    // 默认时薪，如 15
  packaging: number;     // 默认包装费/batch，如 2
  overhead: number;      // 默认间接费用/batch，如 5
  platformFees: number;  // 默认平台费/batch，如 0
}
```

Labor 和 overhead 在不同配方之间基本不变（时薪不会因为做 cookies 还是 cake 而改变）。Pantry 页面提供 "My Defaults" 区域设置这些全局值。Wizard Step 3 和 Quick Add 默认用这些值预填，用户可以在单个配方里覆盖。

**扩展 `Ingredient` 类型（向后兼容）:**
```typescript
interface Ingredient {
  id: string;
  name: string;
  purchaseAmount: number;
  purchaseUnit: string;
  purchasePrice: number;
  usedAmount: number;
  usedUnit: string;
  wastePercent: number;
  pantryId?: string | null;  // 新增 — 引用 Pantry 食材的 ID
  ingredientKey?: string;    // 新增 — 稳定语义 key（如 "all-purpose-flour"），用于密度表查找
}
```

**`ingredientKey` 解释（Codex #1, #7）:**
当前 wizard Step 2 用 `crypto.randomUUID()` 作为 `ingredient.id`，但单位换算的密度表（`density-data.ts`）需要稳定的语义 key（如 "all-purpose-flour"）。现有代码在 Step 2 编辑时用 `ingredientId` 做密度查找，但保存后丢弃。

修复：`Ingredient` 新增 `ingredientKey` 可选字段。Step 2 选择 autocomplete 食材时写入此字段。Pantry 的 `ingredientKey` 同样存储该值。Hydration 层用 `ingredientKey`（不是 `id`）做密度查找。旧配方没有此字段时回退到同类别换算（不做跨类别）。

当 `pantryId` 存在且有效时，`purchaseAmount`, `purchaseUnit`, `purchasePrice` 从 Pantry 实时获取（hydration 层处理）。当 `pantryId` 为 `null`/`undefined` 或指向已删除的 Pantry 项时，使用 Ingredient 自身的内嵌值。

**注意**: 产品未上线，不需要向后兼容旧数据。`ingredientKey` 和 `pantryId` 是必填字段（Pantry 食材）或 null（手动输入食材）。

### 5.3 Hydration Layer

新增 `src/lib/pantry/hydrate.ts`:

```typescript
interface HydrationResult {
  ingredient: Ingredient;
  warning?: 'pantry_deleted' | 'unit_incompatible';
}

/**
 * 将 Pantry 引用的食材水合为完整的 Ingredient 对象。
 * 返回结构化结果（Codex #2 — 不污染 Ingredient 类型）。
 * UI 层根据 warning 显示提示图标。
 */
function hydrateIngredient(
  ingredient: Ingredient,
  pantry: PantryItem[]
): HydrationResult {
  // 无 Pantry 引用 → 返回原始 Ingredient
  if (!ingredient.pantryId) return { ingredient };

  const pantryItem = pantry.find(p => p.id === ingredient.pantryId);

  // Pantry 项已删除 → 回退到内嵌价格 + 警告
  if (!pantryItem) return { ingredient, warning: 'pantry_deleted' };

  // 检查单位兼容性（使用 ingredientKey 做密度查找，不是 id）
  const densityKey = ingredient.ingredientKey || pantryItem.ingredientKey;
  const canConvertUnits = canConvert(
    pantryItem.purchaseUnit,
    ingredient.usedUnit,
    densityKey  // 稳定语义 key（Codex #1）
  );

  if (!canConvertUnits) {
    // 单位不兼容 → 回退到内嵌价格 + 警告
    return { ingredient, warning: 'unit_incompatible' };
  }

  // 水合：用 Pantry 的购买信息替换内嵌值
  return {
    ingredient: {
      ...ingredient,
      purchaseAmount: pantryItem.purchaseAmount,
      purchaseUnit: pantryItem.purchaseUnit,
      purchasePrice: pantryItem.purchasePrice,
    },
  };
}

interface RecipeHydrationResult {
  recipe: Recipe;           // 水合后的 Recipe，可传入 calculateTotalCosts()
  warnings: Array<{ ingredientName: string; warning: string }>;
}

function hydrateRecipe(recipe: Recipe, pantry: PantryItem[]): RecipeHydrationResult {
  const warnings: Array<{ ingredientName: string; warning: string }> = [];
  const hydratedIngredients = recipe.ingredients.map(i => {
    const result = hydrateIngredient(i, pantry);
    if (result.warning) {
      warnings.push({ ingredientName: i.name, warning: result.warning });
    }
    return result.ingredient;
  });
  return {
    recipe: { ...recipe, ingredients: hydratedIngredients },
    warnings,
  };
}
```

### 5.4 Pantry Hook — `usePantry()`

新增 `src/hooks/usePantry.ts`:

```typescript
interface UsePantryReturn {
  pantry: PantryItem[];
  add: (item: Omit<PantryItem, 'id' | 'updatedAt'>) => PantryItem;
  update: (id: string, changes: Partial<PantryItem>) => void;
  remove: (id: string) => void;  // 只删 Pantry 项，不碰 recipes
  findByName: (name: string) => PantryItem | undefined;
  getReferencingRecipeCount: (id: string) => number;  // 查询有多少配方引用了这个食材
}
```

**边界原则（Codex #5）**: `usePantry` 只管 Pantry 数据。`useRecipes` 只管 Recipe 数据。两者不互相修改。

删除 Pantry 食材时的跨 store 协调由**页面组件层**负责：
1. 页面组件调用 `usePantry().getReferencingRecipeCount(id)` 获取引用数
2. 如果有引用 → 显示确认弹窗 "This ingredient is used in N recipes. They will fall back to their saved prices."
3. 确认后 → 页面组件调用 `usePantry().remove(id)` 删除 Pantry 项
4. 引用该食材的配方在渲染时，hydration 层发现 `pantryId` 指向不存在的项 → 自动回退到内嵌价格 + 显示 "pantry_deleted" 警告

不需要 `unlinkPantryItem` — hydration 层的回退机制已经处理了这个情况。产品未上线，不存在需要快照的旧数据。

### 5.5 Pantry 页面 (`/pantry`)

Astro 静态页 + React island（`client:load`）。

**状态:**
- 未付费 → 重定向到 `/activate`
- Empty → "No ingredients yet. Add your first ingredient." + Add 按钮
- Normal → 食材表格

**表格列:**
| 列 | 类型 | 说明 |
|----|------|------|
| 名称 | text, editable | 食材名 |
| 购买量 | number, editable | 如 5 |
| 购买单位 | dropdown, editable | lb, kg, oz, g, each, dozen... |
| 购买价格 | number, editable | 如 $4.99 |
| 单价 | computed, read-only | purchasePrice / purchaseAmount，Geist Mono |
| 更新时间 | date, read-only | 最后修改时间 |
| 操作 | button | 删除（有引用时弹确认） |

**行内编辑**: 点击单元格直接修改。修改后自动保存到 localStorage。

**顶部**: 搜索/过滤输入框 + "Add ingredient" 按钮。

**"My Defaults" 区域**（食材表格上方或侧栏）:
- 默认时薪（$/hr）
- 默认包装费（$/batch）
- 默认间接费用（$/batch）
- 默认平台费（$/batch）
- 行内编辑，自动保存到 `recipepricer_defaults`
- 这些值会预填到 Wizard Step 3 和 Quick Add 的 labor/overhead 字段
- 单个配方可覆盖（覆盖值存在配方的 `laborAndOverhead` 里，不影响全局默认）

### 5.6 Template 页面 (`/template`)

Astro 静态页 + React island（`client:load`）。替代现有 `/recipes` 卡片视图。

**路由处理**: `/recipes` 重定向到 `/template`。

**状态:**
- 未付费 → 重定向到 `/activate`
- Empty → "No recipes yet. Create your first recipe →" 链接到 `/calculator`
- Normal → 配方表格

**表格列:**
| 列 | 类型 | 说明 |
|----|------|------|
| 配方名 | text, read-only | 可点击展开详情 |
| Yield | text, read-only | 如 "24 cookies" |
| 食材成本 | computed, Geist Mono | 从 hydrated ingredients 实时计算 |
| 人工成本 | computed, Geist Mono | hourlyRate × batchTimeHours |
| 真实总成本 | computed, Geist Mono | calculateTotalCosts() |
| 推荐售价 | computed, Geist Mono | 使用配方的 targetCostRatio |
| 操作 | buttons | Edit (→ wizard), Delete (确认弹窗) |

**行展开**: 点击配方名展开该配方的食材明细。每个食材显示：名称、用量、单位、成本、Pantry 关联状态。

**Pantry 关联**: 未关联 Pantry 的食材显示 "Link" 图标。点击后弹出 dropdown，显示所有 Pantry 食材（按名称相似度排序）。选择后关联。

**工具栏**: Export all (v2 JSON) + Import (兼容 v1/v2) + "Go to Pantry" 链接 + "Quick Add" 按钮。

### 5.6.1 Quick Add（Template 页面内添加配方）

Wizard 不再是添加配方的唯一方式。付费用户可以在 Template 页面直接添加配方，跳过 wizard 的引导流程和 reveal 动画。

**设计原则**: reveal 的使命是转化（促成 $19 购买）。付费用户已经被说服了，之后每次强制 wizard 就是摩擦。Quick Add 是效率模式。

**Quick Add 流程**:
1. 用户点击 "Quick Add" 按钮
2. 表格底部展开一个内联表单区域（不是 modal，不离开页面）
3. 表单字段：
   - 配方名（text）
   - Yield 数量 + 单位（如 24 cookies）
   - Batch time（hours）
   - 食材列表：从 Pantry dropdown 选择 + 输入用量。可添加多个。非 Pantry 食材可手动输入价格。
   - Labor & Overhead：从 UserDefaults 预填（显示 "Using your defaults" 提示），可覆盖
4. 点击 "Save" → 创建 SavedRecipe，出现在表格中
5. 不走 reveal 动画，不走 Step 4a/4b — 直接保存

**Quick Add vs Wizard 的关系**:
- Quick Add 是 Wizard 的"无引导版"，数据模型完全相同
- Quick Add 创建的配方和 Wizard 创建的配方在 `/template` 里没有区别
- 用户可以 Quick Add 一个配方后点 "Edit" 进入 Wizard 查看完整 reveal（如果好奇）
- Wizard 仍然是免费用户唯一的入口，也是首次用户的推荐路径

### 5.7 Wizard Step 2 集成

**付费用户**: Autocomplete 列表 = Pantry 食材优先 + 硬编码 50 个常见食材补充。选中 Pantry 食材后自动填充 `purchaseAmount`, `purchaseUnit`, `purchasePrice`，并设置 `pantryId`。

**免费用户**: 行为不变 — 只看到硬编码的 50 个常见食材列表。

### 5.7.1 "Save to My Pantry" 快捷添加

Pantry 不只通过 /pantry 页面维护。用户在使用过程中自然积累 Pantry 数据。

**触发点**: Wizard Step 2 和 Quick Add 中，当用户输入的食材不在 Pantry 里时（手动填写了价格和单位），显示一个 "Save to My Pantry" checkbox/按钮。

**行为**:
- 勾选 → 自动创建 PantryItem（name, ingredientKey, purchaseUnit, purchaseAmount, purchasePrice），同时当前食材设置 `pantryId` 关联
- 不勾 → 食材只存在当前配方里（内嵌价格），不进 Pantry
- 如果 Pantry 里已有同名食材 → 不显示此选项（已自动关联）

**结果**: /pantry 页面变成"价格管理"而非"食材录入"。大部分食材在做配方时就加进去了。

### 5.8 JSON 导出 v2

```json
{
  "version": 2,
  "exportedAt": "ISO-8601",
  "pantry": [ /* PantryItem[] */ ],
  "recipes": [ /* SavedRecipe[] */ ]
}
```

**导入兼容（Codex #3 修正）:**
- v2 JSON（对象，含 `version: 2`）→ 导入 pantry + recipes
- v1 JSON（`SavedRecipe[]` 数组，非 `Recipe[]`）→ 导入 recipes，pantry 为空。检测方式：`Array.isArray(parsed)` 且元素有 `savedAt` 字段
- 无效 JSON → 错误提示

### 5.9 付费边界

| 功能 | 免费 | 付费 ($19) |
|------|------|-----------|
| Wizard Step 1-3 | ✅ | ✅ |
| Step 4a Reveal | ✅ | ✅ |
| Step 4b 推荐售价 + 滑块 | ❌ | ✅ |
| 保存配方 | ❌ | ✅ |
| `/pantry` | ❌ 重定向 /activate | ✅ |
| `/template` | ❌ 重定向 /activate | ✅ |
| Wizard Step 2 Pantry autocomplete | ❌ 硬编码列表 | ✅ Pantry 优先 |
| JSON 导出（含 Pantry） | ❌ | ✅ |

### 5.10 删除 `/recipes` 页面

产品未上线，无需重定向。直接删除 `src/pages/recipes.astro` 和 `src/components/recipes/`。`/template` 完全取代它。Landing page 和 nav 里的链接全部指向 `/template`。

### 5.11 删除 Pantry 食材的数据完整性

```
页面组件处理删除（简化版 — 产品未上线，无旧数据）：

用户点击删除 →
  页面调用 usePantry().getReferencingRecipeCount(id) →
  0 个引用 → 直接调用 usePantry().remove(id)
  N 个引用 → 确认弹窗 "This ingredient is used in N recipes. They will fall back to saved prices."
    取消 → 不操作
    确认 → usePantry().remove(id)

配方渲染时 hydration 层自动处理悬空引用（pantryId 指向已删除项 → 回退内嵌价格）。
不需要主动修改 recipes 数据 — 惰性回退即可。
```

## 6. Implementation Plan

| Phase | Focus | Tickets | 前置依赖 |
|-------|-------|---------|---------|
| **P1: 数据层** | PantryItem + UserDefaults + ingredientKey 类型定义 + usePantry hook + useDefaults hook + hydration 层 + Ingredient 扩展 | 3 tickets | 无 |
| **P2: Pantry 页面** | `/pantry` Astro 页 + React island + 食材表格 CRUD + 行内编辑 + 唯一性校验 + My Defaults 区域 | 2 tickets | P1 |
| **P3: Template 页面** | `/template` 页面 + 配方表格 + 行展开 + Pantry 关联 + Quick Add 表单 + 删除旧 /recipes | 3 tickets | P1 |
| **P4: Wizard 集成** | Step 2 ingredientKey + Pantry autocomplete + Step 3 defaults 预填 + 导出 v2 | 2 tickets | P1, P2 |
| **P5: 收尾** | 响应式 + 可访问性 + E2E QA | 2 tickets | P1-P4 |

**P2 和 P3 可并行**（都依赖 P1 的数据层完成）。产品未上线 — 不需要数据迁移、不需要旧路由重定向、不需要 unlinkPantryItem。

## 7. Acceptance Criteria

### Pantry
- [ ] `/pantry` 页面：CRUD 食材（add, edit inline, delete）
- [ ] 删除有引用的食材时显示确认弹窗，确认后快照价格到配方
- [ ] 未付费用户访问 `/pantry` 重定向到 `/activate`
- [ ] 搜索/过滤食材列表

### Template
- [ ] `/template` 页面：所有配方的表格视图
- [ ] 每个配方的成本和推荐售价从 Pantry 实时计算（非存储值）
- [ ] 点击配方名展开食材明细
- [ ] 未关联 Pantry 的食材显示 "Link" 图标，点击可关联
- [ ] 旧 `/recipes` 页面和组件已删除
- [ ] 未付费用户访问 `/template` 重定向到 `/activate`

### 级联更新
- [ ] 在 `/pantry` 改一个食材价格 → `/template` 显示更新后的成本（刷新页面即可，无需实时）
- [ ] 引用同一食材的多个配方全部更新

### Wizard 集成
- [ ] 付费用户 Step 2 autocomplete 优先显示 Pantry 食材
- [ ] 选中 Pantry 食材后自动填充价格和单位
- [ ] 免费用户 Step 2 行为不变

### 导出/导入
- [ ] 导出为 v2 JSON（含 pantry + recipes）
- [ ] 导入兼容 v1（纯 recipes）和 v2（pantry + recipes）
- [ ] 导入无效 JSON 显示错误提示

### Quick Add
- [ ] Template 页面 "Quick Add" 按钮展开内联表单
- [ ] 从 Pantry dropdown 选食材 + 输入用量
- [ ] Labor/Overhead 从 UserDefaults 预填
- [ ] 保存后配方出现在表格中（不走 wizard/reveal）
- [ ] Quick Add 创建的配方和 Wizard 创建的配方数据结构一致

### Save to Pantry
- [ ] Wizard Step 2：输入不在 Pantry 里的食材后显示 "Save to My Pantry" 选项
- [ ] Quick Add：同上
- [ ] 勾选后自动创建 PantryItem 并关联当前食材
- [ ] Pantry 里已有同名食材时不显示此选项

### My Defaults
- [ ] Pantry 页面有 "My Defaults" 区域：时薪、包装、间接费用、平台费
- [ ] 修改 defaults 后，Wizard Step 3 预填新值
- [ ] Quick Add 预填新值
- [ ] 单个配方可覆盖 defaults，不影响全局

### 通用
- [ ] 所有新页面 375px 响应式
- [ ] 遵循 DESIGN.md 视觉风格
- [ ] `pnpm test` 通过（全部现有 + 新增测试）

## 8. Open Questions

1. **JSON 导出 v2 schema 细节**: 具体字段在实现时确定，上述 5.8 节为初稿。

## 9. Codex Review Findings — Disposition

| # | Finding | Severity | Disposition |
|---|---------|----------|-------------|
| 1 | ingredient.id 是 UUID 不是密度 key | Critical | **Fixed** — 新增 `ingredientKey` 字段 |
| 2 | `_unitWarning` 是编造字段 | High | **Fixed** — hydration 返回 `HydrationResult` 结构 |
| 3 | v1 导出格式理解错误 | Medium | **Fixed** — 修正为 `SavedRecipe[]` |
| 4 | 删除操作原子性 | Medium | **Fixed** — 先写 recipes 再写 pantry，分析撕裂安全性 |
| 5 | usePantry 越界改 recipes | High | **Fixed** — 惰性回退（hydration 层处理悬空引用），不需要主动改 recipes |
| 6 | Pantry 名称无唯一性 | Medium | **Fixed** — 添加唯一性约束 |
| 7 | Step 2 需要类型重设计 | High | **Fixed** — ingredientKey 持久化（P4 ticket） |
| 8 | defaultUnit 无意义 | Low | **Fixed** — 删除该字段 |
| 9 | P2/P3 非真并行 | Medium | **Fixed** — P1 必须先完成数据层 |
| 10 | 最简版本被跳过 | Design | **Rejected** — Pantry 级联是产品差异化核心，不是 over-build |
