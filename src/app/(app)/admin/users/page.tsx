import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import List from "@mui/material/List"
import Divider from "@mui/material/Divider"
import { prisma } from "@/lib/prisma"
import AdminUserRow from "@/components/AdminUserRow"
import AdminInviteRow from "@/components/AdminInviteRow"
import InviteDialog from "@/components/InviteDialog"

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
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h5">Utilisateurs</Typography>
        <InviteDialog />
      </Box>

      <List>
        {users.map((user) => (
          <AdminUserRow key={user.id} user={user} />
        ))}
      </List>

      <Divider />

      <Typography variant="h6">Invitations</Typography>
      <List>
        {invites.map((invite) => (
          <AdminInviteRow key={invite.id} invite={invite} />
        ))}
      </List>
      {invites.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          Aucune invitation.
        </Typography>
      )}
    </Box>
  )
}
