"use client"

import { useState } from "react"
import Fab from "@mui/material/Fab"
import AddIcon from "@mui/icons-material/Add"
import TriggerList, { type TriggerWithScene } from "@/components/TriggerList"
import TriggerSheet from "@/components/TriggerSheet"
import StateCard from "@/components/ui/StateCard"

export default function TriggersClient({
  triggers,
  scenes,
  sensorDevices,
  isAdmin,
}: {
  triggers: TriggerWithScene[]
  scenes: { id: string; name: string }[]
  sensorDevices: { id: string; name: string }[]
  isAdmin: boolean
}) {
  const [editing, setEditing] = useState<TriggerWithScene | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  function openCreate() {
    setEditing(null)
    setSheetOpen(true)
  }

  function openEdit(trigger: TriggerWithScene) {
    setEditing(trigger)
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setEditing(null)
  }

  return (
    <>
      {triggers.length === 0 ? (
        <StateCard
          icon="◷"
          title="Aucun déclencheur"
          actionLabel={isAdmin ? "Nouveau déclencheur" : undefined}
          onAction={isAdmin ? openCreate : undefined}
        />
      ) : (
        <TriggerList
          triggers={triggers}
          isAdmin={isAdmin}
          sensorDevices={sensorDevices}
          onEdit={openEdit}
        />
      )}

      {isAdmin && triggers.length > 0 && (
        <Fab
          color="primary"
          aria-label="Nouveau déclencheur"
          onClick={openCreate}
          sx={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 10,
          }}
        >
          <AddIcon />
        </Fab>
      )}

      <TriggerSheet
        open={sheetOpen}
        onClose={closeSheet}
        trigger={editing ?? undefined}
        scenes={scenes}
        sensorDevices={sensorDevices}
      />
    </>
  )
}
