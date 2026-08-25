#  CRM系统 - 项目README

## 📖 项目简介

这是一个企业级CRM(客户关系管理)系统,基于Next.js 14 + TypeScript + Prisma + MySQL构建。

**核心功能**:
- 👥 客户管理(我的客户 + 公海池)
- 📊 每日新增客资统计
- 📦 订单管理
- 💰 收款管理
- 📋 任务管理
-  日报管理
- 👤 用户管理
- 🔐 RBAC权限控制

---

##  快速开始

### 前置条件
- Node.js 18+
- MySQL 8.0+
- npm 或 yarn

### 安装步骤

1. **克隆项目**
   ```bash
   cd d:\CRM系统2
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置环境变量**
   
   创建 `.env` 文件:
   ```env
   DATABASE_URL="mysql://root:<数据库密码>@localhost:3306/crm_system"
   NEXTAUTH_SECRET="your-secret-key-here"
   NEXTAUTH_URL="http://localhost:3008"
   ```

4. **启动MySQL服务**
   ```
   Win + R → services.msc → 找到MySQL97 → 右键启动
   ```

5. **生成Prisma客户端**
   ```bash
   npx prisma generate
   ```

6. **执行数据库迁移**
   ```bash
   npx prisma migrate dev --name init
   ```

7. **启动开发服务器**
   ```bash
   npm run dev
   ```

8. **打开浏览器**
   ```
   http://localhost:3008
   ```

---

## 👥 测试账号

| 用户名 | 密码 | 角色 | 权限 |
|--------|------|------|------|
| admin | 123456 | 管理员 | 所有权限 |
| manager | 123456 | 销售主管 | 管理+审阅 |
| sales | 123456 | 普通销售 | 销售+个人数据 |
| finance | 123456 | 财务 | 财务+报表 |

---

## 🧪 快速测试

### 方法1: 一键测试(推荐)

1. **确保MySQL已启动**
2. **双击运行**: `prepare-full-test.bat`
3. **等待30秒**(自动生成数据+打开浏览器)
4. **开始测试**

### 方法2: 手动测试

1. **生成测试数据**
   ```bash
   node generate-all-test-data.js
   ```

2. **打开浏览器**
   ```
   http://localhost:3008
   ```

3. **登录测试**
   - 使用上述4个账号依次测试

---

##  项目结构

```
d:\CRM系统2\
│
├─ 📄 README.md                         # 项目说明(本文件)
├─  package.json                      # 项目依赖
─ 📄 tsconfig.json                     # TypeScript配置
├─ 📄 next.config.js                    # Next.js配置
─ 📄 .env                              # 环境变量(需自行创建)
│
─ 🛠️ prepare-full-test.bat             # 🔥 一键测试准备工具
─ 🛠️ generate-all-test-data.js         # 测试数据生成脚本
├─ ️ test-daily-report-fix.bat         # 日报修复验证
├─ 🛠️ test-all-features.bat             # 全功能测试
├─ ️ run-all-tests.ps1                 # PowerShell测试脚本
│
├─ 📚 README_TEST.md                    # ⭐ 3分钟快速测试指南
├─ 📚 COMPREHENSIVE_TEST_GUIDE.md       # 🔥 完整测试指南
├─ 📚 TEST_PREPARATION_COMPLETE.md      # 测试准备说明
├─ 📚 INDEX.md                          # 测试快速索引
├─ 📚 CHECKLIST.md                      # 测试快速启动清单
─ 📚 TEST_SUMMARY.md                   # 测试总结报告
├─ 📚 DAILY_REPORT_FIX.md               # 日报权限修复报告
├─ 📚 MYSQL_STARTUP_GUIDE.md            # MySQL启动指南
├─ 📚 QUICK_START.md                    # 快速启动指南
├─ 📚 FUNCTION_TEST_REPORT.md           # 功能测试报告模板
─ 📚 FINAL_DELIVERY.md                 # 最终交付清单
│
─ src/
│  ├─ app/
│  │  ├─ api/                           # API路由
│  │  │  ├─ auth/[...nextauth]/route.ts # NextAuth API
│  │  │  ├─ customers/route.ts          # 客户API
│  │  │  ├─ daily-reports/route.ts      # 日报API
│  │  │  ├─ daily-leads/route.ts        # 每日客资API
│  │  │  ├─ finance/orders/route.ts     # 订单API
│  │  │  ├─ finance/payments/route.ts   # 收款API
│  │  │  ├─ tasks/route.ts              # 任务API
│  │  │  ─ users/route.ts              # 用户API
│  │  │
│  │  ├─ (dashboard)/                   # 受保护的路由
│  │  │  ├─ layout.tsx                  # 仪表盘布局
│  │  │  ├─ page.tsx                    # 首页
│  │  │  ├─ customers/page.tsx          # 客户管理页面
│  │  │  ├─ public-pool/page.tsx        # 公海池页面
│  │  │  ├─ daily-leads/page.tsx        # 每日客资页面
│  │  │  ├─ orders/page.tsx             # 订单管理页面
│  │  │  ├─ payments/page.tsx           # 收款管理页面
│  │  │  ├─ tasks/page.tsx              # 任务管理页面
│  │  │  ├─ daily-reports/page.tsx      # 日报管理页面
│  │  │  └─ users/page.tsx              # 用户管理页面
│  │  │
│  │  └─ login/page.tsx                 # 登录页面
│  │
│  ├─ components/                        # React组件
│  │  ├─ common/                         # 通用组件
│  │  │  ├─ Sidebar.tsx                  # 侧边栏
│  │  │  ├─ Header.tsx                   # 顶部导航
│  │  │  └─ ...
│  │  ─ ...
│  │
│  ─ lib/                               # 工具库
│     ├─ auth.ts                         # NextAuth配置
│     ├─ casl.ts                         # CASL权限定义
│     ├─ prisma.ts                       # Prisma客户端
│     └─ ...
│
└─ prisma/
   ├─ schema.prisma                      # 数据库模型定义
   └─ migrations/                        # 数据库迁移文件
```

---

## ️ 技术栈

### 前端
- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript 5
- **UI库**: Ant Design 5.x
- **状态管理**: Zustand
- **服务端状态**: React Query

### 后端
- **API**: Next.js API Routes
- **ORM**: Prisma 5.x
- **认证**: NextAuth.js v5
- **权限**: CASL (@casl/ability)

### 数据库
- **类型**: MySQL 8.0
- **驱动**: @prisma/client

### 其他
- **实时通信**: socket.io
- **图表**: echarts
- **文件存储**: ali-oss (阿里云OSS)

---

##  权限系统

### 角色定义
- **admin**: 管理员(所有权限)
- **sales_manager**: 销售主管(管理+审阅)
- **sales**: 普通销售(销售+个人数据)
- **finance**: 财务(财务+报表)

### 权限点
- 客户管理: view, create, update, delete, export
- 订单管理: view, create, update, cancel, export
- 收款管理: view, create, update, export
- 任务管理: view, create, update, delete, assign
- 日报管理: create, view, update, review
- 用户管理: view, create, update, delete
- 等等...

### 权限配置
- 定义位置: [src/lib/casl.ts](file://d:\CRM系统2\src\lib\casl.ts)
- 用户配置: [src/lib/auth.ts](file://d:\CRM系统2\src\lib\auth.ts)
- API检查: 每个API路由中使用 `ability.cannot()` 检查

---

## 📊 数据库模型

### 主要表
- **User**: 用户表
- **Customer**: 客户表
- **FollowUp**: 跟进记录表
- **Order**: 订单表
- **Payment**: 收款表
- **Task**: 任务表
- **DailyReport**: 日报表
- **Role**: 角色表
- **UserRole**: 用户角色关联表

详见: [prisma/schema.prisma](file://d:\CRM系统2\prisma\schema.prisma)

---

## 🧪 测试指南

### 快速测试
参见: [README_TEST.md](file://d:\CRM系统2\README_TEST.md)

### 详细测试
参见: [COMPREHENSIVE_TEST_GUIDE.md](file://d:\CRM系统2\COMPREHENSIVE_TEST_GUIDE.md)

### 问题排查
参见: [MYSQL_STARTUP_GUIDE.md](file://d:\CRM系统2\MYSQL_STARTUP_GUIDE.md)

---

##  API文档

### 认证API
- `POST /api/auth/signin` - 登录
- `POST /api/auth/signout` - 登出
- `GET /api/auth/session` - 获取会话

### 客户API
- `GET /api/customers` - 获取客户列表
- `POST /api/customers` - 创建客户
- `GET /api/customers/:id` - 获取客户详情
- `PUT /api/customers/:id` - 更新客户
- `DELETE /api/customers/:id` - 删除客户
- `POST /api/customers/:id/archive` - 归档客户到公海池

### 公海池API
- `GET /api/public-pool` - 获取公海池客户
- `POST /api/public-pool/:id/claim` - 认领客户

### 每日客资API
- `GET /api/daily-leads` - 获取每日新增客资统计

### 订单API
- `GET /api/finance/orders` - 获取订单列表
- `POST /api/finance/orders` - 创建订单
- `GET /api/finance/orders/:id` - 获取订单详情
- `PUT /api/finance/orders/:id` - 更新订单
- `DELETE /api/finance/orders/:id` - 取消订单

### 收款API
- `GET /api/finance/payments` - 获取收款列表
- `POST /api/finance/payments` - 创建收款
- `PUT /api/finance/payments/:id` - 更新收款

### 任务API
- `GET /api/tasks` - 获取任务列表
- `POST /api/tasks` - 创建任务
- `PUT /api/tasks/:id` - 更新任务
- `DELETE /api/tasks/:id` - 删除任务

### 日报API
- `GET /api/daily-reports` - 获取日报列表
- `POST /api/daily-reports` - 创建日报
- `PUT /api/daily-reports/:id` - 更新日报

### 用户API
- `GET /api/users` - 获取用户列表
- `POST /api/users` - 创建用户
- `PUT /api/users/:id` - 更新用户
- `DELETE /api/users/:id` - 删除用户

---

##  常见问题

### Q: 500 Internal Server Error
**原因**: MySQL未启动  
**解决**: 启动MySQL97服务

### Q: No data显示
**原因**: 数据库是空的  
**解决**: 运行 `node generate-all-test-data.js`

### Q: No permission to...
**原因**: 权限控制正常工作  
**解决**: 换有更多权限的账号测试

### Q: 页面空白
**原因**: 服务器未启动或编译错误  
**解决**: 运行 `npm run dev`

更多问题参见: [README_TEST.md](file://d:\CRM系统2\README_TEST.md) 的"常见问题速查"部分

---

## 📞 支持

### 文档
- [README_TEST.md](file://d:\CRM系统2\README_TEST.md) - 快速测试指南
- [COMPREHENSIVE_TEST_GUIDE.md](file://d:\CRM系统2\COMPREHENSIVE_TEST_GUIDE.md) - 完整测试指南
- [INDEX.md](file://d:\CRM系统2\INDEX.md) - 快速索引

### 联系方式
如有问题,请随时提问!

---

## 📄 许可证

本项目仅供学习和演示使用。

---

**最后更新**: 2026-07-06  
**版本**: v1.0  
**状态**: ✅ 开发完成,可以开始测试!
# CRM系统 - 企业级客户关系管理系统

基于 Next.js 14 + React + TypeScript 构建的企业级CRM系统,包含客户管理、财务统计、协同办公三大核心模块。

## 功能特性

### 核心模块
- **客户管理**: 客户信息、跟进记录、销售线索、客户分类
- **财务管理**: 订单管理、收款记录、业绩报表、应收应付
- **协同办公**: 日报管理、消息中心、任务管理、文件共享

### 用户角色(RBAC权限)
- **管理员**: 系统最高权限,可管理所有模块、用户、配置
- **销售主管**: 管理团队销售,查看团队数据,审阅下属日报
- **普通销售**: 客户管理、跟进记录、提交日报
- **财务**: 财务管理、订单收款、报表统计

## 技术栈

### 前端
- Next.js 14 (App Router)
- React 18 + TypeScript 5
- Ant Design 5.x
- Zustand (状态管理)
- React Query (服务端状态)

### 后端
- Next.js API Routes
- Prisma 5.x (ORM)
- NextAuth.js v5 (认证)
- CASL (权限控制)

### 数据库
- MySQL 8.0

## 快速开始

### 前置要求
- Node.js 18+ 
- MySQL 8.0
- pnpm (推荐) 或 npm

### 安装步骤

1. **克隆项目**
```bash
cd crm-system
```

2. **安装依赖**
```bash
pnpm install
# 或
npm install
```

3. **配置环境变量**
```bash
cp .env.example .env.local
```

编辑 `.env.local` 文件,配置数据库连接:
```env
DATABASE_URL="mysql://root:<数据库密码>@localhost:3306/crm_system"
NEXTAUTH_SECRET="your-super-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"
ENCRYPTION_KEY="your-32-byte-encryption-key-here!!"
```

4. **创建数据库**
```sql
CREATE DATABASE crm_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

5. **运行数据库迁移**
```bash
pnpm prisma:migrate
```

6. **生成Prisma客户端**
```bash
pnpm prisma:generate
```

7. **种子数据(创建初始用户和权限)**
```bash
pnpm prisma:seed
```

默认管理员账号:
- 用户名: `admin`
- 密码: `123456`

8. **启动开发服务器**
```bash
pnpm dev
```

访问 http://localhost:3000

## 项目结构

```
crm-system/
├── prisma/                      # Prisma配置
│   ├── schema.prisma           # 数据库模型
│   └── seed.ts                 # 种子数据
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # 认证路由组
│   │   ├── (dashboard)/       # 主应用路由组
│   │   └── api/               # API路由
│   ├── components/            # React组件
│   ├── lib/                   # 工具库
│   ├── stores/                # 状态管理
│   ├── types/                 # TypeScript类型
│   └── middleware.ts          # 中间件
├── public/                     # 静态资源
├── .env.example               # 环境变量示例
├── next.config.js             # Next.js配置
└── package.json
```

## 数据库设计

### 核心表
- `users` - 用户表
- `roles` - 角色表
- `permissions` - 权限表
- `customers` - 客户表
- `orders` - 订单表
- `payments` - 收款记录
- `daily_reports` - 日报表
- `messages` - 消息表
- `tasks` - 任务表
- `files` - 文件表

详细设计请查看 `prisma/schema.prisma`

## API文档

### 认证接口
- `POST /api/auth/login` - 登录
- `POST /api/auth/logout` - 登出
- `GET /api/auth/session` - 获取会话

### 客户管理
- `GET /api/customers` - 客户列表
- `POST /api/customers` - 创建客户
- `GET /api/customers/:id` - 客户详情
- `PUT /api/customers/:id` - 更新客户
- `DELETE /api/customers/:id` - 删除客户

### 财务管理
- `GET /api/finance/orders` - 订单列表
- `POST /api/finance/orders` - 创建订单
- `GET /api/finance/payments` - 收款记录
- `POST /api/finance/payments` - 创建收款

### 协同办公
- `GET /api/daily-reports` - 日报列表
- `POST /api/daily-reports` - 创建日报
- `GET /api/messages` - 消息列表
- `POST /api/messages` - 发送消息

## 部署到阿里云

### ECS配置建议
- CPU: 2核
- 内存: 4GB
- 系统盘: 100GB ESSD
- 带宽: 5Mbps
- 操作系统: Ubuntu 20.04 LTS

### 部署步骤

1. **安装Node.js和PM2**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
```

2. **上传代码到服务器**
```bash
scp -r crm-system/* user@your-server:/path/to/crm
```

3. **安装依赖并构建**
```bash
cd /path/to/crm
pnpm install
pnpm build
```

4. **配置Nginx**
参考 `nginx.conf` 配置文件

5. **启动应用**
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

详细部署指南请查看架构设计文档。

## 开发规范

### 代码风格
- 使用ESLint + Prettier保证代码质量
- 遵循TypeScript严格模式
- 组件使用函数式写法

### Git提交规范
```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式
refactor: 重构
test: 测试
chore: 构建/工具
```

## 许可证

MIT

## 联系方式

如有问题,请提Issue或联系开发团队。
