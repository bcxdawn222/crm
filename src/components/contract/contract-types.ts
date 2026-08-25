export interface ContractArchive {
  id: string
  archiveNo: string
  contractName: string
  contractType?: string
  version: number
  isLatest: boolean
  fileName: string
  fileSize: number
  fileType: string
  ossUrl?: string
  archivedAt: string
  remarks?: string
  hasOldVersions?: boolean
  totalVersions?: number
  archivedUser?: { id: string; realName: string }
}
