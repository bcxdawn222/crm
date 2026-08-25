import type { ThemeConfig } from 'antd'


export const crmTheme: ThemeConfig = {
  token: {
    colorPrimary: '#197b9c',
    colorInfo: '#2563eb',
    colorSuccess: '#15803d',
    colorWarning: '#b45309',
    colorError: '#b91c1c',
    colorText: '#0f172a',
    colorTextSecondary: '#475569',
    colorBorder: '#cbd5e1',
    colorBgLayout: '#f1f5f9',
    colorBgContainer: '#ffffff',
    borderRadius: 6,
    controlHeight: 34,
    fontSize: 14,
    wireframe: false,
  },
  components: {
    Button: { borderRadius: 6, primaryShadow: 'none' },
    Card: { borderRadiusLG: 8, headerFontSize: 16 },
    Layout: { bodyBg: '#f1f5f9', headerBg: '#ffffff', siderBg: '#0f172a' },
    Menu: { darkItemBg: '#0f172a', darkItemSelectedBg: '#164e63' },
    Modal: { borderRadiusLG: 8, titleFontSize: 18 },
    Table: { cellPaddingBlock: 10, cellPaddingInline: 12, headerBg: '#f8fafc' },
  },
}
