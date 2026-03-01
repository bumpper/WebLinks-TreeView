# Magic8Ball - Build Instructions

This document provides detailed instructions for building the Magic8Ball desktop application.

## Quick Start

### Development Mode
```bash
# Windows
quick-dev.bat

# Or manually
npm install
npm run dev
```

### Production Build
```bash
# Windows
quick-build.bat

# Or manually
npm install
npm run build
```

## Prerequisites

### Required Software

1. **Rust** (latest stable)
   - Install from: https://rustup.rs/
   - Verify: `rustc --version`
   - Should show version 1.70.0 or higher

2. **Node.js** (v16 or later)
   - Install from: https://nodejs.org/
   - Verify: `node --version` and `npm --version`
   - Recommended: v18.x or v20.x LTS

3. **Git** (optional, for version control)
   - Install from: https://git-scm.com/

### Platform-Specific Requirements

#### Windows
- **Microsoft Visual Studio C++ Build Tools**
  - Download: https://visualstudio.microsoft.com/visual-cpp-build-tools/
  - Install "Desktop development with C++" workload
  
- **WebView2**
  - Usually pre-installed on Windows 10/11
  - If needed: https://developer.microsoft.com/microsoft-edge/webview2/

#### macOS
- **Xcode Command Line Tools**
  ```bash
  xcode-select --install
  ```

#### Linux (Debian/Ubuntu)
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

#### Linux (Fedora/RHEL)
```bash
sudo dnf install webkit2gtk4.1-devel \
  openssl-devel \
  curl \
  wget \
  file \
  libappindicator-gtk3-devel \
  librsvg2-devel
```

## Build Process

### Step 1: Install Dependencies

Navigate to the project directory and install Node.js dependencies:

```bash
cd magic8ball
npm install
```

This will install:
- `@tauri-apps/cli` - Tauri command-line interface

### Step 2: Development Build

Run the application in development mode:

```bash
npm run dev
```

This will:
1. Start the Tauri development server
2. Compile the Rust backend
3. Open the application window
4. Enable hot-reload for frontend changes

**Development Features:**
- Hot reload for HTML/CSS/JS changes
- Debug console available
- Faster compilation times
- Source maps enabled

### Step 3: Production Build

Build the application for distribution:

```bash
npm run build
```

This will:
1. Compile the Rust backend in release mode
2. Optimize the frontend assets
3. Create platform-specific installers
4. Generate application bundles

**Build Output Location:**
```
src-tauri/target/release/bundle/
├── msi/          # Windows MSI installer
├── nsis/         # Windows NSIS installer
├── deb/          # Linux Debian package
├── rpm/          # Linux RPM package
├── dmg/          # macOS disk image
└── macos/        # macOS app bundle
```

### Platform-Specific Builds

#### Windows
```bash
npm run build:windows
```
Creates:
- `.msi` installer (Windows Installer)
- `.exe` installer (NSIS)

#### macOS
```bash
npm run build:macos
```
Creates:
- `.dmg` disk image
- `.app` application bundle

#### Linux
```bash
npm run build:linux
```
Creates:
- `.deb` package (Debian/Ubuntu)
- `.rpm` package (Fedora/RHEL)

## Build Configuration

### Tauri Configuration

The build is configured in `src-tauri/tauri.conf.json`:

```json
{
  "productName": "Magic8Ball",
  "version": "1.0.0",
  "identifier": "center.radius.magic8ball",
  "bundle": {
    "active": true,
    "targets": ["msi", "nsis", "deb", "rpm", "dmg", "app"]
  }
}
```

### Cargo Configuration

Rust dependencies are defined in `src-tauri/Cargo.toml`:

```toml
[dependencies]
tauri = { version = "2.0", features = ["protocol-asset"] }
tauri-plugin-shell = "2.0"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

## Build Optimization

### Release Profile

The release build uses optimized settings in `Cargo.toml`:

```toml
[profile.release]
panic = "abort"
codegen-units = 1
lto = true
opt-level = "s"
strip = true
```

**Optimizations:**
- `panic = "abort"` - Smaller binary size
- `codegen-units = 1` - Better optimization
- `lto = true` - Link-time optimization
- `opt-level = "s"` - Optimize for size
- `strip = true` - Remove debug symbols

### Expected Build Sizes

- **Windows**: ~8-12 MB (installer)
- **macOS**: ~10-15 MB (app bundle)
- **Linux**: ~8-12 MB (package)

## Troubleshooting

### Common Issues

#### 1. Rust Not Found
```
error: 'cargo' is not recognized as an internal or external command
```
**Solution:** Install Rust from https://rustup.rs/ and restart terminal

#### 2. Node Modules Error
```
Error: Cannot find module '@tauri-apps/cli'
```
**Solution:** Run `npm install` in the project directory

#### 3. WebView2 Missing (Windows)
```
Error: WebView2 runtime not found
```
**Solution:** Install WebView2 from Microsoft's website

#### 4. Build Tools Missing (Windows)
```
error: linker 'link.exe' not found
```
**Solution:** Install Visual Studio C++ Build Tools

#### 5. Icon Errors
```
Error: Failed to load icon
```
**Solution:** Ensure all icon files exist in `src-tauri/icons/`:
- 32x32.png
- 128x128.png
- 128x128@2x.png
- icon.ico
- icon.icns

#### 6. Permission Errors (Linux/macOS)
```
Permission denied
```
**Solution:** Run with appropriate permissions or use `sudo` for system-wide installation

### Clean Build

If you encounter persistent issues, try a clean build:

```bash
# Clean Rust build artifacts
cd src-tauri
cargo clean
cd ..

# Clean Node modules
rm -rf node_modules
npm install

# Rebuild
npm run build
```

### Update Dependencies

Keep dependencies up to date:

```bash
# Update Rust
rustup update

# Update Cargo dependencies
cd src-tauri
cargo update
cd ..

# Update Node dependencies
npm update
```

## Build Verification

After building, verify the application:

1. **Check Build Output:**
   ```bash
   ls src-tauri/target/release/bundle/
   ```

2. **Test the Installer:**
   - Windows: Run the `.msi` or `.exe` file
   - macOS: Open the `.dmg` and drag to Applications
   - Linux: Install the `.deb` or `.rpm` package

3. **Verify Functionality:**
   - Application launches successfully
   - Magic 8 Ball responds to clicks
   - Shake animation plays
   - Sound effect works
   - Dark mode toggle functions
   - Settings persist after restart

## Continuous Integration

For automated builds, consider using:

- **GitHub Actions** - For multi-platform builds
- **GitLab CI** - For self-hosted builds
- **Jenkins** - For enterprise builds

Example GitHub Actions workflow available in the repository.

## Distribution

### Windows
- Distribute `.msi` for enterprise users
- Distribute `.exe` for general users
- Consider code signing for production

### macOS
- Distribute `.dmg` for easy installation
- Consider notarization for Gatekeeper
- Sign with Apple Developer certificate

### Linux
- Distribute `.deb` for Debian/Ubuntu users
- Distribute `.rpm` for Fedora/RHEL users
- Consider AppImage for universal distribution

## Support

For build issues:
1. Check this documentation
2. Review error messages carefully
3. Search existing issues
4. Contact Radius.Center support

## Additional Resources

- Tauri Documentation: https://tauri.app/
- Rust Documentation: https://doc.rust-lang.org/
- Node.js Documentation: https://nodejs.org/docs/
