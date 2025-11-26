# Hugging Face Model Repository

A Next.js application that allows you to download Hugging Face models via URL and serve them locally for easy access via wget.

## Features

- Download Hugging Face models by providing a URL
- Browse all downloaded models in a library-style interface
- Search models by name
- Get wget commands to download models from your local server
- Modern, responsive UI built with Tailwind CSS
- Runs in Docker container optimized for Raspberry Pi 5 (ARM64)

## Prerequisites

- Docker and Docker Compose installed on your Raspberry Pi 5
- `/localModelRepo/data/models/` directory created on your Raspberry Pi

## Quick Start

1. Clone this repository to your Raspberry Pi:
   ```bash
   git clone https://github.com/ojohnsenCloudian/localModelRepo.git
   cd localModelRepo
   ```

2. Create the models directory on your Raspberry Pi with proper permissions:
   ```bash
   sudo mkdir -p /localModelRepo/data/models
   sudo chmod -R 777 /localModelRepo/data/models
   ```

3. Build and start the Docker container:
   ```bash
   docker-compose up -d --build
   ```

4. Access the application:
   Open your browser and navigate to `http://<raspberry-pi-ip>:8900`

## Usage

### Downloading a Model

1. Click "Download Model" button
2. Enter a Hugging Face model URL (e.g., `https://huggingface.co/model-name/resolve/main/model.safetensors`)
3. Click "Start Download"
4. Wait for the download to complete

### Browsing Models

- All downloaded models will appear in the "All Models" section
- Use the search bar to filter models by name
- Click "Copy wget Command" to copy the wget command to your clipboard
- Use the copied command in your terminal to download the model from your local server
- Or click "Direct Download" to download the file directly in your browser

## Configuration

### Port

The application runs on port 8900 by default. To change it:

1. Update `docker-compose.yml`:
   ```yaml
   ports:
     - "YOUR_PORT:8900"
   ```

2. Update the `PORT` environment variable in `docker-compose.yml` if needed

### Models Directory

Models are stored in `/localModelRepo/data/models/` on your Raspberry Pi by default. To change this:

1. Update the volume mount in `docker-compose.yml`:
   ```yaml
   volumes:
     - /your/custom/path:/app/models:rw
   ```

2. Update the `MODELS_DIR` environment variable accordingly

## Docker Commands

- **Start the container**: `docker-compose up -d`
- **Stop the container**: `docker-compose down`
- **View logs**: `docker-compose logs -f`
- **Rebuild**: `docker-compose up -d --build`
- **Restart**: `docker-compose restart`

## Troubleshooting

### Permission Issues

If you encounter permission issues with the models directory:

```bash
sudo chmod -R 777 /localModelRepo/data/models
```

### Container Won't Start

Check the logs:
```bash
docker-compose logs
```

### Port Already in Use

Change the port mapping in `docker-compose.yml` or stop the service using port 8900.

### Files Not Appearing in Volume

1. Verify the volume mount is working:
   ```bash
   docker exec hugging-face-model-repo ls -la /app/models
   ```

2. Check container logs for errors:
   ```bash
   docker-compose logs -f model-repo
   ```

3. Verify directory permissions on host:
   ```bash
   ls -la /localModelRepo/data/models
   ```

## Architecture

- **Frontend**: Next.js 14 with React and Tailwind CSS
- **Backend**: Next.js API Routes
- **File Downloads**: Uses `wget` command-line tool
- **File Serving**: Next.js API routes serve files with proper headers
- **Storage**: Docker volume mount to host filesystem at `/localModelRepo/data/models`

## License

MIT

