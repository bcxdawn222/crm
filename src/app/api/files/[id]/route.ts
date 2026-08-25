import { NextResponse } from "next/server";

import { recordAuditEvent } from "@/lib/audit/record";
import { auth } from "@/lib/auth";
import { defineAbility } from "@/lib/casl";
import {
  readSharedFile,
  removeSharedFile,
  restoreSharedFile,
} from "@/lib/files/storage";
import {
  getRequestId,
  jsonWithRequestId,
  serverErrorResponse,
} from "@/lib/http/request-context";
import { prisma } from "@/lib/prisma";
import { canAccessSalesData } from "@/lib/data-permission";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const requestId = getRequestId(request);
  try {
    const session = await auth();
    if (!session?.user?.id)
      return jsonWithRequestId({ error: "未授权" }, requestId, { status: 401 });
    if (!session.user.permissions.includes("file:download")) {
      return jsonWithRequestId({ error: "无权下载文件" }, requestId, {
        status: 403,
      });
    }
    const file = await prisma.file.findUnique({ where: { id } });
    if (!file)
      return jsonWithRequestId({ error: "文件不存在" }, requestId, {
        status: 404,
      });
    if (
      !(await canAccessSalesData(
        session.user.id,
        session.user.roles,
        file.uploadedBy,
      ))
    ) {
      return jsonWithRequestId({ error: "无权下载文件" }, requestId, {
        status: 403,
      });
    }
    const content = await readSharedFile(file.path);
    await prisma.file.update({
      where: { id: file.id },
      data: { downloadCount: { increment: 1 } },
    });
    return new NextResponse(new Uint8Array(content), {
      headers: {
        "content-type": file.mimeType,
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
        "x-request-id": requestId,
      },
    });
  } catch (error) {
    return serverErrorResponse(error, "GET /api/files/[id]", requestId);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const requestId = getRequestId(request);
  try {
    const session = await auth();
    if (!session?.user?.id)
      return jsonWithRequestId({ error: "未授权" }, requestId, { status: 401 });
    const ability = defineAbility(session.user.permissions || []);
    if (ability.cannot("delete", "file"))
      return jsonWithRequestId({ error: "无权删除文件" }, requestId, {
        status: 403,
      });
    const file = await prisma.file.findUnique({ where: { id } });
    if (!file)
      return jsonWithRequestId({ error: "文件不存在" }, requestId, {
        status: 404,
      });
    if (
      !(await canAccessSalesData(
        session.user.id,
        session.user.roles,
        file.uploadedBy,
      ))
    ) {
      return jsonWithRequestId({ error: "无权删除文件" }, requestId, {
        status: 403,
      });
    }
    const content = await readSharedFile(file.path);
    await removeSharedFile(file.path);
    try {
      await prisma.$transaction(async (db) => {
        await db.file.delete({ where: { id: file.id } });
        await recordAuditEvent(db, {
          actorId: session.user.id,
          action: "FILE_DELETED",
          entityType: "File",
          entityId: file.id,
          beforeData: { name: file.originalName, size: file.size },
          requestId,
        });
      });
    } catch (error) {
      await restoreSharedFile(file.path, content);
      throw error;
    }
    return jsonWithRequestId({ success: true }, requestId);
  } catch (error) {
    return serverErrorResponse(error, "DELETE /api/files/[id]", requestId);
  }
}
