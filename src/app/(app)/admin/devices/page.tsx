import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemText from "@mui/material/ListItemText"
import { prisma } from "@/lib/prisma"

// Devices are auto-discovered — no create. Rename, set zone (LUMI), remove,
// trigger a discovery sweep (docs/frontend.md, docs/api.md).
export default async function AdminDevicesPage() {
  const devices = await prisma.device.findMany({ orderBy: { name: "asc" } })

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="h5">Appareils</Typography>
      <List>
        {devices.map((device) => (
          <ListItem key={device.id} divider>
            <ListItemText
              primary={device.name}
              secondary={`${device.protocol} · ${device.kind} · ${device.reachable ? "en ligne" : "hors ligne"}`}
            />
          </ListItem>
        ))}
      </List>
      {devices.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          Aucun appareil. Lancez une découverte.
        </Typography>
      )}
    </Box>
  )
}
