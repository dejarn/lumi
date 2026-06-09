"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { Scene, Trigger } from "@prisma/client"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Switch from "@mui/material/Switch"
import Chip from "@mui/material/Chip"
import IconButton from "@mui/material/IconButton"
import Dialog from "@mui/material/Dialog"
import DialogTitle from "@mui/material/DialogTitle"
import DialogContent from "@mui/material/DialogContent"
import DialogActions from "@mui/material/DialogActions"
import Button from "@mui/material/Button"
import Alert from "@mui/material/Alert"
import EditIcon from "@mui/icons-material/Edit"
import DeleteIcon from "@mui/icons-material/Delete"
import GlassSurface from "@/components/ui/GlassSurface"
import { cronToHuman } from "@/lib/automation/cron-human"
import { glowStyle, type GlowKind } from "@/lib/tokens"

export type TriggerWithScene = Trigger & { scene: Scene }

function cardGlow(trigger: TriggerWithScene): GlowKind {
  if (!trigger.enabled) return "none"
  return trigger.type === "SENSOR" ? "sensor" : "accent"
}

function typeIcon(type: Trigger["type"]): string {
  return type === "CRON" ? "◷" : "⬡"
}

function triggerSummary(
  trigger: TriggerWithScene,
  sensorDevices: { id: string; name: string }[],
): string {
  if (trigger.type === "CRON") {
    return cronToHuman(trigger.cronExpr ?? "")
  }

  const sensorName =
    trigger.sensorDeviceId != null
      ? (sensorDevices.find((d) => d.id === trigger.sensorDeviceId)?.name ?? "capteur supprimé")
      : "capteur supprimé"
  const stateLabel = trigger.sensorState ? "présence" : "absence"
  return `Quand ${sensorName} → ${stateLabel}`
}

export default function TriggerList({
  triggers,
  isAdmin,
  sensorDevices,
  onEdit,
}: {
  triggers: TriggerWithScene[]
  isAdmin: boolean
  sensorDevices: { id: string; name: string }[]
  onEdit: (trigger: TriggerWithScene) => void
}) {
  const router = useRouter()
  const [deleteTarget, setDeleteTarget] = useState<TriggerWithScene | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function toggleEnabled(id: string, enabled: boolean) {
    const res = await fetch(`/api/triggers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    })
    if (res.ok) router.refresh()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    const res = await fetch(`/api/triggers/${deleteTarget.id}`, { method: "DELETE" })
    setDeleting(false)
    if (res.ok) {
      setDeleteTarget(null)
      router.refresh()
    } else {
      setDeleteError("Impossible de supprimer ce déclencheur.")
    }
  }

  return (
    <>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(auto-fill, minmax(280px, 1fr))" },
          gap: 1.5,
        }}
      >
        {triggers.map((trigger) => (
          <GlassSurface key={trigger.id} glow={cardGlow(trigger)} sx={{ p: 2 }}>
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
              <Box
                sx={{
                  fontSize: "1.25rem",
                  lineHeight: 1,
                  color: trigger.enabled ? "text.primary" : "text.secondary",
                  flexShrink: 0,
                  mt: 0.25,
                }}
                aria-hidden
              >
                {typeIcon(trigger.type)}
              </Box>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle1" noWrap>
                  {trigger.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {triggerSummary(trigger, sensorDevices)}
                </Typography>
                <Chip
                  label={trigger.scene.name}
                  size="small"
                  sx={{
                    mt: 1,
                    ...glowStyle.accent,
                    backgroundColor: "transparent",
                  }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                  {trigger.enabled ? "Actif" : "Désactivé"}
                </Typography>
              </Box>

              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5 }}>
                <Switch
                  checked={trigger.enabled}
                  onChange={(e) => void toggleEnabled(trigger.id, e.target.checked)}
                  slotProps={{ input: { "aria-label": `${trigger.name} activé` } }}
                />
                {isAdmin && (
                  <Box sx={{ display: "flex" }}>
                    <IconButton
                      size="small"
                      aria-label={`Modifier ${trigger.name}`}
                      onClick={() => onEdit(trigger)}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={`Supprimer ${trigger.name}`}
                      onClick={() => {
                        setDeleteError(null)
                        setDeleteTarget(trigger)
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                )}
              </Box>
            </Box>
          </GlassSurface>
        ))}
      </Box>

      <Dialog
        open={deleteTarget !== null}
        onClose={() => !deleting && setDeleteTarget(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Supprimer le déclencheur ?</DialogTitle>
        <DialogContent>
          {deleteError && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {deleteError}
            </Alert>
          )}
          <Typography variant="body2">
            {deleteTarget
              ? `« ${deleteTarget.name} » sera définitivement supprimé.`
              : null}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Annuler
          </Button>
          <Button color="error" onClick={() => void handleDelete()} disabled={deleting}>
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
