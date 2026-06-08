"use client"

import { useRouter } from "next/navigation"
import type { Scene, Trigger } from "@prisma/client"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemText from "@mui/material/ListItemText"
import Switch from "@mui/material/Switch"

type TriggerWithScene = Trigger & { scene: Scene }

export default function TriggerList({ triggers }: { triggers: TriggerWithScene[] }) {
  const router = useRouter()

  async function toggleEnabled(id: string, enabled: boolean) {
    const res = await fetch(`/api/triggers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    })
    if (res.ok) router.refresh()
  }

  return (
    <List>
      {triggers.map((trigger) => (
        <ListItem key={trigger.id} divider>
          <ListItemText
            primary={trigger.name}
            secondary={`${trigger.type} → ${trigger.scene.name}`}
          />
          <Switch
            edge="end"
            checked={trigger.enabled}
            onChange={(e) => void toggleEnabled(trigger.id, e.target.checked)}
            slotProps={{ input: { "aria-label": `${trigger.name} activé` } }}
          />
        </ListItem>
      ))}
    </List>
  )
}
