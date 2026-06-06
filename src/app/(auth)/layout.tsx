import Box from "@mui/material/Box"
import SessionProvider from "@/components/SessionProvider"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider session={null}>
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "background.default",
          p: 2,
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 420 }}>{children}</Box>
      </Box>
    </SessionProvider>
  )
}
