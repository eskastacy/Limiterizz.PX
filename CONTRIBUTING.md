# Contributing to Limiterizz.PX

Thank you for your interest in contributing to Limiterizz.PX! This guide will help you get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
- [Development Setup](#development-setup)
- [Branching Strategy](#branching-strategy)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [Reporting Issues](#reporting-issues)

---

## Code of Conduct

Be respectful, constructive, and inclusive. Harassment, discrimination, and personal attacks are not tolerated. Focus on the work, not the person.

---

## How to Contribute

1. **Fork** the repository
2. **Clone** your fork locally
3. **Create a branch** for your change
4. **Make your changes** with clear, focused commits
5. **Test** your changes thoroughly
6. **Push** to your fork
7. **Open a Pull Request** against `main`

---

## Development Setup

```bash
# Clone your fork
git clone https://github.com/<your-username>/Limiterizz.PX.git
cd Limiterizz.PX

# Install dependencies
npm install

# Run in development mode
npm start
```

See [docs/BUILDING.md](docs/BUILDING.md) for detailed build instructions.

---

## Branching Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Stable release branch |
| `dev` | Active development branch |
| `feature/<name>` | New features |
| `fix/<name>` | Bug fixes |
| `docs/<name>` | Documentation changes |

Always branch from `main` (or `dev` if it exists) and target your PR accordingly.

---

## Commit Guidelines

Use clear, descriptive commit messages following this format:

```
<type>: <short description>

<optional body with more detail>
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code restructuring, no behavior change |
| `test` | Adding or updating tests |
| `chore` | Build scripts, CI, tooling |

### Examples

```
feat: add selective restore for GPU settings
fix: handle missing XML config file gracefully
docs: update build instructions for Node 20
```

---

## Pull Request Process

1. **Fill out the PR template** — describe what changed and why
2. **Keep PRs focused** — one feature or fix per PR
3. **Ensure no regressions** — test the app manually on Windows
4. **Update documentation** if your change affects user-facing behavior
5. **Link related issues** in the PR description (e.g., `Closes #12`)

### PR Checklist

- [ ] Code follows the project's style guidelines
- [ ] Changes are tested on Windows 10 or 11
- [ ] No new warnings or errors in the console
- [ ] Documentation updated if applicable
- [ ] Commit messages follow the guidelines above

---

## Code Style

### General

- **Indentation:** 2 spaces (no tabs)
- **Quotes:** Single quotes for JavaScript strings
- **Semicolons:** Required
- **Line length:** 100 characters max (soft limit)
- **File encoding:** UTF-8
- **Line endings:** LF (Unix-style)

### JavaScript / Node.js

- Use `const` by default, `let` when reassignment is needed, never `var`
- Use `async`/`await` over raw Promises where possible
- Use template literals for string interpolation
- Destructure objects and arrays when it improves readability
- Add JSDoc comments for all exported functions

### File Organization

- One module per file
- Group imports: Node.js built-ins → third-party → local modules
- Keep functions short and focused (< 50 lines ideally)

### Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Files | kebab-case | `xml-config.js` |
| Variables | camelCase | `configPath` |
| Constants | UPPER_SNAKE_CASE | `MAX_FPS_VALUE` |
| Functions | camelCase | `detectRoblox()` |
| Classes | PascalCase | `ChangeJournal` |

---

## Reporting Issues

### Bug Reports

When reporting a bug, include:

1. **Description** — What happened?
2. **Steps to reproduce** — How can we trigger this?
3. **Expected behavior** — What should have happened?
4. **Actual behavior** — What happened instead?
5. **Environment** — Windows version, Roblox version, app version
6. **Logs** — Relevant content from `%APPDATA%/LimiterizzPX/logs/`
7. **Screenshots** — If applicable

### Feature Requests

When requesting a feature, include:

1. **Description** — What do you want?
2. **Use case** — Why is it useful?
3. **Alternatives** — Have you considered other approaches?

---

## Questions?

Open a [Discussion](../../discussions) or reach out to the maintainer.

Thank you for helping make Limiterizz.PX better! 🔓

