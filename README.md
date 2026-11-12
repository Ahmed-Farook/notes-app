<p align="center">
  <img src="public/logo.svg" width="96" height="96" alt="texō logo" /><br>
  <sub>texō &nbsp; / &nbsp; macOS · Windows · Android · Web</sub>
</p>

<h1 align="center">texō<br>One less thing to keep in your head.</h1>

<p align="center">
  For thoughts to keep and things to get done.<br>
  Write offline. Save locally. Sign in to sync across devices.
</p>

<p align="center">
  <a href="https://github.com/Ahmed-Farook/notes-app/releases/latest"><strong>Download the app ↗</strong></a><br>
  <sub>macOS · Apple Silicon DMG &nbsp; / &nbsp; Windows · EXE &nbsp; / &nbsp; Android · APK</sub>
</p>

> [!TIP]
> **macOS Gatekeeper notice:** If macOS says *"texō is damaged and can't be opened"*, this is Apple's standard message for unnotarized open-source apps. Move the app to `/Applications` and run this in Terminal:
> ```bash
> xattr -cr "/Applications/texo.app"
> ```

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

<br>

## Code Signing Policy

Free code signing provided by [SignPath.io](https://signpath.io/), using a certificate by [SignPath Foundation](https://signpath.org/).

- **Committers & Reviewers:** [Ahmed Farook](https://github.com/Ahmed-Farook)
- **Approvers:** [Ahmed Farook](https://github.com/Ahmed-Farook)

## License

This project is open source and licensed under the [MIT License](LICENSE).


