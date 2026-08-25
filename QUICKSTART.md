# CRM系统快速启动指南

## 前置准备

1. **安装Node.js 18+**
   - 下载地址: https://nodejs.org/
   - 验证安装: `node -v`

2. **安装MySQL 8.0**
   - 下载地址: https://dev.mysql.com/downloads/mysql/
   - 或使用Docker: `docker run --name mysql -e MYSQL_ROOT_PASSWORD=password -p 3306:3306 -d mysql:8.0`

3. **安装pnpm(推荐)**
   ```bash
   npm install -g pnpm
   ```

## 启动步骤

### 1. 配置环境变量

复制环境变量示例文件:
```bash
cp .env.example .env.local
```

编辑 `.env.local`:
```env
DATABASE_URL="mysql://root:<数据库密码>@localhost:3306/crm_system"
NEXTAUTH_SECRET="任意随机字符串用于加密session"
NEXTAUTH_URL="http://localhost:3000"
ENCRYPTION_KEY="32字节的加密密钥,用于敏感数据加密"
```

### 2. 创建数据库

登录MySQL并执行:
```sql
CREATE DATABASE crm_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. 安装依赖

```bash
pnpm install
# 或
npm install
```

### 4. 数据库迁移

生成Prisma客户端:
```bash
pnpm prisma:generate
```

运行数据库迁移:
```bash
pnpm prisma:migrate
```

系统会提示输入迁移名称,输入 `init` 即可。

### 5. 种子数据

创建初始用户和权限数据:
```bash
pnpm prisma:seed
```

成功后会显示:
```
管理员账号: admin / 123456
种子数据完成!
```

### 6. 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000

使用管理员账号登录:
- 用户名: `admin`
- 密码: `123456`

## 常见问题

### 问题1: 数据库连接失败

**错误信息**: `Can't reach database server`

**解决方案**:
1. 确认MySQL服务已启动
2. 检查 `.env.local` 中的 `DATABASE_URL` 是否正确
3. 确认数据库 `crm_system` 已创建

### 问题2: Prisma迁移失败

**错误信息**: `Migration failed`

**解决方案**:
```bash
# 重置数据库(注意:会删除所有数据)
npx prisma migrate reset

# 重新生成客户端
pnpm prisma:generate

# 重新种子数据
pnpm prisma:seed
```

### 问题3: 端口3000被占用

**错误信息**: `Port 3000 is already in use`

**解决方案**:
```bash
# 方法1: 关闭占用端口的进程
# Windows
netstat -ano | findstr :3000
taskkill /PID <进程ID> /F

# 方法2: 使用其他端口
pnpm dev -- -p 3001
```

### 问题4: NextAuth配置错误

**错误信息**: `NEXTAUTH_SECRET is not defined`

**解决方案**:
确保 `.env.local` 文件中设置了 `NEXTAUTH_SECRET`,可以使用以下命令生成:
```bash
openssl rand -base64 32
```

## 项目结构说明

```
crm-system/
├── prisma/
│   ├── schema.prisma      # 数据库模型定义
│   └── seed.ts            # 种子数据脚本
├── src/
│   ├── app/               # Next.js页面和API
│   │   ├── (auth)/       # 登录页面
│   │   ├── (dashboard)/  # 主应用页面
│   │   └── api/          # API路由
│   ├── components/        # React组件
│   ├── lib/              # 工具函数
│   ├── stores/           # 状态管理
│   └── types/            # TypeScript类型
├── .env.local            # 环境变量(不提交git)
├── package.json          # 项目依赖
└── README.md             # 项目文档
```

## 下一步

基础框架搭建完成后,你可以:

1. **查看现有功能**
   - 登录系统
   - 浏览仪表盘
   - 查看菜单结构

2. **开始开发业务模块**
   - 客户管理模块
   - 财务管理模块
   - 协同办公模块

3. **自定义配置**
   - 修改主题颜色
   - 调整菜单项
   - 添加新的权限点

## 技术支持

如遇到问题,请:
1. 查看控制台错误信息
2. 检查浏览器Network请求
3. 查看 `prisma/schema.prisma` 确认数据模型
4. 参考架构设计文档

祝开发顺利! 🚀
