export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'DELIVERING'
  | 'COMPLETED'
  | 'CANCELLED'

export interface OrderRecord {
  id: string
  orderNo: string
  customerId: string
  salesId: string
  contractNo?: string
  contractAmount: number
  paidAmount: number
  unpaidAmount: number
  currency: string
  status: OrderStatus
  signDate?: string
  deliveryDate?: string
  remarks?: string
  createdAt: string
  customer?: {
    id?: string
    name: string
    company?: string
  }
  sales?: {
    realName: string
  }
  _count?: {
    payments: number
  }
}
