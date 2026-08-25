import path from 'path'

type Signature = readonly number[]

export interface UploadTypeRule {
  mimeTypes: readonly string[]
  signatures: readonly Signature[]
  marker?: { offset: number; bytes: Signature }
}

export interface ValidatedUpload {
  buffer: Buffer
  extension: string
  mimeType: string
  originalName: string
}

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UploadValidationError'
  }
}

const PDF: Signature = [0x25, 0x50, 0x44, 0x46, 0x2d]
const JPEG: Signature = [0xff, 0xd8, 0xff]
const PNG: Signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const OLE: Signature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
const ZIP_SIGNATURES: readonly Signature[] = [
  [0x50, 0x4b, 0x03, 0x04],
  [0x50, 0x4b, 0x05, 0x06],
  [0x50, 0x4b, 0x07, 0x08],
]

export const SHARED_UPLOAD_RULES: Readonly<Record<string, UploadTypeRule>> = {
  '.pdf': { mimeTypes: ['application/pdf'], signatures: [PDF] },
  '.doc': { mimeTypes: ['application/msword'], signatures: [OLE] },
  '.docx': {
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    signatures: ZIP_SIGNATURES,
  },
  '.xls': { mimeTypes: ['application/vnd.ms-excel'], signatures: [OLE] },
  '.xlsx': {
    mimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    signatures: ZIP_SIGNATURES,
  },
  '.jpg': { mimeTypes: ['image/jpeg'], signatures: [JPEG] },
  '.jpeg': { mimeTypes: ['image/jpeg'], signatures: [JPEG] },
  '.png': { mimeTypes: ['image/png'], signatures: [PNG] },
  '.webp': {
    mimeTypes: ['image/webp'],
    signatures: [[0x52, 0x49, 0x46, 0x46]],
    marker: { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
  },
}

export const CONTRACT_UPLOAD_RULES: Readonly<Record<string, UploadTypeRule>> = Object.fromEntries(
  ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'].map((extension) => [
    extension,
    SHARED_UPLOAD_RULES[extension],
  ]),
)

function beginsWith(buffer: Buffer, signature: Signature, offset = 0): boolean {
  return signature.every((byte, index) => buffer[offset + index] === byte)
}

function safeOriginalName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 255 || /[\u0000-\u001f\u007f]/.test(trimmed)) {
    throw new UploadValidationError('文件名不合法')
  }
  if (path.basename(trimmed) !== trimmed || trimmed.includes('/') || trimmed.includes('\\')) {
    throw new UploadValidationError('文件名不能包含路径')
  }
  return trimmed
}

export async function validateUploadedFile(
  file: File,
  maxBytes: number,
  rules: Readonly<Record<string, UploadTypeRule>>,
): Promise<ValidatedUpload> {
  const originalName = safeOriginalName(file.name)
  if (file.size <= 0 || file.size > maxBytes) {
    throw new UploadValidationError(`文件不能为空且不能超过 ${Math.floor(maxBytes / 1024 / 1024)}MB`)
  }
  const extension = path.extname(originalName).toLowerCase()
  const rule = rules[extension]
  if (!rule || !rule.mimeTypes.includes(file.type)) {
    throw new UploadValidationError('文件扩展名或类型不受支持')
  }
  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.length !== file.size) {
    throw new UploadValidationError('文件读取不完整')
  }
  const signatureMatches = rule.signatures.some((signature) => beginsWith(buffer, signature))
  const markerMatches = !rule.marker || beginsWith(buffer, rule.marker.bytes, rule.marker.offset)
  if (!signatureMatches || !markerMatches) {
    throw new UploadValidationError('文件内容与扩展名不一致')
  }
  return { buffer, extension, mimeType: file.type, originalName }
}
