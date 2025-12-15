#!/bin/bash

set -e

VM_NAME="microservice"
VM_ZONE="us-central1-c"
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-cloudnine-475221}"
SSH_KEY_FILE="${SSH_KEY_FILE:-$HOME/.ssh/databasesql}"

echo "==================================================================="
echo "Setting up VM for Node.js deployments"
echo "VM: ${VM_NAME}"
echo "==================================================================="

# Install Node.js and PM2
echo ""
echo "Installing Node.js 20.x and PM2..."
gcloud compute ssh --ssh-key-file=${SSH_KEY_FILE} ${VM_NAME} \
  --zone=${VM_ZONE} \
  --project=${PROJECT_ID} \
  --command="
    # Install Node.js 20.x
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs

    # Install PM2 globally
    sudo npm install -g pm2

    # Setup PM2 to start on boot
    pm2 startup | tail -n 1 | bash

    # Verify installations
    echo ''
    echo 'Installed versions:'
    node --version
    npm --version
    pm2 --version
  "

echo ""
echo "==================================================================="
echo "VM setup completed!"
echo "==================================================================="
