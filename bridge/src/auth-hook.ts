import { timingSafeEqual, createHash } from "node:crypto"
import type { FastifyReply, FastifyRequest } from "fastify"

function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest())
}

export function makeAuthHook(token: string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (new URL(req.url, "http://localhost").pathname === "/health") return
    const header = req.headers["x-bridge-token"]
    if (typeof header !== "string" || !safeEqual(header, token)) {
      return reply.code(401).send({ error: "Unauthorized" })
    }
  }
}
