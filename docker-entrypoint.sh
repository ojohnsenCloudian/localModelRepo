#!/bin/sh
set -e

# Ensure models directory exists and has correct permissions
mkdir -p /app/models
chmod 777 /app/models

# Start the application
exec "$@"

