import fs from 'fs'
import path from 'path'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'contracts')

// 确保上传目录存在
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

/**
 * 保存文件到本地存储
 */
export async function saveFile(file: Buffer, key: string): Promise<string> {
  try {
    const filePath = path.join(UPLOAD_DIR, key)
    const dirPath = path.dirname(filePath)
    
    // 确保子目录存在
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
    
    // 写入文件
    fs.writeFileSync(filePath, file)
    
    // 返回相对路径(用于数据库存储和URL访问)
    return `/uploads/contracts/${key}`
  } catch (error) {
    console.error('文件保存失败:', error)
    throw new Error('文件保存失败')
  }
}

/**
 * 删除本地文件
 */
export async function deleteFile(key: string): Promise<void> {
  try {
    const filePath = path.join(UPLOAD_DIR, key)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  } catch (error) {
    console.error('文件删除失败:', error)
    throw new Error('文件删除失败')
  }
}

/**
 * 获取文件URL(本地存储直接返回路径)
 */
export async function getFileUrl(relativePath: string): Promise<string> {
  // 本地存储直接返回路径,浏览器可以直接访问
  return relativePath
}

/**
 * 生成文件存储键(与OSS保持一致的命名规则)
 */
export function generateFileKey(customerId: string, originalFilename: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 10)
  const ext = originalFilename.split('.').pop() || 'bin'
  return `${customerId}/${timestamp}_${random}.${ext}`
}
