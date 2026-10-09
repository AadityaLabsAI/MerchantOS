# syntax=docker/dockerfile:1.6
# ─── Build stage: install all deps and compile ───
FROM node:20-bookworm-slim AS build
WORKDIR /src

# System deps for argon2/scrypt, postgres client
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client ca-certificates python3 build-essential \
 && rm -rf /var/lib/apt/lists/*

# Copy manifests first (cache layer)
COPY package.json package-lock.json* ./
COPY packages/shared-types/package.json   packages/shared-types/
COPY packages/money/package.json          packages/money/
COPY packages/crypto/package.json         packages/crypto/
COPY packages/validation/package.json     packages/validation/
COPY packages/payments/package.json       packages/payments/
COPY packages/qr/package.json             packages/qr/
COPY packages/sync/package.json           packages/sync/
COPY api/package.json                     api/
COPY api/tsconfig.json                    api/
COPY tsconfig.base.json                   ./

# Install API deps
WORKDIR /src/api
RUN npm install --no-audit --no-fund

# Copy source
WORKDIR /src
COPY packages/  packages/
COPY api/       api/
COPY database/  database/
COPY bin/       bin/

# Build packages
WORKDIR /src
RUN for p in packages/*/; do (cd "$p" && npm install --no-audit --no-fund && npm run build); done

# Build API
WORKDIR /src/api
RUN npm run build

# ─── Runtime stage: minimal image ───
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client tini ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=4000

# Copy only what runtime needs
COPY --from=build /src/api/dist          /app/api/dist
COPY --from=build /src/api/package.json   /app/api/package.json
COPY --from=build /src/api/src/landing /app/api/src/landing
COPY --from=build /src/api/node_modules   /app/api/node_modules
COPY --from=build /src/packages           /app/packages
COPY --from=build /src/bin                /app/bin
COPY --from=build /src/database           /app/database
COPY --from=build /src/node_modules       /app/node_modules
COPY docker/entrypoint.sh                 /app/entrypoint.sh

WORKDIR /app/api
RUN chmod +x /app/entrypoint.sh /app/bin/migrate /app/bin/seed

EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s \
  CMD node -e "require('http').get('http://127.0.0.1:'+process.env.PORT+'/healthz',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--", "/app/entrypoint.sh"]
