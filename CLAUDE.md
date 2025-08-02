# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Tauri v2 desktop application built with:
- **Frontend**: Preact + TypeScript + Vite
- **Backend**: Rust (Tauri)
- **Package Manager**: pnpm

## Common Commands

### Development
```bash
# Start development server (frontend + Tauri)
pnpm tauri dev

# Start frontend only
pnpm dev
```

### Build
```bash
# Build for production
pnpm tauri build

# Build frontend only
pnpm build
```

### Testing & Validation
```bash
# Type checking
pnpm tsc

# Preview production build
pnpm preview
```

## Architecture

### Project Structure
- `/src/` - Frontend code (Preact + TypeScript)
  - `main.tsx` - Application entry point
  - `App.tsx` - Main application component
- `/src-tauri/` - Backend code (Rust/Tauri)
  - `src/lib.rs` - Main Tauri application logic and commands
  - `src/main.rs` - Desktop application entry point
  - `tauri.conf.json` - Tauri configuration
  - `Cargo.toml` - Rust dependencies

### Frontend-Backend Communication
- Uses Tauri's IPC system via `@tauri-apps/api`
- Commands are defined in `src-tauri/src/lib.rs` with `#[tauri::command]`
- Frontend calls commands using `invoke()` from `@tauri-apps/api/core`
- Example: `greet` command in lib.rs is called from App.tsx

### Configuration
- Frontend dev server runs on port 1420 (configured in vite.config.ts)
- Tauri configuration in `src-tauri/tauri.conf.json`
- Build output goes to `/dist/` for frontend

## Interaction Notes

- Claude は日本語で話すことができます