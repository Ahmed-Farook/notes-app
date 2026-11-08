// Update Checker Utility for macOS, Android, and Web

export const CURRENT_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.0';
export const GITHUB_REPO = 'Ahmed-Farook/notes-app';

export type PlatformType = 'mac' | 'windows' | 'android' | 'web';

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  name: string;
  body: string;
  publishedAt: string;
  releaseUrl: string;
  downloadUrl: string;
  assetName?: string;
  platform: PlatformType;
  hasUpdate: boolean;
}

export function getPlatform(): PlatformType {
  if (typeof window === 'undefined') return 'web';

  // Check Capacitor Android
  const win = window as any;
  if (win.Capacitor?.isNativePlatform?.() || /Android/i.test(navigator.userAgent)) {
    return 'android';
  }

  // Check macOS Electron
  if (win.electronAPI?.isMac || (/Electron/i.test(navigator.userAgent) && /Mac/i.test(navigator.userAgent))) {
    return 'mac';
  }

  // Check Windows Electron
  if (win.electronAPI?.platform === 'win32' || (/Electron/i.test(navigator.userAgent) && /Win/i.test(navigator.userAgent))) {
    return 'windows';
  }

  return 'web';
}

/**
 * Compare two semver strings (e.g., "0.2.0" and "0.1.0").
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if equal
 */
export function compareVersions(v1: string, v2: string): number {
  const clean = (v: string) => v.replace(/^v/i, '').trim().split('-')[0];
  const parts1 = clean(v1).split('.').map(n => parseInt(n, 10) || 0);
  const parts2 = clean(v2).split('.').map(n => parseInt(n, 10) || 0);

  const len = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < len; i++) {
    const num1 = parts1[i] ?? 0;
    const num2 = parts2[i] ?? 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

export const GITHUB_TOKEN_STORAGE_KEY = 'apple_notes_github_pat';

export function getStoredGithubToken(): string | null {
  try {
    return localStorage.getItem(GITHUB_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredGithubToken(token: string | null) {
  try {
    if (token && token.trim()) {
      localStorage.setItem(GITHUB_TOKEN_STORAGE_KEY, token.trim());
    } else {
      localStorage.removeItem(GITHUB_TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

/**
 * Fallback to Fastly CDN raw package check when GitHub API rate limit (60 req/hr) is reached.
 */
async function checkViaRawFallback(platform: PlatformType): Promise<UpdateInfo> {
  const rawRes = await fetch(
    `https://raw.githubusercontent.com/${GITHUB_REPO}/main/package.json?t=${Date.now()}`,
    { cache: 'no-store' }
  );
  if (!rawRes.ok) {
    throw new Error('Unable to connect to GitHub. Please check your internet connection.');
  }
  const pkg = await rawRes.json();
  const latestVersion = (pkg.version || '0.0.0').replace(/^v/i, '');
  const hasUpdate = compareVersions(latestVersion, CURRENT_VERSION) > 0;

  let downloadUrl = `https://github.com/${GITHUB_REPO}/releases/tag/v${latestVersion}`;
  let assetName: string | undefined = undefined;

  if (platform === 'android') {
    assetName = `texo-${latestVersion}.apk`;
    downloadUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/releases/texo.apk`;
  } else if (platform === 'mac') {
    assetName = `texo-${latestVersion}-arm64.dmg`;
    downloadUrl = `https://github.com/${GITHUB_REPO}/releases/download/v${latestVersion}/${assetName}`;
  } else if (platform === 'windows') {
    assetName = `texo-Setup-${latestVersion}.exe`;
    downloadUrl = `https://github.com/${GITHUB_REPO}/releases/download/v${latestVersion}/${assetName}`;
  }

  return {
    currentVersion: CURRENT_VERSION,
    latestVersion,
    name: `texō v${latestVersion}`,
    body: `Version v${latestVersion} includes the latest performance enhancements, in-app updates, and zero-knowledge privacy features.`,
    publishedAt: new Date().toISOString(),
    releaseUrl: `https://github.com/${GITHUB_REPO}/releases/tag/v${latestVersion}`,
    downloadUrl,
    assetName,
    platform,
    hasUpdate,
  };
}

/**
 * Checks GitHub Releases for the latest version with automatic CDN fallback.
 */
export async function checkForUpdates(overrideToken?: string): Promise<UpdateInfo> {
  const platform = getPlatform();
  const token = overrideToken ?? getStoredGithubToken();

  // If running inside Electron, use Node's native HTTP updater via IPC (avoids all browser CORS & rate limit issues)
  const win = typeof window !== 'undefined' ? (window as any) : undefined;
  if (win?.electronAPI?.checkForUpdates) {
    try {
      const electronResult = await win.electronAPI.checkForUpdates(token || undefined);
      const hasUpdate = compareVersions(electronResult.latestVersion, CURRENT_VERSION) > 0;
      return {
        currentVersion: CURRENT_VERSION,
        latestVersion: electronResult.latestVersion,
        name: electronResult.name,
        body: electronResult.body,
        publishedAt: electronResult.publishedAt,
        releaseUrl: electronResult.releaseUrl,
        downloadUrl: electronResult.downloadUrl,
        assetName: electronResult.assetName,
        platform,
        hasUpdate,
      };
    } catch (ipcErr: any) {
      console.warn('Electron IPC update check failed, falling back to web fetch:', ipcErr);
    }
  }

  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
    };

    if (token) {
      headers.Authorization = `Bearer ${token.trim()}`;
    }

    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest?t=${Date.now()}`,
      {
        headers,
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      // If rate-limited (HTTP 403) or releases not ready (HTTP 404), fall back to raw CDN check
      if (response.status === 403 || response.status === 404) {
        return await checkViaRawFallback(platform);
      }
      throw new Error(`Failed to check updates (HTTP ${response.status})`);
    }

    const data = await response.json();
    const rawTag: string = data.tag_name || '0.0.0';
    const latestVersion = rawTag.replace(/^v/i, '');

    let downloadUrl = data.html_url;
    let assetName: string | undefined = undefined;

    if (Array.isArray(data.assets)) {
      if (platform === 'android') {
        const apkAsset = data.assets.find((a: any) => a.name.startsWith('texo') && a.name.endsWith('.apk'))
          || data.assets.find((a: any) => a.name.endsWith('.apk'));
        if (apkAsset) {
          assetName = apkAsset.name;
          // Use Fastly/raw CDN mirror URL to completely avoid regional GitHub Releases 504 timeouts
          downloadUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/releases/texo.apk`;
        }
      } else if (platform === 'mac') {
        const dmgAsset = data.assets.find((a: any) => a.name.startsWith('texo') && a.name.endsWith('.dmg'))
          || data.assets.find((a: any) => a.name.endsWith('.dmg'));
        if (dmgAsset) {
          downloadUrl = dmgAsset.browser_download_url;
          assetName = dmgAsset.name;
        }
      } else if (platform === 'windows') {
        const exeAsset = data.assets.find((a: any) => a.name.startsWith('texo') && a.name.endsWith('.exe'))
          || data.assets.find((a: any) => a.name.endsWith('.exe'));
        if (exeAsset) {
          downloadUrl = exeAsset.browser_download_url;
          assetName = exeAsset.name;
        }
      }
    }

    const hasUpdate = compareVersions(latestVersion, CURRENT_VERSION) > 0;

    return {
      currentVersion: CURRENT_VERSION,
      latestVersion,
      name: data.name || `Version ${latestVersion}`,
      body: data.body || '',
      publishedAt: data.published_at || '',
      releaseUrl: data.html_url,
      downloadUrl,
      assetName,
      platform,
      hasUpdate,
    };
  } catch (err: any) {
    // If rate-limited or network issue with api.github.com, fall back to Fastly raw CDN
    try {
      return await checkViaRawFallback(platform);
    } catch {
      throw err;
    }
  }
}

