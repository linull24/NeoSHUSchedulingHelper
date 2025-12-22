import { JSEncrypt } from 'jsencrypt';
import { isJwxtLocalLoginUrl, looksLikeJwxtLocalLoginHtml, parseSelectOptions } from '../../../shared/jwxtCrawler/html';
import {
	parseSelectionIndexHtml,
	buildSelectionDisplayPayload,
	mergeSelectionDisplayHtml,
	finalizeSelectionContext,
	parseSelectionPageFields,
	extractRoundMetaFromHtml
} from '../../../shared/jwxtCrawler/selection';
import { mapWithConcurrency } from '../../../shared/jwxtCrawler/task';
import { TaskManager, type TaskStartRequest } from '../../../shared/jwxtCrawler/taskManager';
import { isRetryableError, stringifyError } from '../../../shared/jwxtCrawler/errors';
import { deriveTermCode, termMatches } from '../../../shared/jwxtCrawler/term';
import { ASSUME_ELIGIBLE_FOR_NOW } from '../../../shared/jwxtCrawler/eligibility';
import type { JwxtUserProfileSignals } from '../../../shared/jwxtCrawler/eligibility';
import { deriveRoundPolicy } from '../../../shared/jwxtCrawler/roundPolicy';
import { deriveUserBatchState } from '../../../shared/jwxtCrawler/batchPolicy';
import {
  buildDropPayloadTuikBcZzxkYzb,
  buildEnrollPayload,
  parseDropTuikBcResult,
  parseEnrollResult
} from '../../../shared/jwxtCrawler/enroll';
import {
  buildEnrollmentBreakdownPayload,
  parseEnrollmentBreakdownHtml
} from '../../../shared/jwxtCrawler/enrollmentBreakdown';
import { buildLimitations, normalizeText, parseTeacher, pickFirst, stringify } from '../../../shared/jwxtCrawler/snapshot';
import { JWXT_USERSCRIPT_MARKER_DATASET_KEY } from '../../../shared/jwxtCrawler/userscriptMarker';

declare const __USERSCRIPT_VERSION__: string;
declare const __USERSCRIPT_CONFIG__: {
  roundsConcurrency?: number;
  snapshotConcurrency?: number;
  selectableIncludeBreakdown?: boolean;
};

(function () {
  // In userscript environments, GM_* APIs live on the sandbox global (globalThis),
  // while we want to expose the bridge onto the page global.
  //
  // NOTE:
  // - Some userscript managers (or settings) do NOT expose `unsafeWindow`.
  // - In that case, we must inject a page-context bridge via `postMessage`,
  //   otherwise the web app cannot access `window.__jwxtUserscriptBackend`.
  const sandboxAny: any = globalThis as any;
  const unsafeWindowAny: any = typeof sandboxAny.unsafeWindow !== 'undefined' ? sandboxAny.unsafeWindow : null;
  const pageAny: any = unsafeWindowAny ?? globalThis;

  // Marker for the web app (page context) to know a JWXT userscript is installed.
  // This uses DOM state (dataset) so it works even when `unsafeWindow` is unavailable
  // and CSP blocks inline <script> injection.
  try {
    (document.documentElement as any).dataset[JWXT_USERSCRIPT_MARKER_DATASET_KEY] =
      typeof __USERSCRIPT_VERSION__ === 'string' && __USERSCRIPT_VERSION__ ? __USERSCRIPT_VERSION__ : '1';
  } catch {
    // ignore
  }

  const PAGE_BRIDGE_CHANNEL = 'shuosc-jwxt-userscript-bridge-v1';
  const PAGE_BRIDGE_METHODS = [
    'debugLocal',
    'login',
    'status',
    'ping',
    'rounds',
    'selectRound',
    'search',
    'syncSelected',
    'enroll',
    'drop',
    'crawlSnapshot',
    'push',
    'checkSelectable',
    'getEnrollmentBreakdown',
    'getUserProfileSignals',
    'getRoundPolicy',
    'taskStart',
    'taskStop',
    'taskUpdate',
    'taskGet',
    'taskList',
    'logout'
  ] as const;

  function installBackendToPage(backend: any) {
    if (unsafeWindowAny) {
      unsafeWindowAny.__jwxtUserscriptBackend = backend;
      return;
    }

    try {
      // 1) Content-script side: handle page -> userscript calls.
      window.addEventListener('message', (event) => {
        try {
          if (event.source !== window) return;
          const msg: any = event.data;
          if (!msg || msg.__channel !== PAGE_BRIDGE_CHANNEL || msg.type !== 'call') return;
          const id = String(msg.id || '');
          const method = String(msg.method || '');
          if (!id || !method) return;
          if (!PAGE_BRIDGE_METHODS.includes(method as any)) {
            window.postMessage(
              { __channel: PAGE_BRIDGE_CHANNEL, type: 'resp', id, ok: false, error: 'METHOD_NOT_ALLOWED' },
              '*'
            );
            return;
          }
          const fn = backend?.[method];
          if (typeof fn !== 'function') {
            window.postMessage(
              { __channel: PAGE_BRIDGE_CHANNEL, type: 'resp', id, ok: false, error: 'METHOD_UNSUPPORTED' },
              '*'
            );
            return;
          }
          Promise.resolve()
            .then(() => fn(...(Array.isArray(msg.args) ? msg.args : [])))
            .then((result) => {
              window.postMessage({ __channel: PAGE_BRIDGE_CHANNEL, type: 'resp', id, ok: true, result }, '*');
            })
            .catch((error) => {
              const message = error instanceof Error ? error.message : String(error);
              window.postMessage({ __channel: PAGE_BRIDGE_CHANNEL, type: 'resp', id, ok: false, error: message }, '*');
            });
        } catch {
          // ignore
        }
      });

      // 2) Page-context side: inject a thin bridge onto `window.__jwxtUserscriptBackend`.
      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.textContent = `
(() => {
  const CHANNEL = ${JSON.stringify(PAGE_BRIDGE_CHANNEL)};
  const METHODS = ${JSON.stringify(PAGE_BRIDGE_METHODS)};
  const pending = new Map();
  window.addEventListener('message', (event) => {
    const msg = event && event.data;
    if (!msg || msg.__channel !== CHANNEL || msg.type !== 'resp') return;
    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);
    if (msg.ok) entry.resolve(msg.result);
    else entry.reject(new Error(String(msg.error || 'FAILED')));
  });
  window.addEventListener('message', (event) => {
    const msg = event && event.data;
    if (!msg || msg.__channel !== CHANNEL || msg.type !== 'log') return;
    const level = String(msg.level || 'info');
    const text = String(msg.message || '');
    const meta = msg.meta;
    const tag = '[JWXT Userscript]';
    try {
      const fn =
        level === 'error' ? console.error :
        level === 'warn' ? console.warn :
        level === 'debug' ? (console.debug || console.log) :
        (console.info || console.log);
      if (meta && typeof meta === 'object') fn(tag, text, meta);
      else fn(tag, text);
    } catch {
      // ignore
    }
  });
  function call(method, args) {
    const id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      window.postMessage({ __channel: CHANNEL, type: 'call', id, method, args }, '*');
      setTimeout(() => {
        if (!pending.has(id)) return;
        pending.delete(id);
        reject(new Error('USERSCRIPT_RPC_TIMEOUT'));
      }, 60000);
    });
  }
  const api = {};
  for (const m of METHODS) api[m] = (...args) => call(m, args);
  window.__jwxtUserscriptBackend = api;
  window.__jwxtUserscriptBridgeMode = 'postMessage';
})();
      `.trim();
      (document.documentElement || document.head || document.body).appendChild(script);
      script.remove();
    } catch {
      // ignore
    }
  }

  const cfg = {
    jwxtHost: 'https://jwxt.shu.edu.cn',
    ssoHost: 'https://newsso.shu.edu.cn',
    // Important: must use HTTP entry to reliably trigger `newsso.shu.edu.cn` redirects.
    ssoEntryUrl: 'http://jwxt.shu.edu.cn/sso/shulogin',
    selectionIndexUrl: 'https://jwxt.shu.edu.cn/jwglxt/xsxk/zzxkyzb_cxZzxkYzbIndex.html?gnmkdm=N253512',
    selectionDisplayUrl: 'https://jwxt.shu.edu.cn/jwglxt/xsxk/zzxkyzb_cxZzxkYzbDisplay.html?gnmkdm=N253512',
    courseListUrl: 'https://jwxt.shu.edu.cn/jwglxt/xsxk/zzxkyzb_cxZzxkYzbPartDisplay.html?gnmkdm=N253512',
    selectedCoursesUrl: 'https://jwxt.shu.edu.cn/jwglxt/xsxk/zzxkyzb_cxZzxkYzbChoosedDisplay.html?gnmkdm=N253512',
    enrollUrl: 'https://jwxt.shu.edu.cn/jwglxt/xsxk/zzxkyzbjk_xkBcZyZzxkYzb.html',
    // Ref: `zzxkYzbChoosedZy.js` uses `/xsxk/zzxkyzb_tuikBcZzxkYzb.html` for normal drop.
    dropBcUrl: 'https://jwxt.shu.edu.cn/jwglxt/xsxk/zzxkyzb_tuikBcZzxkYzb.html',
    // Keep legacy drop endpoint as a fallback.
    dropUrl: 'https://jwxt.shu.edu.cn/jwglxt/xsxk/zzxkyzbjk_tuikb.html',
    // Ref: `zzxkYzb.js` -> `ckjxbrsxx(kch_id,jxb_id)` opens this "已选人数明细" dialog.
    enrollmentBreakdownUrl: 'https://jwxt.shu.edu.cn/jwglxt/xkgl/common_cxJxbrsmxIndex.html?gnmkdm=N253512',
    warmupUrl: () => `https://jwxt.shu.edu.cn/jwglxt/xtgl/index_initMenu.html?jsdm=xs&_t=${Date.now()}`
  } as const;

  const state: any = {
    account: null,
    fields: null,
    context: null,
    contextValidatedAtMs: 0,
    roundTabs: null,
    activeXkkzId: null,
    currentXkkzId: null,
    preferredXkkzId: null,
    courseBaseCache: null,
    courseBaseCachePromise: null
  };

  const USERSCRIPT_USERID_KEY = 'jwxt.userscript.userId.v1';
  const USERSCRIPT_LOGGEDIN_AT_KEY = 'jwxt.userscript.loggedInAt.v1';

  function getGmStorage() {
    const GMobj = sandboxAny.GM;
    const asyncGet = typeof GMobj?.getValue === 'function' ? GMobj.getValue.bind(GMobj) : null;
    const asyncSet = typeof GMobj?.setValue === 'function' ? GMobj.setValue.bind(GMobj) : null;
    const asyncDel = typeof GMobj?.deleteValue === 'function' ? GMobj.deleteValue.bind(GMobj) : null;
    const syncGet = typeof sandboxAny.GM_getValue === 'function' ? sandboxAny.GM_getValue : null;
    const syncSet = typeof sandboxAny.GM_setValue === 'function' ? sandboxAny.GM_setValue : null;
    const syncDel = typeof sandboxAny.GM_deleteValue === 'function' ? sandboxAny.GM_deleteValue : null;
    return { asyncGet, asyncSet, asyncDel, syncGet, syncSet, syncDel };
  }

  async function gmReadValue(key: string): Promise<string> {
    try {
      const storage = getGmStorage();
      if (storage.asyncGet) return String((await storage.asyncGet(key, '')) || '');
      if (storage.syncGet) return String(storage.syncGet(key, '') || '');
    } catch {
      // ignore
    }
    return '';
  }

  async function gmWriteValue(key: string, value: string): Promise<void> {
    try {
      const storage = getGmStorage();
      if (storage.asyncSet) {
        await storage.asyncSet(key, value);
        return;
      }
      if (storage.syncSet) {
        storage.syncSet(key, value);
        return;
      }
    } catch {
      // ignore
    }
  }

  async function gmDeleteValue(key: string): Promise<void> {
    try {
      const storage = getGmStorage();
      if (storage.asyncDel) {
        await storage.asyncDel(key);
        return;
      }
      if (storage.syncDel) {
        storage.syncDel(key);
        return;
      }
    } catch {
      // ignore
    }
  }

  const isBackendPage = (() => {
    try {
      const origin = new URL(pageAny.location.href).origin;
      return origin === cfg.jwxtHost || origin === cfg.ssoHost;
    } catch {
      return false;
    }
  })();

  const debug: any = {
    version: typeof __USERSCRIPT_VERSION__ === 'string' ? __USERSCRIPT_VERSION__ : 'dev',
    isBackendPage,
    origin: (() => {
      try {
        return pageAny.location.origin;
      } catch {
        return '';
      }
    })(),
    gm: {
      hasGMObject: typeof sandboxAny.GM === 'object' && sandboxAny.GM != null,
      hasGMXhr:
        typeof sandboxAny.GM_xmlhttpRequest === 'function' ||
        (typeof sandboxAny.GM === 'object' && sandboxAny.GM && typeof sandboxAny.GM.xmlHttpRequest === 'function')
    },
    status: {}
  };
  pageAny.__jwxtUserscriptDebug = debug;

  function sanitizeUrlForLogs(input: string): string {
    try {
      const url = new URL(input, 'https://example.invalid');
      return `${url.protocol}//${url.host}${url.pathname}`;
    } catch {
      return String(input || '').split('?')[0].split('#')[0];
    }
  }

  function emitLog(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: any) {
    // IMPORTANT: Never log credentials or cookies.
    const safeMeta = (() => {
      if (!meta || typeof meta !== 'object') return undefined;
      const out: any = {};
      for (const [k, v] of Object.entries(meta)) {
        const key = String(k);
        if (/password|cookie|authorization|token/i.test(key)) continue;
        if (typeof v === 'string' && /^https?:\/\//.test(v)) out[key] = sanitizeUrlForLogs(v);
        else out[key] = v;
      }
      return out;
    })();

    try {
      const fn =
        level === 'error' ? console.error :
        level === 'warn' ? console.warn :
        level === 'debug' ? (console.debug || console.log) :
        (console.info || console.log);
      safeMeta ? fn('[JWXT Userscript]', message, safeMeta) : fn('[JWXT Userscript]', message);
    } catch {
      // ignore
    }

    try {
      window.postMessage({ __channel: PAGE_BRIDGE_CHANNEL, type: 'log', level, message, meta: safeMeta }, '*');
    } catch {
      // ignore
    }
  }

  function isPromiseLike(value: any) {
    return Boolean(value && (typeof value === 'object' || typeof value === 'function') && typeof value.then === 'function');
  }

  function parseHeaders(raw: string) {
    const map = new Map<string, string>();
    for (const line of String(raw || '').split(/\r?\n/)) {
      const idx = line.indexOf(':');
      if (idx <= 0) continue;
      map.set(line.slice(0, idx).trim().toLowerCase(), line.slice(idx + 1).trim());
    }
    return map;
  }

  function getGmXhr() {
    const GMobj = sandboxAny.GM;
    if (typeof GMobj === 'object' && GMobj && typeof GMobj.xmlHttpRequest === 'function') return GMobj.xmlHttpRequest.bind(GMobj);
    if (typeof sandboxAny.GM_xmlhttpRequest === 'function') return sandboxAny.GM_xmlhttpRequest;
    return null;
  }

  function normalizeBody(body: any) {
    if (body == null) return undefined;
    if (typeof body === 'string') return body;
    if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return body.toString();
    try {
      return String(body);
    } catch {
      return undefined;
    }
  }

  function gmFetch(url: string, init: any = {}) {
    const gmXhr = getGmXhr();
    if (!gmXhr) return Promise.reject(new Error('GM request API unavailable (check @grant / userscript manager settings)'));

    const targetUrl = new URL(url, pageAny.location.href).toString();
    const headers = Object.assign({ accept: '*/*' }, init.headers || {});
    if (!('referer' in headers) && !('referrer' in headers)) headers.referer = targetUrl;

    const timeoutMs = typeof init.timeout === 'number' ? init.timeout : 20000;
    return new Promise<any>((resolve, reject) => {
      let settled = false;
      const finish = (fn: any) => (val: any) => {
        if (settled) return;
        settled = true;
        fn(val);
      };
      const guard = setTimeout(finish(() => reject(new Error('GM request timeout (guard)'))), timeoutMs);

      gmXhr({
        url: targetUrl,
        method: init.method || 'GET',
        headers,
        data: normalizeBody(init.body),
        redirect: init.redirect,
        insecure: true,
        anonymous: false,
        withCredentials: true,
        responseType: 'text',
        timeout: timeoutMs,
        onload: finish((res: any) => {
          clearTimeout(guard);
          const headersMap = parseHeaders(res.responseHeaders);
          resolve({
            status: res.status,
            ok: res.status >= 200 && res.status < 300,
            url: res.finalUrl || targetUrl,
            headers: {
              get: (name: string) => {
                const key = String(name || '').toLowerCase();
                return headersMap.has(key) ? headersMap.get(key) : null;
              }
            },
            text: async () => (res.responseText != null ? res.responseText : ''),
            json: async () => {
              const text = res.responseText != null ? res.responseText : '';
              return text ? JSON.parse(text) : {};
            }
          });
        }),
        onerror: finish((err: any) => {
          clearTimeout(guard);
          const detail = (() => {
            try {
              return JSON.stringify(err);
            } catch {
              return String(err);
            }
          })();
          const errMsg = err && typeof err === 'object' && 'error' in err ? err.error : null;
          reject(new Error(`${errMsg || 'GM request failed'} (${init.method || 'GET'} ${targetUrl}) ${detail}`));
        }),
        onabort: finish(() => {
          clearTimeout(guard);
          reject(new Error('GM request aborted'));
        }),
        ontimeout: finish(() => {
          clearTimeout(guard);
          reject(new Error('GM request timeout'));
        })
      });
    });
  }

  async function step(label: string, fn: () => Promise<any>) {
    try {
      return await fn();
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`${label}: ${msg}`);
    }
  }

  function randomId() {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  const RSA_PUBKEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDl/aCgRl9f/4ON9MewoVnV58OL
OU2ALBi2FKc5yIsfSpivKxe7A6FitJjHva3WpM7gvVOinMehp6if2UNIkbaN+plW
f5IwqEVxsNZpeixc4GsbY9dXEk3WtRjwGSyDLySzEESH/kpJVoxO7ijRYqU+2oSR
wTBNePOk1H+LRQokgQIDAQAB
-----END PUBLIC KEY-----`;

  function encryptPassword(password: string) {
    const enc = new JSEncrypt({ default_key_size: '1024' });
    enc.setPublicKey(RSA_PUBKEY);
    const out = enc.encrypt(String(password));
    if (!out) throw new Error('Encrypt failed');
    return out;
  }

  // --- selection context (shared module) ---

  async function refreshSelectionContext() {
    // 1:1 with app/src/lib/server/jwxt/contextRefresh.ts
    emitLog('debug', 'refreshSelectionContext:start');
    const selectionRes = await gmFetch(cfg.selectionIndexUrl, { method: 'GET' });
    if (selectionRes.status !== 200) throw new Error(`Failed to load selection page (${selectionRes.status})`);
    if (String(selectionRes.url || '').includes('/sso/') || String(selectionRes.url || '').includes('newsso.shu.edu.cn')) {
      throw new Error(`Selection page redirected to SSO (${selectionRes.url})`);
    }
    if (isJwxtLocalLoginUrl(String(selectionRes.url || ''))) {
      throw new Error(`Selection page redirected to JWXT local login (${selectionRes.url})`);
    }
    const indexHtml = await selectionRes.text();
    if (looksLikeJwxtLocalLoginHtml(indexHtml)) {
      throw new Error('Selection page is JWXT local login HTML (session invalid)');
    }
    const parsed = parseSelectionIndexHtml({ indexHtml, preferredXkkzId: state.preferredXkkzId });
    const tabs = parsed.tabs;
    const selectedTab = parsed.selectedTab;
    let mergedFields: Record<string, string> = parsed.mergedFieldsBase;

    if (selectedTab) {
      const payload = buildSelectionDisplayPayload({ indexFields: parsed.indexFields, selectedTab });
      const displayRes = await gmFetch(cfg.selectionDisplayUrl, {
        method: 'POST',
        headers: {
          'x-requested-with': 'XMLHttpRequest',
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          referer: cfg.selectionIndexUrl
        },
        body: payload,
        timeout: 20000
      });
      if (displayRes.status === 200) {
        const displayHtml = await displayRes.text();
        const merged = mergeSelectionDisplayHtml({ mergedFieldsBase: mergedFields, displayHtml });
        mergedFields = merged.mergedFields;
      }
    }
    const finalized = finalizeSelectionContext({ mergedFields, tabs, activeXkkzId: parsed.activeXkkzId });
    state.fields = finalized.fields;
    state.context = finalized.context;
    state.roundTabs = tabs;
    state.activeXkkzId = ((tabs.find((tab: any) => tab.active) || { xkkzId: null }).xkkzId ?? null);
    state.currentXkkzId = finalized.currentXkkzId;
    state.contextValidatedAtMs = Date.now();
    emitLog('debug', 'refreshSelectionContext:ok', { currentXkkzId: state.currentXkkzId, activeXkkzId: state.activeXkkzId });
    return state.context;
  }

  async function ensureContext() {
    const now = Date.now();
    // JWXT session/context can drift or expire even when we still hold a cached `state.context`.
    // Keep a lightweight "revalidate" on a short TTL to avoid "fake login" / stale round fields.
    //
    // NOTE: This only refreshes hidden fields/round meta; it does not perform any enroll/drop side effects.
    const ttlMs = 8_000;
    if (state.context && typeof state.contextValidatedAtMs === 'number' && now - state.contextValidatedAtMs < ttlMs) {
      return state.context;
    }
    try {
      return await refreshSelectionContext();
    } catch (error) {
      // Clear cached context so callers won't keep using stale values after a failed refresh.
      state.fields = null;
      state.context = null;
      state.roundTabs = null;
      state.activeXkkzId = null;
      state.currentXkkzId = null;
      state.contextValidatedAtMs = 0;
      throw error;
    }
  }

  // NOTE: stringify/normalizeText/parseTeacher/pickFirst/buildLimitations are shared via `app/shared/jwxtCrawler/snapshot.ts`.

  async function digestHexSha256(text: string): Promise<string> {
    try {
      const subtle = globalThis.crypto && globalThis.crypto.subtle ? globalThis.crypto.subtle : null;
      if (!subtle) return '';
      const bytes = new TextEncoder().encode(text);
      const hash = await subtle.digest('SHA-256', bytes);
      const view = new Uint8Array(hash);
      let hex = '';
      for (let i = 0; i < view.length; i++) hex += view[i].toString(16).padStart(2, '0');
      return hex;
    } catch {
      return '';
    }
  }

  async function login(payload: any) {
    const run = (async () => {
      try {
        emitLog('info', 'login:start');
        // newsso (2025-12) uses an OAuth-style redirect chain to a login URL like:
        //   https://newsso.shu.edu.cn/login/<opaque-token>
        //
        // That page posts only { username, password } (encrypted), and then redirects back
        // to `https://jwxt.shu.edu.cn/sso/shulogin?...` which completes the ticketlogin.
        //
        // IMPORTANT:
        // - Do NOT rely on "manual redirect" parsing; many GM implementations do not expose full headers.
        // - Just follow redirects and use the final URL as the login page.
        const entryRes = await step('sso-entry-follow', () => gmFetch(cfg.ssoEntryUrl, { method: 'GET', timeout: 20000 }));
        const finalUrl = String(entryRes.url || cfg.ssoEntryUrl);
        emitLog('debug', 'login:sso-entry', { finalUrl });

        // Already logged in (SSO cookie still valid) => selection page should work.
        if (finalUrl.startsWith(cfg.jwxtHost) && !isJwxtLocalLoginUrl(finalUrl)) {
          state.account = { userId: String(payload.userId || '').trim() };
          void gmWriteValue(USERSCRIPT_USERID_KEY, state.account.userId);
          void gmWriteValue(USERSCRIPT_LOGGEDIN_AT_KEY, String(Date.now()));
          await refreshSelectionContext();
          return { ok: true, supported: true, loggedIn: true, account: state.account };
        }

        let loginUrl = finalUrl;
        try {
          const host = new URL(loginUrl).host;
          // If we did not land on newsso's login page, try resolving again.
          if (!/newsso\.shu\.edu\.cn/i.test(host)) {
            const retry = await step('sso-entry-follow-retry', () => gmFetch(cfg.ssoEntryUrl, { method: 'GET', timeout: 20000 }));
            loginUrl = String(retry.url || loginUrl);
          }
        } catch {
          // ignore
        }

        const encrypted = await step('encrypt', async () => encryptPassword(String(payload.password || '')));
        const body = new URLSearchParams({
          username: String(payload.userId || '').trim(),
          password: encrypted
        });
        const loginOrigin = new URL(loginUrl).origin;

        const loginRes = await step('sso-login-post', () =>
          gmFetch(loginUrl, {
            method: 'POST',
            headers: {
              'content-type': 'application/x-www-form-urlencoded',
              origin: loginOrigin,
              referer: loginUrl
            },
            body,
            timeout: 20000
          })
        );
        emitLog('debug', 'login:sso-login-post', { status: loginRes.status, url: loginRes.url });

        if (loginRes.status >= 500) {
          return { ok: false, supported: true, loggedIn: false, message: `Login failed, last status ${loginRes.status}` };
        }

        try {
          const warm = await step('warmup', () => gmFetch(cfg.warmupUrl(), { method: 'GET', timeout: 15000 }));
          if (isJwxtLocalLoginUrl(String(warm.url || ''))) {
            return { ok: false, supported: true, loggedIn: false, message: 'WARMUP_REDIRECTED_TO_LOCAL_LOGIN' };
          }
          const warmHtml = await warm.text();
          if (looksLikeJwxtLocalLoginHtml(warmHtml)) {
            return { ok: false, supported: true, loggedIn: false, message: 'WARMUP_IS_LOCAL_LOGIN_HTML' };
          }
        } catch {}

        const selectionRes = await step('selection-page', () => gmFetch(cfg.selectionIndexUrl, { method: 'GET', timeout: 20000 }));
        if (selectionRes.status !== 200) {
          return { ok: false, supported: true, loggedIn: false, message: `Failed to load selection page (${selectionRes.status})` };
        }
        if (isJwxtLocalLoginUrl(String(selectionRes.url || ''))) {
          return { ok: false, supported: true, loggedIn: false, message: 'SELECTION_REDIRECTED_TO_LOCAL_LOGIN' };
        }
        const selectionHtml = await selectionRes.text();
        if (looksLikeJwxtLocalLoginHtml(selectionHtml)) {
          return { ok: false, supported: true, loggedIn: false, message: 'SELECTION_IS_LOCAL_LOGIN_HTML' };
        }

        state.account = { userId: String(payload.userId || '').trim() };
        void gmWriteValue(USERSCRIPT_USERID_KEY, state.account.userId);
        void gmWriteValue(USERSCRIPT_LOGGEDIN_AT_KEY, String(Date.now()));
        await refreshSelectionContext();
        emitLog('info', 'login:ok');
        return { ok: true, supported: true, loggedIn: true, account: state.account };
      } catch (e: any) {
        const msg = e instanceof Error ? e.message : String(e);
        emitLog('warn', 'login:failed', { message: msg });
        return { ok: false, supported: true, loggedIn: false, message: msg || 'Unknown Error' };
      }
    })();

    const timeout = new Promise((resolve) =>
      setTimeout(() => resolve({ ok: false, supported: true, loggedIn: false, message: 'LOGIN_TIMEOUT' }), 25000)
    );
    return Promise.race([run, timeout]);
  }

  async function status() {
    // IMPORTANT:
    // - Userscript runs in the browser; the real session lives in the cookie jar for jwxt.shu.edu.cn.
    // - This backend is re-initialized on every page load, so we must NOT rely on in-memory `state.account`
    //   to decide loggedIn; otherwise the UI will show "logged out" after refresh even when cookies are valid.
    //
    // Robustness:
    // - Some JWXT endpoints may return 3xx even when logged in (depending on SSO/session glue).
    // - Use the selection index page HTML as the canonical "logged in" probe.
    // - If probing fails transiently, keep a short "optimistic logged-in" window to avoid UI flapping.
    const uid = state.account?.userId ? String(state.account.userId) : (await gmReadValue(USERSCRIPT_USERID_KEY));
    const lastOkAtKey = USERSCRIPT_LOGGEDIN_AT_KEY;
    try {
      const res = await gmFetch(cfg.selectionIndexUrl, { method: 'GET', timeout: 15000 });
      const finalUrl = String(res.url || '');
      const statusCode = res.status;
      emitLog('debug', 'status:probe', { status: statusCode, url: finalUrl });

      if (finalUrl.includes('/sso/') || finalUrl.includes('newsso.shu.edu.cn')) {
        return { ok: true, supported: true, loggedIn: false, account: uid ? { userId: uid } : undefined };
      }
      if (isJwxtLocalLoginUrl(finalUrl)) {
        return { ok: true, supported: true, loggedIn: false, account: uid ? { userId: uid } : undefined };
      }

      const html = await res.text();
      if (looksLikeJwxtLocalLoginHtml(html)) {
        return { ok: true, supported: true, loggedIn: false, account: uid ? { userId: uid } : undefined };
      }

      // Treat any non-SSO, non-local-login HTML as logged-in even if status is 3xx.
      // (Some gateways still return a redirect status while presenting the final HTML.)
      if (!(statusCode >= 200 && statusCode < 400)) {
        return { ok: true, supported: true, loggedIn: false, account: uid ? { userId: uid } : undefined };
      }

      // Session cookie still valid. Account userId is best-effort (from last login).
      state.account = uid ? { userId: uid } : (state.account ?? null);
      void gmWriteValue(lastOkAtKey, String(Date.now()));
      return { ok: true, supported: true, loggedIn: true, account: state.account || undefined };
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : String(error);
      emitLog('debug', 'status:probe-failed', { message: msg });
      // Do NOT clear remembered uid on transient errors.
      // If we recently had a positive probe, keep a short optimistic window to avoid "refresh => logged out".
      const lastOkRaw = await gmReadValue(lastOkAtKey);
      const lastOkAt = Number(lastOkRaw);
      if (Number.isFinite(lastOkAt) && lastOkAt > 0) {
        const ageMs = Date.now() - lastOkAt;
        if (ageMs >= 0 && ageMs < 12 * 60 * 60 * 1000) {
          state.account = uid ? { userId: uid } : (state.account ?? null);
          return { ok: true, supported: true, loggedIn: true, account: state.account || undefined };
        }
      }
      return { ok: true, supported: true, loggedIn: false, account: uid ? { userId: uid } : undefined };
    }
  }

  async function ping() {
    const res = await gmFetch(cfg.ssoEntryUrl, { method: 'GET', timeout: 15000 });
    return { ok: true, ssoEntryStatus: res.status, finalUrl: res.url };
  }

  async function rounds() {
    // Keep this endpoint resilient and consistent with server/dev:
    // - Some deployments render no <li> tabs (single-round UI) => shared parser falls back to hidden fields.
    // - Round meta (xklc/xklcmc) may only exist on the Display page for each tab.
    const selectionRes = await gmFetch(cfg.selectionIndexUrl, { method: 'GET', timeout: 20000 });
    if (selectionRes.status !== 200) throw new Error(`Failed to load selection page (${selectionRes.status})`);
    if (String(selectionRes.url || '').includes('/sso/') || String(selectionRes.url || '').includes('newsso.shu.edu.cn')) {
      throw new Error(`Selection page redirected to SSO (${selectionRes.url})`);
    }
    if (isJwxtLocalLoginUrl(String(selectionRes.url || ''))) {
      throw new Error(`Selection page redirected to JWXT local login (${selectionRes.url})`);
    }
    const indexHtml = await selectionRes.text();
    if (looksLikeJwxtLocalLoginHtml(indexHtml)) {
      throw new Error('Selection page is JWXT local login HTML (session invalid)');
    }
    const parsed = parseSelectionIndexHtml({ indexHtml, preferredXkkzId: state.preferredXkkzId });
    const indexFields = parsed.indexFields;
    const tabs = parsed.tabs;

    // Parallelize display-page fetch for speed: each round's xklc/xklcmc is more stable on Display page.
    const concurrency = USERSCRIPT_CONFIG.roundsConcurrency;
    const rounds: any[] = await mapWithConcurrency(tabs as any[], concurrency, async (tab) => {
      const payload = buildSelectionDisplayPayload({ indexFields, selectedTab: tab as any });
      const displayRes = await gmFetch(cfg.selectionDisplayUrl, {
        method: 'POST',
        headers: {
          'x-requested-with': 'XMLHttpRequest',
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          referer: cfg.selectionIndexUrl
        },
        body: payload,
        timeout: 20000
      });
      if (displayRes.status !== 200) {
        return {
          xkkzId: tab.xkkzId,
          kklxdm: tab.kklxdm,
          kklxLabel: tab.kklxLabel,
          active: tab.active
        };
      }
      const displayHtml = await displayRes.text();
      const displayFields = parseSelectionPageFields(displayHtml);
      const displayRoundMeta = extractRoundMetaFromHtml(displayHtml);
      return {
        xkkzId: tab.xkkzId,
        xklc: displayFields.xklc || displayRoundMeta.xklc || undefined,
        xklcmc: displayFields.xklcmc || displayRoundMeta.xklcmc || undefined,
        kklxdm: tab.kklxdm,
        kklxLabel: tab.kklxLabel,
        active: tab.active
      };
    });

    state.roundTabs = tabs;
    state.activeXkkzId = parsed.activeXkkzId != null ? parsed.activeXkkzId : null;
    return {
      ok: true,
      term: {
        xkxnm: indexFields ? indexFields.xkxnm : undefined,
        xkxqm: indexFields ? indexFields.xkxqm : undefined,
        xkxnmc: indexFields ? indexFields.xkxnmc : undefined,
        xkxqmc: indexFields ? indexFields.xkxqmc : undefined
      },
      selectedXkkzId: state.currentXkkzId != null ? state.currentXkkzId : undefined,
      activeXkkzId: state.activeXkkzId != null ? state.activeXkkzId : undefined,
      rounds
    };
  }

  async function selectRound(xkkzId: string) {
    state.preferredXkkzId = String(xkkzId || '').trim();
    await refreshSelectionContext();
    return { ok: true, selectedXkkzId: state.currentXkkzId != null ? state.currentXkkzId : '' };
  }

  async function search(query: string) {
    await ensureContext();
    const q = String(query || '').trim();
    if (!q) return { ok: false, error: 'Missing query' };
    const payload = new URLSearchParams(Object.assign({}, state.context, { kspage: '1', jspage: '9999' }));
    const res = await gmFetch(cfg.courseListUrl, {
      method: 'POST',
      headers: {
        'x-requested-with': 'XMLHttpRequest',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        referer: cfg.courseListUrl
      },
      body: payload,
      timeout: 20000
    });
    if (res.status !== 200) return { ok: false, error: `Search failed (${res.status})` };
    const data = await res.json();
    const rows = data && ((data as any).tmpList || (data as any).rows) ? ((data as any).tmpList || (data as any).rows) : [];
    const needle = q.toLowerCase();
    const results = rows
      .map((row: any) => ({
        kchId: String(row && row.kch_id != null ? row.kch_id : ''),
        courseName: String(row && row.kcmc != null ? row.kcmc : ''),
        jxbId: String(row && row.jxb_id != null ? row.jxb_id : ''),
        teacher: String(row && row.jsxx != null ? row.jsxx : ''),
        time: String(row && row.sksj != null ? row.sksj : ''),
        credit: String(row && row.jxbxf != null ? row.jxbxf : '')
      }))
      .filter((row: any) => `${row.kchId} ${row.courseName} ${row.jxbId} ${row.teacher}`.toLowerCase().includes(needle))
      .slice(0, 120);
    return { ok: true, results };
  }

  async function syncSelected() {
    await ensureContext();
    const res = await gmFetch(cfg.selectedCoursesUrl, {
      method: 'POST',
      headers: {
        'x-requested-with': 'XMLHttpRequest',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        referer: cfg.selectedCoursesUrl
      },
      body: new URLSearchParams(state.context),
      timeout: 20000
    });
    if (res.status !== 200) return { ok: false, error: `JWXT sync failed (${res.status})` };
    const data = await res.json();
    const rows = Array.isArray(data) ? data : [];
    const selected = rows
      .map((row: any) => ({
        kchId: String(row && row.kch_id != null ? row.kch_id : ''),
        jxbId: String(row && row.jxb_id != null ? row.jxb_id : '')
      }))
      .filter((p: any) => p.kchId && p.jxbId);
    return { ok: true, selected };
  }

  async function enroll(kchId: string, jxbId: string) {
    await ensureContext();
    const courseBase = await getCourseBaseForKch(String(kchId || ''));
    const payload = buildEnrollPayload(state.context, {
      kch_id: String(kchId || ''),
      jxb_ids: String(jxbId || ''),
      // optional; improves compatibility with ref implementations
      kcmc: courseBase?.kcmc || '',
      cxbj: courseBase?.cxbj || '0',
      xxkbj: courseBase?.xxkbj || '0',
      qz: '0',
      jcxx_id: ''
    });
    const res = await gmFetch(cfg.enrollUrl, {
      method: 'POST',
      headers: {
        'x-requested-with': 'XMLHttpRequest',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        referer: cfg.selectionIndexUrl
      },
      body: payload,
      timeout: 20000
    });
    if (res.status !== 200) return { ok: false, error: `Enroll failed (${res.status})` };
    const data = await res.json();
    const parsed = parseEnrollResult(data);
    if (parsed.ok) return { ok: true, message: parsed.msg || 'ok', flag: parsed.flag };
    return { ok: false, error: parsed.msg || 'Enroll failed', flag: parsed.flag, retryable: parsed.retryable };
  }

  async function drop(kchId: string, jxbId: string) {
    await ensureContext();
    const kch = String(kchId || '').trim();
    const jxb = String(jxbId || '').trim();
    if (!kch || !jxb) return { ok: false, error: 'Missing kchId/jxbId' };

    // Primary: `/xsxk/zzxkyzb_tuikBcZzxkYzb.html` (ref implementation).
    try {
      const payload = buildDropPayloadTuikBcZzxkYzb(state.context, { kch_id: kch, jxb_ids: jxb });
      const res = await gmFetch(cfg.dropBcUrl, {
        method: 'POST',
        headers: {
          'x-requested-with': 'XMLHttpRequest',
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          referer: cfg.selectionIndexUrl
        },
        body: payload,
        timeout: 20000
      });
      if (res.status === 200) {
        let raw: any = null;
        try {
          raw = await res.json();
        } catch {
          raw = await res.text();
        }
        const parsed = parseDropTuikBcResult(raw);
        if (parsed.ok) return { ok: true, message: 'ok', code: parsed.code };
        // If server says "busy" or "validation failed", caller may retry.
        if (parsed.retryable) return { ok: false, error: parsed.msg || 'Drop failed', code: parsed.code, retryable: true };
        // Non-retryable -> fall through to legacy endpoint as a last resort.
      }
    } catch {
      // fall through
    }

    // Fallback: legacy endpoint. Keep the old minimal payload to maximize compatibility.
    const legacyPayload = new URLSearchParams(Object.assign({}, state.context, { kch_id: kch, jxb_ids: jxb }));
    const legacyRes = await gmFetch(cfg.dropUrl, {
      method: 'POST',
      headers: {
        'x-requested-with': 'XMLHttpRequest',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        referer: cfg.selectionIndexUrl
      },
      body: legacyPayload,
      timeout: 20000
    });
    if (legacyRes.status !== 200) return { ok: false, error: `Drop failed (${legacyRes.status})` };
    const data = await legacyRes.json();
    const parsed = parseEnrollResult(data);
    if (parsed.ok) return { ok: true, message: parsed.msg || 'ok', flag: parsed.flag };
    return { ok: false, error: parsed.msg || 'Drop failed', flag: parsed.flag, retryable: parsed.retryable };
  }

  async function getCourseBaseForKch(kchId: string): Promise<{ kcmc: string; cxbj: string; xxkbj: string } | null> {
    const id = String(kchId || '').trim();
    if (!id) return null;
    if (state.courseBaseCache && state.courseBaseCache.has(id)) return state.courseBaseCache.get(id) || null;
    try {
      if (!state.courseBaseCachePromise) {
        state.courseBaseCachePromise = (async () => {
          const listPayload = new URLSearchParams(Object.assign({}, state.context, { kspage: '1', jspage: '9999' }));
          const listRes = await gmFetch(cfg.courseListUrl, {
            method: 'POST',
            headers: {
              'x-requested-with': 'XMLHttpRequest',
              'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
              referer: cfg.selectionIndexUrl
            },
            body: listPayload,
            timeout: 20000
          });
          if (listRes.status !== 200) return new Map();
          const listJson = await listRes.json();
          const rows: any[] = listJson && (listJson.tmpList || listJson.rows) ? (listJson.tmpList || listJson.rows) : [];
          const map = new Map();
          for (const row of rows) {
            const k = String(row && (row.kch_id || row.kch) || '').trim();
            if (!k) continue;
            if (map.has(k)) continue;
            map.set(k, {
              kcmc: stringify(row.kcmc),
              cxbj: stringify(row.cxbj || '0') || '0',
              xxkbj: stringify(row.xxkbj || '0') || '0'
            });
          }
          return map;
        })()
          .then((map) => {
            state.courseBaseCache = map;
            return map;
          })
          .finally(() => {
            state.courseBaseCachePromise = null;
          });
      }

      const cache = await state.courseBaseCachePromise;
      const entry = cache && cache.has(id) ? cache.get(id) : null;
      return entry || null;
    } catch {
      return null;
    }
  }

  function clampInt(value: any, fallback: number, min: number, max: number) {
    const n = typeof value === 'number' ? Math.floor(value) : fallback;
    return Math.max(min, Math.min(max, n));
  }

  // Compile-time user config injected by `app/scripts/build-userscript.mjs`.
  // Edit `app/static/backenduserscript/userconfig/config.json` (and optional `local.json`) before building.
  const USERSCRIPT_CONFIG = {
    roundsConcurrency: clampInt(__USERSCRIPT_CONFIG__?.roundsConcurrency, 6, 1, 16),
    snapshotConcurrency: clampInt(__USERSCRIPT_CONFIG__?.snapshotConcurrency, 16, 1, 32),
    selectableIncludeBreakdown:
      typeof __USERSCRIPT_CONFIG__?.selectableIncludeBreakdown === 'boolean'
        ? Boolean(__USERSCRIPT_CONFIG__.selectableIncludeBreakdown)
        : true
  } as const;

  async function crawlSnapshot(
    payload: { termId?: string; limitCourses?: number; concurrency?: number } = {},
    onProgress?: (p: { stage: 'context' | 'list' | 'details' | 'finalize'; done?: number; total?: number; message?: string }) => void
  ) {
    try {
      onProgress?.({ stage: 'context' });
      emitLog('info', 'crawlSnapshot:start', { termId: payload.termId || '' });
      await ensureContext();
      if (!state.context || !state.fields) return { ok: false, supported: true, error: 'Missing JWXT context' };

      const crawlContextBase: Record<string, string> = Object.assign({}, state.context);
      const indexUrl = cfg.selectionIndexUrl;
      const detailUrl =
        'https://jwxt.shu.edu.cn/jwglxt/xsxk/zzxkyzbjk_cxJxbWithKchZzxkYzb.html?gnmkdm=N253512';

      onProgress?.({ stage: 'list' });
      const listPayload = new URLSearchParams(Object.assign({}, crawlContextBase, { kspage: '1', jspage: '9999' }));
      const listRes = await gmFetch(cfg.courseListUrl, {
        method: 'POST',
        headers: {
          'x-requested-with': 'XMLHttpRequest',
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          referer: indexUrl
        },
        body: listPayload,
        timeout: 20000
      });
      if (listRes.status !== 200) return { ok: false, supported: true, error: `Course list request failed (${listRes.status})` };
      const listJson = await listRes.json();
      const rows: any[] = listJson && (listJson.tmpList || listJson.rows) ? (listJson.tmpList || listJson.rows) : [];
      emitLog('debug', 'crawlSnapshot:list-ok', { rows: rows.length });

      const baseByKchId = new Map<string, { courseId: string; courseName: string; credit: string; cxbj: string; fxbj: string }>();
      for (const row of rows) {
        const kchId = stringify(row && (row.kch_id || row.kch)).trim();
        if (!kchId) continue;
        if (baseByKchId.has(kchId)) continue;
        baseByKchId.set(kchId, {
          courseId: stringify(row && (row.kch || kchId)),
          courseName: stringify(row && row.kcmc),
          credit: stringify(row && (row.xf || row.jxbxf)),
          cxbj: stringify(row && (row.cxbj || '0')),
          fxbj: stringify(row && (row.fxbj || '0'))
        });
      }

      const kchIdsAll = [...baseByKchId.keys()];
      const limit = typeof payload.limitCourses === 'number' ? Math.max(0, Math.floor(payload.limitCourses)) : null;
      const kchIds = limit != null ? kchIdsAll.slice(0, limit) : kchIdsAll;
      const tasks = kchIds
        .map((kchId) => {
          const base = baseByKchId.get(kchId);
          return base ? { kchId, base } : null;
        })
        .filter(Boolean) as Array<{ kchId: string; base: { courseId: string; courseName: string; credit: string; cxbj: string; fxbj: string } }>;

      // Userscript mode should prefer high parallelism: GM_xmlhttpRequest has no CORS limitations,
      // and snapshot crawling is network-bound. Keep it bounded to avoid JWXT throttling.
      const concurrency = clampInt((payload as any).concurrency, USERSCRIPT_CONFIG.snapshotConcurrency, 1, 32);
      onProgress?.({ stage: 'details', done: 0, total: tasks.length });
      const detailLists = await mapWithConcurrency(tasks, concurrency, async (task) => {
        const detailPayload = new URLSearchParams(
          Object.assign({}, crawlContextBase, {
            kch_id: task.kchId,
            cxbj: task.base.cxbj || '0',
            fxbj: task.base.fxbj || '0'
          })
        );
        const res = await gmFetch(detailUrl, {
          method: 'POST',
          headers: {
            'x-requested-with': 'XMLHttpRequest',
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            referer: indexUrl
          },
          body: detailPayload,
          timeout: 20000
        });
        if (res.status !== 200) throw new Error(`Detail request for ${task.kchId} failed (${res.status})`);
        const raw = await res.json();
        const detailRows: Array<Record<string, any>> = Array.isArray(raw) ? raw : raw && (raw.tmpList || raw.rows) ? (raw.tmpList || raw.rows) : [];
        return detailRows.map((detail) => ({ base: task.base, detail }));
      }, (done, total) => onProgress?.({ stage: 'details', done, total }));

      onProgress?.({ stage: 'finalize' });
      emitLog('debug', 'crawlSnapshot:details-ok', { courses: tasks.length });
      const courses: any[] = [];
      const totalDetails = detailLists.reduce((acc, list) => acc + list.length, 0);
      let finalized = 0;
      const reportFinalize = () => {
        onProgress?.({ stage: 'finalize', done: finalized, total: totalDetails, message: `${finalized}/${totalDetails}` });
      };
      reportFinalize();
      for (const list of detailLists) {
        for (const item of list) {
          const base = item.base;
          const detail = item.detail;
          finalized += 1;
          if (finalized % 250 === 0) reportFinalize();
          const teacher = parseTeacher((detail as any).jsxx);
          const limitations = buildLimitations(detail, base);
          const academy = pickFirst(detail, ['kkxy', 'kkxy_name', 'kkxy_mc', 'kkxymc', 'dwmc', 'kkdwmc']);
          const major = pickFirst(detail, ['zyfxmc', 'zymc', 'zyhmc', 'zyfxname']);
          const teachingMode = pickFirst(detail, ['jxms', 'jxmsmc', 'skfs', 'skfsmc', 'jxms_name']);
          const languageMode = pickFirst(detail, ['yylx', 'yylxmc', 'yyxz', 'yyxzmc', 'yyms', 'yymsmc']);
          const selectionNote = pickFirst(detail, ['xkbz', 'xklybz', 'bz', 'kcbz', 'bzxx']);
          const classStatus = pickFirst(detail, ['jxbzt', 'krlx', 'zt', 'status']);

          courses.push({
            courseId: base.courseId,
            courseName: base.courseName,
            credit: base.credit,
            teacherId: teacher.teacherId,
            teacherName: teacher.teacherName,
            teacherTitle: teacher.teacherTitle || undefined,
            classTime: normalizeText((detail as any).sksj),
            campus: stringify((detail as any).xqumc || (detail as any).yqmc),
            position: normalizeText((detail as any).jxdd),
            capacity: stringify((detail as any).jxbrl),
            number: stringify((detail as any).yxzrs),
            limitations,
            teachingClassId: stringify((detail as any).jxb_id),
            batchId: stringify((crawlContextBase as any).xkkz_id),
            academy: academy || undefined,
            major: major || undefined,
            teachingMode: teachingMode || undefined,
            languageMode: languageMode || undefined,
            selectionNote: selectionNote || undefined,
            classStatus: classStatus || undefined
          });
        }
      }
      reportFinalize();
      emitLog('info', 'crawlSnapshot:finalize-ok', { totalDetails, courses: courses.length });

      const uniqueCourses: any[] = [];
      const seen = new Set<string>();
      for (const course of courses) {
        const key = `${course.courseId}::${course.teachingClassId}::${course.batchId || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        uniqueCourses.push(course);
      }
      uniqueCourses.sort((a, b) =>
        a.courseId === b.courseId ? String(a.teachingClassId).localeCompare(String(b.teachingClassId)) : String(a.courseId).localeCompare(String(b.courseId))
      );

      const derived = deriveTermCode(state.fields);
      const termIdDerived = derived.termCode;
      const termName =
        `${pickFirst(state.fields as any, ['xkxnmc', 'xkxnm']).trim()} ${pickFirst(state.fields as any, ['xkxqmc', 'xkxqm']).trim()}`.trim() ||
        termIdDerived;

      const jwxtRound = {
        xkkzId: stringify((crawlContextBase as any).xkkz_id),
        xklc: stringify((state.fields as any).xklc),
        xklcmc: stringify((state.fields as any).xklcmc)
      };

      // NOTE:
      // Hashing a huge snapshot via `JSON.stringify` can be very slow and may look like the crawl is
      // “stuck” at the finalize stage on slower machines.
      //
      // The app does not rely on this snapshot-level hash for correctness (course/group hashes are
      // computed by the parser). Keep it as an optional best-effort value.
      const hash = '';
      const snapshot = {
        backendOrigin: cfg.jwxtHost,
        termName,
        jwxtRound,
        updateTimeMs: Date.now(),
        hash,
        courses: uniqueCourses
      };

      if (payload.termId && !termMatches(String(payload.termId), termIdDerived)) {
        return { ok: false, supported: true, error: `TERM_MISMATCH:${termIdDerived}` };
      }

      return { ok: true, supported: true, termId: termIdDerived, snapshot };
    } catch (e: any) {
      return { ok: false, supported: true, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async function push(selectionSnapshotBase64: string, dryRun: boolean, options?: { enrollConcurrency?: number }) {
    const snapText = atob(String(selectionSnapshotBase64 || ''));
    const decoded = JSON.parse(snapText) || {};
    const desired = Array.isArray(decoded.selected) ? decoded.selected : [];
    const desiredPairs = desired
      .map((s: any) => String(s || ''))
      .filter(Boolean)
      .map((ref: string) => {
        const parts = ref.split('::');
        return { kchId: parts[0] || '', jxbId: parts[1] || '' };
      })
      .filter((p: any) => p.kchId && p.jxbId);

    const syncRes: any = await syncSelected();
    if (!syncRes.ok) return syncRes;
    const remotePairs = syncRes.selected != null ? syncRes.selected : [];
    const desiredSet = new Set(desiredPairs.map((p: any) => `${p.kchId}::${p.jxbId}`));
    const remoteSet = new Set(remotePairs.map((p: any) => `${p.kchId}::${p.jxbId}`));
    const toEnroll = desiredPairs.filter((p: any) => !remoteSet.has(`${p.kchId}::${p.jxbId}`));
    const toDrop = remotePairs.filter((p: any) => !desiredSet.has(`${p.kchId}::${p.jxbId}`));
    const plan = { toEnroll, toDrop };

    if (dryRun) {
      return { ok: true, plan, summary: { enrollPlanned: toEnroll.length, dropPlanned: toDrop.length, enrollDone: 0, dropDone: 0 }, results: [] };
    }

    const results: any[] = [];
    for (const pair of toDrop) {
      const r: any = await drop(pair.kchId, pair.jxbId);
      results.push({ op: 'drop', kchId: pair.kchId, jxbId: pair.jxbId, ok: r.ok, message: r.error });
      if (!r.ok) break;
    }
    if (results.every((r) => r.ok)) {
      const concurrencyRaw = typeof options?.enrollConcurrency === 'number' ? options!.enrollConcurrency! : 1;
      const concurrency = clampInt(concurrencyRaw, 1, 1, 12);
      if (concurrency <= 1 || toEnroll.length <= 1) {
        for (const pair of toEnroll) {
          const r: any = await enroll(pair.kchId, pair.jxbId);
          results.push({ op: 'enroll', kchId: pair.kchId, jxbId: pair.jxbId, ok: r.ok, message: r.error });
          if (!r.ok) break;
        }
      } else {
        const out = await mapWithConcurrency(toEnroll as any[], concurrency, async (pair) => {
          const r: any = await enroll(String((pair as any).kchId || ''), String((pair as any).jxbId || ''));
          return { op: 'enroll', kchId: (pair as any).kchId, jxbId: (pair as any).jxbId, ok: r.ok, message: r.error };
        });
        results.push(...out);
      }
    }
    return {
      ok: true,
      plan,
      summary: {
        enrollPlanned: toEnroll.length,
        dropPlanned: toDrop.length,
        enrollDone: results.filter((r) => r.op === 'enroll' && r.ok).length,
        dropDone: results.filter((r) => r.op === 'drop' && r.ok).length
      },
      results
    };
  }

  function logout() {
    state.account = null;
    state.fields = null;
    state.context = null;
    state.roundTabs = null;
    state.activeXkkzId = null;
    state.currentXkkzId = null;
    state.preferredXkkzId = null;
    return { ok: true, supported: true, loggedIn: false };
  }

  async function checkSelectable(payload: { kchId: string; jxbId: string }) {
    try {
      await ensureContext();
      const kchId = stringify(payload?.kchId).trim();
      const jxbId = stringify(payload?.jxbId).trim();
      if (!kchId || !jxbId) return { ok: false, error: 'Missing kchId/jxbId' };
      const includeBreakdown =
        typeof (payload as any)?.includeBreakdown === 'boolean'
          ? Boolean((payload as any).includeBreakdown)
          : USERSCRIPT_CONFIG.selectableIncludeBreakdown;

      // TBD: user eligibility differs by cohort (retake/grade/major/prereq/batch).
      // Future crawler will produce `userbatch/<termCode>.json` for per-course-group batch rules (user-agnostic).
      // For now we assume the user is eligible and DO NOT block selection on this dimension.
      // TODO(groupKey): use real groupKey from future `userbatch/<termCode>.json` instead of `kchId`.
      const eligibility = await ASSUME_ELIGIBLE_FOR_NOW.getEligibilityForGroupKey(kchId);

      const detailUrl = 'https://jwxt.shu.edu.cn/jwglxt/xsxk/zzxkyzbjk_cxJxbWithKchZzxkYzb.html?gnmkdm=N253512';
      const ctx = Object.assign({}, state.context, { kch_id: kchId });
      const res = await gmFetch(detailUrl, {
        method: 'POST',
        headers: {
          'x-requested-with': 'XMLHttpRequest',
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          referer: cfg.selectionIndexUrl
        },
        body: new URLSearchParams(ctx),
        timeout: 20000
      });
      if (res.status !== 200) return { ok: false, error: `Detail request failed (${res.status})`, retryable: res.status >= 500 || res.status === 429 };
      const raw = await res.json();
      const rows: Array<Record<string, any>> = Array.isArray(raw) ? raw : raw && (raw.tmpList || raw.rows) ? (raw.tmpList || raw.rows) : [];
      const hit = rows.find((r) => stringify(r && r.jxb_id).trim() === jxbId) || null;
      if (!hit) return { ok: false, error: 'SECTION_NOT_FOUND', retryable: false };

      const classStatus = pickFirst(hit, ['jxbzt', 'krlx', 'zt', 'status']);
      const cap = Number.parseInt(stringify(hit.jxbrl || hit.capacity), 10);
      const num = Number.parseInt(stringify(hit.yxzrs || hit.number), 10);

      const blockers: string[] = [];
      if (classStatus && /停开|关闭|结束|暂停/.test(classStatus)) blockers.push('CLASS_CLOSED');
      if (Number.isFinite(cap) && Number.isFinite(num) && cap > 0 && num >= cap) blockers.push('FULL');

      // Optional: "已选人数明细" is relatively expensive; keep it opt-in for speed.
      // Callers can use `getEnrollmentBreakdown()` separately when needed.
      let enrollmentBreakdown: any = null;
      let userBatch: any = null;
      if (includeBreakdown) {
        try {
          const r: any = await getEnrollmentBreakdown({ kchId, jxbId });
          if (r && r.ok) {
            enrollmentBreakdown = r.breakdown || null;
            userBatch = { ...deriveUserBatchState(enrollmentBreakdown), source: 'userscript' as const };
          }
        } catch {}
      }

      // NOTE: JWXT also has hidden constraints (time conflicts, restrictions, etc.) which we can only know on actual enroll.
      const selectable = blockers.length === 0;
      return {
        ok: true,
        selectable,
        blockers,
        eligibility,
        // User profile/batch signals are USER-SPECIFIC and must not be embedded into cloud snapshots.
        // Expose here so frontend can decide whether it can trust cloud-only `extra.json` checks.
        userProfile: getUserProfileSignals(),
        enrollmentBreakdown,
        userBatch,
        detail: { classStatus: classStatus || undefined, capacity: cap, number: num }
      };
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg || 'Unknown error', retryable: isRetryableError(msg) };
    }
  }

  async function getEnrollmentBreakdown(payload: { kchId: string; jxbId: string }) {
    try {
      await ensureContext();
      const kchId = stringify(payload?.kchId).trim();
      const jxbId = stringify(payload?.jxbId).trim();
      if (!kchId || !jxbId) return { ok: false, error: 'Missing kchId/jxbId' };

      const ctxAny: any = state.context as any;
      const meta = {
        xkkzId: stringify(ctxAny?.xkkz_id).trim() || undefined,
        xklc: stringify(ctxAny?.xklc).trim() || undefined,
        xklcmc: stringify(ctxAny?.xklcmc).trim() || undefined,
        xnm: stringify(ctxAny?.xnm || ctxAny?.xkxnm).trim() || undefined,
        xqm: stringify(ctxAny?.xqm || ctxAny?.xkxqm).trim() || undefined
      };

      const form = buildEnrollmentBreakdownPayload(state.context as any, { kch_id: kchId, jxb_id: jxbId });
      const res = await gmFetch(cfg.enrollmentBreakdownUrl, {
        method: 'POST',
        headers: {
          'x-requested-with': 'XMLHttpRequest',
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
          referer: cfg.selectionIndexUrl
        },
        body: form,
        timeout: 20000
      });
      if (res.status !== 200) {
        return { ok: false, error: `Breakdown request failed (${res.status})`, retryable: res.status >= 500 || res.status === 429 };
      }
      const html = await res.text();
      if (isJwxtLocalLoginUrl(res.url) || looksLikeJwxtLocalLoginHtml(html)) {
        return { ok: false, error: 'SESSION_INVALID', retryable: true };
      }
      const breakdown = parseEnrollmentBreakdownHtml(html);
      const userBatch = { ...deriveUserBatchState(breakdown), source: 'userscript' as const };
      return { ok: true, meta, userBatch, breakdown };
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg || 'Unknown error', retryable: isRetryableError(msg) };
    }
  }

  function getUserProfileSignals(): JwxtUserProfileSignals {
    const derived = deriveTermCode(state.fields);
    const ctx: Record<string, string> = {};
    const keys = ['rwlx', 'njdm_id', 'zyh_id', 'zyfx_id', 'xslbdm', 'xz', 'ccdm', 'mzm', 'xbm', 'xklc'];
    for (const key of keys) {
      const v = stringify((state.context as any)?.[key] ?? (state.fields as any)?.[key]).trim();
      if (v) ctx[key] = v;
    }
    return {
      userId: state.account ? String(state.account.userId || '').trim() : undefined,
      termCode: derived.termCode || undefined,
      xkkzId: stringify((state.context as any)?.xkkz_id ?? (state.fields as any)?.xkkz_id).trim() || undefined,
      rwlx: ctx.rwlx,
      njdm_id: ctx.njdm_id,
      zyh_id: ctx.zyh_id,
      zyfx_id: ctx.zyfx_id,
      xslbdm: ctx.xslbdm,
      xz: ctx.xz,
      ccdm: ctx.ccdm,
      mzm: ctx.mzm,
      xbm: ctx.xbm,
      raw: ctx,
      note: 'TBD'
    };
  }

  function getRoundPolicy() {
    // Derived from current context; semantics are still TBD (we only expose as advisory signals).
    const policy = deriveRoundPolicy({ context: state.context as any, fields: state.fields as any });
    return { ok: true, policy };
  }

  const taskManager = new TaskManager({
    jwxt_poll_selectable: async ({ request, signal, reportProgress }) => {
      const r: any = request as any;
      reportProgress({ stage: 'selectable' });
      const result: any = await checkSelectable({ kchId: r.kchId, jxbId: r.jxbId, includeBreakdown: (r as any)?.includeBreakdown } as any);
      if (signal.aborted) return { ok: false, done: false, error: 'ABORTED', retryable: false };
      if (!result.ok) return { ok: false, done: false, error: String(result.error || 'CHECK_FAILED'), retryable: Boolean(result.retryable) };
      return { ok: true, done: Boolean(result.selectable), result };
    },
    jwxt_poll_push: async ({ request, signal, reportProgress }) => {
      const r: any = request as any;
      if (signal.aborted) return { ok: false, done: false, error: 'ABORTED', retryable: false };
      const snapshotBase64 = String(r.selectionSnapshotBase64 || '').trim();
      if (!snapshotBase64) return { ok: false, done: false, error: 'MISSING_SNAPSHOT', retryable: false };

      const concurrency = clampInt(r?.parallel?.concurrency, 4, 1, 12);

      reportProgress({ stage: 'push-preview' });
      const preview: any = await push(snapshotBase64, true);
      if (!preview || !preview.ok) return { ok: false, done: false, error: String(preview?.error || 'PUSH_PREVIEW_FAILED'), retryable: true };

      const toEnrollCount = Array.isArray(preview.plan?.toEnroll) ? preview.plan.toEnroll.length : 0;
      const toDropCount = Array.isArray(preview.plan?.toDrop) ? preview.plan.toDrop.length : 0;
      reportProgress({ stage: 'push', message: `plan enroll=${toEnrollCount} drop=${toDropCount}` });

      if (!toEnrollCount && !toDropCount) {
        // Keep running until user stops; this is a "polling mode" daemon.
        return { ok: true, done: false, result: { ok: true, synced: true, plan: preview.plan, summary: preview.summary } };
      }

      const out: any = await push(snapshotBase64, false, { enrollConcurrency: concurrency });
      if (!out || !out.ok) return { ok: false, done: false, error: String(out?.error || out?.message || 'PUSH_FAILED'), retryable: true };
      const allOk = Array.isArray(out.results) ? out.results.every((x: any) => x && x.ok) : true;
      if (!allOk) return { ok: false, done: false, error: 'PUSH_NOT_COMPLETE', retryable: true, result: out };
      return { ok: true, done: false, result: out };
    },
    jwxt_crawl_snapshot: async ({ request, signal, reportProgress }) => {
      const r: any = request as any;
      if (signal.aborted) return { ok: false, done: false, error: 'ABORTED', retryable: false };
      const out: any = await crawlSnapshot({
        termId: r.termId,
        limitCourses: r.limitCourses,
        // High-parallel by default; caller may override via request.parallel.concurrency.
        concurrency: clampInt(r?.parallel?.concurrency, USERSCRIPT_CONFIG.snapshotConcurrency, 1, 32)
      }, (p) => reportProgress(p));
      if (signal.aborted) return { ok: false, done: false, error: 'ABORTED', retryable: false };
      if (!out || !out.ok) {
        const err = String(out?.error || out?.message || 'CRAWL_FAILED');
        return { ok: false, done: false, error: err, retryable: isRetryableError(err) };
      }
      return { ok: true, done: true, result: out };
    },
    jwxt_parallel_rounds: async ({ request, signal, reportProgress }) => {
      const r: any = request as any;
      if (signal.aborted) return { ok: false, done: false, error: 'ABORTED', retryable: false };
      const concurrency = clampInt(r?.parallel?.concurrency, USERSCRIPT_CONFIG.roundsConcurrency, 1, 16);
      const data: any = await (async () => {
        reportProgress({ stage: 'context' });
        // Identical to `rounds()` but fetch each Display page concurrently for speed and robustness.
        const selectionRes = await gmFetch(cfg.selectionIndexUrl, { method: 'GET', timeout: 20000 });
        if (selectionRes.status !== 200) throw new Error(`Failed to load selection page (${selectionRes.status})`);
        if (String(selectionRes.url || '').includes('/sso/') || String(selectionRes.url || '').includes('newsso.shu.edu.cn')) {
          throw new Error(`Selection page redirected to SSO (${selectionRes.url})`);
        }
        if (isJwxtLocalLoginUrl(String(selectionRes.url || ''))) {
          throw new Error(`Selection page redirected to JWXT local login (${selectionRes.url})`);
        }
        const indexHtml = await selectionRes.text();
        if (looksLikeJwxtLocalLoginHtml(indexHtml)) {
          throw new Error('Selection page is JWXT local login HTML (session invalid)');
        }
        const parsed = parseSelectionIndexHtml({ indexHtml, preferredXkkzId: state.preferredXkkzId });
        const indexFields = parsed.indexFields;
        const tabs = parsed.tabs;

        const rounds = await mapWithConcurrency(tabs as any[], concurrency, async (tab) => {
          const payload = buildSelectionDisplayPayload({ indexFields, selectedTab: tab as any });
          const displayRes = await gmFetch(cfg.selectionDisplayUrl, {
            method: 'POST',
            headers: {
              'x-requested-with': 'XMLHttpRequest',
              'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
              referer: cfg.selectionIndexUrl
            },
            body: payload,
            timeout: 20000
          });
          if (displayRes.status !== 200) {
            return { xkkzId: tab.xkkzId, kklxdm: tab.kklxdm, kklxLabel: tab.kklxLabel, active: tab.active };
          }
          const displayHtml = await displayRes.text();
          const displayFields = parseSelectionPageFields(displayHtml);
          const displayRoundMeta = extractRoundMetaFromHtml(displayHtml);
          return {
            xkkzId: tab.xkkzId,
            xklc: stringify(displayFields.xklc || displayRoundMeta.xklc || ''),
            xklcmc: stringify(displayFields.xklcmc || displayRoundMeta.xklcmc || ''),
            kklxdm: tab.kklxdm,
            kklxLabel: tab.kklxLabel,
            active: tab.active
          };
        });

        return {
          term: {
            xkxnm: stringify((indexFields as any).xkxnm) || undefined,
            xkxqm: stringify((indexFields as any).xkxqm) || undefined,
            xkxnmc: stringify((indexFields as any).xkxnmc) || undefined,
            xkxqmc: stringify((indexFields as any).xkxqmc) || undefined
          },
          selectedXkkzId: state.currentXkkzId,
          activeXkkzId: stringify((indexFields as any).firstXkkzId) || (tabs as any[]).find((t: any) => t.active)?.xkkzId || null,
          rounds
        };
      })();
      if (signal.aborted) return { ok: false, done: false, error: 'ABORTED', retryable: false };
      return { ok: true, done: true, result: data };
    }
  });

  function taskStart(request: TaskStartRequest & Record<string, any>) {
    const res = taskManager.start(request);
    return res.ok ? res : { ok: false, error: res.error };
  }

  function taskStop(taskId: string) {
    return taskManager.stop(String(taskId || '').trim());
  }

  function taskUpdate(taskId: string, patch: Record<string, any>) {
    return taskManager.update(String(taskId || '').trim(), patch && typeof patch === 'object' ? patch : {});
  }

  function taskGet(taskId: string) {
    const task = taskManager.get(String(taskId || '').trim());
    return { ok: true, task };
  }

  function taskList() {
    return { ok: true, tasks: taskManager.list() };
  }

  const backendHandlers: any = {
    login,
    status,
    ping,
    rounds,
    selectRound,
    search,
    syncSelected,
    enroll,
    drop,
    crawlSnapshot,
    push,
    checkSelectable,
    getEnrollmentBreakdown,
    getUserProfileSignals,
    getRoundPolicy,
    taskStart,
    taskStop,
    taskUpdate,
    taskGet,
    taskList,
    logout
  };

  function debugLocal() {
    return Promise.resolve({
      ok: true,
      supported: true,
      version: debug.version,
      origin: debug.origin,
      isBackendPage: Boolean(isBackendPage),
      gm: debug.gm
    });
  }

  function proxy(action: string) {
    return async (...args: any[]) => {
      const gmXhrAvailable = Boolean(getGmXhr());
      if (!gmXhrAvailable) return { ok: false, supported: true, error: 'GM request API unavailable (check @grant / userscript manager settings)' };
      return backendHandlers[action](...args);
    };
  }

  const backendApi: any = {
    fetch: gmFetch,
    debugLocal,
    login: proxy('login'),
    status: proxy('status'),
    ping: proxy('ping'),
    rounds: proxy('rounds'),
    selectRound: proxy('selectRound'),
    search: proxy('search'),
    syncSelected: proxy('syncSelected'),
    enroll: proxy('enroll'),
    drop: proxy('drop'),
    crawlSnapshot: proxy('crawlSnapshot'),
    push: proxy('push'),
    checkSelectable: proxy('checkSelectable'),
    getEnrollmentBreakdown: proxy('getEnrollmentBreakdown'),
    getUserProfileSignals: proxy('getUserProfileSignals'),
    getRoundPolicy: proxy('getRoundPolicy'),
    taskStart: proxy('taskStart'),
    taskStop: proxy('taskStop'),
    taskUpdate: proxy('taskUpdate'),
    taskGet: proxy('taskGet'),
    taskList: proxy('taskList'),
    logout: proxy('logout')
  };
  installBackendToPage(backendApi);

  console.info(isBackendPage ? '[JWXT Userscript] backend executor ready' : '[JWXT Userscript] frontend bridge ready', {
    version: debug.version,
    origin: debug.origin,
    isBackendPage: debug.isBackendPage
  });
})();
