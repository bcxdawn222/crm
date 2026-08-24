import { auth } from '@/lib/auth'
import { defineAbility } from '@/lib/casl'
import {
  CustomerImportConflictError,
  CustomerImportValidationError,
  importCustomers,
} from '@/lib/customers/import'
import { getRequestId, jsonWithRequestId, serverErrorResponse } from '@/lib/http/request-context'

export async function POST(request: Request) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session) {
      return jsonWithRequestId({ error: '未登录或登录已过期' }, requestId, { status: 401 })
    }

    const ability = defineAbility(session.user.permissions || [])
    if (ability.cannot('create', 'customer')) {
      return jsonWithRequestId({ error: '无权导入客户' }, requestId, { status: 403 })
    }

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return jsonWithRequestId({ error: '上传内容不是有效的表单文件' }, requestId, { status: 400 })
    }
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return jsonWithRequestId({ error: '请选择需要导入的文件' }, requestId, { status: 400 })
    }

    const customerIds = await importCustomers({ file, actorId: session.user.id, requestId })
    return jsonWithRequestId({
      success: true,
      data: { count: customerIds.length, total: customerIds.length },
      message: `成功导入 ${customerIds.length} 条客户记录`,
    }, requestId, { status: 201 })
  } catch (error) {
    if (error instanceof CustomerImportValidationError) {
      return jsonWithRequestId(
        { error: error.message, errors: error.errors, requestId },
        requestId,
        { status: 400 }
      )
    }
    if (error instanceof CustomerImportConflictError) {
      return jsonWithRequestId(
        { error: error.message, code: 'CUSTOMER_IMPORT_CONFLICT', requestId },
        requestId,
        { status: 409 }
      )
    }
    return serverErrorResponse(error, 'POST /api/customers/import', requestId)
  }
}
