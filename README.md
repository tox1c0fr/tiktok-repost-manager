# TikTok Repost Manager

An automated, client-side CLI utility designed to scan, index, and systematically remove reposted video entries from TikTok profiles.

---

## Overview

TikTok does not offer a native bulk-removal endpoint for reposted media on its desktop client. This tool connects through an authenticated browser session, performs an index pass across the user's repost history to calculate exact targets, and executes removals with safe, randomized rate-limiting intervals.

---

## Key Features

- **Pre-Execution Indexing**: Automatically scans the profile feed to discover and calculate the full count of active reposts before execution begins.
- **Selective DOM Targeting**: Interacts strictly with direct video resources (`a[href*="/video/"]`), completely isolating creator profile navigation.
- **Dynamic Feed Re-Buffering**: Automatically requests subsequent feed chunks and re-anchors to the target profile view when DOM nodes are depleted.
- **Clean In-Browser HUD**: Renders a minimalist, dark-themed control badge with real-time percentage indicators directly in the active browser window.
- **Enterprise-Grade Logging**: Emits clean, timestamped logs formatted to `[INFO]`, `[SUCCESS]`, `[REMOVED]`, `[WARN]`, and `[ERROR]` levels with a persistent log file (`repost-remover.log`).

---

## Prerequisites

- **Node.js**: v18.0.0 or higher
- **Microsoft Edge** or Chromium-based runtime

---

## Installation & Setup

1. Install project dependencies:
   ```bash
   npm install
   ```

2. Run the utility:
   ```bash
   npm start
   ```
   *(Or double-click `Run-TikTok-Remover.bat` on Windows).*

---

## Execution Workflow

1. The script launches an isolated browser instance and opens TikTok.
2. Authenticate your account manually if prompted (session data is saved locally in `.edge-profile`).
3. Navigate to your **Profile > Reposts** tab.
4. Press `[ENTER]` in the terminal or click **Scan & Remove** in the on-screen badge.
5. The tool scans your feed, calculates the total count, and processes removals sequentially.

---

## Configuration

Timing and parameters can be adjusted directly in `remover.js`:

```javascript
const CONFIG = {
  TIKTOK_URL: 'https://www.tiktok.com',
  ACTION_DELAY_MIN: 600,
  ACTION_DELAY_MAX: 1200,
  USER_DATA_DIR: path.join(__dirname, '.edge-profile'),
  LOG_FILE: path.join(__dirname, 'repost-remover.log'),
};
```

---

## License

MIT License. For educational and personal profile management purposes.
