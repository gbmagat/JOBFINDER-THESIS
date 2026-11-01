# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app
# better-sqlite3 has native code; these tools also support a source-build fallback.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY .figma/make/site.json ./.figma/make/site.json
COPY src ./src
COPY public ./public
ENV JOBFINDER_BASE=/
RUN npm run build && npm prune --omit=dev --ignore-scripts

FROM node:24-bookworm-slim AS runtime
ARG VCS_REF=unknown
LABEL org.opencontainers.image.title="JobFinder" \
      org.opencontainers.image.source="https://github.com/aizukiontop/Jobfinder" \
      org.opencontainers.image.revision=$VCS_REF
RUN apt-get update && apt-get install -y --no-install-recommends nginx-light ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && install -d -o node -g node /data /data/uploads
WORKDIR /app
ENV NODE_ENV=production \
    JOBFINDER_HOST=127.0.0.1 \
    JOBFINDER_PORT=3210 \
    JOBFINDER_DB_PATH=/data/jobfinder.sqlite \
    JOBFINDER_UPLOAD_DIR=/data/uploads \
    JOBFINDER_APP_ORIGIN=http://localhost:8080 \
    JOBFINDER_SEED_ON_START=1 \
    JOBFINDER_MAIL_PROVIDER=none \
    JOBFINDER_NOTIFICATIONS_ENABLED=0
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json package-lock.json ./
COPY server/*.js server/schema.sql ./server/
COPY server/cli/*.js ./server/cli/
COPY src/data/jobs.verified.json ./src/data/jobs.verified.json
COPY docker/api.mjs docker/runtime-config.mjs docker/entrypoint.sh docker/nginx.conf ./docker/
# Files copied from Windows must also work when a checkout uses CRLF.
RUN sed -i 's/\r$//' /app/docker/entrypoint.sh
USER node
EXPOSE 8080
VOLUME ["/data"]
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/api/health').then(async r=>{const b=await r.json();if(!r.ok||!b.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["bash", "/app/docker/entrypoint.sh"]
