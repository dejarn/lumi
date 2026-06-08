import Box from "@mui/material/Box"
import List from "@mui/material/List"
import { prisma } from "@/lib/prisma"
import AdminDevicesHeader from "@/components/AdminDevicesHeader"
import AdminDeviceRow from "@/components/AdminDeviceRow"
import PageHeader from "@/components/ui/PageHeader"
import PageSection from "@/components/ui/PageSection"
import StateCard from "@/components/ui/StateCard"

// Devices are auto-discovered — no create. Rename, set zone (LUMI), remove,
// trigger a discovery sweep (docs/frontend.md, docs/api.md).
export default async function AdminDevicesPage() {
  const devices = await prisma.device.findMany({ orderBy: { name: "asc" } })

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <PageHeader title="Appareils" action={<AdminDevicesHeader />} />
      <PageSection glow="accent">
        {devices.length === 0 ? (
          <StateCard
            variant="empty"
            icon="◎"
            title="Aucun appareil"
            description="Lancez une découverte."
          />
        ) : (
          <List>
            {devices.map((device) => (
              <AdminDeviceRow key={device.id} device={device} />
            ))}
          </List>
        )}
      </PageSection>
    </Box>
  )
}
