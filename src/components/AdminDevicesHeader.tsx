"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Button from "@mui/material/Button"
import SearchIcon from "@mui/icons-material/Search"

export default function AdminDevicesHeader() {
  const router = useRouter()
  const [discovering, setDiscovering] = useState(false)

  async function handleDiscover() {
    setDiscovering(true)
    await fetch("/api/devices/discover", { method: "POST" })
    setTimeout(() => {
      router.refresh()
      setDiscovering(false)
    }, 1000)
  }

  return (
    <Button
      variant="outlined"
      startIcon={<SearchIcon />}
      onClick={handleDiscover}
      disabled={discovering}
    >
      Découvrir
    </Button>
  )
}
