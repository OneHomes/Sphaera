# Sphaera call bot (see index.mjs). Debian, not Alpine: @livekit/rtc-node
# ships glibc binaries.
FROM node:20-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY index.mjs ./
USER node
CMD ["node", "index.mjs"]
