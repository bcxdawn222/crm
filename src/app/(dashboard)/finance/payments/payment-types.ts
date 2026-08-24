import type { Dayjs } from 'dayjs'

export interface PaymentRecord {
  id: string
  paymentNo: string
  orderId: string
  amount: number
  paymentMethod: string
  paymentDate: string
  invoiceNo?: string
  invoiceType?: string
  remarks?: string
  operatorId: string
  createdAt: string
  order?: {
    orderNo: string
    contractNo?: string
    customer?: {
      name: string
      company?: string
    }
  }
  operator?: {
    realName: string
  }
}

export interface PaymentOrderOption {
  id: string
  orderNo: string
  unpaidAmount: number
  status: string
  customer?: {
    name: string
  }
}

export interface PaymentFormValues {
  orderId: string
  amount: number
  paymentMethod: string
  paymentDate: Dayjs
  invoiceNo?: string
  invoiceType?: string
  remarks?: string
}
