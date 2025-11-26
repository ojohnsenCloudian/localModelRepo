# Hugging Face Model Repository

A Next.js application that allows you to download Hugging Face models via URL and serve them locally for easy access via wget.

## Features

- Download Hugging Face models by providing a URL
- Browse all downloaded models with search functionality
- Get wget commands to download models from your local server
- Modern, responsive UI built with Tailwind CSS
- Runs in Docker container optimized for Raspberry Pi 5 (ARM64)
- **Zero configuration required** - works out of the box!

## Prerequisites

- Docker and Docker Compose installed on your Raspberry Pi 5
- That's it! No manual directory creation or permission setup needed.

## Quick Start

1. Clone this repository:

1. Clone this repository:
   ```bash
   git clone https://github.com/ojohnsenCloudian/localModelRepo.git
   cd localModelRepo
   ```

2. Build and start the Docker container:
   ```bash
   docker-compose up -d --build
   ```

   The container will automatically:
   - Create the `/localModelRepo/data/models` directory if it doesn't exist
   - Set proper permissions
   - Start the application

3. Access the application:
   Open your browser and navigate to `http://<raspberry-pi-ip>:8900`

That's it! The application is ready to use.

## Usage

### Downloading a Model

1. Click "Download Model" button
2. Enter a Hugging Face model URL (e.g., `https://huggingface.co/model-name/resolve/main/model.safetensors`)
3. Click "Start Download"
4. Wait for the download to complete

### Browsing Models

- All downloaded models will appear in the "All Models" section
- Use the search bar to filter models by name
- Click "Copy wget command to your clipboard
- Use the copied command in your terminal to download the model from your local server
- Or click "Direct Download" to download the file directly in your browser

## Docker Commands

- **Start the container**: `docker-compose up -d`
- **Stop the container**: `docker-compose down`
- **View logs**: `docker-compose logs -f`
- **Rebuild**: `docker-compose up -d --build`
- **Restart**: `docker-compose restart`

## Troubleshooting

### Container Won't Start

Check the logs:
```bash
docker-compose logs
```

### Port Already in Use

The application uses port 8900 by default. If you need to change it, edit `docker-compose.yml`:
```yaml
ports:
  - "YOUR_PORT:8900"
```

### Files Not Appearing

1. Verify the volume mount:
   ```bash
   docker exec hugging-face-model-repo ls -la /app/models
   ```

2. Check container logs:
   ```bash
   docker-compose logs -f model-repo
   ```

## Architecture

- **Frontend**: Next.js 14 with React and Tailwind CSS
- **Backend**: Next.js API Routes
- **File Downloads**: Uses Node.js fetch API with direct filesystem writes
- **File Serving**: Next.js API routes serve files with proper headers
- **Storage**: Docker volume mount to `/localModelRepo/data/models` on host

## Configuration

All configuration is handled automatically. The application:
- Creates the models directory automatically
- Sets proper permissions
- Runs on port 8900
- Stores models in `/localModelRepo/data/models` on your Raspberry Pi

No manual configuration needed!

## License

MIT
