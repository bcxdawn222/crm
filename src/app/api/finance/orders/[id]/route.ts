import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { defineAbility } from "@/lib/casl";
import { recordAuditEvent } from "@/lib/audit/record";
import {
  getRequestId,
  jsonWithRequestId,
  serverErrorResponse,
} from "@/lib/http/request-context";
import { canAccessSalesData } from "@/lib/data-permission";
import { Prisma } from "@prisma/client";
import {
  serializeOrderAmounts,
  serializeOrderDetails,
  updateOrderSchema,
} from "./order-route-helpers";

// GET /api/finance/orders/[id] - 获取订单详情
export async function GET(
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

    // Check permissions
    const permissions = session.user?.permissions || [];
    const ability = defineAbility(permissions);
    if (ability.cannot("read", "order")) {
      return NextResponse.json({ error: "无权访问" }, { status: 403 });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            company: true,
            phone: true,
            email: true,
          },
        },
        sales: {
          select: {
            id: true,
            realName: true,
            phone: true,
            email: true,
          },
        },
        payments: {
          orderBy: { paymentDate: "desc" },
          include: {
            operator: {
              select: {
                realName: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "订单不存在" }, { status: 404 });
    }

    if (
      !(await canAccessSalesData(
        session.user.id,
        session.user.roles,
        order.salesId,
      ))
    ) {
      return NextResponse.json({ error: "无权查看该订单" }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      data: serializeOrderDetails(order),
    });
  } catch (error) {
    return serverErrorResponse(
      error,
      "GET /api/finance/orders/[id]",
      requestId,
    );
  }
}

// PUT /api/finance/orders/[id] - 更新订单
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
    if (ability.cannot("update", "order")) {
      return NextResponse.json({ error: "无权更新订单" }, { status: 403 });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return jsonWithRequestId(
        { error: "请求内容不是有效 JSON", requestId },
        requestId,
        { status: 400 },
      );
    }
    const parsed = updateOrderSchema.safeParse(payload);
    if (!parsed.success) {
      return jsonWithRequestId(
        {
          error: parsed.error.issues[0]?.message ?? "订单参数不正确",
          requestId,
        },
        requestId,
        { status: 400 },
      );
    }

    // 检查订单是否存在
    const existingOrder = await prisma.order.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: "订单不存在" }, { status: 404 });
    }

    if (
      !(await canAccessSalesData(
        session.user.id,
        session.user.roles,
        existingOrder.salesId,
      ))
    ) {
      return NextResponse.json({ error: "无权修改该订单" }, { status: 403 });
    }

    // 如果更新了合同金额,需要重新计算未付金额
    const updateData: Prisma.OrderUpdateInput = { ...parsed.data };
    const { contractAmount } = parsed.data;
    if (
      contractAmount !== undefined &&
      !existingOrder.contractAmount.equals(contractAmount)
    ) {
      const newContractAmount = contractAmount;
      const paidAmount = existingOrder.paidAmount.toNumber();
      const newUnpaidAmount = newContractAmount - paidAmount;
      if (newUnpaidAmount < 0) {
        return jsonWithRequestId(
          { error: "合同金额不能低于已收金额", requestId },
          requestId,
          { status: 400 },
        );
      }
      updateData.contractAmount = new Prisma.Decimal(
        newContractAmount.toFixed(2),
      );
      updateData.unpaidAmount = new Prisma.Decimal(newUnpaidAmount.toFixed(2));
    }

    // 更新订单
    const order = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: updateData,
      });
      await recordAuditEvent(tx, {
        actorId: session.user.id,
        action: "UPDATE",
        entityType: "Order",
        entityId: updated.id,
        beforeData: existingOrder,
        afterData: updated,
        reason: "ORDER_UPDATED",
        requestId,
      });
      return updated;
    });

    return jsonWithRequestId(
      {
        success: true,
        data: serializeOrderAmounts(order),
        message: "订单更新成功",
      },
      requestId,
    );
  } catch (error) {
    return serverErrorResponse(
      error,
      "PUT /api/finance/orders/[id]",
      requestId,
    );
  }
}

// DELETE /api/finance/orders/[id] - 删除订单
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
    if (ability.cannot("delete", "order")) {
      return NextResponse.json({ error: "无权删除订单" }, { status: 403 });
    }

    // 检查订单是否存在
    const existingOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        _count: {
          select: { payments: true },
        },
      },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: "订单不存在" }, { status: 404 });
    }

    // 如果有收款记录,不允许删除
    if (existingOrder._count.payments > 0) {
      return NextResponse.json(
        { error: "该订单已有收款记录,无法删除" },
        { status: 400 },
      );
    }

    if (
      !(await canAccessSalesData(
        session.user.id,
        session.user.roles,
        existingOrder.salesId,
      ))
    ) {
      return NextResponse.json({ error: "无权删除该订单" }, { status: 403 });
    }

    // 删除订单
    await prisma.$transaction(async (tx) => {
      await tx.order.delete({ where: { id } });
      await recordAuditEvent(tx, {
        actorId: session.user.id,
        action: "DELETE",
        entityType: "Order",
        entityId: existingOrder.id,
        beforeData: existingOrder,
        reason: "ORDER_DELETED",
        requestId,
      });
    });

    return jsonWithRequestId(
      {
        success: true,
        message: "订单删除成功",
      },
      requestId,
    );
  } catch (error) {
    return serverErrorResponse(
      error,
      "DELETE /api/finance/orders/[id]",
      requestId,
    );
  }
}
