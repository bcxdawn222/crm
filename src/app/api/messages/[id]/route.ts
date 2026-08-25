import { auth } from "@/lib/auth";
import { recordAuditEvent } from "@/lib/audit/record";
import { defineAbility } from "@/lib/casl";
import {
  getRequestId,
  jsonWithRequestId,
  serverErrorResponse,
} from "@/lib/http/request-context";
import { prisma } from "@/lib/prisma";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const requestId = getRequestId(request);
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return jsonWithRequestId({ error: "未授权" }, requestId, { status: 401 });
    }
    const ability = defineAbility(session.user.permissions || []);
    if (ability.cannot("read", "message")) {
      return jsonWithRequestId({ error: "无权操作消息" }, requestId, {
        status: 403,
      });
    }
    const updated = await prisma.$transaction(async (tx) => {
      const readAt = new Date();
      const result = await tx.message.updateMany({
        where: { id, receiverId: session.user.id },
        data: { isRead: true, readAt },
      });
      if (result.count === 0) {
        return false;
      }
      await recordAuditEvent(tx, {
        actorId: session.user.id,
        action: "MESSAGE_READ",
        entityType: "Message",
        entityId: id,
        afterData: { isRead: true, readAt },
        requestId,
      });
      return true;
    });
    if (!updated) {
      return jsonWithRequestId({ error: "消息不存在" }, requestId, {
        status: 404,
      });
    }
    return jsonWithRequestId({ success: true }, requestId);
  } catch (error) {
    return serverErrorResponse(error, `PATCH /api/messages/${id}`, requestId);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const requestId = getRequestId(request);
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return jsonWithRequestId({ error: "未授权" }, requestId, { status: 401 });
    }
    const ability = defineAbility(session.user.permissions || []);
    if (ability.cannot("delete", "message")) {
      return jsonWithRequestId({ error: "无权删除消息" }, requestId, {
        status: 403,
      });
    }
    const deleted = await prisma.$transaction(async (tx) => {
      const result = await tx.message.deleteMany({
        where: { id, receiverId: session.user.id },
      });
      if (result.count === 0) {
        return false;
      }
      await recordAuditEvent(tx, {
        actorId: session.user.id,
        action: "MESSAGE_DELETED",
        entityType: "Message",
        entityId: id,
        requestId,
      });
      return true;
    });
    if (!deleted) {
      return jsonWithRequestId({ error: "消息不存在" }, requestId, {
        status: 404,
      });
    }
    return jsonWithRequestId({ success: true }, requestId);
  } catch (error) {
    return serverErrorResponse(error, `DELETE /api/messages/${id}`, requestId);
  }
}
