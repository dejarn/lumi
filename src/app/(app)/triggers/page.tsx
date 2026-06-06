import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemText from "@mui/material/ListItemText"
import { prisma } from "@/lib/prisma"

export default async function TriggersPage() {
  const triggers = await prisma.trigger.findMany({
    include: { scene: true },
    orderBy: { name: "asc" },
  })

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="h5">Déclencheurs</Typography>
      <List>
        {triggers.map((trigger) => (
          <ListItem key={trigger.id} divider>
            <ListItemText
              primary={trigger.name}
              secondary={`${trigger.type} → ${trigger.scene.name}${trigger.enabled ? "" : " (désactivé)"}`}
            />
          </ListItem>
        ))}
      </List>
      {triggers.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          Aucun déclencheur.
        </Typography>
      )}
    </Box>
  )
}
