# 前端项目部署完成指南

## 当前状态

### 已完成 ✅

| 组件 | 状态 | 地址 |
|------|------|------|
| PDF API (后端) | ✅ 已部署 | https://gua.preview.aliyun-zeabur.cn |
| 前端代码 | ✅ 已提交 | GitHub (temp/ai-ec1f8296 分支) |
| Zeabur 配置 | ✅ 已创建 | zeabur.json, Dockerfile.frontend |

### 待完成 ⏳

| 步骤 | 操作 |
|------|------|
| 1. 创建 Zeabur 项目 | 从 GitHub 导入前端代码 |
| 2. 配置环境变量 | 设置 VITE_PDF_API_URL |
| 3. 部署服务 | 等待构建完成 |
| 4. 配置域名 | 生成访问地址 |
| 5. 验证测试 | 上传 PDF 测试 |

---

## 快速部署步骤

### 方式1: Zeabur 网页部署（推荐）

1. **登录 Zeabur**
   - 访问 https://dash.zeabur.com
   - 点击 "New Project" 或 "Create Project"

2. **导入 GitHub 仓库**
   - 选择 "GitHub repository"
   - 选择 `Baymaxxx/nocode-640d177e280f476a`
   - 选择分支 `temp/ai-ec1f8296`

3. **配置环境变量**
   ```bash
   VITE_PDF_API_URL=https://gua.preview.aliyun-zeabur.cn
   ```

4. **部署**
   - Zeabur 自动检测 `zeabur.json`
   - 构建命令: `npm install && npm run build`
   - 启动命令: `npx serve -s dist -l $PORT`

5. **配置域名**
   - 进入项目 → Domain
   - 点击 "Generate Domain"

### 方式2: 使用现有项目

你也可以在现有的 `untitled` 或 `untitled-2` 项目中添加前端服务：

1. 进入现有项目
2. 点击 "Add Service" 或 "Deploy New Service"
3. 选择 GitHub 仓库部署

---

## 验证测试

部署完成后，测试步骤：

```bash
# 1. 测试前端页面访问
curl https://你的前端域名.zeabur.app

# 2. 浏览器打开前端页面
# 上传 PDF 文件测试

# 3. 检查网络请求
# 打开浏览器开发者工具 (F12)
# 确认请求发送到 gua.preview.aliyun-zeabur.cn
```

---

## 完整架构

```
用户浏览器
    ↓ HTTPS
前端 (Zeabur) https://frontend.zeabur.app
    ↓ HTTPS (API 请求)
PDF API (Zeabur) https://gua.preview.aliyun-zeabur.cn
    ↓ OCR 处理
返回 JSON 数据
    ↓
前端显示商品列表
```

---

## 故障排查

### 如果构建失败
1. 检查环境变量是否设置正确
2. 查看构建日志
3. 确认 `zeabur.json` 格式正确

### 如果 API 请求失败
1. 检查 `VITE_PDF_API_URL` 是否正确
2. 确认 PDF API 服务正常运行
3. 检查浏览器控制台网络请求

### 如果跨域错误
- Zeabur 自动处理 HTTPS
- 确保前后端都是 HTTPS

---

## 下一步操作

请按以下步骤完成部署：

1. 登录 https://dash.zeabur.com
2. 创建新项目
3. 导入 GitHub 仓库 `nocode-640d177e280f476a`
4. 配置环境变量 `VITE_PDF_API_URL`
5. 部署并生成域名

完成后把前端域名发给我，我帮你验证测试！
