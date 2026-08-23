# 层级数据访问控制功能实现报告

**实现日期**: 2026年7月25日  
**功能名称**: 基于组织架构的层级数据权限控制  

---

## 📋 需求概述

实现基于角色和上下级关系的数据访问控制,确保:
1. **管理员**: 可以查看所有数据
2. **销售主管**: 只能查看自己和下属(销售代表)的数据
3. **普通销售**: 只能查看自己的数据
4. **财务专员**: 可以查看所有数据(财务需要全局视角)

---

## ✅ 已实现功能

### 1. 数据库设计

#### User模型扩展字段

| 字段 | 类型 | 说明 |
|------|------|------|
| managerId | String? | 上级主管ID(外键自引用) |
| manager | User? | 上级用户对象(自关联关系) |
| subordinates | User[] | 下属用户列表(一对多) |

**索引优化:**
- `@@index([managerId])` - 加速查询下属

#### 层级关系示例

```
Admin (系统管理员)
├─ Manager (销售主管)
│  └─ Sales (销售代表)
└─ Finance (财务人员)
```

---

### 2. 数据权限过滤工具函数

创建了 `src/lib/data-permission.ts` 文件,包含以下核心函数:

#### `getUserAndSubordinateIds(userId)`
递归获取用户及其所有下属的ID列表(支持多层级)

**示例:**
```typescript
// Manager调用返回: ['2', '3'] (自己和下属Sales)
// Sales调用返回: ['3'] (只有自己)
```

#### `buildDataFilter(userId, userRoles)`
根据用户角色生成Prisma查询过滤条件

**逻辑:**
- Admin/Finance: 返回空过滤器(无限制)
- Sales Manager/Sales: 返回 `{ salesId: { in: [自己+下属IDs] } }`

#### `canAccessSalesData(currentUserId, currentUserRoles, targetSalesId)`
检查用户是否有权限访问指定销售的数据

#### `getDirectSubordinates(userId)`
获取用户的直接下属列表(不递归)

#### `getTeamTree(userId)`
获取完整的团队树结构(递归,包含所有层级)

---

### 3. API接口修改

#### 已更新的API端点

1. **客户管理 API** (`/api/customers/route.ts`)
   - GET: 应用层级数据过滤
   - POST: 保持不变

2. **订单管理 API** (`/api/finance/orders/route.ts`)
   - GET: 应用层级数据过滤

3. **日报管理 API** (`/api/daily-reports/route.ts`)
   - GET: 应用层级数据过滤

**修改内容:**
```typescript
// 旧代码 - 只支持sales角色
if (session.user.roles.includes('sales')) {
  where.salesId = session.user.id
}

// 新代码 - 支持层级过滤
const roles = session.user.roles || []
const dataFilter = await buildDataFilter(session.user.id, roles)

if (roles.includes('sales_manager') || roles.includes('sales')) {
  Object.assign(where, dataFilter)
}
```

---

### 4. 测试账号层级关系

#### 账号配置

| 用户名 | 角色 | ID | 上级(managerId) | 数据访问范围 |
|--------|------|----|----------------|-------------|
| admin | 管理员 | 1 | null | 全部数据 |
| manager | 销售主管 | 2 | null | 自己 + Sales的数据 |
| sales | 销售代表 | 3 | 2 (Manager) | 仅自己的数据 |
| finance | 财务专员 | 4 | null | 全部数据 |

#### 执行脚本

运行 `setup-user-hierarchy.js` 脚本自动设置层级关系:
```bash
node setup-user-hierarchy.js
```

---

## 🔧 技术实现细节

### 1. Prisma Schema修改

```prisma
model User {
  // ... 其他字段
  
  // 层级关系 - 上级主管
  managerId     String?   // 上级ID
  manager       User?     @relation("UserManager", fields: [managerId], references: [id])
  subordinates  User[]    @relation("UserManager")
  
  @@index([managerId])
}
```

### 2. 递归查询算法

```typescript
async function getUserAndSubordinateIds(userId: string): Promise<string[]> {
  const ids = new Set<string>([userId])
  
  async function getSubordinates(parentId: string) {
    const subordinates = await prisma.user.findMany({
      where: { managerId: parentId },
      select: { id: true }
    })
    
    for (const sub of subordinates) {
      if (!ids.has(sub.id)) {
        ids.add(sub.id)
        await getSubordinates(sub.id) // 递归
      }
    }
  }
  
  await getSubordinates(userId)
  return Array.from(ids)
}
```

**特点:**
- 使用Set避免重复
- 支持无限层级深度
- 防止循环引用

### 3. 权限判断逻辑

```typescript
export async function buildDataFilter(
  userId: string,
  userRoles: string[]
): Promise<{ salesId?: { in: string[] } } | {}> {
  // Admin可以查看所有数据
  if (userRoles.includes('admin')) {
    return {}
  }
  
  // Sales Manager和Sales只能查看自己和下属的数据
  if (userRoles.includes('sales_manager') || userRoles.includes('sales')) {
    const accessibleUserIds = await getUserAndSubordinateIds(userId)
    return {
      salesId: { in: accessibleUserIds }
    }
  }
  
  // Finance可以查看所有数据
  if (userRoles.includes('finance')) {
    return {}
  }
  
  return {}
}
```

---

## 📊 数据访问规则矩阵

| 数据类型 | Admin | Manager | Sales | Finance |
|---------|-------|---------|-------|---------|
| 客户列表 | ✅ 全部 | ✅ 自己+下属 | ✅ 仅自己 | ✅ 全部 |
| 订单列表 | ✅ 全部 | ✅ 自己+下属 | ✅ 仅自己 | ✅ 全部 |
| 日报列表 | ✅ 全部 | ✅ 自己+下属 | ✅ 仅自己 | ✅ 全部 |
| 电销名单 | ✅ 全部 | ✅ 自己+下属 | ✅ 仅自己 | ❌ 无权限 |
| 已合作客户 | ✅ 全部 | ✅ 自己+下属 | ✅ 仅自己 | ✅ 全部 |
| 财务数据 | ✅ 全部 | ❌ 无权限 | ❌ 无权限 | ✅ 全部 |

---

## 🎯 使用场景示例

### 场景1: 销售主管查看团队业绩

**操作:**
1. 使用 `manager` / `123456` 登录
2. 进入"客户管理"页面
3. 可以看到:
   - Manager自己创建的客户
   - Sales创建的客户(下属)

**效果:**
- 无法看到Admin或Finance创建的客户
- 统计卡片显示团队总数(自己+下属)

### 场景2: 销售代表查看个人数据

**操作:**
1. 使用 `sales` / `123456` 登录
2. 进入"客户管理"页面
3. 只能看到自己创建的客户

**效果:**
- 完全隔离,看不到Manager或其他同事的数据
- 保证数据隐私性和安全性

### 场景3: 管理员全局监控

**操作:**
1. 使用 `admin` / `123456` 登录
2. 可以查看所有销售的数据
3. 进行全局数据分析和决策

**效果:**
- 完整的全局视图
- 可以进行跨团队对比分析

---

## 🚀 扩展建议

### 1. 多销售团队支持

如果需要支持多个销售团队:

```typescript
// 添加Team模型
model Team {
  id        String   @id @default(uuid())
  name      String
  leaderId  String   // 团队负责人
  members   User[]
}

// User模型添加
model User {
  teamId    String?
  team      Team?   @relation(fields: [teamId], references: [id])
}
```

### 2. 数据共享功能

允许销售之间临时共享客户:

```typescript
model CustomerShare {
  customerId     String
  sharedWithId   String  // 共享给谁
  sharedById     String  // 谁共享的
  expiresAt      DateTime?
}
```

### 3. 权限审计日志

记录数据访问行为:

```typescript
model DataAccessLog {
  id          String   @id @default(uuid())
  userId      String
  targetType  String   // customer/order/report
  targetId    String
  action      String   // view/update/delete
  createdAt   DateTime @default(now())
}
```

### 4. 动态角色配置

在数据库中存储角色权限,而不是硬编码:

```typescript
// 从数据库读取角色权限
const rolePermissions = await prisma.rolePermission.findMany({
  where: { roleId: userRoleId },
  include: { permission: true }
})
```

---

## ⚠️ 注意事项

### 1. 性能优化

- 递归查询可能导致N+1问题
- 建议对深层级团队使用缓存(Redis)
- 添加查询超时保护

### 2. 数据安全

- 始终在后端验证权限,不要信任前端
- 定期审计数据访问日志
- 敏感操作需要二次确认

### 3. 边界情况

- 处理用户被删除时的层级关系(Prisma Cascade)
- 处理循环引用的可能性(虽然Prisma会阻止)
- 处理用户转团队时的数据迁移

---

## 📝 测试清单

### 功能测试

- [x] Admin可以查看所有客户
- [x] Manager可以看到自己和Sales的客户
- [x] Sales只能看到自己的客户
- [x] Finance可以查看所有客户
- [x] 层级关系正确设置
- [x] 递归查询正常工作

### 回归测试

- [ ] 客户CRUD操作正常
- [ ] 订单创建和查看正常
- [ ] 日报提交和审阅正常
- [ ] 电销名单功能正常
- [ ] 已合作客户功能正常

---

## 🎉 总结

本次更新成功实现了基于组织架构的层级数据访问控制系统:

✅ **数据库层面**: 添加了自关联的上下级关系  
✅ **工具函数**: 创建了完整的数据权限过滤工具集  
✅ **API层**: 更新了客户、订单、日报等核心API  
✅ **测试数据**: 设置了清晰的账号层级关系  
✅ **文档**: 提供了详细的使用说明和扩展建议  

系统现在可以灵活支持不同规模的销售团队,确保数据安全和隐私保护!

---

**相关文件:**
- `prisma/schema.prisma` - 数据库模型
- `src/lib/data-permission.ts` - 权限过滤工具
- `src/lib/auth.ts` - 认证配置
- `src/app/api/customers/route.ts` - 客户API
- `src/app/api/finance/orders/route.ts` - 订单API
- `src/app/api/daily-reports/route.ts` - 日报API
- `setup-user-hierarchy.js` - 层级设置脚本
