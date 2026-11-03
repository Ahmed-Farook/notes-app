# Cross-Platform Notes App (Apple Notes Inspired) 📝

A lightweight, modern, cross-platform notes application inspired by Apple Notes. Built to run seamlessly on macOS, Windows, Linux, and the Web.

---

## ✨ Features

- **Apple Notes 3-Pane Layout:**
  - **Sidebar:** Folders (`All Notes`, `Quick Notes`, `Notes`, `Recently Deleted`), custom folders, note count badges, and sidebar collapse toggle.
  - **Notes List:** Real-time search, pinned notes section, preview snippets, modification timestamps, list view & gallery grid view.
  - **Rich Text Editor:** TipTap ProseMirror engine with Apple-style warm yellow accents.
- **Rich Text Formatting:**
  - Headings (Title H1, Heading H2, Subheading H3)
  - Interactive checklists (circular checkboxes with strikethrough animation)
  - Bold, Italic, Underline, Strikethrough, and Highlighter
  - Bulleted and numbered lists
  - Blockquotes, Code blocks, and Horizontal dividers
- **Smart Title & Snippet Detection:**
  - Automatically derives the note title from the first line of content and snippet preview from the following lines.
- **Offline & Local-First:**
  - Instant auto-save to local storage with zero latency and full offline support.
- **Exporting:**
  - Export individual notes as Markdown (`.md`), Plain Text (`.txt`), or HTML (`.html`).
- **Dark & Light Mode:**
  - Follows system preference with manual toggle in the top bar.

---

## 🚀 Getting Started

### 1. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 2. Build for Production (Web / PWA)
```bash
npm run build
```

---

## 🖥️ Cross-Platform Packaging Roadmap

To distribute as native desktop applications:
1. **Tauri (Recommended):** Ultra-lightweight (~10MB binary, uses system webview, Rust backend).
   ```bash
   npx @tauri-apps/cli init
   npx @tauri-apps/cli dev
   ```
2. **Electron:** Full Chromium bundle (.dmg for macOS, .exe for Windows, .AppImage/.deb for Linux).
   ```bash
   npm install --save-dev electron electron-builder
   ```
3. **Cloud Sync:** Optional backend sync using Supabase, Firebase, or WebDAV for multi-device sync.
