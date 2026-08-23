import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { authenticateDatabaseUser } from '@/lib/auth/database-user'

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
    maxAge: 8 * 60 * 60, // 8小时
  },
  secret: process.env.NEXTAUTH_SECRET,
})

// 导出GET和POST用于API路由
export const GET = handlers.GET
export const POST = handlers.POST
