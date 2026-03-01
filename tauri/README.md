# Magic8Ball - Mystical Answer Oracle

A desktop application that brings the classic Magic 8 Ball experience to your computer. Ask any question, shake the ball, and receive mystical guidance with 20 classic responses. Built with Tauri for cross-platform support.

## Features

- **Classic Magic 8 Ball Experience**: Click to shake and receive mystical answers
- **20 Authentic Responses**: Including positive, negative, and neutral predictions
- **Shake Animation**: Realistic shake effect with sound
- **Dark Mode**: Toggle between light and dark themes
- **Smooth Animations**: Beautiful floating text reveal animation
- **Persistent Settings**: Dark mode preference saved locally
- **Cross-platform**: Works on Windows, macOS, and Linux

## Magic 8 Ball Responses

The application includes all 20 classic Magic 8 Ball responses:

**Positive (10):**
- It is certain
- It is decidedly so
- Without a doubt
- Yes definitely
- You may rely on it
- As I see it, yes
- Most likely
- Outlook good
- Yes
- Signs point to yes

**Non-committal (5):**
- Reply hazy, try again
- Ask again later
- Better not tell you now
- Cannot predict now
- Concentrate and ask again

**Negative (5):**
- Don't count on it
- My reply is no
- My sources say no
- Outlook not so good
- Very doubtful

## Prerequisites

Before building the application, ensure you have the following installed:

1. **Rust** (latest stable version)
   - Download from: https://rustup.rs/
   - Verify installation: `rustc --version`

2. **Node.js** (v16 or later recommended)
   - Download from: https://nodejs.org/
   - Verify installation: `node --version`

3. **Platform-specific dependencies:**

   ### Windows
   - Microsoft Visual Studio C++ Build Tools
   - WebView2 (usually pre-installed on Windows 10/11)

   ### macOS
   - Xcode Command Line Tools: `xcode-select --install`

   ### Linux (Debian/Ubuntu)
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

   ### Linux (Fedora/RHEL)
   ```bash
   sudo dnf install webkit2gtk4.1-devel \
     openssl-devel \
     curl \
     wget \
     file \
     libappindicator-gtk3-devel \
     librsvg2-devel
   ```

## Installation

1. Navigate to the project directory:
   ```bash
   cd magic8ball
   ```

2. Install Node.js dependencies:
   ```bash
   npm install
   ```

## Development

To run the application in development mode:

```bash
npm run dev
```

Or use the quick start script:
```bash
quick-dev.bat
```

This will start the Tauri development server and open the application window.

## Building Installers

### Build for Current Platform

To build the application for your current platform:

```bash
npm run build
```

Or use the quick build script:
```bash
quick-build.bat
```

The installers will be created in `src-tauri/target/release/bundle/`

### Platform-Specific Builds

**Windows (.exe, .msi):**
```bash
npm run build:windows
```
Output: `src-tauri/target/release/bundle/msi/` and `src-tauri/target/release/bundle/nsis/`

**macOS (.dmg, .app):**
```bash
npm run build:macos
```
Output: `src-tauri/target/release/bundle/dmg/` and `src-tauri/target/release/bundle/macos/`

**Linux (.deb, .rpm):**
```bash
npm run build:linux
```
Output: `src-tauri/target/release/bundle/deb/` and `src-tauri/target/release/bundle/rpm/`

## Usage

### Asking Questions
1. Think of a yes/no question
2. Click anywhere on the Magic 8 Ball
3. Watch the shake animation
4. Receive your mystical answer

### Dark Mode
- Toggle the switch in the top-right corner to enable/disable dark mode
- Your preference is automatically saved

### Features
- **Shake Sound**: Authentic shake sound effect plays with each click
- **Smooth Animation**: Answer floats up and comes into focus
- **Random Responses**: Each shake provides a random answer from 20 possibilities

## Installation Paths

The application will be installed to the following default directories:

- **Windows**: `C:\Program Files\Magic8Ball\` or `%LOCALAPPDATA%\Programs\Magic8Ball\`
- **macOS**: `/Applications/Magic8Ball.app`
- **Linux**: `/usr/bin/magic8ball` (binary) and `/usr/share/applications/` (desktop entry)

## Troubleshooting

### Icon Issues
If you encounter icon-related errors during build, ensure all icon files are present in `src-tauri/icons/`:
- `32x32.png`
- `128x128.png`
- `128x128@2x.png`
- `icon.icns` (macOS)
- `icon.ico` (Windows)

### Build Errors
1. Make sure all dependencies are installed
2. Clear the build cache: `cargo clean` in the `src-tauri` directory
3. Update Rust: `rustup update`
4. Update dependencies: `cargo update` in the `src-tauri` directory

### Audio Issues
If the shake sound doesn't play:
1. Check that `shake.wav` is present in the `src/` directory
2. Verify browser audio permissions
3. Check system volume settings

## Technologies Used

- **Tauri 2.0**: Cross-platform desktop framework
- **HTML5/CSS3/JavaScript**: Frontend technologies
- **Web Audio API**: Sound effects
- **LocalStorage API**: Settings persistence

## Project Structure

```
magic8ball/
├── src/
│   ├── index.html          # Main application HTML
│   ├── magic8ball.png      # Magic 8 Ball image
│   ├── shake.wav           # Shake sound effect
│   └── favicon.ico         # Application favicon
├── src-tauri/
│   ├── src/
│   │   ├── main.rs         # Rust main entry point
│   │   └── lib.rs          # Rust library code
│   ├── icons/              # Application icons
│   ├── capabilities/       # Tauri capabilities
│   ├── Cargo.toml          # Rust dependencies
│   ├── tauri.conf.json     # Tauri configuration
│   └── build.rs            # Build script
├── package.json            # Node.js dependencies
├── quick-build.bat         # Quick build script
├── quick-dev.bat           # Quick development script
└── README.md               # This file
```

## License

MIT License - Copyright © 2025 Radius.Center

## Credits

Based on the classic Magic 8 Ball toy by Mattel.

## Support

For issues and questions, please visit the project repository or contact Radius.Center.
