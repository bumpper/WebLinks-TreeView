#!/bin/bash

###############################################################################
# Magic 8 Ball - Quick Build Script (macOS/Linux)
# Builds the production version of Magic 8 Ball
###############################################################################

echo "=========================================="
echo "  Magic 8 Ball - Production Build"
echo "=========================================="
echo ""

# Detect platform
if [[ "$OSTYPE" == "darwin"* ]]; then
    PLATFORM="macOS"
    BUILD_CMD="build:mac"
elif [[ -f /etc/fedora-release ]] || [[ -f /etc/redhat-release ]]; then
    PLATFORM="Fedora/RHEL"
    BUILD_CMD="build:fedora"
elif [[ -f /etc/debian_version ]]; then
    PLATFORM="Debian/Ubuntu"
    BUILD_CMD="build:linux-deb"
else
    PLATFORM="Linux"
    BUILD_CMD="build:linux"
fi

echo "Detected Platform: $PLATFORM"
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

# Show build information
echo "Building Magic 8 Ball for $PLATFORM..."
echo "  Build command: npm run $BUILD_CMD"
echo ""
echo "This may take several minutes..."
echo ""

# Run the build
npm run "$BUILD_CMD"

BUILD_EXIT_CODE=$?

if [ $BUILD_EXIT_CODE -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "  ✓ Build Successful!"
    echo "=========================================="
    echo ""
    echo "Output location: src-tauri/target/release/bundle/"
    echo ""
    
    # Show platform-specific output
    if [[ "$PLATFORM" == "macOS" ]]; then
        echo "Built files:"
        echo "  - DMG: src-tauri/target/release/bundle/dmg/"
        echo "  - APP: src-tauri/target/release/bundle/macos/"
    elif [[ "$PLATFORM" == "Fedora/RHEL" ]]; then
        echo "Built files:"
        echo "  - RPM: src-tauri/target/release/bundle/rpm/"
        echo "  - AppImage: src-tauri/target/release/bundle/appimage/"
    elif [[ "$PLATFORM" == "Debian/Ubuntu" ]]; then
        echo "Built files:"
        echo "  - DEB: src-tauri/target/release/bundle/deb/"
        echo "  - AppImage: src-tauri/target/release/bundle/appimage/"
    else
        echo "Built files:"
        echo "  - Check: src-tauri/target/release/bundle/"
    fi
    echo ""
else
    echo ""
    echo "=========================================="
    echo "  ❌ Build Failed"
    echo "=========================================="
    echo ""
    echo "Please check the error messages above."
    echo ""
    exit $BUILD_EXIT_CODE
fi
