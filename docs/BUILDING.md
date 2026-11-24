# Building Limiterizz.PX from Source

This guide walks through building Limiterizz.PX from source code on Windows.

---

## Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| **Node.js** | 18.0 or later (LTS recommended) | [nodejs.org](https://nodejs.org/) |
| **npm** | 9.0 or later (bundled with Node.js) | Included with Node.js |
| **Git** | Any recent version | [git-scm.com](https://git-scm.com/) |
| **Windows** | 10 or 11 (64-bit) | — |

Verify your installations:

```bash
node --version    # Should print v18.x.x or later
npm --version     # Should print 9.x.x or later
git --version     # Should print git version 2.x.x
```

---

## Clone the Repository

```bash
git clone https://github.com/EskaProject-X/Limiterizz.PX.git
cd Limiterizz.PX
```

---

## Install Dependencies

```bash
npm install
```

This installs all required packages:

| Package | Purpose |
|---------|---------|
| `electron` | Desktop application framework |
| `electron-builder` | Packaging and distribution |
| `fast-xml-parser` | XML reading and writing |
| `regedit` | Windows registry access |
| `electron-store` | Persistent configuration storage |

---

## Development Mode

Run the app in development mode with hot-reload support:

```bash
npm start
```

This launches Electron and loads the app directly from source. Changes to renderer files are reflected on reload (`Ctrl+R` in the app window). Changes to main process files require restarting the app.

### DevTools

In development mode, you can open Chrome DevTools inside the app window:
- Press `Ctrl+Shift+I` or `F12`
- Or use the menu: View → Toggle Developer Tools (if the menu is visible)

---

## Production Build

Build a distributable package:

```bash
npm run build
```

### Output

Built files are placed in the `dist/` directory:

```
dist/
├── Limiterizz.PX Setup 1.0.0.exe    # NSIS installer
├── Limiterizz.PX 1.0.0.exe          # Portable executable
├── win-unpacked/                      # Unpacked app directory
└── builder-effective-config.yaml      # Build configuration used
```

### Build Configuration

The build is configured via `electron-builder.yml` in the project root:

```yaml
appId: com.eskaprojectx.limiterizz-px
productName: Limiterizz.PX
win:
  target:
    - nsis
    - portable
  icon: src/assets/logo.png
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
asar: true
singleInstance: true
```

---

## Code Signing (Optional)

Code signing your builds removes Windows SmartScreen warnings and verifies the publisher identity.

### Using a Code Signing Certificate

1. Obtain a code signing certificate from a trusted Certificate Authority (e.g., DigiCert, Sectigo, GlobalSign)

2. Set environment variables before building:

```powershell
$env:CSC_LINK = "path\to\certificate.pfx"
$env:CSC_KEY_PASSWORD = "your-certificate-password"
```

3. Run the build:

```bash
npm run build
```

electron-builder will automatically sign the executable during the build process.

### Self-Signing (Development Only)

For development and testing, you can create a self-signed certificate:

```powershell
New-SelfSignedCertificate -Type CodeSigning -Subject "CN=Limiterizz.PX Dev" -CertStoreLocation Cert:\CurrentUser\My
```

> **Note:** Self-signed certificates will still trigger SmartScreen warnings for other users. Use a proper code signing certificate for public releases.

---

## Troubleshooting

### `npm install` fails with native module errors

Some dependencies include native Node.js modules that need to be compiled for Electron's version of Node. If you encounter build errors:

```bash
npm install --force
```

Or rebuild native modules for Electron:

```bash
npx electron-rebuild
```

### Electron doesn't start

Ensure no other instance of the app is running (Limiterizz.PX enforces single instance). Check the task manager for stale `electron.exe` processes.

### Build produces unsigned warnings

This is expected without a code signing certificate. See the [Code Signing](#code-signing-optional) section above.

### `npm run build` fails on Windows

Make sure you're running PowerShell or Command Prompt as Administrator if the build needs elevated permissions for symlink creation.

---

## Project Structure

```
Limiterizz.PX/
├── src/
│   ├── main/              # Electron main process
│   │   ├── main.js        # App entry point
│   │   ├── preload.js     # Preload script (context bridge)
│   │   ├── modules/       # Feature modules
│   │   └── utils/         # Utility libraries
│   ├── renderer/          # Electron renderer process
│   │   ├── index.html     # Main window HTML
│   │   ├── styles/        # CSS stylesheets
│   │   └── scripts/       # Frontend JavaScript
│   └── assets/            # Static assets
│       ├── logo.png       # Application icon
│       ├── icons/         # UI icons
│       ├── overlays/      # Overlay images
│       └── fonts/         # Custom fonts
├── data/                  # Runtime data (gitignored)
├── docs/                  # Documentation
├── electron-builder.yml   # Build configuration
├── package.json           # Project manifest
└── README.md              # Project readme
```

