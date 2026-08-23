import OSS from 'ali-oss'

// OSS客户端配置
const ossClient = new OSS({
  region: process.env.OSS_REGION || 'oss-cn-hangzhou',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
  bucket: process.env.OSS_BUCKET || 'crm-contracts',
})

/**
 * 上传文件到OSS
 * @param file - 文件Buffer
 * @param key - OSS对象键(路径)
 * @returns OSS访问URL
 */
export async function uploadToOSS(file: Buffer, key: string): Promise<string> {
  try {
    const result = await ossClient.put(key, file)
    return result.url
  } catch (error) {
    console.error('OSS上传失败:', error)
    throw new Error('文件上传失败')
  }
}

/**
 * 从OSS删除文件
 * @param key - OSS对象键
 */
export async function deleteFromOSS(key: string): Promise<void> {
  try {
    await ossClient.delete(key)
  } catch (error) {
    console.error('OSS删除失败:', error)
    throw new Error('文件删除失败')
  }
}

/**
 * 获取临时签名URL(用于下载/预览)
 * @param key - OSS对象键
 * @param expires - 过期时间(秒),默认1小时
 * @returns 签名URL
 */
export async function getSignedUrl(key: string, expires: number = 3600): Promise<string> {
  try {
    return ossClient.signatureUrl(key, { expires })
  } catch (error) {
    console.error('获取签名URL失败:', error)
    throw new Error('获取文件链接失败')
  }
}

/**
 * 生成OSS对象键
 * @param customerId - 客户ID
 * @param originalFilename - 原始文件名
 * @returns OSS对象键
 */
export function generateOSSKey(customerId: string, originalFilename: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 10)
  const ext = originalFilename.split('.').pop() || 'bin'
  return `contracts/${customerId}/${timestamp}_${random}.${ext}`
}
