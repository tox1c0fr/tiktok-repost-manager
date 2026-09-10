const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const chalk = require('chalk');
const ora = require('ora');
const boxen = require('boxen');
const Table = require('cli-table3');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

puppeteer.use(StealthPlugin());

const CONFIG = {
  TIKTOK_URL: 'https://www.tiktok.com',
  ACTION_DELAY_MIN: 600,
  ACTION_DELAY_MAX: 1200,
  USER_DATA_DIR: path.join(__dirname, '.edge-profile'),
  LOG_FILE: path.join(__dirname, 'repost-remover.log'),
};

class Logger {
  constructor(logFile) {
    this.logFile = logFile;
    this.startTime = Date.now();
    this.counts = { removed: 0, failed: 0, total: 0 };
    fs.writeFileSync(this.logFile, '');
    this._write('------------------------------------------------------------');
    this._write(`TikTok Repost Manager - Execution Log`);
    this._write(`Session Started: ${new Date().toISOString()}`);
    this._write('------------------------------------------------------------\n');
  }

  _write(msg) {
    fs.appendFileSync(this.logFile, `${msg}\n`);
  }

  _timestamp() {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const now = new Date().toTimeString().split(' ')[0];
    return `[${now}] [+${elapsed}s]`;
  }

  info(msg) {
    console.log(chalk.gray(this._timestamp()) + ' ' + chalk.cyan('[INFO]') + ' ' + chalk.white(msg));
    this._write(`${this._timestamp()} [INFO] ${msg}`);
  }

  success(msg) {
    console.log(chalk.gray(this._timestamp()) + ' ' + chalk.green('[SUCCESS]') + ' ' + chalk.white(msg));
    this._write(`${this._timestamp()} [SUCCESS] ${msg}`);
  }

  warn(msg) {
    console.log(chalk.gray(this._timestamp()) + ' ' + chalk.yellow('[WARN]') + ' ' + chalk.white(msg));
    this._write(`${this._timestamp()} [WARN] ${msg}`);
  }

  error(msg) {
    console.log(chalk.gray(this._timestamp()) + ' ' + chalk.red('[ERROR]') + ' ' + chalk.white(msg));
    this._write(`${this._timestamp()} [ERROR] ${msg}`);
  }

  removed(current, total) {
    this.counts.removed++;
    const pct = total > 0 ? Math.round((this.counts.removed / total) * 100) : 0;
    const countStr = `[${this.counts.removed}/${total}]`.padEnd(11);
    console.log(
      chalk.gray(this._timestamp()) + ' ' +
      chalk.green('[REMOVED]') + ' ' +
      chalk.cyan(countStr) + ' ' +
      chalk.yellow(`(${pct}%)`) + ' ' +
      chalk.white('Item processed successfully')
    );
    this._write(`${this._timestamp()} [REMOVED] [${this.counts.removed}/${total}] (${pct}%) Item processed successfully`);
  }

  failed(current, total, reason) {
    this.counts.failed++;
    console.log(
      chalk.gray(this._timestamp()) + ' ' +
      chalk.red('[FAILED]') + ' ' +
      chalk.red(`[${current}/${total}]`) + ' ' +
      chalk.gray(reason)
    );
    this._write(`${this._timestamp()} [FAILED] [${current}/${total}] ${reason}`);
  }

  summary() {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const table = new Table({
      head: [chalk.cyan('Metric'), chalk.cyan('Value')],
      style: { head: [], border: ['gray'] },
    });
    table.push(
      ['Total Detected', String(this.counts.total)],
      ['Successfully Removed', chalk.green(String(this.counts.removed))],
      ['Failed / Skipped', this.counts.failed > 0 ? chalk.red(String(this.counts.failed)) : '0'],
      ['Remaining', chalk.yellow(String(Math.max(0, this.counts.total - this.counts.removed)))],
      ['Execution Time', `${elapsed}s`],
    );

    this._write(`\n------------------------------------------------------------\nSUMMARY: Removed ${this.counts.removed}/${this.counts.total} items in ${elapsed}s\n------------------------------------------------------------\n`);
    console.log('\n' + table.toString() + '\n');
  }
}

const sleep = (ms) => new Promise(res => setTimeout(res, ms));
const randomDelay = () => sleep(Math.floor(Math.random() * (CONFIG.ACTION_DELAY_MAX - CONFIG.ACTION_DELAY_MIN)) + CONFIG.ACTION_DELAY_MIN);

function findEdgeBinary() {
  const paths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/microsoft-edge',
    '/usr/bin/microsoft-edge-stable',
  ];
  return paths.find(p => fs.existsSync(p)) || null;
}

async function main() {
  console.log(
    boxen(
      chalk.bold.white('TikTok Repost Manager') + '\n' +
      chalk.gray('Automated Profile Repost Cleaner - v1.2.0'),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'cyan',
        align: 'center',
      }
    )
  );

  const log = new Logger(CONFIG.LOG_FILE);

  const edgePath = findEdgeBinary();
  if (!edgePath) {
    log.error('Microsoft Edge binary not found. Ensure Edge is installed.');
    return;
  }

  const spinner = ora({
    text: chalk.gray('Initializing browser runtime...'),
    spinner: 'dots',
  }).start();

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: false,
      executablePath: edgePath,
      userDataDir: CONFIG.USER_DATA_DIR,
      defaultViewport: null,
      ignoreDefaultArgs: ['--enable-automation'],
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        '--start-maximized',
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });

    const pages = await browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0'
    );

    spinner.succeed(chalk.green('Browser runtime initialized'));

    log.info('Connecting to platform endpoint...');
    await page.goto(CONFIG.TIKTOK_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });

    console.log(
      boxen(
        chalk.bold.white('AUTHENTICATION & TARGET SPECIFICATION') + '\n\n' +
        chalk.gray('1. Ensure your account is authenticated in the browser window.\n') +
        chalk.gray('2. Navigate to your Profile and select the Reposts tab.\n') +
        chalk.gray('3. Confirm your repost list is rendered on screen.\n\n') +
        chalk.cyan('Press [ENTER] in this console or click [START] in the browser to proceed.'),
        {
          padding: 1,
          margin: 1,
          borderStyle: 'single',
          borderColor: 'gray',
        }
      )
    );

    await page.evaluate(() => {
      window.__repostRemoverReady = false;
      const old = document.getElementById('remover-overlay');
      if (old) old.remove();

      const panel = document.createElement('div');
      panel.id = 'remover-overlay';
      panel.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 9999999;
        background: #0f1115;
        color: #e6edf3;
        border: 1px solid #30363d;
        border-radius: 10px;
        padding: 18px 22px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        text-align: left;
        min-width: 280px;
        box-sizing: border-box;
      `;
      panel.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <span style="font-size: 14px; font-weight: 600; letter-spacing: 0.3px;">Repost Manager</span>
          <span id="remover-badge" style="font-size: 11px; background: #21262d; color: #8b949e; padding: 2px 8px; border-radius: 12px; font-weight: 500;">STANDBY</span>
        </div>
        <div style="font-size: 12px; color: #8b949e; margin-bottom: 14px;">
          Open your <b>Profile &gt; Reposts</b> tab to initialize.
        </div>
        <button id="remover-start-btn" style="
          background: #238636;
          color: #ffffff;
          border: 1px solid rgba(240,246,252,0.1);
          font-weight: 600;
          font-size: 13px;
          padding: 9px 16px;
          border-radius: 6px;
          cursor: pointer;
          width: 100%;
          transition: background 0.2s;
        ">Scan &amp; Remove</button>
      `;
      document.body.appendChild(panel);

      document.getElementById('remover-start-btn').onclick = () => {
        window.__repostRemoverReady = true;
        const btn = document.getElementById('remover-start-btn');
        btn.innerText = 'Scanning...';
        btn.style.background = '#1f6feb';
        const badge = document.getElementById('remover-badge');
        if (badge) {
          badge.innerText = 'ACTIVE';
          badge.style.color = '#58a6ff';
        }
      };
    }).catch(() => {});

    log.info('Awaiting user navigation to target profile tab...');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    let userReady = false;
    rl.question(chalk.gray('\n[Ready] Press ENTER when Reposts tab is open: \n'), () => {
      userReady = true;
    });

    while (!userReady) {
      try {
        const clicked = await page.evaluate(() => window.__repostRemoverReady);
        if (clicked) {
          userReady = true;
          break;
        }
      } catch (e) {}
      await sleep(1000);
    }
    rl.close();

    const targetProfileUrl = page.url();
    log.info(`Target scope established: ${targetProfileUrl}`);

    log.info('Running index pass across profile feed...');

    await page.evaluate(() => {
      const banner = document.getElementById('remover-overlay');
      if (banner) {
        banner.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 14px; font-weight: 600;">Scanning Index</span>
            <span style="font-size: 11px; background: #1f6feb; color: #fff; padding: 2px 8px; border-radius: 12px;">SCANNING</span>
          </div>
          <div id="remover-scan-stat" style="font-size: 22px; color: #58a6ff; font-weight: 700; margin: 10px 0 6px 0;">0 Detected</div>
          <div style="font-size: 11px; color: #8b949e;">Reading complete history feed...</div>
        `;
      }
    }).catch(() => {});

    const allVideoUrls = new Set();
    let prevFound = -1;
    let stableScrolls = 0;
    const maxScrolls = 80;
    let scrollIndex = 0;

    while (stableScrolls < 4 && scrollIndex < maxScrolls) {
      scrollIndex++;

      const currentUrls = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href*="/video/"]'))
          .map(a => a.href)
          .filter(h => h.includes('/video/'));
      });

      for (const u of currentUrls) {
        allVideoUrls.add(u);
      }

      await page.evaluate((cnt) => {
        const stat = document.getElementById('remover-scan-stat');
        if (stat) stat.innerText = `${cnt} Detected`;
      }, allVideoUrls.size).catch(() => {});

      if (allVideoUrls.size === prevFound) {
        stableScrolls++;
      } else {
        stableScrolls = 0;
        prevFound = allVideoUrls.size;
        log.info(`Index count: ${allVideoUrls.size} items discovered`);
      }

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await sleep(1200);
    }

    const totalReposts = allVideoUrls.size;
    log.counts.total = totalReposts;

    log.success(`Index pass complete. Total targets: ${totalReposts}`);

    if (totalReposts === 0) {
      log.info('No repost records identified in active view. Task completed.');
      log.summary();
      return;
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(1500);

    let consecutiveFailures = 0;
    let processed = 0;

    await page.evaluate((tot) => {
      const banner = document.getElementById('remover-overlay');
      if (banner) {
        banner.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 14px; font-weight: 600;">Processing</span>
            <span id="remover-badge" style="font-size: 11px; background: #238636; color: #fff; padding: 2px 8px; border-radius: 12px;">RUNNING</span>
          </div>
          <div id="remover-progress-text" style="font-size: 20px; color: #f0f6fc; font-weight: 700; margin: 6px 0;">0 / ${tot}</div>
          <div style="background: #21262d; border-radius: 4px; height: 6px; width: 100%; margin: 8px 0; overflow: hidden;">
            <div id="remover-progress-bar" style="background: #238636; height: 100%; width: 0%; transition: width 0.2s;"></div>
          </div>
          <div style="font-size: 11px; color: #8b949e;">High-throughput execution mode</div>
        `;
      }
    }, totalReposts).catch(() => {});

    while (log.counts.removed < totalReposts) {
      processed++;

      const currentUrl = page.url();
      if (!currentUrl.includes('/video/') && !currentUrl.startsWith(targetProfileUrl.split('?')[0])) {
        log.warn(`Navigation boundary exceeded (${currentUrl}). Re-anchoring...`);
        await page.goto(targetProfileUrl, { waitUntil: 'domcontentloaded' });
        await sleep(2500);
      }

      let visibleCount = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href*="/video/"]')).filter(a => {
          const rect = a.getBoundingClientRect();
          return rect.width > 50 && rect.height > 50;
        }).length;
      });

      if (visibleCount < 4) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await sleep(2000);

        visibleCount = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('a[href*="/video/"]')).filter(a => {
            const rect = a.getBoundingClientRect();
            return rect.width > 50 && rect.height > 50;
          }).length;
        });
      }

      if (visibleCount === 0) {
        log.info('Buffer depleted. Refreshing target view...');
        await page.goto(targetProfileUrl, { waitUntil: 'domcontentloaded' });
        await sleep(3500);

        visibleCount = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('a[href*="/video/"]')).filter(a => {
            const rect = a.getBoundingClientRect();
            return rect.width > 50 && rect.height > 50;
          }).length;
        });

        if (visibleCount === 0) {
          log.success('Feed exhausted. All items have been processed.');
          break;
        }
      }

      if (consecutiveFailures >= 10) {
        log.warn('Threshold reached for unhandled exceptions. Halting to maintain session integrity.');
        break;
      }

      const clicked = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a[href*="/video/"]')).filter(a => {
          const rect = a.getBoundingClientRect();
          return rect.width > 50 && rect.height > 50;
        });
        if (links.length > 0) {
          links[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
          links[0].click();
          return true;
        }
        return false;
      });

      if (!clicked) {
        await sleep(1500);
        continue;
      }

      await sleep(1000);

      let removedSuccess = false;

      try {
        const shareSelectors = [
          '[data-e2e="browse-share-icon"]',
          '[data-e2e="share-icon"]',
          'button[aria-label*="share" i]',
          'button[aria-label*="Share" i]',
        ];

        let hovered = false;
        for (const sel of shareSelectors) {
          const btn = await page.$(sel);
          if (btn) {
            await btn.hover();
            hovered = true;
            break;
          }
        }

        await sleep(350);

        removedSuccess = await page.evaluate(() => {
          const allEls = Array.from(document.querySelectorAll('*'));
          for (const el of allEls) {
            const txt = (el.textContent || '').trim().toLowerCase();
            const aria = (el.getAttribute('aria-label') || '').toLowerCase();
            if ((txt === 'remove repost' || txt === 'undo repost' || txt === 'delete repost' ||
                 aria === 'remove repost' || aria === 'undo repost') && el.children.length <= 2) {
              el.click();
              return true;
            }
          }
          return false;
        });

        if (!removedSuccess && hovered) {
          for (const sel of shareSelectors) {
            const btn = await page.$(sel);
            if (btn) {
              await btn.click();
              await sleep(350);
              break;
            }
          }

          removedSuccess = await page.evaluate(() => {
            const allEls = Array.from(document.querySelectorAll('*'));
            for (const el of allEls) {
              const txt = (el.textContent || '').trim().toLowerCase();
              const aria = (el.getAttribute('aria-label') || '').toLowerCase();
              if ((txt === 'remove repost' || txt === 'undo repost' || txt === 'delete repost' ||
                   aria === 'remove repost' || aria === 'undo repost') && el.children.length <= 2) {
                el.click();
                return true;
              }
            }
            return false;
          });
        }
      } catch (e) {}

      if (!removedSuccess) {
        try {
          removedSuccess = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
            for (const btn of buttons) {
              const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
              const dataE2e = (btn.getAttribute('data-e2e') || '').toLowerCase();
              if ((aria.includes('repost') && !aria.includes('share')) || dataE2e.includes('repost')) {
                btn.click();
                return true;
              }
            }
            return false;
          });
        } catch (e) {}
      }

      await sleep(350);
      try {
        const closed = await page.evaluate(() => {
          const closeBtn = document.querySelector('[data-e2e="browse-close"], button[aria-label="Close"]');
          if (closeBtn) {
            closeBtn.click();
            return true;
          }
          return false;
        });
        if (!closed) {
          await page.keyboard.press('Escape');
          await sleep(200);
          await page.keyboard.press('Escape');
        }
      } catch (e) {}

      if (removedSuccess) {
        consecutiveFailures = 0;
        log.removed(log.counts.removed + 1, totalReposts);

        await page.evaluate((rem, tot) => {
          const text = document.getElementById('remover-progress-text');
          const bar = document.getElementById('remover-progress-bar');
          if (text) text.innerText = `${rem} / ${tot}`;
          if (bar) bar.style.width = `${Math.min(100, Math.round((rem / tot) * 100))}%`;
        }, log.counts.removed, totalReposts).catch(() => {});

        await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a[href*="/video/"]')).filter(a => {
            const rect = a.getBoundingClientRect();
            return rect.width > 50 && rect.height > 50;
          });
          if (links.length > 0) {
            const card = links[0].closest('[data-e2e="user-post-item"]') ||
                         links[0].closest('div[class*="-DivItemContainer"]') ||
                         links[0];
            card.remove();
          }
        }).catch(() => {});
      } else {
        consecutiveFailures++;
        log.failed(processed, totalReposts, 'Unrecognized element schema');

        await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a[href*="/video/"]')).filter(a => {
            const rect = a.getBoundingClientRect();
            return rect.width > 50 && rect.height > 50;
          });
          if (links.length > 0) {
            const card = links[0].closest('[data-e2e="user-post-item"]') ||
                         links[0].closest('div[class*="-DivItemContainer"]') ||
                         links[0];
            card.remove();
          }
        }).catch(() => {});
      }

      await randomDelay();
    }

    await page.evaluate(() => {
      const badge = document.getElementById('remover-badge');
      if (badge) {
        badge.innerText = 'COMPLETE';
        badge.style.background = '#238636';
      }
    }).catch(() => {});

    log.summary();
    log.success('Execution lifecycle complete.');

  } catch (err) {
    log.error(`Process failure: ${err.message}`);
    log.summary();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
