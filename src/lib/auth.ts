import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import "next-auth/jwt"
import bcrypt from "bcryptjs"
import { timingSafeEqual } from "crypto"
import { prisma } from "@/lib/prisma"
import type { Role } from "@prisma/client"

// Startup validation for critical env vars (skip during next build — no secrets in build stage).
const isNextBuild = process.env.NEXT_PHASE === "phase-production-build"
if (process.env.NODE_ENV === "production" && !isNextBuild) {
  if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET must be set in production")
  if (!process.env.ADMIN_PASSWORD) throw new Error("ADMIN_PASSWORD must be set in production")
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

        const username = credentials.username as string
        const password = credentials.password as string

        // First-admin bootstrap from env vars (timing-safe comparison).
        const usernameMatch = timingSafeEqual(
          Buffer.from(username),
          Buffer.from(process.env.ADMIN_USERNAME ?? ""),
        )
        const passwordMatch = timingSafeEqual(
          Buffer.from(password),
          Buffer.from(process.env.ADMIN_PASSWORD ?? ""),
        )
        if (usernameMatch && passwordMatch) {
          const admin = await prisma.user.upsert({
            where: { username },
            update: {},
            create: {
              username,
              hashedPassword: await bcrypt.hash(password, 12),
              role: "ADMIN",
            },
          })
          return { id: admin.id, username: admin.username, role: admin.role }
        }

        const user = await prisma.user.findUnique({ where: { username } })
        if (!user || !user.active) return null

        const valid = await bcrypt.compare(password, user.hashedPassword)
        if (!valid) return null

        return { id: user.id, username: user.username, role: user.role }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.username = user.username
        token.role = user.role
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
