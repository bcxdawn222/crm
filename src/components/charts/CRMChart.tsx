'use client'

import ReactEChartsCore from 'echarts-for-react/lib/core'
import type { EChartsReactProps } from 'echarts-for-react/lib/types'
import * as echarts from 'echarts/core'
import { BarChart, FunnelChart, LineChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'

echarts.use([
  BarChart,
  FunnelChart,
  LineChart,
  PieChart,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  SVGRenderer,
])

type CRMChartProps = Omit<EChartsReactProps, 'echarts'>

export default function CRMChart(props: CRMChartProps) {
  return <ReactEChartsCore echarts={echarts} {...props} />
}
