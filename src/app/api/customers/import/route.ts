import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { defineAbility } from '@/lib/casl'
import * as XLSX from 'xlsx'
import { CustomerLevel, CustomerSource } from '@prisma/client'

// POST /api/customers/import - 批量导入客户
export async function POST(request: Request) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permissions
    const permissions = session.user?.permissions || []
    const ability = defineAbility(permissions)
    if (ability.cannot('create', 'customer')) {
      return NextResponse.json({ error: 'No permission to create customers' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // 读取文件内容
    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet)

    if (!jsonData || jsonData.length === 0) {
      return NextResponse.json({ error: 'Empty file or invalid format' }, { status: 400 })
    }

    if (jsonData.length > 1000) {
      return NextResponse.json({ error: 'Too many records, maximum 1000' }, { status: 400 })
    }

    // 字段映射
    const fieldMapping: Record<string, string> = {
      '姓名': 'name',
      'name': 'name',
      '公司': 'company',
      'company': 'company',
      '公司名称': 'company',
      '电话': 'phone',
      'phone': 'phone',
      '联系电话': 'phone',
      '邮箱': 'email',
      'email': 'email',
      '邮箱地址': 'email',
      '地址': 'address',
      'address': 'address',
      '联系地址': 'address',
      '分类': 'category',
      'category': 'category',
      '客户分类': 'category',
      '来源': 'source',
      'source': 'source',
      '客户来源': 'source',
      '备注': 'notes',
      'notes': 'notes',
      '备注信息': 'notes',
    }

    // 处理数据
    const customersToCreate = []
    const errors = []

    for (let i = 0; i < jsonData.length; i++) {
      const row: any = jsonData[i]
      
      // 转换字段名
      const customer: any = {}
      for (const [key, value] of Object.entries(row)) {
        const mappedKey = fieldMapping[key] || key
        if (mappedKey && value) {
          customer[mappedKey] = String(value).trim()
        }
      }

      // 验证必填字段
      if (!customer.name) {
        errors.push(`第 ${i + 2} 行：姓名为必填项`)
        continue
      }

      if (!customer.phone) {
        errors.push(`第 ${i + 2} 行：电话为必填项`)
        continue
      }

      // 设置默认值
      customer.category = customer.category || '潜在客户'
      customer.source = customer.source || '其他'
      customer.status = 'ACTIVE'
      customer.salesId = session.user.id

      customersToCreate.push(customer)
    }

    // 批量创建
    let successCount = 0
    for (const customerData of customersToCreate) {
      try {
        await prisma.customer.create({
          data: {
            name: customerData.name,
            company: customerData.company || null,
            phone: customerData.phone,
            email: customerData.email || null,
            address: customerData.address || null,
            level: mapCategoryToLevel(customerData.category),
            source: mapSource(customerData.source),
            status: customerData.status,
            salesId: customerData.salesId,
            notes: customerData.notes || null,
          },
        })
        successCount++
      } catch (error: any) {
        errors.push(`${customerData.name}：${error.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        count: successCount,
        total: jsonData.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    })
  } catch (error: any) {
    console.error('Import failed:', error)
    return NextResponse.json({ 
      error: 'Server error',
      details: error.message 
    }, { status: 500 })
  }
}

// 将分类映射到level枚举
function mapCategoryToLevel(category: string): CustomerLevel {
  const levelMap: Record<string, CustomerLevel> = {
    '潜在客户': 'POTENTIAL',
    '普通客户': 'NORMAL',
    '重要客户': 'IMPORTANT',
    'VIP客户': 'VIP',
  }
  return levelMap[category] || 'POTENTIAL'
}

function mapSource(source: string): CustomerSource {
  const sourceMap: Record<string, CustomerSource> = {
    '网站': CustomerSource.WEBSITE,
    '转介绍': CustomerSource.REFERRAL,
    '广告': CustomerSource.ADVERTISEMENT,
    '展会': CustomerSource.EXHIBITION,
    '电话': CustomerSource.COLD_CALL,
    '社交媒体': CustomerSource.SOCIAL_MEDIA,
    '其他': CustomerSource.OTHER,
  }
  if (Object.values(CustomerSource).includes(source as CustomerSource)) {
    return source as CustomerSource
  }
  return sourceMap[source] ?? CustomerSource.OTHER
}
