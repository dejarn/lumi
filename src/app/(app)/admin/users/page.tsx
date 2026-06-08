import Box from "@mui/material/Box"
import List from "@mui/material/List"
import { prisma } from "@/lib/prisma"
import AdminUserRow from "@/components/AdminUserRow"
import AdminInviteRow from "@/components/AdminInviteRow"
import InviteDialog from "@/components/InviteDialog"
import PageHeader from "@/components/ui/PageHeader"
import PageSection from "@/components/ui/PageSection"
import StateCard from "@/components/ui/StateCard"

// List users, issue invites, change role, set active:false to cut off a departed
// flatmate instantly (docs/api.md#users).
export default async function AdminUsersPage() {
  const [users, invites] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, username: true, role: true, active: true, createdAt: true },
      orderBy: { username: "asc" },
    }),
    prisma.invite.findMany({
      select: { id: true, role: true, expiresAt: true, usedAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ])

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <PageHeader title="Utilisateurs" action={<InviteDialog />} />

      <PageSection glow="accent">
        <List>
          {users.map((user) => (
            <AdminUserRow key={user.id} user={user} />
          ))}
        </List>
      </PageSection>

      <PageSection label="Invitations" glow="accent">
        {invites.length === 0 ? (
          <StateCard variant="empty" icon="✉" title="Aucune invitation" />
        ) : (
          <List>
            {invites.map((invite) => (
              <AdminInviteRow key={invite.id} invite={invite} />
            ))}
          </List>
        )}
      </PageSection>
    </Box>
  )
}
