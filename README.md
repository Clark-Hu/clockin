# 打卡表（Cloudflare Pages）

一个临时个人使用的打卡网页：从**首次使用当天**开始，到 **2026-01-30** 结束；支持按天/按周查看，状态（满意/一般/不满意/未完成），可加注释与照片（或图片链接）；支持查看**单项目纵向满意度**与**按时间段横向平均满意度**。

## 运行方式

本项目是纯静态页面 + Cloudflare Pages Functions：

- 页面：`index.html` / `app.js` / `styles.css`
- 数据接口：`functions/api/data.js`（保存到 Cloudflare KV，内容为 JSON 文本）

## 部署到 Cloudflare Pages

1. 创建 Cloudflare Pages 项目，指向本仓库
2. Build 设置：
   - Build command：留空
   - Output directory：`/`（仓库根目录）
3. 创建 KV（Workers KV）命名空间（任意名字都行）
4. Pages 项目 → `Settings` → `Bindings`（或 `Functions`/`KV` 相关入口，界面会随 Cloudflare 更新）→ 添加 **KV Namespace** 绑定：
   - Variable name：`CHECKIN_KV`
   - KV namespace：选择你创建的 namespace
5. Pages 项目 → `Settings` → `Variables and Secrets`：
   - `PASSWORD_HASH`：你的密码的 **SHA-256 hex**（下面有生成方法）
   - （可选）`DATA_KEY`：KV 存储 key，默认 `checkin_data_v1`

> 注意：`CHECKIN_KV` 不能用“Plaintext 变量”代替，它必须是 Cloudflare 的 **KV 绑定**（运行时是一个 KV 对象，不是字符串）。

## 如果你部署的是 Worker（workers.dev）而不是 Pages

截图里如果看到 `workers.dev` / `Routes`，那是 **Worker** 项目。这个仓库当前是 **Pages + Functions** 结构（`functions/` 目录），直接 `wrangler deploy` 会报你看到的 “assets directory” 提示。

建议做法：
- 用 Pages 部署：`npx wrangler pages deploy . --project-name <你的Pages项目名>`
- 或者在控制台新建一个 Pages 项目并绑定仓库（不需要 `wrangler deploy`）

如果你坚持用 Worker 方式部署，我也可以把项目改成 “Worker + 静态资源(assets) + KV” 的结构（会增加 `wrangler.jsonc` 和 Worker 入口文件）。

## 生成 PASSWORD_HASH

### Windows PowerShell

```powershell
$pw = "你的密码"
[System.BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash([System.Text.Encoding]::UTF8.GetBytes($pw))).Replace('-','').ToLower()
```

### Node.js

```bash
node -e "console.log(require('crypto').createHash('sha256').update(process.argv[1]).digest('hex'))" "你的密码"
```

把输出结果填到 Cloudflare Pages 的 `PASSWORD_HASH`。

## 自定义项目

编辑 `projects.js` 中的 `DEFAULT_PROJECT_CATEGORIES` 即可。

## 数据备份/迁移

页面「设置」里支持导出/导入 JSON（导入会覆盖当前数据）。

## 照片说明

“选择照片”会在浏览器端压缩后存为 `data:`（Base64）文本，和数据一起存到 KV。建议不要放太多大图；如果想更轻量，可以只填“图片链接”。
