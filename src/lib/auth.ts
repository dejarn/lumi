import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import "next-auth/jwt"
import { authorizeCredentials } from "@/lib/credentials"
import { prisma } from "@/lib/prisma"
import type { Role } from "@prisma/client"

// Startup validation for critical env vars (skip during next build — no secrets in build stage).
const isNextBuild = process.env.NEXT_PHASE === "phase-production-build"
if (process.env.NODE_ENV === "production" && !isNextBuild) {
  if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET must be set in production")
  if (!process.env.ADMIN_PASSWORD) throw new Error("ADMIN_PASSWORD must be set in production")
  if (!process.env.ADMIN_USERNAME) throw new Error("ADMIN_USERNAME must be set in production")
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      username: string
      role: Role
    }
  }
  interface User {
    username: string
    role: Role
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    username: string
    role: Role
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Long maxAge: revocation never relies on token expiry. Every request re-checks
  // User.active against the DB via requireUser() (see lib/auth-guard.ts, CLAUDE.md rule 3).
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null
        return authorizeCredentials(
          credentials.username as string,
          credentials.password as string,
        )
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.username = user.username
        token.role = user.role
      } else if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: { username: true, role: true, active: true },
        })
        if (!dbUser || !dbUser.active) return token
        token.username = dbUser.username
        token.role = dbUser.role
      }
      return token
    },
    async session({ session, token }) {
      session.user.id = token.id
      session.user.username = token.username
      session.user.role = token.role
      return session
    },
  },
})
