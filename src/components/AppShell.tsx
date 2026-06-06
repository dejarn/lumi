"use client"

import { useState } from "react"
import type { Session } from "next-auth"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import AppBar from "@mui/material/AppBar"
import Toolbar from "@mui/material/Toolbar"
import Typography from "@mui/material/Typography"
import IconButton from "@mui/material/IconButton"
import Drawer from "@mui/material/Drawer"
import Box from "@mui/material/Box"
import List from "@mui/material/List"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemIcon from "@mui/material/ListItemIcon"
import ListItemText from "@mui/material/ListItemText"
import Divider from "@mui/material/Divider"
import MenuIcon from "@mui/icons-material/Menu"
import LightbulbIcon from "@mui/icons-material/Lightbulb"
import MovieFilterIcon from "@mui/icons-material/MovieFilter"
import ScheduleIcon from "@mui/icons-material/Schedule"
import DevicesIcon from "@mui/icons-material/Devices"
import PeopleIcon from "@mui/icons-material/People"
import LogoutIcon from "@mui/icons-material/Logout"
import SseProvider from "@/components/SseProvider"

type NavItem = { href: string; label: string; icon: React.ReactNode; adminOnly?: boolean }

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Tableau de bord", icon: <LightbulbIcon /> },
  { href: "/scenes", label: "Scènes", icon: <MovieFilterIcon /> },
  { href: "/triggers", label: "Déclencheurs", icon: <ScheduleIcon /> },
  { href: "/admin/devices", label: "Appareils", icon: <DevicesIcon />, adminOnly: true },
  { href: "/admin/users", label: "Utilisateurs", icon: <PeopleIcon />, adminOnly: true },
]

export default function AppShell({
  children,
  session,
}: {
  children: React.ReactNode
  session: Session
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const isAdmin = session.user.role === "ADMIN"
  const items = NAV.filter((item) => !item.adminOnly || isAdmin)

  return (
    <SseProvider>
      <AppBar position="sticky">
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => setOpen(true)} sx={{ mr: 1 }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Lumi
          </Typography>
        </Toolbar>
      </AppBar>

      <Drawer open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: 260 }} role="presentation" onClick={() => setOpen(false)}>
          <List>
            {items.map((item) => (
              <ListItemButton
                key={item.href}
                component={Link}
                href={item.href}
                selected={pathname.startsWith(item.href)}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </List>
          <Divider />
          <List>
            <ListItemButton onClick={() => signOut({ callbackUrl: "/login" })}>
              <ListItemIcon>
                <LogoutIcon />
              </ListItemIcon>
              <ListItemText primary="Déconnexion" />
            </ListItemButton>
          </List>
        </Box>
      </Drawer>

      <Box component="main" sx={{ p: 2, maxWidth: 900, mx: "auto" }}>
        {children}
      </Box>
    </SseProvider>
  )
}
