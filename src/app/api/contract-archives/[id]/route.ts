import { auth } from "@/lib/auth";
import {
  ContractArchiveError,
  deleteContractArchive,
} from "@/lib/contracts/archive";
import { canWriteContractArchive } from "@/lib/contracts/access";
import {
  getRequestId,
  jsonWithRequestId,
  serverErrorResponse,
} from "@/lib/http/request-context";
import { prisma } from "@/lib/prisma";

export async function DELETE(
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
      include: { customer: { select: { salesId: true } } },
    });
    if (!archive) {
      return jsonWithRequestId({ error: "合同备案不存在" }, requestId, {
        status: 404,
      });
    }
    if (
      !(await canWriteContractArchive(session.user, archive.customer.salesId))
    ) {
      return jsonWithRequestId({ error: "无权删除合同备案" }, requestId, {
        status: 403,
      });
    }

    await deleteContractArchive({
      archiveId: id,
      actorId: session.user.id,
      requestId,
    });
    return jsonWithRequestId(
      { success: true, message: "合同备案已删除" },
      requestId,
    );
  } catch (error) {
    if (error instanceof ContractArchiveError) {
      return jsonWithRequestId(
        { error: error.message, code: error.code, requestId },
        requestId,
        { status: error.status },
      );
    }
    return serverErrorResponse(
      error,
      "DELETE /api/contract-archives/[id]",
      requestId,
    );
  }
}
