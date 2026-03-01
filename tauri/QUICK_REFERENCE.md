# Magic 8 Ball - Quick Reference Guide

Quick command reference for building and developing the Magic 8 Ball Tauri application across all platforms.

## Quick Start

### Windows
```cmd
quick-dev.bat          # Start development
quick-build.bat        # Build production
```

### macOS/Linux
```bash
chmod +x *.sh          # Make executable (first time)
./quick-dev.sh         # Start development
./quick-build.sh       # Build production
```

---

## NPM Scripts

### Development
```bash
npm run dev              # Generic dev mode
npm run dev:windows      # Windows dev mode
npm run dev:mac          # macOS dev mode
npm run dev:linux        # Linux dev mode
```

### Building

**Windows:**
```bash
npm run build:windows    # MSI + NSIS installers
```

**macOS:**
```bash
npm run build:mac        # DMG + APP (Apple Silicon)
npm run build:mac-intel  # DMG + APP (Intel)
npm run build:macos      # Alias for build:mac
```

**Linux:**
```bash
npm run build:linux      # DEB + AppImage
npm run build:linux-deb  # DEB + AppImage
npm run build:linux-rpm  # RPM only
npm run build:fedora     # RPM + AppImage
```

### Utilities
```bash
npm run platform:info    # Show platform info
npm run clean            # Clean Rust build cache
npm run clean:all        # Clean everything
```

---

## Prerequisites

### All Platforms
- Node.js 16+ ([nodejs.org](https://nodejs.org/))
- Rust ([rustup.rs](https://rustup.rs/))

### Windows
- Visual Studio Build Tools
- WebView2 (pre-installed on Win11)

### macOS
```bash
xcode-select --install
```

### Ubuntu/Debian
```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

### Fedora/RHEL
```bash
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file libappindicator-gtk3-devel librsvg2-devel rpm-build
```

---

## Build Output Locations

### Windows
```
src-tauri\target\release\bundle\
├── msi\magic8ball_1.0.0_x64_en-US.msi
└── nsis\magic8ball_1.0.0_x64-setup.exe
```

### macOS
```
src-tauri/target/release/bundle/
├── dmg/magic8ball_1.0.0_aarch64.dmg
└── macos/magic8ball.app
```

### Linux
```
src-tauri/target/release/bundle/
├── deb/magic8ball_1.0.0_amd64.deb
├── appimage/magic8ball_1.0.0_amd64.AppImage
└── rpm/magic8ball-1.0.0-1.x86_64.rpm
```

---

## Common Commands

### Install Dependencies
```bash
npm install
```

### Update Rust
```bash
rustup update
```

### Clean Build
```bash
npm run clean
cd src-tauri && cargo clean && cd ..
```

### Check Platform
```bash
npm run platform:info
```

### Verify Prerequisites
```bash
node --version
npm --version
rustc --version
cargo --version
```

---

## Troubleshooting

### Permission Denied (Unix)
```bash
chmod +x quick-dev.sh quick-build.sh
```

### Cargo Not Found
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### WebKit Not Found (Linux)
```bash
# Ubuntu/Debian
sudo apt install libwebkit2gtk-4.1-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel
```

### Build Fails
```bash
# Clean and retry
npm run clean
npm install
npm run build
```

### Slow Build
- First build: 10-30 minutes (normal)
- Subsequent: 1-5 minutes
- Don't delete `target/` directory

---

## File Transfer Between Platforms

### What to Copy
✅ Source files (`src/`, `src-tauri/src/`)  
✅ Config files (`package.json`, `tauri.conf.json`)  
✅ Scripts (`*.sh`, `*.bat`, `scripts/`)  
✅ Documentation (`*.md`)  

❌ `node_modules/` (regenerate)  
❌ `src-tauri/target/` (regenerate)  

### After Transfer
```bash
npm install
chmod +x *.sh  # Unix only
```

---

## Platform Detection

The build scripts automatically detect your platform:
- **Windows:** Builds MSI + NSIS
- **macOS:** Builds DMG + APP
- **Ubuntu/Debian:** Builds DEB + AppImage
- **Fedora/RHEL:** Builds RPM + AppImage

---

## Development Workflow

1. **Start Development:**
   ```bash
   npm run dev
   ```

2. **Make Changes:**
   - Edit files in `src/` (HTML/CSS/JS)
   - Edit Rust code in `src-tauri/src/`

3. **Hot Reload:**
   - Frontend changes reload automatically
   - Rust changes require restart

4. **Build for Production:**
   ```bash
   npm run build:windows  # or :mac, :linux
   ```

5. **Test Installer:**
   - Find in `src-tauri/target/release/bundle/`
   - Install and test on target platform

---

## Quick Tips

- Use `npm run dev` for development (fast)
- Use `npm run build` only for releases (slow)
- Keep `target/` directory for faster rebuilds
- Test on actual target platforms before release
- Sign apps for macOS distribution
- Use AppImage for maximum Linux compatibility

---

## Documentation

- **[BUILD_INSTRUCTIONS_CROSS_PLATFORM.md](BUILD_INSTRUCTIONS_CROSS_PLATFORM.md)** - Complete build guide
- **[PLATFORM_SETUP.md](PLATFORM_SETUP.md)** - Platform setup instructions
- **[CROSS_PLATFORM_SUMMARY.md](CROSS_PLATFORM_SUMMARY.md)** - Implementation overview

---

## Support Resources

- [Tauri Documentation](https://tauri.app/)
- [Tauri Discord](https://discord.com/invite/tauri)
- [Rust Documentation](https://doc.rust-lang.org/)
- [Node.js Documentation](https://nodejs.org/docs/)

---

## Version Info

- **Magic 8 Ball Version:** 1.0.0
- **Tauri Version:** 2.0.0
- **Supported Platforms:** Windows, macOS, Linux (Ubuntu/Debian/Fedora)
