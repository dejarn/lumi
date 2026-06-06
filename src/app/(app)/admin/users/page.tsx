import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemText from "@mui/material/ListItemText"
import { prisma } from "@/lib/prisma"

// List users, issue invites, change role, set active:false to cut off a departed
// flatmate instantly (docs/api.md#users).
export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, role: true, active: true, createdAt: true },
    orderBy: { username: "asc" },
  })

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="h5">Utilisateurs</Typography>
      <List>
        {users.map((user) => (
          <ListItem key={user.id} divider>
            <ListItemText
              primary={user.username}
              secondary={`${user.role}${user.active ? "" : " · désactivé"}`}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  )
}
