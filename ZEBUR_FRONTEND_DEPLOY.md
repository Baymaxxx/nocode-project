# 前端项目 Zeabur 部署指南

## 部署方式

Zeabur 支持多种方式部署前端项目：

### 方式1: 使用 zeabur.json（推荐）

已创建 `zeabur.json` 配置文件，Zeabur 会自动识别。

### 方式2: 使用 Dockerfile

已创建 `Dockerfile.frontend`，部署时选择 Docker 方式。

---

## 部署步骤

### 1. 提交代码到 GitHub

```bash
git add zeabur.json Dockerfile.frontend ZEBUR_FRONTEND_DEPLOY.md
git commit -m "chore: add Zeabur deployment config for frontend"
git push origin temp/ai-ec1f8296
```

### 2. 在 Zeabur 创建新项目

1. 登录 https://zeabur.com
2. 点击 "创建项目"
3. 选择 "GitHub repository"
4. 选择 `nocode-640d177e280f476a` 仓库

### 3. 部署配置

Zeabur 会自动检测 `zeabur.json` 并使用以下配置：
- **构建命令**: `npm install && npm run build`
- **启动命令**: `npx serve -s dist -l $PORT`

### 4. 配置域名

部署完成后：
1. 进入服务详情
2. 点击 "域名" / "Domain"
3. 生成域名或绑定自定义域名

---

## 环境变量

确保以下环境变量已设置：

```bash
VITE_PDF_API_URL=https://gua.preview.aliyun-zeabur.cn
```

在 Zeabur 控制台：
1. 进入项目 → 环境变量
2. 添加变量 `VITE_PDF_API_URL`
3. 值为你的 PDF API 地址

---

## 访问地址

部署成功后，前端地址类似：
```
https://你的项目名.zeabur.app
```

---

## 注意事项

1. **构建时间**: 首次部署需要 3-5 分钟安装依赖和构建
2. **环境变量**: 确保 `VITE_PDF_API_URL` 指向正确的 PDF API 地址
3. **跨域**: Zeabur 自动处理 HTTPS，确保 PDF API 也支持 HTTPS

---

## 完整部署架构

```
用户浏览器
    ↓ HTTPS
前端 (Zeabur) https://frontend.zeabur.app
    ↓ HTTPS
PDF API (Zeabur) https://gua.preview.aliyun-zeabur.cn
    ↓ OCR 处理
PDF 解析结果
```

这样前后端都部署在 Zeabur 上，访问速度快，且都在一个平台管理。
