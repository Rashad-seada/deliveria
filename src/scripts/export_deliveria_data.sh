#!/bin/bash

# ==============================================================================
# Deliveria Data Export Script (Run this on the OLD VPS)
# ==============================================================================
# This script creates a full backup of the MongoDB database from the running
# Docker container, and archives the uploaded images directory.
# ==============================================================================

set -e

# Configuration
DB_CONTAINER="deliveria_mongodb"
APP_CONTAINER="deliveria_app"
DB_USER="root"
DB_PASS="secret"
BACKUP_DIR="./deliveria_migration_backup"
DATE=$(date +%Y%m%d_%H%M%S)

echo "🚀 Starting Deliveria data export process..."

# Create a dedicated backup directory
mkdir -p "$BACKUP_DIR"
cd "$BACKUP_DIR"

echo "📦 1. Exporting MongoDB database..."
# Run mongodump inside the container
docker exec -it "$DB_CONTAINER" sh -c "mongodump --username $DB_USER --password $DB_PASS --authenticationDatabase admin --archive=/data/db/db_backup.archive --gzip"

# Copy the archive out of the container
docker cp "$DB_CONTAINER:/data/db/db_backup.archive" "./db_backup.archive"

# Remove the archive from inside the container to save space
docker exec -it "$DB_CONTAINER" rm -f /data/db/db_backup.archive
echo "✅ Database exported successfully."

echo "🖼️  2. Exporting uploaded images..."
# Copy the upload directory from the app container
docker cp "$APP_CONTAINER:/deliveria/deliveria_upload" "./deliveria_upload"

# Compress the images directory into a tarball
tar -czvf "images_backup.tar.gz" "./deliveria_upload" > /dev/null 2>&1

# Clean up the uncompressed directory
rm -rf "./deliveria_upload"
echo "✅ Images exported successfully."

echo "🗜️  3. Creating final migration package..."
# Compress everything into one final file to easily transfer to the new VPS
cd ..
tar -czvf "deliveria_migration_${DATE}.tar.gz" "$BACKUP_DIR" > /dev/null 2>&1

# Clean up
rm -rf "$BACKUP_DIR"

echo ""
echo "🎉 Export complete!"
echo "Your migration package is ready: deliveria_migration_${DATE}.tar.gz"
echo ""
echo "Next steps:"
echo "1. Transfer this file to your new VPS using SCP or RSYNC:"
echo "   scp deliveria_migration_${DATE}.tar.gz root@NEW_VPS_IP:~/"
echo "2. On the new VPS, extract it and run the import script."
