/** @type {import('next').NextConfig} */
const nextConfig = {
  // 禁用barrel优化器以解决Ant Design组件导入问题
  experimental: {
    optimizePackageImports: [],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.aliyuncs.com',
      },
    ],
  },
}

module.exports = nextConfig
