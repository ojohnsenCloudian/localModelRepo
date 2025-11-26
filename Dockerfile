# Stage 1: Dependencies
FROM node:22-alpine AS deps
RUN apk update && apk upgrade && apk add --no-cache libc6-compat
WORKDIR /app

# Update npm to latest version
RUN npm install -g npm@latest

COPY package.json ./
RUN npm install

# Stage 2: Builder
FROM node:22-alpine AS builder
WORKDIR /app

# Update npm to latest version
RUN npm install -g npm@latest

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Disable telemetry during build
ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# Stage 3: Runner
FROM node:22-alpine AS runner
WORKDIR /app

# Update npm to latest version and update system packages
RUN apk update && apk upgrade && npm install -g npm@latest && apk add --no-cache su-exec

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
# Create public directory (Next.js standalone includes public files in .next/standalone, but create it anyway)
RUN mkdir -p ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Create models directory with proper permissions before switching user
# Note: Volume mount will override this, but ensures directory structure exists
RUN mkdir -p /app/models && chown -R nextjs:nodejs /app/models && chmod 755 /app/models

# Copy entrypoint script (keep as root for permission fixing)
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Don't switch user here - entrypoint will handle it after fixing permissions

EXPOSE 8900

ENV PORT 8900
ENV HOSTNAME "0.0.0.0"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]

