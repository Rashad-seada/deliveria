#!/bin/bash

# ==============================================================================
# Deliveria Data Import Script (Run this on the NEW VPS)
# ==============================================================================
# This script restores a full backup of the MongoDB database and uploaded images
# into the running Docker containers on the new VPS.
# ==============================================================================

set -e

# Configuration
DB_CONTAINER="deliveria_mongodb"
APP_CONTAINER="deliveria_app"
DB_USER="root"
DB_PASS="secret"

echo "🚀 Starting Deliveria data import process..."

# Check if the migration package was passed as an argument
if [ -z "$1" ]; then
    echo "❌ Error: Please provide the migration package file."
    echo "Usage: ./import_deliveria_data.sh deliveria_migration_YYYYMMDD_HHMMSS.tar.gz"
    exit 1
fi

MIGRATION_FILE="$1"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Error: File $MIGRATION_FILE not found."
    exit 1
fi

echo "📦 1. Extracting migration package..."
tar -xzvf "$MIGRATION_FILE" > /dev/null 2>&1
cd deliveria_migration_backup

echo "📥 2. Restoring MongoDB database..."
# Copy the archive into the new MongoDB container
docker cp "./db_backup.archive" "$DB_CONTAINER:/data/db/"

# Run mongorestore inside the container (using --drop to replace existing empty data)
docker exec -t "$DB_CONTAINER" sh -c "mongorestore --username $DB_USER --password $DB_PASS --authenticationDatabase admin --archive=/data/db/db_backup.archive --gzip --drop"

# Clean up from container
docker exec -it "$DB_CONTAINER" rm -f /data/db/db_backup.archive
echo "✅ Database restored successfully."

echo "🖼️  3. Restoring uploaded images..."
# Extract the images tarball
tar -xzvf "images_backup.tar.gz" > /dev/null 2>&1

# Copy the images into the running app container's volume
docker cp "./deliveria_upload/." "$APP_CONTAINER:/deliveria/deliveria_upload/"
echo "✅ Images restored successfully."

echo "🧹 4. Cleaning up..."
cd ..
rm -rf deliveria_migration_backup

echo "🔄 5. Restarting application container..."
docker restart "$APP_CONTAINER"

echo ""
echo "🎉 Import complete!"
echo "Your Deliveria instance is now fully migrated with all data and images."
echo "Please verify everything is working correctly on the new server."
