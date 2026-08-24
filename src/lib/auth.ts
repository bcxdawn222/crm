import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { authenticateDatabaseUser } from '@/lib/auth/database-user'

const DEFAULT_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60
const MIN_SESSION_MAX_AGE_SECONDS = 60
const MAX_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

function sessionMaxAgeSeconds(): number {
  const configured = process.env.CRM_SESSION_MAX_AGE_SECONDS?.trim()
  if (!configured) return DEFAULT_SESSION_MAX_AGE_SECONDS
  if (!/^\d+$/.test(configured)) {
    throw new Error('CRM_SESSION_MAX_AGE_SECONDS 必须是整数秒数')
  }
  const seconds = Number(configured)
  if (!Number.isSafeInteger(seconds) || seconds < MIN_SESSION_MAX_AGE_SECONDS || seconds > MAX_SESSION_MAX_AGE_SECONDS) {
    throw new Error(
      `CRM_SESSION_MAX_AGE_SECONDS 必须在 ${MIN_SESSION_MAX_AGE_SECONDS} 到 ${MAX_SESSION_MAX_AGE_SECONDS} 秒之间`,
    )
  }
  return seconds
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "用户名", type: "text" },
        password: { label: "密码", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null
        }
        
        const user = await authenticateDatabaseUser(
          String(credentials.username),
          String(credentials.password)
        )
        
        if (!user) {
          return null
        }
        
        return {
          id: user.id,
          username: user.username,
          email: user.email,
          realName: user.realName,
          roles: user.roles,
          permissions: user.permissions
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.roles = user.roles
        token.permissions = user.permissions
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.roles = token.roles as string[]
        session.user.permissions = token.permissions as string[]
      }
      return session
    }
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: "jwt",
    maxAge: sessionMaxAgeSeconds(),
  },
  secret: process.env.NEXTAUTH_SECRET,
})

// 导出GET和POST用于API路由
export const GET = handlers.GET
export const POST = handlers.POST
