# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Limiterizz.PX, please report it responsibly:

1. **Do not** open a public issue
2. Email the maintainer or use [GitHub Security Advisories](../../security/advisories/new) to file a private report
3. Include a clear description of the vulnerability and steps to reproduce it
4. Allow reasonable time for a fix before any public disclosure

We will acknowledge your report within 48 hours and aim to provide a fix or mitigation within 7 days.

---

## What Limiterizz.PX Does

Limiterizz.PX is an Electron application that modifies Roblox's **user-accessible XML configuration file** (`GlobalBasicSettings_13.xml`) to unlock the frame rate cap and apply performance optimizations to your system.

### The application:

- ✅ Reads and writes Roblox's XML settings file in `%LOCALAPPDATA%\Roblox`
- ✅ Creates automatic backups of original configuration before changes
- ✅ Maintains a change journal for full reversibility
- ✅ Applies Windows performance tweaks (power plan, visual effects, timer resolution)
- ✅ Runs entirely on your local machine

---

## What Limiterizz.PX Does NOT Do

### No Binary Modification

Limiterizz.PX **never** modifies any executable files, DLLs, or game binaries. It only modifies XML configuration files that Roblox itself reads on startup.

### No Anti-Cheat Bypass

The application does **not** interact with, circumvent, or disable Roblox's anti-cheat systems (Byfron/Hyperion or any other). It operates entirely outside the game process boundary.

### No Code Injection

Limiterizz.PX does **not** inject code, hooks, patches, or DLLs into any running process. It does not attach to or modify the memory of Roblox or any other application.

### No Credential Harvesting

The application does **not** access, collect, store, or transmit:
- Roblox account credentials
- Windows account credentials
- Browser cookies or tokens
- Any personal or authentication data

### No Network Communication

Limiterizz.PX operates **entirely offline**. It makes no HTTP requests, no telemetry calls, and no data transmissions of any kind. The only network-adjacent behavior is static hyperlinks in the UI that open your default browser when clicked (social media links for the developer).

### No Persistent Background Service

The application runs only when you open it. It does not install background services, scheduled tasks, startup entries, or any form of persistence beyond the application files themselves.

---

## Reversibility

All changes made by Limiterizz.PX are **fully reversible**:

- **Automatic backups** are created before every modification
- **Change journal** records every setting change with its original value
- **Selective restore** allows undoing individual categories
- **Full restore** reverts everything to the pre-modification state

If Limiterizz.PX is uninstalled, the backup files in `%APPDATA%/LimiterizzPX/` can still be used to manually restore the original Roblox configuration.

---

## Open Source Transparency

Limiterizz.PX is fully open source under the MIT License. Every line of code is available for inspection in this repository. We encourage security researchers and users to audit the source code.

---

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | ✅ Yes    |

---

## Scope

The following are **in scope** for security reports:

- Vulnerabilities in the application code
- Unintended file access or modification
- Privilege escalation through the application
- Data exposure or leakage

The following are **out of scope**:

- Roblox's own security policies or terms of service
- Issues requiring physical access to the machine
- Social engineering attacks
- Vulnerabilities in third-party dependencies (report these upstream, but let us know so we can update)
