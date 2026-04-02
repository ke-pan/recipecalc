# License 服务端验证 Roadmap

## 背景

当前 license 验证纯前端 honor system（localStorage + CSS blur），几秒可绕过。
本 roadmap 分三个阶段逐步加固，每阶段向前兼容，不浪费工作量。

## Phase 1: 服务端 Session [当前]

**目标**: 建立服务端验证权威，停止信任 localStorage。

**改动**:
- `astro.config.mjs` 切换 `output: 'server'`，现有页面 `prerender: true`
- 新增 `src/lib/server/session.ts` — HMAC-SHA256 签名 token（Web Crypto API）
- 新增 `/api/activate` — Worker 调 LemonSqueezy → 设 HttpOnly cookie (`rc_session`)
- 新增 `/api/session` — 验证 cookie，返回 `{ unlocked, keyPrefix }`
- 新增 `/api/deactivate` — 清除 cookie
- `LicenseContext` 改为调服务端 API，localStorage 降为 UI hint（防闪烁）
- 环境变量: `SESSION_SECRET`（HMAC 密钥，wrangler secret / .dev.vars）

**安全提升**: 从"改 localStorage"升级到"需要伪造 HMAC-SHA256 签名"

**Etsy / Gumroad**: 无影响，key 通过 `/activate` 页面照常工作

## Phase 2: 服务端计算 Pro 结果

**触发条件**: 上线后观察到绕过行为，或 pro 逻辑成为核心 IP。

- 推荐售价、利润率 → `/api/calculate` 服务端返回
- Pantry / Template 数据 → `/api/data` 服务端返回
- 无 session = 无结果，前端篡改 React state 也拿不到数据
- Phase 1 的 session 机制直接复用

## Phase 3: 代码隔离（按需）

**触发条件**: 有证据表明代码被 patch、抓包、或整站克隆。

- Pro 组件 `React.lazy()` 拆成独立 chunk
- Worker middleware 拦截 pro chunk 请求，无 session → 403
- 免费用户浏览器里没有 pro JavaScript
- Phase 1 的 session + Phase 2 的 API 直接复用
