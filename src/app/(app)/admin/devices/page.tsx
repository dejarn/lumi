import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import List from "@mui/material/List"
import { prisma } from "@/lib/prisma"
import AdminDevicesHeader from "@/components/AdminDevicesHeader"
import AdminDeviceRow from "@/components/AdminDeviceRow"

// Devices are auto-discovered — no create. Rename, set zone (LUMI), remove,
// trigger a discovery sweep (docs/frontend.md, docs/api.md).
export default async function AdminDevicesPage() {
  const devices = await prisma.device.findMany({ orderBy: { name: "asc" } })

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h5">Appareils</Typography>
        <AdminDevicesHeader />
      </Box>
      <List>
        {devices.map((device) => (
          <AdminDeviceRow key={device.id} device={device} />
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
