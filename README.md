<p align="center">
  <sub>NOTES &nbsp; / &nbsp; macOS · Windows · Android · Web</sub>
</p>

<h1 align="center">One less thing<br>to keep in your head.</h1>

<p align="center">
  Inspired by Apple Notes. For thoughts to keep and things to get done.<br>
  Write offline. Save locally. Sign in to sync across devices.
</p>

<p align="center">
  <a href="https://github.com/Ahmed-Farook/notes-app/releases/latest"><strong>Download the app ↗</strong></a><br>
  <sub>macOS · Apple Silicon DMG &nbsp; / &nbsp; Windows · EXE &nbsp; / &nbsp; Android · APK</sub>
</p>

> [!NOTE]
> **First-Time Installation Notices (Open Source Releases):**
> - **Windows:** If SmartScreen shows *"Windows protected your PC"*, click **"More info"** → **"Run anyway"**.
> - **macOS:** If Gatekeeper says *"Apple Notes is damaged and can't be opened"*, move the app to `/Applications` and run:
>   ```bash
>   xattr -cr "/Applications/Apple Notes.app"
>   ```
> - **Android:** Enable *"Install from unknown sources"* if prompted by your browser, or tap *"More details"* → *"Install anyway"* if Play Protect warns about direct APK downloads.

<br>

**Write it down.**  
Rich text · checklists · code blocks · highlights

**Find it again.**  
Folders · pins · search · list or gallery

**Pick up anywhere.**  
Local autosave · offline editing · real-time sync

<p align="center">
  Light or dark. Desktop or pocket.<br>
  Export your notes as Markdown, plain text, or HTML.
</p>

<br>

<details>
<summary><strong>Under the cover — run & build</strong></summary>

<br>

From the project directory:

```bash
npm install
npm run dev
```

Open [localhost:5173](http://localhost:5173).

<details>
<summary>Web</summary>

```bash
npm run build
```

</details>

<details>
<summary>macOS</summary>

```bash
npm run mac:dev    # Development
npm run mac:build  # Package a DMG
```

</details>

<details>
<summary>Windows</summary>

```bash
npm run win:build
```

</details>

<details>
<summary>Android</summary>

```bash
npm run android:sync
npm run android:open   # Open in Android Studio
npm run android:build  # Build a debug APK
```

</details>

Desktop packages are written to `release/`.

**Inside:** TipTap for editing · Supabase for authentication and sync · Capacitor for Android.

</details>

