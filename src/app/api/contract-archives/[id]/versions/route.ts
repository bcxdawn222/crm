import { auth } from "@/lib/auth";
import { canReadContractArchive } from "@/lib/contracts/access";
import {
  getRequestId,
  jsonWithRequestId,
  serverErrorResponse,
} from "@/lib/http/request-context";
import { prisma } from "@/lib/prisma";

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
    const current = await prisma.contractArchive.findUnique({
      where: { id },
      include: {
        customer: { select: { salesId: true, operationManagerId: true } },
      },
    });
    if (!current) {
      return jsonWithRequestId({ error: "合同备案不存在" }, requestId, {
        status: 404,
      });
    }
    if (!(await canReadContractArchive(session.user, current.customer))) {
      return jsonWithRequestId({ error: "无权查看合同版本" }, requestId, {
        status: 403,
      });
    }

    const versions = await prisma.contractArchive.findMany({
      where: {
        customerId: current.customerId,
        contractName: current.contractName,
      },
      orderBy: { version: "desc" },
      include: { archivedUser: { select: { id: true, realName: true } } },
    });
    return jsonWithRequestId({ success: true, data: versions }, requestId);
  } catch (error) {
    return serverErrorResponse(
      error,
      "GET /api/contract-archives/[id]/versions",
      requestId,
    );
  }
}
