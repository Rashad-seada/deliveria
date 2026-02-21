#!/bin/bash

# ==============================================================================
# ONE-CLICK VPS MIGRATION SCRIPT (Deliveria)
# Run this on your OLD VPS only.
#
# Requirements:
# - Both VPS instances must be running the exact same docker-compose containers
#   (deliveria_app and deliveria_mongodb).
# - You must have the password for the new VPS (it will prompt you twice).
# ==============================================================================

set -e

# Configuration
DB_CONTAINER="deliveria_mongodb"
APP_CONTAINER="deliveria_app"
DB_USER="root"
DB_PASS="secret"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="migration_tmp_${DATE}"
ARCHIVE_NAME="migration_${DATE}.tar.gz"

echo "================================================"
echo "🚀 ONE-CLICK VPS MIGRATION TOOL"
echo "================================================"
echo ""

# Prompt for target VPS details
read -p "Enter the IP address of the NEW VPS: " NEW_VPS_IP
read -p "Enter the username for the NEW VPS (e.g. root): " NEW_VPS_USER

if [ -z "$NEW_VPS_IP" ] || [ -z "$NEW_VPS_USER" ]; then
    echo "❌ Error: IP and username are required."
    exit 1
fi

echo ""
echo "------------------------------------------------"
echo "📦 STEP 1: Exporting data from OLD VPS..."
echo "------------------------------------------------"

# 1. Create temporary directory
mkdir -p "$BACKUP_DIR"
cd "$BACKUP_DIR"

# 2. Dump MongoDB
echo "Dumping database from $DB_CONTAINER..."
docker exec -t "$DB_CONTAINER" sh -c "mongodump --username $DB_USER --password $DB_PASS --authenticationDatabase admin --archive=/data/db/db_backup.archive --gzip"

# Copy it out
docker cp "$DB_CONTAINER:/data/db/db_backup.archive" "./db_backup.archive"

# Remove from container
docker exec -t "$DB_CONTAINER" rm -f /data/db/db_backup.archive


# 3. Export Images
echo "Exporting uploaded images from $APP_CONTAINER..."
docker cp "$APP_CONTAINER:/deliveria/deliveria_upload" "./deliveria_upload"
tar -czf "images_backup.tar.gz" "./deliveria_upload" > /dev/null 2>&1
rm -rf "./deliveria_upload"

# 4. Create single archive
echo "Compressing migration package..."
cd ..
tar -czf "$ARCHIVE_NAME" "$BACKUP_DIR" > /dev/null 2>&1
rm -rf "$BACKUP_DIR"

echo "✅ Local export complete: $ARCHIVE_NAME"
echo ""

echo "------------------------------------------------"
echo "🌐 STEP 2: Transferring data to NEW VPS..."
echo "------------------------------------------------"
echo "⚠️  You will be prompted for the $NEW_VPS_USER password on $NEW_VPS_IP."

scp "$ARCHIVE_NAME" "$NEW_VPS_USER@$NEW_VPS_IP:~/$ARCHIVE_NAME"

echo "✅ Transfer complete."
echo ""

echo "------------------------------------------------"
echo "📥 STEP 3: Importing data remotely on NEW VPS..."
echo "------------------------------------------------"
echo "⚠️  You will be prompted for the password ONE LAST TIME."

# Execute remote commands via SSH to import data directly into running containers
ssh "$NEW_VPS_USER@$NEW_VPS_IP" << EOF
    # Abort on errors
    set -e
    
    echo "   -> Extracting archive remotely..."
    tar -xzf "$ARCHIVE_NAME" > /dev/null 2>&1
    cd migration_tmp_${DATE}
    
    echo "   -> Restoring Database..."
    docker cp "./db_backup.archive" "$DB_CONTAINER:/data/db/"
    docker exec -t "$DB_CONTAINER" sh -c "mongorestore --username $DB_USER --password $DB_PASS --authenticationDatabase admin --archive=/data/db/db_backup.archive --gzip --drop"
    docker exec -t "$DB_CONTAINER" rm -f /data/db/db_backup.archive
    
    echo "   -> Restoring Images..."
    tar -xzf "images_backup.tar.gz" > /dev/null 2>&1
    docker cp "./deliveria_upload/." "$APP_CONTAINER:/deliveria/deliveria_upload/"
    
    echo "   -> Restarting App Container..."
    docker restart "$APP_CONTAINER"
    
    echo "   -> Cleaning up remote temporary files..."
    cd ..
    rm -rf migration_tmp_${DATE}
    rm -f "$ARCHIVE_NAME"
    
    echo "✅ Remote import complete!"
EOF

# Clean up local backup file
rm -f "$ARCHIVE_NAME"

echo ""
echo "================================================"
echo "🎉 SUCCESS: Migration completed entirely!"
echo "Your data and images have been moved to $NEW_VPS_IP."
echo "================================================"
