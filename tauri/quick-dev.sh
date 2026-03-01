#!/bin/bash

###############################################################################
# Magic 8 Ball - Quick Development Script (macOS/Linux)
# Starts the Tauri development environment
###############################################################################

echo "=========================================="
echo "  Magic 8 Ball - Development Mode"
echo "=========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    echo "   Please install Node.js from: https://nodejs.org/"
    exit 1
fi

# Check if npm dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo "❌ Error: Rust is not installed"
    echo "   Please install Rust from: https://rustup.rs/"
    exit 1
fi

echo "✓ All prerequisites found"
echo ""
echo "Starting development environment..."
echo "  - Tauri Dev Window will open shortly"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start development mode
if [[ "$OSTYPE" == "darwin"* ]]; then
    npm run dev:mac
else
    npm run dev:linux
fi
