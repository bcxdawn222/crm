import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 随机数生成器
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

// 随机选择数组元素
const randomChoice = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

// 姓名数据
const firstNames = ['张', '李', '王', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '马', '朱', '胡', '郭', '何', '高', '林', '罗']
const lastNames = ['伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋', '勇', '艳', '杰', '娟', '涛', '明', '超', '秀英', '霞', '平']

// 公司数据
const companies = [
  '北京科技有限公司',
  '上海贸易发展有限公司',
  '广州制造厂',
  '深圳创新科技公司',
  '杭州电子商务公司',
  '成都餐饮管理公司',
  '武汉建筑工程公司',
  '南京金融服务公司',
  '西安文化传媒公司',
  '重庆物流运输公司',
  '天津进出口公司',
  '苏州工业园区企业',
  '青岛海洋科技公司',
  '大连软件开发公司',
  '厦门国际贸易公司',
]

// 地址前缀
const cities = [
  '北京市朝阳区',
  '上海市浦东新区',
  '广州市天河区',
  '深圳市南山区',
  '杭州市西湖区',
  '成都市武侯区',
  '武汉市江汉区',
  '南京市鼓楼区',
  '西安市雁塔区',
  '重庆市渝中区',
]

const streets = ['建国路', '人民路', '中山路', '解放路', '和平路', '胜利路', '文化路', '科技路', '创新路', '发展路']

// 备注模板
const noteTemplates = [
  '对CRM系统很感兴趣,需要详细演示',
  '初步接触,待进一步沟通',
  '已发送产品资料,等待反馈',
  '客户要求先试用再决定',
  '价格敏感,需要提供优惠方案',
  '决策流程较长,需要持续跟进',
  '竞争对手也在接触,需要加强关系',
  '预算充足,成交可能性高',
  '需要技术团队支持',
  '计划下季度采购',
]

async function generateRandomCustomer(salesId: string) {
  const firstName = randomChoice(firstNames)
  const lastName = randomChoice(lastNames)
  const name = firstName + lastName
  
  const company = randomChoice(companies)
  const phone = `1${randomInt(3, 9)}${String(randomInt(100000000, 999999999))}`
  const email = `${name.toLowerCase()}${randomInt(1, 999)}@example.com`
  
  const city = randomChoice(cities)
  const street = randomChoice(streets)
  const address = `${city}${street}${randomInt(1, 999)}号`
  
  const levels = ['POTENTIAL', 'NORMAL', 'VIP', 'IMPORTANT']
  const sources = ['WEBSITE', 'REFERRAL', 'ADVERTISEMENT', 'EXHIBITION', 'COLD_CALL', 'SOCIAL_MEDIA']
  const statuses = ['ACTIVE', 'INACTIVE']
  
  return {
    name,
    company,
    phone,
    email,
    address,
    level: randomChoice(levels) as any,
    source: randomChoice(sources) as any,
    notes: randomChoice(noteTemplates),
    salesId,
    status: randomChoice(statuses) as any,
  }
}

async function main() {
  console.log('开始生成随机客户数据...\n')

  // 获取admin用户作为销售
  const salesUser = await prisma.user.findFirst({
    where: { username: 'admin' }
  })

  if (!salesUser) {
    console.error('未找到用户')
    return
  }

  console.log(`使用销售用户: ${salesUser.realName} (${salesUser.id})\n`)

  // 生成50个随机客户
  const customerCount = 50
  let successCount = 0
  let skipCount = 0

  for (let i = 0; i < customerCount; i++) {
    try {
      const customerData = await generateRandomCustomer(salesUser.id)
      
      const customer = await prisma.customer.create({
        data: customerData,
      })
      
      successCount++
      console.log(`✓ [${successCount}/${customerCount}] 创建客户: ${customer.name} (${customer.company})`)
      
      // 添加小延迟,避免过快
      await new Promise(resolve => setTimeout(resolve, 50))
    } catch (error: any) {
      // 如果是唯一约束冲突,跳过
      if (error.code === 'P2002') {
        skipCount++
        console.log(`⊘ 跳过重复客户 (${skipCount})`)
      } else {
        console.error(`✗ 创建失败:`, error.message)
      }
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log(`生成完成!`)
  console.log(`成功: ${successCount} 个`)
  console.log(`跳过: ${skipCount} 个`)
  console.log('='.repeat(50))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
