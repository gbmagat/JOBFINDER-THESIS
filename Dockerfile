FROM node:24-bookworm-slim AS frontend-build

WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN npm ci --prefix frontend
COPY frontend ./frontend
RUN npm run build --prefix frontend

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4000
ENV JOBFINDER_DATABASE_PATH=/app/storage/jobfinder.db
ENV JOBFINDER_UPLOADS_PATH=/app/storage/uploads
ENV JOBFINDER_BACKUPS_PATH=/app/storage/backups

WORKDIR /app
COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci --omit=dev --prefix backend
COPY backend/src ./backend/src
COPY backend/scripts ./backend/scripts
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

VOLUME ["/app/storage"]
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(response=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["npm", "--prefix", "backend", "start"]
