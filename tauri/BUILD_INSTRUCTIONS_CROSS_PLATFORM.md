# Cross-Platform Build Instructions for Magic 8 Ball

This guide provides detailed instructions for building the Magic 8 Ball application on Windows, macOS, and Linux (including Fedora for RPM packages).

## Table of Contents

- [Overview](#overview)
- [Prerequisites by Platform](#prerequisites-by-platform)
- [Building on Windows](#building-on-windows)
- [Building on macOS](#building-on-macos)
- [Building on Linux (Ubuntu/Debian)](#building-on-linux-ubuntudebian)
- [Building on Fedora/RHEL (RPM)](#building-on-fedorarhel-rpm)
- [Cross-Platform Development](#cross-platform-development)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Magic 8 Ball application is built using Tauri 2.0, which allows you to create native desktop applications for multiple platforms. However, **you must build on each target platform** - cross-compilation from Windows to macOS/Linux is not straightforward with Tauri.

### What You Can Do:

✅ Copy the project files to any platform  
✅ Build native executables on each platform  
✅ Create platform-specific installers (MSI, DMG, DEB, RPM)  
✅ Use the same source code across all platforms  

### What You Cannot Do:

❌ Build a macOS DMG from Windows  
❌ Build a Linux DEB/RPM from Windows  
❌ Build a Windows MSI from macOS/Linux  

---

## Prerequisites by Platform

### All Platforms

- **Node.js** 16 or higher ([Download](https://nodejs.org/))
- **Rust** latest stable ([Download](https://rustup.rs/))

### Windows-Specific

- **Visual Studio Build Tools** with C++ support
  - Download from: https://visualstudio.microsoft.com/downloads/
  - Select "Desktop development with C++"
- **WebView2** (pre-installed on Windows 11)

### macOS-Specific

- **Xcode Command Line Tools**
  ```bash
  xcode-select --install
  ```
- **Homebrew** (recommended for installing dependencies)
  ```bash
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  ```

### Linux-Specific (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

### Fedora/RHEL-Specific

```bash
sudo dnf install -y \
  webkit2gtk4.1-devel \
  openssl-devel \
  curl \
  wget \
  file \
  libappindicator-gtk3-devel \
  librsvg2-devel \
  rpm-build
```

---

## Building on Windows

### Quick Build (Recommended)

1. Double-click `quick-build.bat`
2. Follow the prompts
3. Find your installer in `src-tauri\target\release\bundle\`

### Manual Build

```cmd
# Install dependencies
npm install

# Build
npm run build:windows
```

### Output Files

- **MSI Installer:** `src-tauri\target\release\bundle\msi\magic8ball_1.0.0_x64_en-US.msi`
- **NSIS Installer:** `src-tauri\target\release\bundle\nsis\magic8ball_1.0.0_x64-setup.exe`
- **Executable:** `src-tauri\target\release\magic8ball.exe`

---

## Building on macOS

### Quick Build (Recommended)

1. Make the script executable:
   ```bash
   chmod +x quick-build.sh
   ```
2. Run the script:
   ```bash
   ./quick-build.sh
   ```
3. Find your app in `src-tauri/target/release/bundle/`

### Manual Build

```bash
# Install dependencies
npm install

# Build for Apple Silicon (M1/M2/M3)
npm run build:mac

# Or build for Intel Macs
npm run build:mac-intel
```

### Output Files

- **DMG Installer:** `src-tauri/target/release/bundle/dmg/magic8ball_1.0.0_aarch64.dmg`
- **App Bundle:** `src-tauri/target/release/bundle/macos/magic8ball.app`

### Code Signing (Optional)

For distribution outside the App Store, you'll need to sign your app:

```bash
# Sign the app
codesign --force --deep --sign "Developer ID Application: Your Name" \
  src-tauri/target/release/bundle/macos/magic8ball.app

# Verify signature
codesign --verify --verbose src-tauri/target/release/bundle/macos/magic8ball.app
```

---

## Building on Linux (Ubuntu/Debian)

### Quick Build (Recommended)

1. Make the script executable:
   ```bash
   chmod +x quick-build.sh
   ```
2. Run the script:
   ```bash
   ./quick-build.sh
   ```
3. Find your package in `src-tauri/target/release/bundle/`

### Manual Build

```bash
# Install dependencies
npm install

# Build DEB package
npm run build:linux-deb

# Or build both DEB and AppImage
npm run build:linux
```

### Output Files

- **DEB Package:** `src-tauri/target/release/bundle/deb/magic8ball_1.0.0_amd64.deb`
- **AppImage:** `src-tauri/target/release/bundle/appimage/magic8ball_1.0.0_amd64.AppImage`

### Installing the DEB Package

```bash
sudo dpkg -i src-tauri/target/release/bundle/deb/magic8ball_1.0.0_amd64.deb
```

---

## Building on Fedora/RHEL (RPM)

### Quick Build (Recommended)

1. Make the script executable:
   ```bash
   chmod +x quick-build.sh
   ```
2. Run the script:
   ```bash
   ./quick-build.sh
   ```
3. The script will detect Fedora and build RPM automatically
4. Find your package in `src-tauri/target/release/bundle/`

### Manual Build

```bash
# Install dependencies
npm install

# Build RPM package
npm run build:linux-rpm

# Or build RPM + AppImage
npm run build:fedora
```

### Output Files

- **RPM Package:** `src-tauri/target/release/bundle/rpm/magic8ball-1.0.0-1.x86_64.rpm`
- **AppImage:** `src-tauri/target/release/bundle/appimage/magic8ball_1.0.0_amd64.AppImage`

### Installing the RPM Package

```bash
sudo dnf install src-tauri/target/release/bundle/rpm/magic8ball-1.0.0-1.x86_64.rpm
```

Or using rpm directly:

```bash
sudo rpm -i src-tauri/target/release/bundle/rpm/magic8ball-1.0.0-1.x86_64.rpm
```

---

## Cross-Platform Development

### Development Mode

**Windows:**
```cmd
quick-dev.bat
```
Or:
```cmd
npm run dev:windows
```

**macOS/Linux:**
```bash
chmod +x quick-dev.sh
./quick-dev.sh
```
Or:
```bash
npm run dev:mac    # macOS
npm run dev:linux  # Linux
```

### Platform Detection

Check your current platform configuration:

```bash
npm run platform:info
```

This will display:
- Detected platform
- Architecture
- OS release
- Build targets
- Output directory

---

## Troubleshooting

### Build Fails with "cargo not found"

**Solution:** Install Rust from https://rustup.rs/

```bash
# Update Rust
rustup update
```

### Build Fails with Missing System Dependencies

**Ubuntu/Debian:**
```bash
sudo apt install libwebkit2gtk-4.1-dev build-essential
```

**Fedora:**
```bash
sudo dnf install webkit2gtk4.1-devel gcc
```

### "WebView2 not found" on Windows

**Solution:** Install WebView2 Runtime:
- Download from: https://developer.microsoft.com/microsoft-edge/webview2/

### Build is Very Slow

First builds are slow due to Rust compilation (10-30 minutes). Subsequent builds are much faster (1-5 minutes) due to caching.

**Tips:**
- Don't delete the `target/` directory between builds
- Use `npm run dev` for development (faster iteration)
- Only use `npm run build` for final releases

### Permission Denied on Shell Scripts (macOS/Linux)

**Solution:** Make scripts executable:
```bash
chmod +x quick-dev.sh quick-build.sh
```

### RPM Build Fails on Fedora

**Solution:** Install rpm-build:
```bash
sudo dnf install rpm-build
```

---

## Platform-Specific Notes

### Windows

- MSI installers require administrator privileges to install
- NSIS installers are more flexible but require additional configuration
- WebView2 is required on Windows 10 (pre-installed on Windows 11)

### macOS

- Apps must be signed for distribution outside the App Store
- Notarization is required for macOS 10.15+
- Universal binaries (Intel + Apple Silicon) require building twice and using `lipo`

### Linux

- DEB packages work on Debian, Ubuntu, Linux Mint, etc.
- RPM packages work on Fedora, RHEL, CentOS, openSUSE, etc.
- AppImage works on most Linux distributions without installation

---

## Next Steps

1. **Test on Target Platform:** Always test builds on the actual target platform
2. **Create Release Notes:** Document changes for each version
3. **Sign Your Applications:** Required for macOS, recommended for Windows
4. **Set Up CI/CD:** Automate builds using GitHub Actions or similar

---

## Additional Resources

- [Tauri Documentation](https://tauri.app/)
- [Tauri Building Guide](https://tauri.app/v1/guides/building/)
- [Rust Documentation](https://doc.rust-lang.org/)

---

**Need Help?** Check [PLATFORM_SETUP.md](PLATFORM_SETUP.md) for detailed platform-specific setup instructions.
