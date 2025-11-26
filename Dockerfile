FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Build Next.js application
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Copy and set up entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose port 8900
EXPOSE 8900

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8900
ENV HOST=0.0.0.0
ENV MODELS_DIR=/app/models

# Create models directory (will be overridden by volume mount but ensures it exists)
RUN mkdir -p /app/models && chmod 777 /app/models

# Use entrypoint script
ENTRYPOINT ["docker-entrypoint.sh"]

# Start the application
CMD ["npm", "start"]
