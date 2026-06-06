import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Button from "@mui/material/Button"

export default function NotFound() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        p: 2,
      }}
    >
      <Typography variant="h3">404</Typography>
      <Typography color="text.secondary">Page introuvable.</Typography>
      <Button href="/dashboard" variant="outlined">
        Retour au tableau de bord
      </Button>
    </Box>
  )
}
