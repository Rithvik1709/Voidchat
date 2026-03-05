#!/bin/bash

# Image Sharing Feature Setup Script
# This script configures the image sharing feature for production

set -e

echo "🖼️  Setting up Image Sharing Feature..."

# Create uploads directory
echo "📁 Creating uploads directory..."
mkdir -p public/uploads

# Set proper permissions (optional, for Linux/Mac)
if [[ "$OSTYPE" == "linux-gnu"* ]] || [[ "$OSTYPE" == "darwin"* ]]; then
    chmod 755 public/uploads
    echo "✅ Directory permissions set"
fi

# Create .gitignore entry if it doesn't exist
if ! grep -q "public/uploads" .gitignore 2>/dev/null; then
    echo "📝 Updating .gitignore..."
    echo "" >> .gitignore
    echo "# Image uploads (temporary files)" >> .gitignore
    echo "public/uploads/*" >> .gitignore
    echo "!public/uploads/.gitkeep" >> .gitignore
    echo "✅ .gitignore updated"
else
    echo "✅ .gitignore already contains uploads directory"
fi

echo ""
echo "✅ Image Sharing Feature is ready!"
echo ""
echo "📋 Next steps:"
echo "1. Update your environment variables in .env.local if needed"
echo "2. Setup a cron job to clean old images:"
echo "   - Call: POST /api/uploads/cleanup"
echo "   - Frequency: Every 6-24 hours"
echo "3. Test the feature by uploading an image in the chat"
echo ""
echo "💡 Configuration can be adjusted in:"
echo "   - /app/api/upload/route.ts (max file size, allowed types)"
echo "   - /app/api/uploads/cleanup/route.ts (retention period)"
echo ""
echo "📚 For more info, see IMAGE_SHARING.md"
