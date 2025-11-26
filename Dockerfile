# Use Node.js Alpine image for ARM64 (Raspberry Pi 5 compatible)
FROM node:20-alpine

# Install wget (needed for downloading models)
RUN apk add --no-cache wget

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm install

# Copy application files
COPY . .

# Build Next.js application
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Expose port 8900
EXPOSE 8900

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8900
ENV HOST=0.0.0.0
ENV MODELS_DIR=/app/models

# Create models directory
RUN mkdir -p /app/models

# Start the application
CMD ["npm", "start"]

