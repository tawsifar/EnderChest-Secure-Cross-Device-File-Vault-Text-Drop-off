# EnderChest Version 1.1 Snapshot Record

**Version**: 1.1 Stable (Golden Baseline)
**Date**: August 14, 2026

---

## 🎯 Version 1.1 Core Specifications & Features
1. **Zero-Login Drop-off Architecture**:
   - Rooms accessed purely via room runes/codes (e.g. SHA-256 room hashes).
   - Dynamic session tokens signed server-side for stateless auth.
2. **Seamless Multi-Device Storage & Transfers**:
   - Master central vault backend integration with automatic token refreshing.
   - Server-side memory buffer caching for instant cross-device downloads.
   - Public reader permissions applied automatically to uploaded files.
   - Direct download streaming (`/api/drive/download/:fileId`) with HTTP status retry handling.
3. **Robust Real-Time Slate & Inventory**:
   - Live collaborative text slate with dirty-state debounce syncing.
   - Complete inventory file lists fetched on room entry and periodic sync.
   - Defensive rendering guards and React `ErrorBoundary` preventing blank screens or unhandled exceptions.
4. **No Third-Party UI Prompts**:
   - All legacy connection prompts, dialogs, and redirects removed from user screens.
   - Full dark Minecraft-themed obsidian & teal UI.

---

## 📌 Rollback Instructions
If any subsequent versions introduce regressions or unwanted changes:
- Simply request: *"Roll back to version 1.1"* or *"Shift back to v1.1"*.
- All file manifests, components, and backend endpoints are pinned to this baseline state.
