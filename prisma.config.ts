try {
  await import("dotenv/config")
} catch {}

const config = {
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
}

export default config
