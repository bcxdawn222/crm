import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { defineAbility } from "@/lib/casl";
import { recordAuditEvent } from "@/lib/audit/record";
import { canAccessSalesData } from "@/lib/data-permission";
import {
  getRequestId,
  jsonWithRequestId,
  serverErrorResponse,
} from "@/lib/http/request-context";
import {
  buildCustomerUpdateData,
  CustomerRouteError,
  parseCustomerUpdate,
} from "./customer-route-helpers";

// GET /api/customers/[id] - 获取客户详情
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const requestId = getRequestId(request);
  try {
    if (!z.string().uuid().safeParse(id).success) {
      return jsonWithRequestId({ error: "客户 ID 格式不正确", code: "VALIDATION_ERROR" }, requestId, { status: 400 });
    }
    const session = await auth();

    if (!session) {
      return jsonWithRequestId({ error: "未登录或登录已过期", code: "UNAUTHORIZED" }, requestId, { status: 401 });
    }

    // Check permissions
    const permissions = session.user?.permissions || [];
    const ability = defineAbility(permissions);
    if (ability.cannot("read", "customer")) {
      return jsonWithRequestId({ error: "无权查看客户", code: "FORBIDDEN" }, requestId, { status: 403 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        sales: {
          select: {
            id: true,
            realName: true,
            phone: true,
            email: true,
          },
        },
        followUps: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            sales: {
              select: {
                id: true,
                realName: true,
              },
            },
          },
        },
        orders: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        leads: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    if (!customer) {
      return jsonWithRequestId({ error: "客户不存在", code: "CUSTOMER_NOT_FOUND" }, requestId, { status: 404 });
    }

    if (
      !(await canAccessSalesData(
        session.user.id,
        session.user.roles,
        customer.salesId,
      ))
    ) {
      return jsonWithRequestId({ error: "无权查看该客户", code: "FORBIDDEN" }, requestId, { status: 403 });
    }

    const categoryMap: Record<string, string> = {
      POTENTIAL: "潜在客户",
      NORMAL: "普通客户",
      IMPORTANT: "重要客户",
      VIP: "VIP客户",
    };
    return jsonWithRequestId({
      success: true,
      data: {
        ...customer,
        category: customer.level ? categoryMap[customer.level] || customer.level : "潜在客户",
        contractAmount: customer.contractAmount?.toNumber() ?? null,
        orders: customer.orders.map((order) => ({
          ...order,
          contractAmount: order.contractAmount.toNumber(),
          paidAmount: order.paidAmount.toNumber(),
          unpaidAmount: order.unpaidAmount.toNumber(),
        })),
      },
    }, requestId);
  } catch (error) {
    return serverErrorResponse(error, "GET /api/customers/[id]", requestId);
  }
}

// PUT /api/customers/[id] - 更新客户
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const requestId = getRequestId(request);
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // 检查权限
    const ability = defineAbility(session.user.permissions as string[]);
    if (ability.cannot("update", "customer")) {
      return NextResponse.json({ error: "无权更新客户" }, { status: 403 });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { error: "请求内容不是有效 JSON" },
        { status: 400 },
      );
    }
    const parsed = parseCustomerUpdate(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "客户参数不正确" },
        { status: 400 },
      );
    }

    // 检查客户是否存在
    const existingCustomer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!existingCustomer) {
      return NextResponse.json({ error: "客户不存在" }, { status: 404 });
    }

    if (
      !(await canAccessSalesData(
        session.user.id,
        session.user.roles,
        existingCustomer.salesId,
      ))
    ) {
      return NextResponse.json({ error: "无权修改该客户" }, { status: 403 });
    }

    // 检查电话是否与其他客户重复
    const duplicatePhone = parsed.data.phone
      ? await prisma.customer.findFirst({
          where: {
            phone: parsed.data.phone,
            id: { not: id },
          },
        })
      : null;

    if (duplicatePhone) {
      return NextResponse.json(
        { error: "该电话已被其他客户使用" },
        { status: 400 },
      );
    }

    // 更新客户
    const customer = await prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id },
        data: buildCustomerUpdateData(parsed.data, existingCustomer),
      });
      await recordAuditEvent(tx, {
        actorId: session.user.id,
        action: "UPDATE",
        entityType: "Customer",
        entityId: updated.id,
        beforeData: existingCustomer,
        afterData: updated,
        reason: "CUSTOMER_UPDATED",
        requestId,
      });
      return updated;
    });

    return jsonWithRequestId(
      {
        success: true,
        data: customer,
        message: "客户更新成功",
      },
      requestId,
    );
  } catch (error) {
    return serverErrorResponse(error, "PUT /api/customers/[id]", requestId);
  }
}

// DELETE /api/customers/[id] - 删除客户
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const requestId = getRequestId(request);
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    // 检查权限
    const ability = defineAbility(session.user.permissions as string[]);
    if (ability.cannot("delete", "customer")) {
      return NextResponse.json({ error: "无权删除客户" }, { status: 403 });
    }

    // 检查客户是否存在
    const customer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      return NextResponse.json({ error: "客户不存在" }, { status: 404 });
    }

    if (
      !(await canAccessSalesData(
        session.user.id,
        session.user.roles,
        customer.salesId,
      ))
    ) {
      return NextResponse.json({ error: "无权删除该客户" }, { status: 403 });
    }

    if (customer.status === "INACTIVE") {
      return jsonWithRequestId(
        { error: "客户已删除", code: "CUSTOMER_ALREADY_INACTIVE" },
        requestId,
        { status: 409 },
      );
    }

    // 软删除(设置状态为INACTIVE)
    const updatedCustomer = await prisma.$transaction(async (tx) => {
      const result = await tx.customer.updateMany({
        where: { id, status: { not: "INACTIVE" } },
        data: { status: "INACTIVE" },
      });
      if (result.count !== 1) {
        throw new CustomerRouteError(
          "客户状态已变化，请刷新后重试",
          409,
          "CUSTOMER_DELETE_CONFLICT",
        );
      }
      const updated = await tx.customer.findUnique({
        where: { id },
      });
      if (!updated) {
        throw new CustomerRouteError(
          "客户删除结果不存在",
          500,
          "CUSTOMER_DELETE_RESULT_MISSING",
        );
      }
      await recordAuditEvent(tx, {
        actorId: session.user.id,
        action: "DELETE",
        entityType: "Customer",
        entityId: updated.id,
        beforeData: customer,
        afterData: updated,
        reason: "CUSTOMER_SOFT_DELETED",
        requestId,
      });
      return updated;
    });

    return jsonWithRequestId(
      {
        success: true,
        message: "客户删除成功",
      },
      requestId,
    );
  } catch (error) {
    if (error instanceof CustomerRouteError) {
      return jsonWithRequestId(
        { error: error.message, code: error.code },
        requestId,
        { status: error.status },
      );
    }
    return serverErrorResponse(error, "DELETE /api/customers/[id]", requestId);
  }
}
