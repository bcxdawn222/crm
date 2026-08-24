import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import {
  authenticateDatabaseUser,
  loadActiveDatabaseUserById,
} from '@/lib/auth/database-user'
import type { AuthenticatedDatabaseUser } from '@/lib/auth/database-user'
import type { JWT } from 'next-auth/jwt'

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

function synchronizeToken(token: JWT, user: AuthenticatedDatabaseUser): JWT {
  token.id = user.id
  token.username = user.username
  token.email = user.email
  token.realName = user.realName
  token.roles = user.roles
  token.permissions = user.permissions
  return token
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
        return synchronizeToken(token, user)
      }
      if (typeof token.id !== 'string') return null
      const currentUser = await loadActiveDatabaseUserById(token.id)
      return currentUser ? synchronizeToken(token, currentUser) : null
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.username = token.username
        session.user.email = token.email
        session.user.realName = token.realName
        session.user.roles = token.roles
        session.user.permissions = token.permissions
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
