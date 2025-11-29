---
description: Setup CI/CD and Deploy to VPS
---

# CI/CD Setup and Deployment Workflow

This workflow describes how to set up the Continuous Integration and Continuous Deployment (CI/CD) pipeline for the Deliveria project.

## Prerequisites

1.  **VPS**: An Ubuntu VPS with Docker and Docker Compose installed.
2.  **Docker Hub Account**: An account to store your Docker images.
3.  **GitHub Repository**: The project must be hosted on GitHub.

## Step 1: Prepare the VPS

SSH into your VPS and ensure Docker is installed:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group (to run without sudo)
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker compose version
```

## Step 2: Configure GitHub Secrets

Go to your GitHub Repository -> **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**.

Add the following secrets:

### Docker Hub
- `DOCKER_HUB_USERNAME`: Your Docker Hub username.
- `DOCKER_HUB_ACCESS_TOKEN`: Your Docker Hub Access Token (Profile -> Security -> New Access Token).

### VPS Connection
- `VPS_HOST`: The IP address of your VPS.
- `VPS_USERNAME`: The SSH username (e.g., `root` or `ubuntu`).
- `VPS_SSH_KEY`: The private SSH key (`.pem` content) to access the VPS.

### Application Environment Variables
- `MONGO_USERNAME`: (e.g., `root`)
- `MONGO_PASSWORD`: (e.g., `secret`)
- `MONGO_DATABASE`: (e.g., `deliveria`)
- `JWT_KEY`: Your JWT secret key.
- `PROJECT_ID`: Firebase project ID.
- `CLIENT_EMAIL`: Firebase client email.
- `PRIVATE_KEY`: Firebase private key (Copy the entire block including BEGIN and END lines).

## Step 3: Deployment

The deployment is automated via GitHub Actions.

1.  **Push Changes**: When you push code to the `main` or `master` branch, the workflow triggers.
2.  **Build**: GitHub Actions builds the Docker images for the App and Webserver.
3.  **Push**: Images are pushed to Docker Hub.
4.  **Deploy**: The workflow connects to your VPS, copies the `docker-compose.prod.yml`, creates the `.env` file from secrets, and updates the running containers.

## Manual Deployment (Optional)

If you need to deploy manually:

1.  Copy `docker-compose.prod.yml` to the VPS.
2.  Create a `.env` file with the necessary variables.
3.  Run:
    ```bash
    docker compose -f docker-compose.prod.yml up -d
    ```
