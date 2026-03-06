#!/bin/bash

# DiffSense GitHub Pages Deployment Script

echo "🚀 Starting DiffSense website deployment to GitHub Pages..."

# Create a temporary directory for the deployment
DEPLOY_DIR="diffsense-github-pages"
rm -rf $DEPLOY_DIR
mkdir $DEPLOY_DIR

# Copy all website files to the deployment directory
cp index.html $DEPLOY_DIR/
cp style.css $DEPLOY_DIR/
cp script.js $DEPLOY_DIR/

# Create .nojekyll file to prevent Jekyll processing
touch $DEPLOY_DIR/.nojekyll

# Create CNAME file if you have a custom domain (uncomment and modify if needed)
# echo "your-domain.com" > $DEPLOY_DIR/CNAME

echo "✅ Website files prepared for deployment"

echo ""
echo "📋 Next steps to deploy to GitHub Pages:"
echo "1. Create a new GitHub repository named 'diffsense.github.io' (replace 'diffsense' with your GitHub username)"
echo "2. Clone the repository locally: git clone https://github.com/YOUR_USERNAME/diffsense.github.io.git"
echo "3. Copy all files from '$DEPLOY_DIR' to the cloned repository"
echo "4. Commit and push the changes:"
echo "   cd diffsense.github.io"
echo "   git add ."
echo "   git commit -m 'Deploy DiffSense website'"
echo "   git push origin main"
echo ""
echo "🌐 Your website will be available at: https://YOUR_USERNAME.github.io"
echo ""
echo "💡 Note: Replace 'YOUR_USERNAME' with your actual GitHub username throughout these instructions."

echo "✨ Deployment preparation complete!"