import { Prisma } from "@prisma/client";
import { z } from "zod";

import { auth } from "@/lib/auth";
import {
  ContractArchiveError,
  createContractArchive,
} from "@/lib/contracts/archive";
import {
  canReadContractArchive,
  canWriteContractArchive,
} from "@/lib/contracts/access";
import {
  getRequestId,
  jsonWithRequestId,
  serverErrorResponse,
} from "@/lib/http/request-context";
import {
  CONTRACT_UPLOAD_RULES,
  UploadValidationError,
  validateUploadedFile,
} from "@/lib/files/validation";
import { parsePagination } from "@/lib/http/pagination";
import { prisma } from "@/lib/prisma";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const CONTRACT_TYPES = ["SALES", "SERVICE", "COOPERATION", "OTHER"] as const;
const optionalDate = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.date().optional(),
);
const optionalAmount = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().min(0).max(99_999_999.99).optional(),
);
const metadataSchema = z
  .object({
    contractName: z.preprocess(
      (value) => value === undefined || value === null ? "" : value,
      z.string().trim().max(200),
    ),
    contractType: z.preprocess(
      (value) => (value === "" || value === null ? undefined : value),
      z.enum(CONTRACT_TYPES).optional(),
    ),
    signDate: optionalDate,
    effectiveDate: optionalDate,
    expiryDate: optionalDate,
    contractAmount: optionalAmount,
    remarks: z.string().trim().max(10_000).optional(),
  })
  .refine(
    (data) =>
      !data.effectiveDate ||
      !data.expiryDate ||
      data.expiryDate >= data.effectiveDate,
    "合同到期日期不能早于生效日期",
  );

async function findCustomer(customerId: string) {
  return prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, salesId: true, operationManagerId: true },
  });
}

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
    const customer = await findCustomer(id);
    if (!customer) {
      return jsonWithRequestId({ error: "客户不存在" }, requestId, {
        status: 404,
      });
    }
    if (!(await canReadContractArchive(session.user, customer))) {
      return jsonWithRequestId({ error: "无权查看合同备案" }, requestId, {
        status: 403,
      });
    }

    const searchParams = new URL(request.url).searchParams;
    const pagination = parsePagination(searchParams);
    if (!pagination) {
      return jsonWithRequestId({ error: "分页参数不正确" }, requestId, {
        status: 400,
      });
    }
    const where: Prisma.ContractArchiveWhereInput = { customerId: id };
    if (searchParams.get("showAllVersions") !== "true") where.isLatest = true;

    const [total, archives] = await prisma.$transaction([
      prisma.contractArchive.count({ where }),
      prisma.contractArchive.findMany({
        where,
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
        orderBy: { createdAt: "desc" },
        include: { archivedUser: { select: { id: true, realName: true } } },
      }),
    ]);
    const contractNames = [
      ...new Set(archives.map((archive) => archive.contractName)),
    ];
    const counts =
      contractNames.length === 0
        ? []
        : await prisma.contractArchive.groupBy({
            by: ["contractName"],
            where: { customerId: id, contractName: { in: contractNames } },
            _count: { _all: true },
          });
    const countByName = new Map(
      counts.map((item) => [item.contractName, item._count._all]),
    );
    const list = archives.map((archive) => ({
      ...archive,
      totalVersions: countByName.get(archive.contractName) ?? 1,
      hasOldVersions: (countByName.get(archive.contractName) ?? 1) > 1,
    }));

    return jsonWithRequestId(
      {
        success: true,
        data: {
          list,
          total,
          ...pagination,
          totalPages: Math.ceil(total / pagination.pageSize),
        },
      },
      requestId,
    );
  } catch (error) {
    return serverErrorResponse(
      error,
      "GET /api/customers/[id]/contract-archives",
      requestId,
    );
  }
}

export async function POST(
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
    const customer = await findCustomer(id);
    if (!customer) {
      return jsonWithRequestId({ error: "客户不存在" }, requestId, {
        status: 404,
      });
    }
    if (!(await canWriteContractArchive(session.user, customer.salesId))) {
      return jsonWithRequestId({ error: "无权上传合同备案" }, requestId, {
        status: 403,
      });
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return jsonWithRequestId({ error: "上传内容不是有效表单" }, requestId, {
        status: 400,
      });
    }
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return jsonWithRequestId({ error: "请选择合同文件" }, requestId, {
        status: 400,
      });
    }
    let upload;
    try {
      upload = await validateUploadedFile(
        file,
        MAX_FILE_SIZE,
        CONTRACT_UPLOAD_RULES,
      );
    } catch (error) {
      if (error instanceof UploadValidationError) {
        return jsonWithRequestId({ error: error.message }, requestId, {
          status: 400,
        });
      }
      throw error;
    }
    const parsed = metadataSchema.safeParse({
      contractName: formData.get("contractName"),
      contractType: formData.get("contractType"),
      signDate: formData.get("signDate"),
      effectiveDate: formData.get("effectiveDate"),
      expiryDate: formData.get("expiryDate"),
      contractAmount: formData.get("contractAmount"),
      remarks: formData.get("remarks"),
    });
    if (!parsed.success) {
      return jsonWithRequestId(
        {
          error: parsed.error.issues[0]?.message ?? "合同信息不正确",
          requestId,
        },
        requestId,
        { status: 400 },
      );
    }

    const { archive, replayed } = await createContractArchive({
      ...parsed.data,
      contractName: parsed.data.contractName || upload.originalName.slice(0, 200),
      customerId: id,
      fileName: upload.originalName,
      fileType: upload.extension.slice(1),
      fileSize: upload.buffer.length,
      file: upload.buffer,
      actorId: session.user.id,
      requestId,
    });
    return jsonWithRequestId(
      {
        success: true,
        data: archive,
        replayed,
        message: replayed ? "合同备案已存在，返回原记录" : "合同备案成功",
      },
      requestId,
      { status: replayed ? 200 : 201 },
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
      "POST /api/customers/[id]/contract-archives",
      requestId,
    );
  }
}
