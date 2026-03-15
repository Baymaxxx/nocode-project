# Zeabur CLI 部署指南

## 安装 CLI

```bash
npm install -g zeabur
```

## 登录

```bash
zeabur auth login
```
这会打开浏览器让你授权登录。

## 查看项目列表

```bash
zeabur project list
```

## 创建前端项目

### 方式1: 使用 deploy 命令（推荐）

```bash
cd /Users/zhongshuai/Downloads/nocode-640d177e280f476a

# 部署到 Zeabur
zeabur deploy
```

### 方式2: 手动创建

```bash
# 创建新项目
zeabur project create --name pdf-parser-frontend

# 创建服务
zeabur service create --project-id <项目ID> --name frontend --type GIT

# 设置 GitHub 仓库
zeabur service update --service-id <服务ID> --git-repo Baymaxxx/pdf-parser-api --git-branch main
```

## 配置环境变量

```bash
# 设置环境变量
zeabur variable create --service-id <服务ID> --name VITE_PDF_API_URL --value https://gua.preview.aliyun-zeabur.cn
```

## 配置域名

```bash
# 生成域名
zeabur domain create --service-id <服务ID>

# 或查看域名
zeabur domain list --service-id <服务ID>
```

## 查看部署状态

```bash
# 查看部署日志
zeabur deployment list --service-id <服务ID>

# 查看服务状态
zeabur service get --service-id <服务ID>
```

## 完整部署脚本

```bash
#!/bin/bash

# 登录
zeabur auth login

# 进入项目目录
cd /Users/zhongshuai/Downloads/nocode-640d177e280f476a

# 部署（会自动创建项目和服务）
zeabur deploy

echo "部署完成！请访问 Zeabur 控制台查看域名"
```

## 注意事项

1. **登录**: 首次使用需要浏览器授权
2. **项目**: 一个项目可以包含多个服务（前端+后端）
3. **环境变量**: 部署前确保设置 `VITE_PDF_API_URL`
4. **域名**: 部署完成后需要手动生成域名

## 后端服务信息

- 服务名: pdf-parser-api
- 地址: https://gua.preview.aliyun-zeabur.cn
- 状态: ✅ 运行中

## 前端部署后

- 地址: https://xxx.zeabur.app（部署后生成）
- API 调用: 自动指向后端服务
