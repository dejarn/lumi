import bcrypt from "bcryptjs"
import { createHash, timingSafeEqual } from "crypto"
import { prisma } from "@/lib/prisma"
import type { Role } from "@prisma/client"

export type AuthUser = { id: string; username: string; role: Role }

// Precomputed bcrypt hash for timing-equalization on unknown usernames.
const DUMMY_HASH = "$2b$12$dQL97s9wQmu934JajKKe..n/f4iBVaGmfQLBhWV5//1hu4ASASCB6"

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest()
  const hb = createHash("sha256").update(b).digest()
  return timingSafeEqual(ha, hb)
}

async function bootstrapAllowed(): Promise<boolean> {
  if (process.env.ALLOW_ADMIN_BOOTSTRAP === "true") return true
  const count = await prisma.user.count({ where: { role: "ADMIN", active: true } })
  return count === 0
}

/** Credentials authorize logic (env bootstrap + DB users). Used by NextAuth and tests. */
export async function authorizeCredentials(
  username: string,
  password: string,
): Promise<AuthUser | null> {
  const usernameMatch = safeEqual(username, process.env.ADMIN_USERNAME ?? "")
  const passwordMatch = safeEqual(password, process.env.ADMIN_PASSWORD ?? "")
  if (usernameMatch && passwordMatch) {
    if (!(await bootstrapAllowed())) return null
    const admin = await prisma.user.upsert({
      where: { username },
      update: {},
      create: {
        username,
        hashedPassword: await bcrypt.hash(password, 12),
        role: "ADMIN",
      },
    })
    if (!admin.active) return null
    return { id: admin.id, username: admin.username, role: admin.role }
  }

  const user = await prisma.user.findUnique({ where: { username } })
  if (!user || !user.active) {
    await bcrypt.compare(password, DUMMY_HASH)
    return null
  }

  const valid = await bcrypt.compare(password, user.hashedPassword)
  if (!valid) return null

  return { id: user.id, username: user.username, role: user.role }
}
