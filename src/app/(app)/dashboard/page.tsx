import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import { prisma } from "@/lib/prisma"
import DeviceTile from "@/components/DeviceTile"

// Two sections — Lights then Sensors. Flat 2-column grid (docs/frontend.md).
export default async function DashboardPage() {
  const [lights, sensors] = await Promise.all([
    prisma.device.findMany({ where: { kind: "LIGHT" }, orderBy: { name: "asc" } }),
    prisma.device.findMany({ where: { kind: "SENSOR" }, orderBy: { name: "asc" } }),
  ])

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <section>
        <Typography variant="h5" gutterBottom>
          Lumières
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1.5 }}>
          {lights.map((device) => (
            <DeviceTile key={device.id} device={device} />
          ))}
          {lights.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Aucune lumière détectée.
            </Typography>
          )}
        </Box>
      </section>

      <section>
        <Typography variant="h5" gutterBottom>
          Capteurs
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1.5 }}>
          {sensors.map((device) => (
            <DeviceTile key={device.id} device={device} />
          ))}
          {sensors.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Aucun capteur détecté.
            </Typography>
          )}
        </Box>
      </section>
    </Box>
  )
}
