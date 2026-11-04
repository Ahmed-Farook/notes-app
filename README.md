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

## 🖥️ Running on Mac (Native Desktop App)

You can run and build the native macOS application with native traffic light controls, vibrancy, and menus:

```bash
# 1. Launch in development mode
npm run mac:dev

# 2. Or run directly from built assets
npm run mac:start

# 3. Package as a native macOS .app / .dmg bundle
npm run mac:build
```
The compiled macOS app is placed in `release/mac-arm64/Apple Notes.app`.

---

## 📱 Running on Android (Native Android App)

The app is integrated with **Capacitor** to deliver 60-120fps hardware-accelerated Android performance, haptic feedback, safe area insets, and keyboard auto-resizing:

```bash
# 1. Sync any web code updates into Android
npm run android:sync

# 2. Open the project in Android Studio
npm run android:open

# 3. Build debug APK directly with Gradle
npm run android:build
```

---

## ⚡ Performance & "Snappy" Optimizations
- **Non-blocking Persistence:** Notes auto-save is debounced (250ms), keeping keystrokes at 120 FPS without synchronous JSON serialization stutter.
- **Hardware-Accelerated Mobile Transitions:** Seamless single-pane sliding on mobile (< 768px) and 3-column layout on desktop.
- **Zero Touch Delay:** Uses `touch-action: manipulation` to eliminate the default 300ms mobile touch delay.
- **Native Haptics:** Tactile feedback on checklists, note selections, and folder switching via `@capacitor/haptics`.
- **macOS Native Window:** Vibrancy frosted glass effect, native traffic lights, and native macOS shortcuts (`Cmd+N`, `Cmd+F`).

