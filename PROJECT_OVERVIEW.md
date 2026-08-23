# CRM系统项目概览

## 🎯 项目简介

这是一个基于 **Next.js 14 + React + TypeScript** 构建的企业级CRM(客户关系管理)系统,包含客户管理、财务统计、协同办公三大核心模块,支持4种用户角色的RBAC权限控制,可部署到阿里云ECS。

## 📋 功能模块

### 1. 客户管理
- ✅ 客户信息管理(基本信息、联系方式、来源渠道)
- ✅ 跟进记录管理(沟通历史、下次联系时间)
- ✅ 销售线索管理(潜在客户、转化跟踪)
- ✅ 客户分类(标签、行业、区域)

### 2. 财务管理
- ✅ 订单管理(合同金额、收款状态)
- ✅ 收款记录(付款方式、发票管理)
- ✅ 业绩报表(按销售/部门/时间统计)
- ✅ 应收应付账款

### 3. 协同办公
- ✅ 日报管理(富文本编辑、主管审阅)
- ✅ 消息中心(内部通讯、系统通知)
- ✅ 任务管理(任务分配、进度跟踪)
- ✅ 文件共享(OSS存储、权限控制)

## 👥 用户角色(RBAC)

| 角色 | 权限范围 | 典型用户 |
|------|---------|---------|
| **管理员** | 所有权限,包括用户管理、系统设置 | IT管理员 |
| **销售主管** | 查看团队数据,审阅下属日报,分配任务 | 销售经理 |
| **普通销售** | 仅操作自己的客户/订单,提交日报 | 销售代表 |
| **财务** | 查看所有订单,管理收款,查看财务报表 | 财务人员 |

## 🛠️ 技术栈

### 前端
- **框架**: Next.js 14 (App Router)
- **UI库**: React 18 + TypeScript 5
- **组件库**: Ant Design 5.x
- **状态管理**: Zustand
- **服务端状态**: React Query
- **富文本**: Tiptap
- **图表**: ECharts

### 后端
- **运行时**: Node.js 18+
- **Web框架**: Next.js API Routes
- **ORM**: Prisma 5.x
- **认证**: NextAuth.js v5
- **权限**: CASL
- **实时通信**: Socket.io

### 数据库
- **数据库**: MySQL 8.0
- **连接池**: Prisma内置

### 部署
- **服务器**: 阿里云ECS (2核4GB)
- **反向代理**: Nginx
- **进程管理**: PM2
- **文件存储**: 阿里云OSS

## 📊 数据库设计

### 核心表(14个)

**用户与权限(5个)**
- `users` - 用户表
- `roles` - 角色表
- `user_roles` - 用户角色关联
- `permissions` - 权限点表
- `role_permissions` - 角色权限关联

**客户管理(3个)**
- `customers` - 客户表
- `follow_ups` - 跟进记录表
- `leads` - 销售线索表

**财务管理(2个)**
- `orders` - 订单表
- `payments` - 收款记录表

**协同办公(4个)**
- `daily_reports` - 日报表
- `messages` - 消息表
- `tasks` - 任务表
- `files` - 文件表

## 🔐 安全特性

1. **密码加密**: bcrypt哈希加密
2. **Session管理**: JWT Token,8小时有效期
3. **权限控制**: RBAC模型,路由级+组件级双重保护
4. **SQL注入防护**: Prisma ORM参数化查询
5. **XSS防护**: React自动转义,DOMPurify清理HTML
6. **CSRF防护**: NextAuth自动处理
7. **数据脱敏**: 敏感信息API响应脱敏
8. **HTTPS**: SSL/TLS加密传输

## 📁 项目结构

```
crm-system/
├── prisma/                    # 数据库配置
│   ├── schema.prisma         # 数据模型定义
│   └── seed.ts               # 种子数据
├── src/
│   ├── app/                  # Next.js页面
│   │   ├── (auth)/          # 认证页面
│   │   ├── (dashboard)/     # 主应用页面
│   │   └── api/             # API路由
│   ├── components/          # React组件
│   ├── lib/                 # 工具函数
│   ├── stores/              # 状态管理
│   ├── types/               # TypeScript类型
│   └── middleware.ts        # 中间件
├── public/                   # 静态资源
├── .env.example             # 环境变量示例
├── package.json             # 项目依赖
├── README.md                # 项目文档
└── QUICKSTART.md            # 快速启动指南
```

## 🚀 快速开始

### 前置要求
- Node.js 18+
- MySQL 8.0
- pnpm (推荐)

### 安装步骤

```bash
# 1. 安装依赖
pnpm install

# 2. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 填入数据库配置

# 3. 创建数据库
mysql -u root -p
CREATE DATABASE crm_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 4. 数据库迁移
pnpm prisma:generate
pnpm prisma:migrate

# 5. 种子数据
pnpm prisma:seed

# 6. 启动开发服务器
pnpm dev
```

访问 http://localhost:3000  
默认账号: `admin` / `123456`

## 📈 开发路线图

### Phase 1: 基础框架 ✅ (已完成)
- [x] Next.js项目初始化
- [x] 数据库Schema设计
- [x] 用户认证系统
- [x] RBAC权限系统
- [x] 基础布局组件

### Phase 2: 客户管理 (Week 3-4)
- [ ] 客户列表和CRUD
- [ ] 跟进记录管理
- [ ] 销售线索转化
- [ ] 客户导入导出

### Phase 3: 财务管理 (Week 5-6)
- [ ] 订单管理
- [ ] 收款记录
- [ ] 业绩报表
- [ ] 数据可视化

### Phase 4: 协同办公 (Week 7-9)
- [ ] 日报系统
- [ ] 消息中心
- [ ] 任务管理
- [ ] 文件共享

### Phase 5: 测试优化 (Week 10-11)
- [ ] 单元测试
- [ ] 性能优化
- [ ] 安全测试

### Phase 6: 部署上线 (Week 12)
- [ ] 阿里云ECS部署
- [ ] 域名SSL配置
- [ ] 监控告警
- [ ] 正式上线

## 💰 成本估算

### 开发成本
- 前端开发: ¥30-40万 (2人×3个月)
- 后端开发: ¥15-20万 (1人×3个月)
- UI设计: ¥3-5万 (兼职)
- 测试: ¥2-3万 (兼职)
- **合计**: ¥50-68万

### 运维成本(首年)
- 阿里云ECS: ¥3600-6000
- 阿里云RDS: ¥4800-7200
- 域名+SSL: ¥100-300
- **合计**: ¥8500-13500/年

### 总成本(首年): ¥51-69万

## 🎨 界面预览

### 登录页面
- 简洁的登录表单
- 渐变背景设计
- 响应式布局

### 仪表盘
- 统计卡片展示
- 关键数据指标
- 快捷入口

### 侧边栏菜单
- 客户管理
- 财务管理
- 日报管理
- 消息中心
- 任务管理
- 文件共享
- 系统管理

## 📝 API接口

### 认证接口
- `POST /api/auth/login` - 登录
- `POST /api/auth/logout` - 登出
- `GET /api/auth/session` - 获取会话

### 客户接口
- `GET /api/customers` - 客户列表
- `POST /api/customers` - 创建客户
- `GET /api/customers/:id` - 客户详情
- `PUT /api/customers/:id` - 更新客户
- `DELETE /api/customers/:id` - 删除客户

### 财务接口
- `GET /api/finance/orders` - 订单列表
- `POST /api/finance/orders` - 创建订单
- `GET /api/finance/payments` - 收款记录
- `POST /api/finance/payments` - 创建收款

### 协同办公接口
- `GET /api/daily-reports` - 日报列表
- `POST /api/daily-reports` - 创建日报
- `GET /api/messages` - 消息列表
- `POST /api/messages` - 发送消息
- `GET /api/tasks` - 任务列表
- `POST /api/tasks` - 创建任务

## 🔧 扩展建议

1. **移动端**: React Native开发iOS/Android App
2. **AI集成**: 智能客户推荐,销售预测
3. **BI分析**: 更强大的数据分析看板
4. **微服务**: 大模块拆分为独立服务
5. **国际化**: 多语言支持
6. **第三方集成**: 企业微信,钉钉,ERP系统

## 📞 技术支持

- 详细文档: 查看 `README.md` 和 `QUICKSTART.md`
- 架构设计: 查看 `CRM系统架构设计方案.md`
- 问题反馈: 提Issue或联系开发团队

## 📄 许可证

MIT License

---

**开发周期**: 12周(3个月)  
**团队配置**: 前端2人 + 后端1人 + UI 1人(兼职) + 测试1人(兼职)  
**技术特点**: 现代化、安全可靠、易于扩展、部署简单

🎉 **Phase 1基础框架已完成,可以开始开发业务功能!**
