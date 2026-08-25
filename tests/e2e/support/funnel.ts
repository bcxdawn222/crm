export const emptyFunnelResponse = {
  success: true,
  data: {
    stages: [
      { stage: 'LEAD', name: '线索客户', count: 0, conversionRate: 100, avgDaysInStage: 0 },
      { stage: 'CONTACTED', name: '已跟进', count: 0, conversionRate: 0, avgDaysInStage: 0 },
      { stage: 'PROPOSAL', name: '有订单', count: 0, conversionRate: 0, avgDaysInStage: 0 },
      { stage: 'NEGOTIATION', name: '待确认', count: 0, conversionRate: 0, avgDaysInStage: 0 },
      { stage: 'CLOSED_WON', name: '已成交', count: 0, conversionRate: 0, avgDaysInStage: 0 },
    ],
    overallConversionRate: 0,
    avgSalesCycle: 0,
  },
} as const
