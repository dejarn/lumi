import { redirect } from "next/navigation"
import { getSession } from "@/lib/get-session"
import { prisma } from "@/lib/prisma"
import AppShell from "@/components/AppShell"
import SessionProvider from "@/components/SessionProvider"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect("/login")

  // Per-request revocation check (CLAUDE.md rule 3): trust the DB, not the JWT.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { active: true },
  })
  if (!user || !user.active) redirect("/login")

  return (
    <SessionProvider session={session}>
      <AppShell session={session}>{children}</AppShell>
    </SessionProvider>
  )
}
