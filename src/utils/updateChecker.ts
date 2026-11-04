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
 * Checks GitHub Releases for the latest version.
 */
export async function checkForUpdates(overrideToken?: string): Promise<UpdateInfo> {
  const platform = getPlatform();
  const token = overrideToken ?? getStoredGithubToken();

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }

  const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
    headers,
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        token
          ? 'No releases found on GitHub.'
          : 'Repository is private or no releases found. Sign in with GitHub or set repository to Public.'
      );
    }
    if (response.status === 403) {
      throw new Error('GitHub API rate limit reached. Please try again later.');
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
      const apkAsset = data.assets.find((a: any) => a.name.endsWith('.apk'));
      if (apkAsset) {
        downloadUrl = apkAsset.browser_download_url;
        assetName = apkAsset.name;
      }
    } else if (platform === 'mac') {
      const dmgAsset = data.assets.find((a: any) => a.name.endsWith('.dmg'));
      if (dmgAsset) {
        downloadUrl = dmgAsset.browser_download_url;
        assetName = dmgAsset.name;
      }
    } else if (platform === 'windows') {
      const exeAsset = data.assets.find((a: any) => a.name.endsWith('.exe'));
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
}

