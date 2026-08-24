import { handlePublicPoolClaim } from '@/lib/public-pool/claim-handler'


export async function POST(request: Request) {
  return handlePublicPoolClaim(request)
}
