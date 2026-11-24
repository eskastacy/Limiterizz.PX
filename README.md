# Limiterizz.PX

### Roblox FPS Unlocker & Hard Performance Optimizer

Unlock Roblox frame rate to 9999 FPS and optimize system latency with one click.

---

## Features

- **One-Click FPS Unlock**: Set Roblox frame rate cap to 9999 FPS instantly
- **CPU Optimization**: Adjust process priority and thread quantum in IFEO without Realtime hazards
- **GPU Optimization**: Discrete GPU preference enforcement for dedicated graphics cards
- **RAM Optimization**: Working set page priority tuning to prevent premature paging
- **Windows Optimization**: System-level power scheme, Game Mode, and GameDVR overhead removal
- **Automatic Backup**: Pristine initial configuration saved to `original_backup.xml`
- **Change Journal**: Persistent audit log recording every key, original value, and status
- **Selective Restore**: Revert modifications by category independently
- **Full Restore**: Single action restoration to pristine default state
- **Configuration Validation**: Pre-write and post-write XML schema integrity verification
- **Roblox Detection**: Auto-detects Roblox player installations across Windows user accounts
- **Cybersigilism UI**: Holy Tuff Black Chrome aesthetic with developer profile integration

---

## Installation & Download

### Ready-to-Use Executable
Pre-compiled binaries with Authenticode digital signatures are available in the `dist/` directory:
- **Portable Version**: `dist/Limiterizz.PX-Portable-1.0.0.exe` (no installation required)
- **Installer Version**: `dist/Limiterizz.PX Setup 1.0.0.exe` (NSIS installer)

### Building from Source

```bash
# 1. Clone repository
git clone https://github.com/EskaProject-X/Limiterizz.PX.git
cd Limiterizz.PX

# 2. Install dependencies
npm install

# 3. Launch development mode
npm start

# 4. Compile production executables
npm run build
```

---

## How the FPS Unlocker Works

Limiterizz.PX targets Roblox's official client configuration file:

`%LOCALAPPDATA%\Roblox\GlobalBasicSettings_13.xml`

Inside this file, Roblox stores user preferences under `<Item class="UserGameSettings">` in `<Properties>`. The frame rate limiter is governed by:

```xml
<int name="FramerateCap">9999</int>
```

### Safety and Validation Pipeline
1. **Detection**: Automatically identifies the user's `%LOCALAPPDATA%\Roblox` directory.
2. **Process Inspection**: Checks whether `RobloxPlayerBeta.exe` is currently running.
3. **Pristine Backup**: On initial run, creates an immutable copy at `%APPDATA%\LimiterizzPX\backups\original_backup.xml`.
4. **Snapshot Backup**: Creates a timestamped backup before each modification.
5. **Atomic Write**: Generates a temporary `.limiterizz.tmp` file, parses and verifies XML integrity, then atomically replaces the destination.
6. **Journal Recording**: Records the change in `%APPDATA%\LimiterizzPX\change-journal.json`.

---

## Performance Optimizations

| Category | Optimization | Technical Mechanism | Reversibility |
|----------|-------------|---------------------|---------------|
| **CPU** | Process Priority High | Sets `CpuPriorityClass = 3` in IFEO PerfOptions | Restores original value |
| **CPU** | I/O & Throttling Prevention | Sets `IoPriority = 3` to prevent disk throttling | Restores original value |
| **GPU** | Discrete GPU Preference | Sets `GpuPreference = 2;` in DirectX UserGpuPreferences | Removes or restores key |
| **RAM** | Memory Page Priority | Sets `PagePriority = 5` for Roblox memory working set | Restores original value |
| **Windows** | High Performance Power Plan | Activates High Performance Scheme (`8c5e7fda...`) | Restores original GUID |
| **Windows** | Windows Game Mode | Sets `AutoGameModeEnabled = 1` in GameBar registry | Restores original value |
| **Windows** | GameDVR Overhead Removal | Sets `AppCaptureEnabled = 0` in GameDVR registry | Restores original value |

*Limiterizz.PX never disables Windows Defender, Windows Firewall, or Windows Update.*

---

## Backup & Restore Architecture

### Pristine Original Backup
The first time Limiterizz.PX runs, it preserves the original unedited `GlobalBasicSettings_13.xml` as `original_backup.xml`. This file is strictly write-protected and is never overwritten.

### Change Journal
All modifications are logged in `%APPDATA%\LimiterizzPX\change-journal.json` with:
- Modification ID
- ISO-8601 Timestamp
- Category (`fps`, `cpu`, `gpu`, `ram`, `windows`)
- Key / Path
- Original Value
- Modified Value
- Status (`applied`, `restored`, `failed`)
- Restore Status (`pending`, `restored`)

### Restore Modes
- **Selective Restore**: Roll back changes in one category without affecting others.
- **Restore Everything**: Reverts all XML changes and system settings to their exact pre-modification state.

---

## System Requirements

- **OS**: Windows 10 or Windows 11 (64-bit)
- **Roblox**: Roblox Player installed
- **Memory**: 4 GB RAM minimum
- **Disk Space**: ~250 MB for build and executables

---

## SHA-256 Integrity Verification

Verify the integrity of downloaded binaries using PowerShell:

```powershell
Get-FileHash .\dist\Limiterizz.PX-Portable-1.0.0.exe -Algorithm SHA256
```

Compare with the official checksums published in `SHA256SUMS.txt`:

```text
4eeccd7c1ac21cce798b07a3a96c460fbb8d952a2b3e8f4d69ca5c1378d6c373  Limiterizz.PX Setup 1.0.0.exe
9c87a990ce43d1768c62e5656f6c2808be26415e61a71955647e8d8a7bfd07b1  Limiterizz.PX-Portable-1.0.0.exe
```

---

## Security & Transparency

Limiterizz.PX is built for transparency:
- **No binary manipulation**: Does not patch or alter `RobloxPlayerBeta.exe` binary.
- **No anti-cheat hooks**: Operates completely outside Roblox's memory space and Hyperion anti-cheat.
- **Offline operation**: Does not transmit credentials or telemetric data.
- **Authenticode Signed**: Signed with a 5-year digital certificate under `EskaProject-X`.

---

## Developer Profile

- **Developer**: Eska Stacy
- **Brand**: EskaProject-X
- **Handle**: @jar.ajhi_

### Official Links
- [Linktree](https://linktr.ee/eskastacy_)
- [WhatsApp Channel](https://whatsapp.com/channel/0029VbAowqoC1Fu3uTLcRe1n)
- [TikTok](https://www.tiktok.com/@jarachyy_?_r=1&_t=ZS-99b76hsvJha)
- [Discord](https://discord.gg/eZSNxNghu)
- [Instagram](https://www.instagram.com/jar.ajhi_)

---

## License

This project is licensed under the [MIT License](LICENSE).
