import { recordAuditEvent } from "@/lib/audit/record";
import { auth } from "@/lib/auth";
import { canReadContractArchive } from "@/lib/contracts/access";
import { readContractFile } from "@/lib/fileStorage";
import {
  getRequestId,
  jsonWithRequestId,
  serverErrorResponse,
} from "@/lib/http/request-context";
import { prisma } from "@/lib/prisma";

const MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const requestId = getRequestId(request);
  try {
    const session = await auth();
    if (!session) {
      return jsonWithRequestId({ error: "未登录或登录已过期" }, requestId, {
        status: 401,
      });
    }
    const archive = await prisma.contractArchive.findUnique({
      where: { id },
      include: {
        customer: { select: { salesId: true, operationManagerId: true } },
      },
    });
    if (!archive) {
      return jsonWithRequestId({ error: "合同备案不存在" }, requestId, {
        status: 404,
      });
    }
    if (!(await canReadContractArchive(session.user, archive.customer))) {
      return jsonWithRequestId({ error: "无权下载合同文件" }, requestId, {
        status: 403,
      });
    }

    const file = await readContractFile(archive.ossKey);
    await recordAuditEvent(prisma, {
      actorId: session.user.id,
      action: "DOWNLOAD",
      entityType: "ContractArchive",
      entityId: archive.id,
      afterData: { fileName: archive.fileName, fileType: archive.fileType },
      reason: "CONTRACT_FILE_DOWNLOADED",
      requestId,
    });
    const inline = new URL(request.url).searchParams.get("inline") === "1";
    const disposition = inline ? "inline" : "attachment";
    return new Response(new Uint8Array(file), {
      status: 200,
      headers: {
        "Content-Type":
          MIME_TYPES[archive.fileType] || "application/octet-stream",
        "Content-Length": String(file.length),
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(archive.fileName)}`,
        "x-request-id": requestId,
      },
    });
  } catch (error) {
    return serverErrorResponse(
      error,
      "GET /api/contract-archives/[id]/download",
      requestId,
    );
  }
}
