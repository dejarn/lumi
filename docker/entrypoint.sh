#!/bin/sh
set -e

# Apply pending migrations, then start the standalone Next.js server.
node prisma-modules/node_modules/prisma/build/index.js migrate deploy
exec node server.js
