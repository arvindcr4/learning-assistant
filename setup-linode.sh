#!/bin/bash

echo "🔧 Setting up Linode CLI for deployment..."

# Check if Linode CLI is configured
if ! linode-cli profile view &>/dev/null; then
    echo "❌ Linode CLI is not configured."
    echo ""
    echo "Choose your authentication method:"
    echo "1) Web browser authentication (recommended)"
    echo "2) Personal Access Token"
    echo ""
    read -p "Enter choice (1 or 2): " choice
    
    case $choice in
        1)
            echo "🌐 Opening browser for authentication..."
            linode-cli configure
            ;;
        2)
            echo "🔑 You'll need a Personal Access Token from:"
            echo "   https://cloud.linode.com/profile/tokens"
            echo ""
            linode-cli configure --token
            ;;
        *)
            echo "❌ Invalid choice. Exiting."
            exit 1
            ;;
    esac
else
    echo "✅ Linode CLI is already configured"
fi

# Verify configuration
if linode-cli profile view &>/dev/null; then
    echo "✅ Linode CLI configuration verified"
    echo ""
    echo "🚀 Ready to deploy! Run: ./linode-deploy.sh"
else
    echo "❌ Configuration failed. Please try again."
    exit 1
fi