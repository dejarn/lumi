import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export const runtime = "nodejs"

// Edge gate only checks JWT presence. Per-request User.active revocation is
// enforced deeper, in requireUser()/requireAdmin() (lib/auth-guard.ts).
const PUBLIC_PAGES = ["/login", "/invite/"]

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isAuthed = Boolean(req.auth)
  const role = req.auth?.user?.role

  // API routes: 401 JSON for unauthenticated, skip page logic.
  if (pathname.startsWith("/api/")) {
    // `/api/invites` (list/create) is ADMIN; only `/api/invites/<token>...` is public.
    const isPublicApi =
      pathname.startsWith("/api/auth") ||
      (pathname.startsWith("/api/invites/") && !isAuthed)
    if (!isPublicApi && !isAuthed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.next()
  }

  // Page routes.
  const isPublicPage = pathname === "/" || PUBLIC_PAGES.some((p) => pathname.startsWith(p))
  if (!isPublicPage && !isAuthed) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isAuthed && pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
