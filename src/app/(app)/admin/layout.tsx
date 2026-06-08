import { redirect } from "next/navigation"
import { getSession } from "@/lib/get-session"
import { prisma } from "@/lib/prisma"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { active: true, role: true },
  })
  if (!user || !user.active) redirect("/login")
  if (user.role !== "ADMIN") redirect("/dashboard")

  return children
}
