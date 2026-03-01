# Platform-Specific Setup Instructions for Magic 8 Ball

This guide provides detailed setup instructions for each supported platform to prepare your development environment for building the Magic 8 Ball Tauri application.

## Table of Contents

- [Windows Setup](#windows-setup)
- [macOS Setup](#macos-setup)
- [Linux Setup (Ubuntu/Debian)](#linux-setup-ubuntudebian)
- [Linux Setup (Fedora/RHEL)](#linux-setup-fedorarhel)
- [Transferring Projects Between Platforms](#transferring-projects-between-platforms)
- [Common Issues](#common-issues)

---

## Windows Setup

### 1. Install Node.js

1. Download Node.js from: https://nodejs.org/
2. Choose the LTS (Long Term Support) version
3. Run the installer and follow the prompts
4. Verify installation:
   ```cmd
   node --version
   npm --version
   ```

### 2. Install Rust

1. Download Rust from: https://rustup.rs/
2. Run `rustup-init.exe`
3. Follow the prompts (default options are fine)
4. Restart your terminal
5. Verify installation:
   ```cmd
   rustc --version
   cargo --version
   ```

### 3. Install Visual Studio Build Tools

1. Download from: https://visualstudio.microsoft.com/downloads/
2. Select "Build Tools for Visual Studio 2022"
3. In the installer, select:
   - ✅ Desktop development with C++
   - ✅ MSVC v143 - VS 2022 C++ x64/x86 build tools
   - ✅ Windows 10/11 SDK
4. Install (this may take 30+ minutes)

### 4. Install WebView2 (if needed)

- **Windows 11:** Pre-installed, no action needed
- **Windows 10:** Download from https://developer.microsoft.com/microsoft-edge/webview2/

### 5. Clone/Copy the Project

```cmd
cd "F:\Daniel\My Web Sites\radius.center\magic8ball\tauri"
npm install
```

### 6. Test Your Setup

```cmd
quick-dev.bat
```

---

## macOS Setup

### 1. Install Xcode Command Line Tools

```bash
xcode-select --install
```

Follow the prompts to complete installation.

### 2. Install Homebrew (Optional but Recommended)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 3. Install Node.js

**Using Homebrew:**
```bash
brew install node
```

**Or download from:** https://nodejs.org/

Verify installation:
```bash
node --version
npm --version
```

### 4. Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

Verify installation:
```bash
rustc --version
cargo --version
```

### 5. Clone/Copy the Project

```bash
cd ~/path/to/magic8ball/tauri
npm install
chmod +x quick-dev.sh quick-build.sh
```

### 6. Test Your Setup

```bash
./quick-dev.sh
```

---

## Linux Setup (Ubuntu/Debian)

### 1. Update System

```bash
sudo apt update
sudo apt upgrade -y
```

### 2. Install Node.js

**Using NodeSource repository (recommended):**
```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
```

**Or using apt (may be older version):**
```bash
sudo apt install -y nodejs npm
```

Verify installation:
```bash
node --version
npm --version
```

### 3. Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

Verify installation:
```bash
rustc --version
cargo --version
```

### 4. Install System Dependencies

```bash
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

### 5. Clone/Copy the Project

```bash
cd ~/path/to/magic8ball/tauri
npm install
chmod +x quick-dev.sh quick-build.sh
```

### 6. Test Your Setup

```bash
./quick-dev.sh
```

---

## Linux Setup (Fedora/RHEL)

### 1. Update System

```bash
sudo dnf update -y
```

### 2. Install Node.js

```bash
sudo dnf install -y nodejs npm
```

Verify installation:
```bash
node --version
npm --version
```

### 3. Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

Verify installation:
```bash
rustc --version
cargo --version
```

### 4. Install System Dependencies

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

### 5. Clone/Copy the Project

```bash
cd ~/path/to/magic8ball/tauri
npm install
chmod +x quick-dev.sh quick-build.sh
```

### 6. Test Your Setup

```bash
./quick-dev.sh
```

---

## Transferring Projects Between Platforms

### What to Transfer

When moving the project between platforms, you need to transfer:

✅ **Source files:**
- `src/` directory (HTML, CSS, JS, images, audio)
- `src-tauri/` directory (Rust code, config)
- `scripts/` directory
- `package.json`
- `*.sh` and `*.bat` scripts
- Documentation files (`*.md`)

❌ **Do NOT transfer:**
- `node_modules/` (regenerate with `npm install`)
- `src-tauri/target/` (build artifacts)
- `.git/` (if using version control, clone instead)

### Transfer Methods

#### Method 1: USB Drive

1. Copy the project folder to USB drive
2. On target machine, copy to desired location
3. Run `npm install`
4. On Unix systems, run `chmod +x *.sh`

#### Method 2: Git Repository

```bash
# On source machine
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main

# On target machine
git clone <your-repo-url>
cd magic8ball/tauri
npm install
chmod +x *.sh  # Unix only
```

#### Method 3: Network Transfer

```bash
# Using scp (Unix to Unix)
scp -r magic8ball/ user@target-machine:~/

# On target machine
cd ~/magic8ball/tauri
npm install
chmod +x *.sh
```

### After Transfer Checklist

1. ✅ Run `npm install` to install dependencies
2. ✅ On Unix systems: `chmod +x quick-dev.sh quick-build.sh`
3. ✅ Verify Node.js is installed: `node --version`
4. ✅ Verify Rust is installed: `cargo --version`
5. ✅ Install platform-specific dependencies (see above)
6. ✅ Test with development mode: `quick-dev.bat` or `./quick-dev.sh`

---

## Common Issues

### Issue: "command not found: node"

**Solution:** Node.js is not installed or not in PATH
```bash
# Verify installation
which node

# If not found, install Node.js (see platform-specific instructions above)
```

### Issue: "command not found: cargo"

**Solution:** Rust is not installed or not in PATH
```bash
# Add Rust to PATH (Unix)
source $HOME/.cargo/env

# Or add to shell profile
echo 'source $HOME/.cargo/env' >> ~/.bashrc
source ~/.bashrc
```

### Issue: "webkit2gtk not found" (Linux)

**Solution:** Install WebKit dependencies
```bash
# Ubuntu/Debian
sudo apt install libwebkit2gtk-4.1-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel
```

### Issue: "Permission denied" on shell scripts (Unix)

**Solution:** Make scripts executable
```bash
chmod +x quick-dev.sh quick-build.sh
```

### Issue: Build fails with "linker error" (Windows)

**Solution:** Install Visual Studio Build Tools with C++ support
- See Windows Setup section above

### Issue: "WebView2 not found" (Windows 10)

**Solution:** Install WebView2 Runtime
- Download from: https://developer.microsoft.com/microsoft-edge/webview2/

### Issue: npm install fails with permission errors (Unix)

**Solution:** Don't use sudo with npm. Fix npm permissions:
```bash
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Issue: Build is extremely slow

**Solution:** This is normal for first builds
- First build: 10-30 minutes (Rust compilation)
- Subsequent builds: 1-5 minutes (cached)
- Don't delete `src-tauri/target/` directory

### Issue: "error: failed to run custom build command" (Rust)

**Solution:** Update Rust
```bash
rustup update
```

---

## Verifying Your Setup

Run this command to check your environment:

```bash
npm run platform:info
```

This will display:
- Current platform
- Architecture
- Build targets
- Output directories

---

## Next Steps

Once your platform is set up:

1. **Development:** Run `quick-dev.bat` (Windows) or `./quick-dev.sh` (Unix)
2. **Building:** Run `quick-build.bat` (Windows) or `./quick-build.sh` (Unix)
3. **Documentation:** See [BUILD_INSTRUCTIONS_CROSS_PLATFORM.md](BUILD_INSTRUCTIONS_CROSS_PLATFORM.md)

---

## Additional Resources

- [Node.js Documentation](https://nodejs.org/docs/)
- [Rust Documentation](https://doc.rust-lang.org/)
- [Tauri Prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites)
- [Tauri Documentation](https://tauri.app/)

---

**Need Help?** Check [BUILD_INSTRUCTIONS_CROSS_PLATFORM.md](BUILD_INSTRUCTIONS_CROSS_PLATFORM.md) for build-specific instructions.
