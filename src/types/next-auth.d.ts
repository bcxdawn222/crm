import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      username: string
      email: string
      realName: string
      roles: string[]
      permissions: string[]
    }
  }

  interface User {
    id: string
    username: string
    email: string
    realName: string
    roles: string[]
    permissions: string[]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    roles: string[]
    permissions: string[]
  }
}
