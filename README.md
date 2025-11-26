# Local Model Repository

A Next.js application that downloads and hosts Hugging Face models locally, providing a web interface to browse, search, and generate download commands for stored models. Optimized for Raspberry Pi 5.

## Features

- Download models directly from Hugging Face URLs
- Browse and search your local model library
- Generate wget commands for easy model retrieval
- Persistent storage via Docker volumes
- Modern, responsive web interface

## Prerequisites

- Docker and Docker Compose installed on your Raspberry Pi 5
- At least 2GB of free disk space (more depending on model sizes)
- Internet connection for downloading models

## Installation

1. **Clone or download this repository:**
   ```bash
   git clone https://github.com/ojohnsenCloudian/localModelRepo.git
   cd localModelRepo
   ```

2. **Build and start the application:**
   ```bash
   docker-compose up -d --build
   ```

   This will:
   - Build the Next.js application optimized for ARM64
   - Create a `models` directory for persistent storage
   - Start the application on port 8900

3. **Access the application:**
   Open your web browser and navigate to:
   ```
   http://localhost:8900
   ```
   
   Or if accessing from another device on your network:
   ```
   http://<raspberry-pi-ip>:8900
   ```

## Usage

### Downloading a Model

1. Copy a Hugging Face model URL (must be a direct download link)
   - Example: `https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/vae/qwen_image_vae.safetensors`
   - Note: Use the "resolve" link, not the repository page link

2. Paste the URL into the input field on the home page

3. Click "Download Model"

4. Wait for the download to complete (large files may take several minutes)

### Browsing Models

- All downloaded models appear in the Model Library section
- Use the search bar to filter models by filename
- Click on any model card to view details and get the wget command

### Downloading Models from Your Server

When you click on a model, a dialog will appear showing:
- Model filename
- File size
- Download date
- Wget command to download from your server

Copy the wget command and run it on any machine that can access your Raspberry Pi:

```bash
wget http://<raspberry-pi-ip>:8900/api/files/model-name.safetensors
```

**Note**: If you get a "Permission denied" error when downloading, ensure you have write permissions to the current directory:

```bash
# Check current directory permissions
ls -ld .

# Fix permissions if needed (replace with your username)
sudo chown -R $USER:$USER ~/comfy/ComfyUI/models/vae
chmod 755 ~/comfy/ComfyUI/models/vae

# Or download to a directory you own
wget -O /tmp/model-name.safetensors http://<raspberry-pi-ip>:8900/api/files/model-name.safetensors
sudo mv /tmp/model-name.safetensors ~/comfy/ComfyUI/models/vae/
```

## Docker Commands

### Start the application:
```bash
docker-compose up -d
```

### Stop the application:
```bash
docker-compose down
```

### View logs:
```bash
docker-compose logs -f
```

### Rebuild after changes:
```bash
docker-compose up -d --build
```

### Remove everything (including models):
```bash
docker-compose down -v
```

**Warning:** The `-v` flag will remove the volumes, deleting all downloaded models!

## Storage

Models are stored in the `./models` directory on your Raspberry Pi. This directory is mounted as a Docker volume, so your models persist even if you restart or rebuild the container.

To backup your models, simply copy the `models` directory:
```bash
cp -r models /path/to/backup/
```

## Troubleshooting

### Port already in use
If port 8900 is already in use, edit `docker-compose.yml` and change the port mapping:
```yaml
ports:
  - "8901:8900"  # Change 8901 to any available port
```

### Out of disk space
Check available space:
```bash
df -h
```

Remove old models manually:
```bash
rm models/old-model-name.safetensors
```

### Download fails
- Verify the Hugging Face URL is a direct download link (contains `/resolve/`)
- Check your internet connection
- Ensure you have enough disk space
- Check Docker logs: `docker-compose logs`

### Can't access from other devices
- Ensure your Raspberry Pi firewall allows port 8900
- Verify you're using the correct IP address
- Check that Docker is binding to `0.0.0.0` (default)

## Development

To run in development mode (without Docker):

```bash
npm install
npm run dev
```

The application will be available at `http://localhost:8900`

## Technical Details

- **Framework:** Next.js 14
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Platform:** ARM64 (Raspberry Pi 5)
- **Port:** 8900
- **Storage:** Docker volume at `./models`

## License

MIT

