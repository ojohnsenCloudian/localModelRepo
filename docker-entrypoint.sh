#!/bin/sh
set -e

# Fix permissions for models directory
# The volume mount may have different ownership, so we ensure nextjs user can write
if [ -d "/app/models" ]; then
    chown -R nextjs:nodejs /app/models 2>/dev/null || true
    chmod -R 755 /app/models 2>/dev/null || true
fi

# Switch to nextjs user and execute the main command
exec su-exec nextjs "$@"

