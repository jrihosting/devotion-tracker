/**
 * Devotion Tracker — Google Apps Script Web App
 * Devotion Tracker Web App
 *
 * LOOP ENGINEERING:
 *   Config Loop (setup → store → read)
 *   Connection Loop (pick sheet → pick tab → pick columns)
 *   Mapping Loop (map col A → col B across sheets)
 *   Observation Loop (read sheets → display)
 *   Lookup Loop (phone → cross-sheet resolution)
 *   Insert Loop (validate → append → refresh)
 *   Aggregation Loop (stats → charts)
 */

// ──────────────────────────────────────────────
// MINIMAL CONFIG — Super admin (sekour), lòt users nan sheet
// ──────────────────────────────────────────────
const CONFIG = {
  AUTH: {
    SUPER_ADMINS: [
      { email: 'admin@jrispace.com', pin: '1234', role: 'super_admin', name: 'Super Admin' },
      { email: 'tgdr.media@tabernacleofglory.net', pin: '1234', role: 'super_admin', name: 'Media Admin' },
    ],
    PROPERTY_KEY: 'DEVOTION_TRACKER_TOKENS',
  },
  CONFIG_KEY: 'DEVOTION_APP_CONFIG',
};

// ──────────────────────────────────────────────
// CONFIG MANAGER — tout konfigirasyon dinamis
// ──────────────────────────────────────────────
function getAppConfig() {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(CONFIG.CONFIG_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch(e) { return null; }
}

function saveAppConfig(config) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty(CONFIG.CONFIG_KEY, JSON.stringify(config));
}

function hasConfig() {
  return getAppConfig() !== null;
}

// ──────────────────────────────────────────────
// doGet — Serve web app
// ──────────────────────────────────────────────
function doGet() {
  const template = HtmlService.createTemplateFromFile('Index');
  const output = template.evaluate()
    .setTitle('Devotion Tracker')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  return output;
}

// ──────────────────────────────────────────────
// doPost — JSON REST API pou lokal & ekstèn
// ──────────────────────────────────────────────
// Pèmèt dev/server lokal la rele fonksyon yo vía fetch()
// Accepte: { action: "fonksyonNon", args: [arg1, arg2, ...] }
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const args = data.args || [];
    const fn = globalThis[action];
    if (typeof fn !== 'function') {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: 'Action inconnue: ' + action }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    // Retounen rezilta fonksyon an dirèkteman (pa plis包裹)
    const result = fn.apply(null, args);
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function include(file) {
  return HtmlService.createHtmlOutputFromFile(file).getContent();
}

// ── Pou Service Account (Execution API) ─────────────────
// Rele sa a via Execution API pou jwenn yon token valid
// San bezwen email/pin, paske Execution API deja verifye moun k ap rele a
function getTokenForServiceAccount() {
  const token = Utilities.getUuid();
  const props = PropertiesService.getUserProperties();
  props.setProperty(CONFIG.AUTH.PREFIX + token, JSON.stringify({
    email: 'service-account@system.local',
    role: 'super_admin',
    name: 'Service Account',
    timestamp: Date.now(),
  }));
  return { ok: true, token: token };
}

// ──────────────────────────────────────────────
// AUTH
// ──────────────────────────────────────────────
function authenticate(email, pin) {
  const cleanEmail = email.toLowerCase().trim();

  // 1. Tcheke super admin anvan
  for (const sa of CONFIG.AUTH.SUPER_ADMINS) {
    if (sa.email === cleanEmail && sa.pin === pin) {
      const token = Utilities.getUuid();
      const props = PropertiesService.getUserProperties();
      const tokens = JSON.parse(props.getProperty(CONFIG.AUTH.PROPERTY_KEY) || '{}');
      tokens[token] = { email: cleanEmail, role: sa.role, name: sa.name, loginAt: new Date().toISOString() };
      props.setProperty(CONFIG.AUTH.PROPERTY_KEY, JSON.stringify(tokens));
      return { ok: true, token, user: { email: cleanEmail, role: sa.role, name: sa.name } };
    }
  }

  // 2. Tcheke nan users sheet si config la egziste
  const config = getAppConfig();
  if (config) {
    const usersConn = _findConnByRole(config, 'users');
    if (usersConn) {
      try {
        const headers = _getCachedHeaders(usersConn);
        const rows = _getCachedRows(usersConn);

        const emailCol = _findColumn(headers, ['EMAIL', 'COURRIEL', 'IMEL']);
        const pinCol = _findColumn(headers, ['PIN', 'PASSWORD', 'MOTDEPASSE', 'KOD']);
        const roleCol = _findColumn(headers, ['ROLE', 'WOL']);
        const nameCol = _findColumn(headers, ['NAME', 'NON', 'PRENOM', 'FULL NAME', 'USERNAME']);

        if (emailCol !== null && pinCol !== null) {
          for (const row of rows) {
            const rowEmail = String(row[headers[emailCol]] || '').toLowerCase().trim();
            const rowPin = String(row[headers[pinCol]] || '').trim();
            if (rowEmail === cleanEmail) {
              if (rowPin !== pin) {
                return { ok: false, error: 'PIN kòd pa bon' };
              }
              const token = Utilities.getUuid();
              const role = roleCol !== null ? (row[headers[roleCol]] || 'user') : 'user';
              const name = nameCol !== null ? (row[headers[nameCol]] || cleanEmail) : cleanEmail;
              const props = PropertiesService.getUserProperties();
              const tokens = JSON.parse(props.getProperty(CONFIG.AUTH.PROPERTY_KEY) || '{}');
              tokens[token] = { email: cleanEmail, role, name, loginAt: new Date().toISOString() };
              props.setProperty(CONFIG.AUTH.PROPERTY_KEY, JSON.stringify(tokens));
              return { ok: true, token, user: { email: cleanEmail, role, name } };
            }
          }
        }
      } catch (e) {
        // Si gen erè ak sheet la, kontinye
      }
    }
  }

  return { ok: false, error: 'Email pa rekonèt nan sistèm nan' };
}

function _findColumn(headers, names) {
  for (let i = 0; i < headers.length; i++) {
    const upper = headers[i].toString().toUpperCase().trim();
    for (const name of names) {
      if (upper === name) return i;
    }
  }
  // Deuxième passe: partial match
  for (let i = 0; i < headers.length; i++) {
    const upper = headers[i].toString().toUpperCase().trim();
    for (const name of names) {
      if (upper.includes(name)) return i;
    }
  }
  return null;
}

function googleSignIn() {
  try {
    const email = Session.getActiveUser().getEmail();
    if (!email) {
      return { ok: false, error: 'Pa ka detekte imèl Google ou. Verifye w siyen nan Google.' };
    }
    const cleanEmail = email.toLowerCase().trim();
    // Tcheke si se super admin
    for (const sa of CONFIG.AUTH.SUPER_ADMINS) {
      if (sa.email === cleanEmail) {
        const token = Utilities.getUuid();
        const props = PropertiesService.getUserProperties();
        const tokens = JSON.parse(props.getProperty(CONFIG.AUTH.PROPERTY_KEY) || '{}');
        tokens[token] = { email: cleanEmail, role: sa.role, name: sa.name, loginAt: new Date().toISOString() };
        props.setProperty(CONFIG.AUTH.PROPERTY_KEY, JSON.stringify(tokens));
        return { ok: true, token, user: { email: cleanEmail, role: sa.role, name: sa.name } };
      }
    }
    // Tcheke nan users sheet
    const config = getAppConfig();
    if (config) {
      const usersConn = _findConnByRole(config, 'users');
      if (usersConn) {
        const headers = _getCachedHeaders(usersConn);
        const rows = _getCachedRows(usersConn);
        const emailCol = _findColumn(headers, ['EMAIL', 'COURRIEL', 'IMEL']);
        const roleCol = _findColumn(headers, ['ROLE', 'WOL']);
        const nameCol = _findColumn(headers, ['NAME', 'NON', 'PRENOM', 'FULL NAME', 'USERNAME']);
        if (emailCol !== null) {
          for (const row of rows) {
            const rowEmail = String(row[headers[emailCol]] || '').toLowerCase().trim();
            if (rowEmail === cleanEmail) {
              const token = Utilities.getUuid();
              const role = roleCol !== null ? (row[headers[roleCol]] || 'user') : 'user';
              const name = nameCol !== null ? (row[headers[nameCol]] || cleanEmail) : cleanEmail;
              const props = PropertiesService.getUserProperties();
              const tokens = JSON.parse(props.getProperty(CONFIG.AUTH.PROPERTY_KEY) || '{}');
              tokens[token] = { email: cleanEmail, role, name, loginAt: new Date().toISOString() };
              props.setProperty(CONFIG.AUTH.PROPERTY_KEY, JSON.stringify(tokens));
              return { ok: true, token, user: { email: cleanEmail, role, name } };
            }
          }
        }
      }
    }
    return { ok: false, error: 'Imèl Google sa pa rekonèt nan sistèm nan' };
  } catch (e) {
    return { ok: false, error: 'Erè Google Auth: ' + e.message };
  }
}

function verifyToken(token) {
  if (!token) return null;
  const props = PropertiesService.getUserProperties();
  const tokens = JSON.parse(props.getProperty(CONFIG.AUTH.PROPERTY_KEY) || '{}');
  return tokens[token] || null;
}

function logout(token) {
  if (!token) return;
  const props = PropertiesService.getUserProperties();
  const tokens = JSON.parse(props.getProperty(CONFIG.AUTH.PROPERTY_KEY) || '{}');
  delete tokens[token];
  props.setProperty(CONFIG.AUTH.PROPERTY_KEY, JSON.stringify(tokens));
}

// ──────────────────────────────────────────────
// CONFIG ENDPOINTS (Frontend → Backend)
// ──────────────────────────────────────────────
function checkHasConfig(token) {
  if (!verifyToken(token)) throw new Error('Unauthorized');
  return { ok: true, hasConfig: hasConfig(), config: getAppConfig() };
}

function listSpreadsheetTabs(token, spreadsheetId) {
  if (!verifyToken(token)) throw new Error('Unauthorized');
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheets = ss.getSheets();
    return {
      ok: true,
      tabs: sheets.map(s => ({
        name: s.getSheetName(),
        index: s.getIndex(),
        isHidden: !s.isSheetHidden(),
      })),
      name: ss.getName(),
    };
  } catch (e) {
    return { ok: false, error: 'Pa ka ouvri spreadsheet sa. Verifye ID a epi asire w li pataje ak editè AppScript la.' };
  }
}

function listSheetColumns(token, spreadsheetId, tabName) {
  if (!verifyToken(token)) throw new Error('Unauthorized');
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = tabName ? ss.getSheetByName(tabName) : ss.getSheets()[0];
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) return { ok: true, columns: [] };
    const headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
    return {
      ok: true,
      columns: headers.map((h, i) => ({
        name: String(h || 'Column ' + (i + 1)),
        index: i,
      })),
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function getSpreadsheetName(token, spreadsheetId) {
  if (!verifyToken(token)) throw new Error('Unauthorized');
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    return { ok: true, name: ss.getName() };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function saveFullConfig(token, config) {
  if (!verifyToken(token)) throw new Error('Unauthorized');
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const oldConfig = getAppConfig();
    saveAppConfig(config);
    _clearConfiguredCaches(oldConfig);
    _clearConfiguredCaches(config);
    _clearMembersCache();
    _bumpDataVersion('config');
    return { ok: true, message: 'Konfigirasyon anrejistre!' };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

function resetConfig(token) {
  if (!verifyToken(token)) throw new Error('Unauthorized');
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const oldConfig = getAppConfig();
    const props = PropertiesService.getScriptProperties();
    props.deleteProperty(CONFIG.CONFIG_KEY);
    _clearConfiguredCaches(oldConfig);
    _clearMembersCache();
    _bumpDataVersion('config_reset');
    return { ok: true, message: 'Konfigirasyon efase!' };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

// ──────────────────────────────────────────────
// CACHE LAYER — CacheService pou akselere
// ──────────────────────────────────────────────
const CACHE_TTL = 21600; // 6 hours; Apps Script CacheService max TTL
const CACHE_VERSION = 'v5';
const MEMBERS_CACHE_KEY = 'dt_v5_members_list'; // 6-hour cache for getMembersList result
const DATA_VERSION_KEY = 'dt_v5_data_version';
const DATA_MANIFEST_KEY = 'dt_v5_data_manifest';

function _cacheKey(conn, kind) {
  return `dt_${CACHE_VERSION}_${conn.spreadsheetId}_${conn.sheetTab || '_default'}_${kind}`;
}

function _cacheGet(key) {
  try {
    const cache = CacheService.getScriptCache();
    const raw = cache.get(key);
    if (raw) {
      const cachedValue = _readCachePayload(raw);
      if (cachedValue !== null) return cachedValue;
      cache.remove(key);
    }

    // Retry via PropertiesService (pou gwo data)
    const props = PropertiesService.getScriptProperties();
    const fallback = props.getProperty(key);
    if (fallback) {
      const fallbackValue = _readCachePayload(fallback);
      if (fallbackValue !== null) return fallbackValue;
      props.deleteProperty(key);
    }
  } catch (e) { /* ignore cache errors */ }
  return null;
}

function _readCachePayload(raw) {
  const parsed = JSON.parse(raw);
  if (parsed && parsed.__dtCache === true) {
    if (parsed.expiresAt && Date.now() > parsed.expiresAt) return null;
    return parsed.data;
  }
  return parsed;
}

function _cachePut(key, data, ttl) {
  try {
    const expiry = Math.min(Number(ttl || CACHE_TTL) || CACHE_TTL, 21600);
    const json = JSON.stringify({
      __dtCache: true,
      expiresAt: Date.now() + expiry * 1000,
      data: data,
    });
    // CacheService — rapid, limite a ~100KB
    if (json.length < 95000) {
      const cache = CacheService.getScriptCache();
      cache.put(key, json, expiry);
    }
    // PropertiesService — pi dousman, men 500KB disponib
    const props = PropertiesService.getScriptProperties();
    props.setProperty(key, json);
  } catch (e) { /* ignore cache errors */ }
}

function _cacheRemoveKeys(keys) {
  try {
    const unique = [];
    const seen = {};
    (keys || []).forEach(function(key) {
      if (key && !seen[key]) {
        seen[key] = true;
        unique.push(key);
      }
    });
    if (!unique.length) return;

    const cache = CacheService.getScriptCache();
    for (var i = 0; i < unique.length; i += 100) {
      const chunk = unique.slice(i, i + 100);
      try {
        cache.removeAll(chunk);
      } catch (e) {
        chunk.forEach(function(key) {
          try { cache.remove(key); } catch (ignore) {}
        });
      }
    }

    const props = PropertiesService.getScriptProperties();
    unique.forEach(function(key) {
      try { props.deleteProperty(key); } catch (ignore) {}
    });
  } catch (e) { /* ignore */ }
}

function _cacheRemove(conn) {
  try {
    _clearPhoneLookupCache(conn);
    const kinds = ['headers', 'rows', 'rows_all', 'rows_1', 'rows_25', 'rows_50', 'rows_100', 'rows_500', 'phone_lookup_meta'];
    const keys = kinds.map(function(kind) { return _cacheKey(conn, kind); });
    _cacheRemoveKeys(keys);
  } catch (e) { /* ignore */ }
}

function _clearMembersCache() {
  try {
    _cacheRemoveKeys([
      MEMBERS_CACHE_KEY,
      'dt_v4_members_list',
      'dt_v3_members_list',
      'dt_v2_members_list',
      'dt_members_list',
    ]);
  } catch(e) { /* ignore */ }
}

function _clearConfiguredCaches(config) {
  try {
    _clearMembersCache();
    _cacheRemoveKeys([DATA_MANIFEST_KEY]);
    (config && config.connections || []).forEach(function(conn) {
      _cacheRemove(conn);
    });
  } catch(e) { /* ignore */ }
}

function _clearAllDataCaches() {
  try {
    _clearConfiguredCaches(getAppConfig());
    const props = PropertiesService.getScriptProperties();
    const dtKeys = props.getKeys().filter(function(key) {
      return key.indexOf('dt_') === 0 && key !== DATA_VERSION_KEY;
    });
    _cacheRemoveKeys(dtKeys);
  } catch(e) { /* ignore */ }
}

function _getDataVersion() {
  try {
    const props = PropertiesService.getScriptProperties();
    let version = props.getProperty(DATA_VERSION_KEY);
    if (!version) {
      version = String(Date.now());
      props.setProperty(DATA_VERSION_KEY, version);
    }
    return version;
  } catch(e) {
    return String(Date.now());
  }
}

function _bumpDataVersion(reason) {
  try {
    const version = Date.now() + ':' + (reason || 'data');
    PropertiesService.getScriptProperties().setProperty(DATA_VERSION_KEY, version);
    _cacheRemoveKeys([DATA_MANIFEST_KEY]);
    return version;
  } catch(e) {
    return String(Date.now());
  }
}

function _connectionSignature(conn) {
  const sig = {
    name: conn.name || '',
    role: conn.role || '',
    spreadsheetId: conn.spreadsheetId || '',
    sheetTab: conn.sheetTab || '',
    sheetName: '',
    lastRow: 0,
    lastColumn: 0,
    lastUpdated: 0,
    error: '',
  };

  try {
    const sheet = _openDynamicSheet(conn);
    sig.sheetName = sheet.getName();
    sig.lastRow = sheet.getLastRow();
    sig.lastColumn = sheet.getLastColumn();
  } catch(e) {
    sig.error = e.message;
  }

  try {
    sig.lastUpdated = DriveApp.getFileById(conn.spreadsheetId).getLastUpdated().getTime();
  } catch(e) {
    sig.lastUpdated = 0;
  }

  sig.key = [
    sig.role,
    sig.spreadsheetId,
    sig.sheetTab,
    sig.lastRow,
    sig.lastColumn,
    sig.lastUpdated,
    sig.error,
  ].join(':');
  return sig;
}

function getDataManifest(token) {
  if (!verifyToken(token)) throw new Error('Unauthorized');
  const config = getAppConfig();
  if (!config) return { ok: false, error: 'Pa gen konfigirasyon', needsSetup: true };

  const signatures = (config.connections || []).map(function(conn) {
    return _connectionSignature(conn);
  });
  const devotionSig = signatures.filter(function(sig) { return sig.role === 'devotion'; });
  const memberSigs = signatures.filter(function(sig) { return sig.role !== 'devotion' && sig.role !== 'users'; });
  const userSigs = signatures.filter(function(sig) { return sig.role === 'users'; });
  const dataVersion = _getDataVersion();
  const base = CACHE_VERSION + ':' + dataVersion + ':';
  const devotionKey = devotionSig.map(function(sig) { return sig.key; }).join('|');
  const membersKey = memberSigs.map(function(sig) { return sig.key; }).join('|');
  const usersKey = userSigs.map(function(sig) { return sig.key; }).join('|');

  return {
    ok: true,
    cacheVersion: CACHE_VERSION,
    ttlSeconds: CACHE_TTL,
    generatedAt: Date.now(),
    dataVersion,
    signatures: {
      devotion: devotionSig,
      members: memberSigs,
      users: userSigs,
      connections: signatures,
    },
    keys: {
      dashboard: base + 'dashboard:' + devotionKey + ':' + membersKey + ':' + usersKey,
      tracker: base + 'tracker:' + devotionKey,
      trackerFeed: base + 'tracker_feed:' + devotionKey,
      devotionals: base + 'devotionals:' + devotionKey,
      members: base + 'members:' + membersKey,
      users: base + 'users:' + usersKey,
    },
  };
}

function _rowHasContent(row) {
  return row.some(cell => {
    if (cell === null || cell === undefined) return false;
    if (cell instanceof Date) return true;
    return String(cell).trim() !== '';
  });
}

// ──────────────────────────────────────────────
// DYNAMIC SHEET HELPERS — baze sou config
// ──────────────────────────────────────────────
function _openDynamicSheet(conn) {
  const ss = SpreadsheetApp.openById(conn.spreadsheetId);
  const sheet = conn.sheetTab ? ss.getSheetByName(conn.sheetTab) : ss.getSheets()[0];
  if (!sheet) throw new Error('Tab ' + (conn.sheetTab || 'default') + ' pa jwenn nan spreadsheet ' + conn.spreadsheetId);
  return sheet;
}

function _getCachedHeaders(conn) {
  const key = _cacheKey(conn, 'headers');
  let cached = _cacheGet(key);
  if (cached) return cached;
  const sheet = _openDynamicSheet(conn);
  const maxCols = sheet.getLastColumn();
  cached = maxCols === 0 ? [] : sheet.getRange(1, 1, 1, maxCols).getDisplayValues()[0];
  _cachePut(key, cached);
  return cached;
}

function _getCachedRows(conn, maxRows) {
  const requestedLimit = maxRows && Number(maxRows) > 0 ? Math.floor(Number(maxRows)) : 0;
  const key = _cacheKey(conn, requestedLimit ? 'rows_' + requestedLimit : 'rows_all');
  let cached = _cacheGet(key);
  if (cached) return cached;

  const sheet = _openDynamicSheet(conn);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];

  const rowCount = requestedLimit ? Math.min(lastRow - 1, requestedLimit) : (lastRow - 1);

  const headers = lastCol === 0 ? [] : sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  const data = sheet.getRange(2, 1, rowCount, lastCol).getDisplayValues();
  const rows = data.map((row, idx) => {
    if (!_rowHasContent(row)) return null;
    const obj = { _row: idx + 2 };
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  }).filter(Boolean);

  _cachePut(key, rows);
  return rows;
}

// Ankò pou retro-konpatibilite
function _getHeaders(sheet) {
  const maxCols = sheet.getLastColumn();
  if (maxCols === 0) return [];
  return sheet.getRange(1, 1, 1, maxCols).getDisplayValues()[0];
}

function _getAllRows(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];
  const headers = _getHeaders(sheet);
  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
  return data.map((row, idx) => {
    if (!_rowHasContent(row)) return null;
    const obj = { _row: idx + 2 };
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  }).filter(Boolean);
}

function _appendRow(sheet, data, headers) {
  const row = headers.map(h => data[h] !== undefined ? data[h] : '');
  sheet.appendRow(row);
}

function _updateRow(sheet, rowIndex, data, headers) {
  const values = headers.map(h => data[h] !== undefined ? data[h] : '');
  sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
}

function _invalidateCacheFor(conn) {
  _cacheRemove(conn);
  _clearMembersCache();
  _bumpDataVersion('sheet_write');
}

// ──────────────────────────────────────────────
// DRIVE SEARCH — chèche spreadsheet nan Drive
// ──────────────────────────────────────────────
function searchDriveSheets(token, query) {
  if (!verifyToken(token)) throw new Error('Unauthorized');
  if (!query || query.trim().length < 2) return { ok: false, error: 'Antre omwen 2 karaktè' };

  try {
    const clean = query.trim();
    // DriveApp.searchFiles limite a 20 rezilta
    const files = DriveApp.searchFiles(
      'title contains "' + clean.replace(/"/g, '\\"') + '" and mimeType = "application/vnd.google-apps.spreadsheet"'
    );

    const results = [];
    while (files.hasNext() && results.length < 20) {
      const f = files.next();
      results.push({
        id: f.getId(),
        name: f.getName(),
        owner: f.getOwner() ? f.getOwner().getEmail() : '',
      });
    }

    return { ok: true, files: results };
  } catch (e) {
    return { ok: false, error: 'Drive search: ' + e.message };
  }
}

function clearCache() {
  try {
    _clearAllDataCaches();
    _bumpDataVersion('manual_clear');
    return { ok: true, message: 'Cache netwaye!' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ──────────────────────────────────────────────
// CHECK PERMISSIONS — fòse otorizasyon Drive
// ──────────────────────────────────────────────
function getDriveAuthUrl() {
  try {
    DriveApp.getRootFolder();
    return { ok: true, authorized: true };
  } catch (e) {
    const info = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);
    return { ok: false, authorized: false, authUrl: info.getAuthorizationUrl() };
  }
}

// ──────────────────────────────────────────────
// GET CONNECTION BY ROLE — chèche koneksyon pa wòl
// ──────────────────────────────────────────────
function _findConnByRole(config, role) {
  if (!config || !config.connections) return null;
  return config.connections.find(c => c.role === role) || null;
}

function _findConnByName(config, name) {
  if (!config || !config.connections) return null;
  return config.connections.find(c => c.name === name) || null;
}

function _getFieldMapping(config, conn, pageTypeFallback) {
  if (!config.fieldMappings) return {};
  if (conn && config.fieldMappings[conn.name]) return config.fieldMappings[conn.name];
  if (pageTypeFallback && config.fieldMappings[pageTypeFallback]) return config.fieldMappings[pageTypeFallback];
  return {};
}

function _mappedColumnName(fieldMapping, appField, fallback) {
  const mapped = fieldMapping && fieldMapping[appField];
  if (mapped !== undefined && mapped !== null && String(mapped).trim() !== '') {
    return String(mapped).trim();
  }
  return fallback;
}

function _generateShortUniqueId() {
  return Utilities.getUuid().replace(/-/g, '').substring(0, 8);
}

function _generateUniqueShortId(sheet, headers, idColumn) {
  const existing = {};
  const colIndex = headers.indexOf(idColumn);
  if (colIndex >= 0 && sheet.getLastRow() >= 2) {
    const values = sheet.getRange(2, colIndex + 1, sheet.getLastRow() - 1, 1).getDisplayValues();
    values.forEach(row => {
      const value = String(row[0] || '').trim();
      if (value) existing[value] = true;
    });
  }

  for (let i = 0; i < 25; i++) {
    const id = _generateShortUniqueId();
    if (!existing[id]) return id;
  }
  return Utilities.getUuid().replace(/-/g, '').substring(0, 12);
}

// ──────────────────────────────────────────────
// TRACKER — Read (dinamik selon konfigirasyon)
// ──────────────────────────────────────────────
function getTrackerData(token, opts) {
  if (!verifyToken(token)) throw new Error('Unauthorized');
  const config = getAppConfig();
  if (!config) return { ok: false, error: 'Pa gen konfigirasyon', needsSetup: true };

  const devotionConn = _findConnByRole(config, 'devotion');
  if (!devotionConn) return { ok: false, error: 'Pa gen koneksyon devotion nan config', needsSetup: true };

  const headers = _getCachedHeaders(devotionConn);
  const rows = _getCachedRows(devotionConn);

  const colMap = {};
  headers.forEach((h, i) => { colMap[h.trim().toUpperCase()] = i; });

  opts = opts || {};
  const page = Math.max(0, opts.page || 0);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize || 25));

  // Filtre rechèch (server-side)
  let filtered = rows;
  if (opts.search) {
    const term = opts.search.toLowerCase();
    filtered = rows.filter(function(r) {
      return headers.some(function(h) {
        return String(r[h] || '').toLowerCase().includes(term);
      });
    });
  }

  // Tri (server-side)
  if (opts.sortCol && headers.indexOf(opts.sortCol) >= 0) {
    var col = opts.sortCol;
    var dir = opts.sortDir === 'desc' ? -1 : 1;
    filtered.sort(function(a, b) {
      var av = String(a[col] || '').toLowerCase();
      var bv = String(b[col] || '').toLowerCase();
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  }

  var total = filtered.length;
  var start = page * pageSize;
  var sliced = filtered.slice(start, start + pageSize);

  return {
    ok: true,
    headers: headers,
    rows: sliced,
    colMap: colMap,
    total: total,
    page: page,
    pageSize: pageSize,
    connection: devotionConn,
  };
}

// ──────────────────────────────────────────────
// ADD DEVOTION — append sèlman
// ──────────────────────────────────────────────
function addDevotion(token, entry) {
  const session = verifyToken(token);
  if (!session) throw new Error('Unauthorized');
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    entry = entry || {};
    const config = getAppConfig();
    if (!config) return { ok: false, error: 'Pa gen konfigirasyon', needsSetup: true };

    const devotionConn = _findConnByRole(config, 'devotion');
    if (!devotionConn) return { ok: false, error: 'Pa gen koneksyon devotion' };

    const sheet = _openDynamicSheet(devotionConn);
    const headers = _getHeaders(sheet);

    // Apply field mapping in reverse: app field → sheet column
    var fieldMapping = _getFieldMapping(config, devotionConn, 'devotionals');
    const uniqueIdColumn = _mappedColumnName(fieldMapping, 'UNIQUE ID', 'UNIQUE ID');
    if (!entry['UNIQUE ID']) {
      entry['UNIQUE ID'] = _generateUniqueShortId(sheet, headers, uniqueIdColumn);
    }
    if (!entry.Timestamp) {
      entry.Timestamp = new Date().toISOString();
    }
    if (!entry['Reporter Name']) {
      entry['Reporter Name'] = session.name || session.email || '';
    }
    if (!entry['DATE POSTED'] && !entry.DATE) {
      entry['DATE POSTED'] = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MM/dd/yyyy');
    }

    var sheetEntry = {};
    for (var key in entry) {
      if (entry.hasOwnProperty(key)) {
        var sheetCol = _mappedColumnName(fieldMapping, key, key);
        sheetEntry[sheetCol] = entry[key];
      }
    }

    const idCol = headers[0];
    if (idCol && sheetEntry[idCol] === undefined) {
      const lastId = sheet.getLastRow() >= 1
        ? sheet.getRange(sheet.getLastRow(), 1).getValue()
        : 0;
      sheetEntry[idCol] = (parseInt(lastId) || 0) + 1;
    }

    _appendRow(sheet, sheetEntry, headers);
    _invalidateCacheFor(devotionConn);
    _clearMembersCache();
    return { ok: true, message: 'Devotion anrejistre avèk siksè!' };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

// ──────────────────────────────────────────────
// UPDATE / DELETE DEVOTION
// ──────────────────────────────────────────────
function updateDevotion(token, rowIndex, entry) {
  if (!verifyToken(token)) throw new Error('Unauthorized');
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const config = getAppConfig();
    const devotionConn = _findConnByRole(config, 'devotion');
    if (!devotionConn) return { ok: false, error: 'Pa gen koneksyon devotion' };

    const sheet = _openDynamicSheet(devotionConn);
    const headers = _getHeaders(sheet);

    // Apply field mapping in reverse: app field → sheet column
    var fieldMapping = _getFieldMapping(config, devotionConn, 'devotionals');
    var sheetEntry = {};
    for (var key in entry) {
      if (entry.hasOwnProperty(key)) {
        var sheetCol = fieldMapping[key] || key;
        sheetEntry[sheetCol] = entry[key];
      }
    }
    sheetEntry.Timestamp = new Date().toISOString();
    _updateRow(sheet, rowIndex, sheetEntry, headers);
    _invalidateCacheFor(devotionConn);
    _clearMembersCache();
    return { ok: true, message: 'Devotion mete ajou!' };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

function deleteDevotion(token, rowIndex) {
  if (!verifyToken(token)) throw new Error('Unauthorized');
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const config = getAppConfig();
    const devotionConn = _findConnByRole(config, 'devotion');
    if (!devotionConn) return { ok: false, error: 'Pa gen koneksyon devotion' };

    const sheet = _openDynamicSheet(devotionConn);
    sheet.deleteRow(rowIndex);
    _invalidateCacheFor(devotionConn);
    _clearMembersCache();
    return { ok: true, message: 'Devotion efase!' };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

// ──────────────────────────────────────────────
// PHONE LOOKUP — chèche moun dinamik
// ──────────────────────────────────────────────
function _phoneLookupMetaKey(conn) {
  return _cacheKey(conn, 'phone_lookup_meta');
}

function _phoneLookupBucketKey(conn, suffix) {
  return _cacheKey(conn, 'phone_lookup_' + suffix);
}

function _findPhoneHeader(headers, fieldMapping) {
  const mappedPhoneHeader = (fieldMapping && (fieldMapping.PHONE || fieldMapping.phone || fieldMapping['FULL PHONE NUMBER'] || fieldMapping['CLEAN PHONE'])) || '';
  if (mappedPhoneHeader && headers.indexOf(mappedPhoneHeader) >= 0) return mappedPhoneHeader;

  const exactPhone = headers.find(function(h) {
    return String(h || '').trim().toUpperCase() === 'PHONE';
  });
  if (exactPhone) return exactPhone;

  const cleanPhone = headers.find(function(h) {
    const upper = String(h || '').trim().toUpperCase();
    return upper.indexOf('CLEAN') >= 0 && upper.indexOf('PHONE') >= 0;
  });
  if (cleanPhone) return cleanPhone;

  return headers.find(function(h) {
    const upper = String(h || '').trim().toUpperCase();
    return upper.indexOf('PHONE') >= 0 || upper.indexOf('TEL') >= 0;
  }) || '';
}

function _buildPhoneLookupBucket(config, conn, suffix) {
  const headers = _getCachedHeaders(conn);
  const fieldMapping = _getFieldMapping(config, conn, 'members');
  const phoneHeader = _findPhoneHeader(headers, fieldMapping);
  if (!phoneHeader) return [];

  const rows = _getCachedRows(conn);
  const bucket = [];
  for (const row of rows) {
    const val = row[phoneHeader];
    if (!val) continue;
    const cleanVal = val.toString().replace(/\D/g, '').trim();
    if (cleanVal && cleanVal.slice(-4) === suffix) {
      bucket.push({
        fromConn: conn.name,
        member: row,
        headers,
        phoneValue: val,
        fieldMapping,
        cleanPhone: cleanVal,
      });
    }
  }
  return bucket;
}

function _getPhoneLookupBucket(config, conn, suffix) {
  const bucketKey = _phoneLookupBucketKey(conn, suffix);
  const cached = _cacheGet(bucketKey);
  if (cached !== null) return cached;

  const bucket = _buildPhoneLookupBucket(config, conn, suffix);
  _cachePut(bucketKey, bucket);

  const metaKey = _phoneLookupMetaKey(conn);
  const meta = _cacheGet(metaKey) || { suffixes: [] };
  if (meta.suffixes.indexOf(suffix) < 0) {
    meta.suffixes.push(suffix);
    _cachePut(metaKey, meta);
  }
  return bucket;
}

function _clearPhoneLookupCache(conn) {
  try {
    const metaKey = _phoneLookupMetaKey(conn);
    const meta = _cacheGet(metaKey);
    const keys = [metaKey];
    if (meta && meta.suffixes && meta.suffixes.length) {
      meta.suffixes.forEach(function(suffix) {
        keys.push(_phoneLookupBucketKey(conn, suffix));
      });
    }
    _cacheRemoveKeys(keys);
  } catch(e) { /* ignore */ }
}

function lookupByPhone(token, phone) {
  if (!verifyToken(token)) throw new Error('Unauthorized');
  if (!phone || phone.trim() === '') {
    return { ok: true, found: false, error: 'Pa gen nimewo' };
  }

  const config = getAppConfig();
  if (!config) return { ok: false, error: 'Pa gen konfigirasyon', needsSetup: true };

  const cleanPhone = phone.toString().replace(/\D/g, '').trim();
  if (cleanPhone.length < 4) {
    return { ok: true, found: false, error: 'Tape omwen 4 chif pou chèche' };
  }

  // Chèche sèlman nan kolòn PHONE koneksyon manm yo.
  const results = [];
  const suffix = cleanPhone.slice(-4);

  for (const conn of (config.connections || [])) {
    if (conn.role !== 'lookup') continue;
    const bucket = _getPhoneLookupBucket(config, conn, suffix);
    for (const item of bucket) {
      const cleanVal = item.cleanPhone || (item.phoneValue || '').toString().replace(/\D/g, '').trim();
      if (cleanVal && cleanVal.endsWith(cleanPhone)) {
        results.push(item);
      }
    }
  }

  function enrichLookupResult(result) {
    const enriched = {};
    Object.assign(enriched, result.member);

    for (const appField in (result.fieldMapping || {})) {
      const sheetColumn = result.fieldMapping[appField];
      if (
        sheetColumn &&
        result.member[sheetColumn] !== undefined &&
        (enriched[appField] === undefined || enriched[appField] === null || String(enriched[appField]).trim() === '')
      ) {
        enriched[appField] = result.member[sheetColumn];
      }
    }

    for (const mapping of (config.mappings || [])) {
      // Chèche si yon moun jwenn nan either side of mapping
      if (result.fromConn === mapping.fromConn || result.fromConn === mapping.toConn) {
        const theHeaders = result.headers;
        if (theHeaders.includes(mapping.fromColumn)) {
          enriched[mapping.toColumn] = result.member[mapping.fromColumn];
        }
        if (theHeaders.includes(mapping.toColumn)) {
          enriched[mapping.fromColumn] = result.member[mapping.toColumn];
        }
      }
    }
    return enriched;
  }

  if (results.length > 0) {
    const members = results.map(result => ({
      member: enrichLookupResult(result),
      headers: result.headers,
      fromConn: result.fromConn,
      phoneValue: result.phoneValue,
      enriched: !!((config.mappings && config.mappings.length) || (result.fieldMapping && Object.keys(result.fieldMapping).length)),
    }));

    return {
      ok: true,
      found: true,
      members,
      member: members[0].member,
      headers: members[0].headers,
      fromConn: members[0].fromConn,
      enriched: members[0].enriched,
    };
  }

  return { ok: true, found: false, error: 'Pa jwenn moun sa nan baz done a' };
}

// ──────────────────────────────────────────────
// DEVOTIONALS — card view similar to members
// ──────────────────────────────────────────────
function getDevotionalsList(token) {
  if (!verifyToken(token)) throw new Error('Unauthorized');
  const config = getAppConfig();
  if (!config) return { ok: false, error: 'Pa gen konfigirasyon', needsSetup: true };

  const devotionConn = _findConnByRole(config, 'devotion');
  if (!devotionConn) return { ok: false, error: 'Pa gen koneksyon devotion', needsSetup: true };

  const headers = _getCachedHeaders(devotionConn);
  const rows = _getCachedRows(devotionConn);

  // Apply field mapping for devotionals
  var fieldMapping = _getFieldMapping(config, devotionConn, 'devotionals');
  function mapField(appField, fallback) {
    return _mappedColumnName(fieldMapping, appField, fallback);
  }

  const dateColumns = [mapField('DATE POSTED', 'DATE POSTED'), mapField('DATE', 'DATE'), mapField('date', 'DATE POSTED')];
  const nameColumns = [mapField('FULL NAME', 'FULL NAME'), mapField('Reporter Name', 'Reporter Name'), mapField('name', 'FULL NAME')];
  const campusMapped = mapField('CAMPUS', 'CAMPUS');
  const ministryMapped = mapField('MINISTRY', 'MINISTRY');

  const dateCol = headers.find(h => dateColumns.includes(h) || h.toUpperCase().includes('DATE'));
  const nameCol = headers.find(h =>
    nameColumns.includes(h) ||
    h.toUpperCase().includes('FULL NAME') || h.toUpperCase().includes('REPORTER') ||
    h.toUpperCase().includes('FIRST NAME')
  ) || headers[0];
  const campusCol = headers.find(h => campusMapped === h || h.toUpperCase().includes('CAMPUS'));
  const ministryCol = headers.find(h => ministryMapped === h || h.toUpperCase().includes('MINISTRY'));

  const devotionals = rows.map(r => {
    const dateRaw = dateCol ? r[dateCol] : null;
    let dateStr = '';
    let month = '';
    if (dateRaw) {
      if (typeof dateRaw === 'string') {
        dateStr = dateRaw;
        try {
          const p = dateRaw.split(/[\/\-]/);
          if (p.length === 3) month = p[2] + '-' + p[0].padStart(2, '0');
        } catch(e) {}
      } else if (dateRaw instanceof Date) {
        dateStr = Utilities.formatDate(dateRaw, Session.getScriptTimeZone(), 'MM/dd/yyyy');
        month = Utilities.formatDate(dateRaw, Session.getScriptTimeZone(), "yyyy-MM");
      }
    }
    return {
      name: nameCol ? r[nameCol] || '' : '',
      date: dateStr,
      month: month,
      campus: campusCol ? r[campusCol] || '' : '',
      ministry: ministryCol ? r[ministryCol] || '' : '',
    };
  });

  return { ok: true, devotionals, total: devotionals.length };
}

// ──────────────────────────────────────────────
// DASHBOARD — Stats dinamik
// ──────────────────────────────────────────────
function getDashboardStats(token, opts) {
  if (!verifyToken(token)) throw new Error('Unauthorized');
  const config = getAppConfig();
  if (!config) return { ok: false, error: 'Pa gen konfigirasyon', needsSetup: true };

  const devotionConn = _findConnByRole(config, 'devotion');
  if (!devotionConn) return { ok: false, error: 'Pa gen koneksyon devotion', needsSetup: true };

  // Apply devotion field mapping
  var devFieldMap = _getFieldMapping(config, devotionConn, 'devotionals');
  function devMap(appField, fallback) {
    return _mappedColumnName(devFieldMap, appField, fallback);
  }

  const headers = _getCachedHeaders(devotionConn);
  let rows = _getCachedRows(devotionConn);

  const dateColumns = [devMap('DATE POSTED', 'DATE POSTED'), devMap('DATE', 'DATE'), devMap('date', 'DATE POSTED')];
  const dateCol = headers.find(h => dateColumns.includes(h) || h.toUpperCase().includes('DATE'));

  // Apply date filter if provided
  if (opts && (opts.dateFrom || opts.dateTo) && dateCol) {
    rows = rows.filter(r => {
      const rd = r[dateCol];
      if (!rd) return true;
      const d = typeof rd === 'string' ? new Date(rd) : rd;
      if (isNaN(d.getTime())) return true;
      const ts = d.getTime();
      if (opts.dateFrom) {
        const from = new Date(opts.dateFrom).getTime();
        if (ts < from) return false;
      }
      if (opts.dateTo) {
        const to = new Date(opts.dateTo + 'T23:59:59').getTime();
        if (ts > to) return false;
      }
      return true;
    });
  }
  const campusCol = headers.find(h => h.toUpperCase().includes('CAMPUS'));
  const ministryCol = headers.find(h => h.toUpperCase().includes('MINISTRY'));
  const reporterCol = headers.find(h =>
    h.toUpperCase().includes('REPORTER') || h.toUpperCase().includes('FULL NAME')
  );
  const totalDevotions = rows.length;
  const byMonth = {};

  // Total members across all connections (except devotion)
  let totalMembers = 0;
  let totalUsers = 0;
  for (const conn of (config.connections || [])) {
    if (conn.role === 'devotion') continue;
    try {
      const s = _openDynamicSheet(conn);
      const count = Math.max(0, s.getLastRow() - 1);
      if (conn.role === 'users') totalUsers += count;
      else totalMembers += count;
    } catch (e) { /* skip */ }
  }

  for (const row of rows) {
    if (dateCol && row[dateCol]) {
      const d = new Date(row[dateCol]);
      if (!isNaN(d.getTime())) {
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        byMonth[monthKey] = (byMonth[monthKey] || 0) + 1;
      }
    }
  }

  const byCampus = {};
  if (campusCol) {
    for (const row of rows) {
      const val = row[campusCol] || 'Unknown';
      byCampus[val] = (byCampus[val] || 0) + 1;
    }
  }

  const byReporter = {};
  if (reporterCol) {
    for (const row of rows) {
      const val = row[reporterCol] || 'Unknown';
      byReporter[val] = (byReporter[val] || 0) + 1;
    }
  }

  const byMinistry = {};
  if (ministryCol) {
    for (const row of rows) {
      const val = row[ministryCol] || 'Unknown';
      byMinistry[val] = (byMinistry[val] || 0) + 1;
    }
  }

  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MM/dd/yyyy');
  const todayCount = dateCol
    ? rows.filter(r => {
        const rd = r[dateCol];
        if (!rd) return false;
        if (typeof rd === 'string') return rd.startsWith(today);
        if (rd instanceof Date) return Utilities.formatDate(rd, Session.getScriptTimeZone(), 'MM/dd/yyyy') === today;
        return false;
      }).length
    : 0;

  return {
    ok: true,
    stats: {
      totalDevotions,
      todayCount,
      totalMembers,
      totalUsers,
      byMonth: _sortObjectKeys(byMonth),
      byCampus,
      byReporter: _topN(byReporter, 10),
      byMinistry,
    },
    connections: config.connections,
    mappings: config.mappings || [],
  };
}

function _sortObjectKeys(obj) {
  return Object.keys(obj).sort().reduce((acc, k) => { acc[k] = obj[k]; return acc; }, {});
}

function _topN(obj, n) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
}

// ──────────────────────────────────────────────
// PREDEFINED FIELDS
// ──────────────────────────────────────────────
var MEMBER_FIELDS = [
  'ID', 'USER ID', 'CAMPUS', 'FULL NAME', 'FIRST NAME', 'LAST NAME', 'PHONE', 'HOME PHONE', 'WORK PHONE',
  'EMAIL', 'WORK EMAIL', 'GENDER', 'DOB', 'ADDRESS', 'CITY', 'STATE', 'ZIP CODE',
  'COUNTRY', 'HP', 'HP Number', 'LADDER', 'ADMIN POSITION', 'SIDE', 'MINISTRY', 'OTHER MINISTRIES',
  'OTHER CAMPUSES', 'STATUS', 'TEMPERAMENT', 'SPIRITUAL GIFT', 'LOVE LANGUAGE',
  'PHOTO', 'MARITAL STATUS', 'PROFILE LINK', 'EDUCATION', 'PROFESSION', 'CAMPUS TYPE',
  'TRAINING', 'LEVEL', 'CLEAN PHONE', 'INTEGRATION DATE', '_ComputedName', 'LadderID',
  'Default Image', 'LEADERSHIP LADDER', 'LADDER VIEW FILTERING', 'Volunteers',
  'IS BAPTIZED', 'BAPTISM DATE', 'IS GRADUATED', 'GRADUATION DATE', 'GATE',
];

// ──────────────────────────────────────────────
// MEMBER LIST — predefined fields
// ──────────────────────────────────────────────
var DEMO_MEMBERS = [
  { conn:"Members", ID:"1", CAMPUS:"Delmas", "FIRST NAME":"Jean", "LAST NAME":"Pierre", PHONE:"+509 34 56 7890", "HOME PHONE":"", "WORK PHONE":"", EMAIL:"jean.pierre@email.com", "WORK EMAIL":"", GENDER:"M", DOB:"15/03/1990", ADDRESS:"15 Rue Capois", CITY:"Port-au-Prince", STATE:"Ouest", "ZIP CODE":"HT6110", COUNTRY:"Haïti", HP:"", LADDER:"1", "ADMIN POSITION":"", SIDE:"", MINISTRY:"Louange", "OTHER MINISTRIES":"", "OTHER CAMPUSES":"", STATUS:"Actif", TEMPERAMENT:"Sanguin", "SPIRITUAL GIFT":"Enseignement", "LOVE LANGUAGE":"Service", PHOTO:"", "MARITAL STATUS":"Marié(e)", "PROFILE LINK":"", EDUCATION:"Université", PROFESSION:"Enseignant", "CAMPUS TYPE":"Principal", TRAINING:"Niveau 1", LEVEL:"Membre", "CLEAN PHONE":"50934567890", "INTEGRATION DATE":"01/01/2024", _ComputedName:"Pierre Jean", LadderID:"L001", "Default Image":"", "LEADERSHIP LADDER":"", "LADDER VIEW FILTERING":"", Volunteers:"", "IS BAPTIZED":"Oui", "BAPTISM DATE":"15/06/2005", "IS GRADUATED":"Oui", "GRADUATION DATE":"15/06/2023", GATE:"Porte 1" },
  { conn:"Members", ID:"2", CAMPUS:"Pétion-Ville", "FIRST NAME":"Marie", "LAST NAME":"Joseph", PHONE:"+509 37 89 0123", "HOME PHONE":"+509 22 33 4455", "WORK PHONE":"", EMAIL:"marie.joseph@email.com", "WORK EMAIL":"mj@travail.com", GENDER:"F", DOB:"22/08/1985", ADDRESS:"38 Rue Darguin", CITY:"Pétion-Ville", STATE:"Ouest", "ZIP CODE":"HT6140", COUNTRY:"Haïti", HP:"", LADDER:"2", "ADMIN POSITION":"Secrétaire", SIDE:"Droite", MINISTRY:"Jeunesse", "OTHER MINISTRIES":"Enfants", "OTHER CAMPUSES":"Delmas", STATUS:"Actif", TEMPERAMENT:"Colérique", "SPIRITUAL GIFT":"Intercession", "LOVE LANGUAGE":"Paroles", PHOTO:"", "MARITAL STATUS":"Célibataire", "PROFILE LINK":"https://facebook.com/marie", EDUCATION:"Master", PROFESSION:"Avocat", "CAMPUS TYPE":"Principal", TRAINING:"Niveau 2", LEVEL:"Leader", "CLEAN PHONE":"50937890123", "INTEGRATION DATE":"15/03/2023", _ComputedName:"Joseph Marie", LadderID:"L002", "Default Image":"", "LEADERSHIP LADDER":"", "LADDER VIEW FILTERING":"", Volunteers:"Oui", "IS BAPTIZED":"Oui", "BAPTISM DATE":"10/12/1998", "IS GRADUATED":"Oui", "GRADUATION DATE":"20/08/2024", GATE:"Porte 2" },
  { conn:"Members", ID:"3", CAMPUS:"Tabarre", "FIRST NAME":"Paul", "LAST NAME":"Dorsainvil", PHONE:"+509 31 45 6789", "HOME PHONE":"", "WORK PHONE":"+509 29 87 6543", EMAIL:"paul.dorsainvil@email.com", "WORK EMAIL":"", GENDER:"M", DOB:"10/11/1992", ADDRESS:"5 Avenue Lamartinière", CITY:"Tabarre", STATE:"Ouest", "ZIP CODE":"HT6120", COUNTRY:"Haïti", HP:"", LADDER:"3", "ADMIN POSITION":"Trésorier", SIDE:"Gauche", MINISTRY:"Finances", "OTHER MINISTRIES":"Administration", "OTHER CAMPUSES":"", STATUS:"Actif", TEMPERAMENT:"Mélancolique", "SPIRITUAL GIFT":"Administration", "LOVE LANGUAGE":"Temps", PHOTO:"", "MARITAL STATUS":"Marié(e)", "PROFILE LINK":"", EDUCATION:"BAC+5", PROFESSION:"Comptable", "CAMPUS TYPE":"Principal", TRAINING:"Niveau 3", LEVEL:"Leader", "CLEAN PHONE":"50931456789", "INTEGRATION DATE":"01/09/2022", _ComputedName:"Dorsainvil Paul", LadderID:"L003", "Default Image":"", "LEADERSHIP LADDER":"", "LADDER VIEW FILTERING":"", Volunteers:"", "IS BAPTIZED":"Non", "BAPTISM DATE":"", "IS GRADUATED":"Non", "GRADUATION DATE":"", GATE:"Porte 3" },
];

function getMembersList(token) {
  var START = Date.now();
  var MAX_EXECUTION_MS = 330000; // leave a little room under Apps Script's execution ceiling
  try {
    if (!verifyToken(token)) throw new Error('Unauthorized');

    // Check cache first
    var cached = _cacheGet(MEMBERS_CACHE_KEY);
    if (cached) return cached;

    const config = getAppConfig();
    if (!config) return { ok: false, error: 'Pa gen konfigirasyon', needsSetup: true };

    var realMembers = [];
    var ABORTED = false;

    for (var ci = 0; ci < (config.connections || []).length; ci++) {
      if (Date.now() - START > MAX_EXECUTION_MS) { ABORTED = true; break; }
      var conn = config.connections[ci];
      if (conn.role === 'devotion' || conn.role === 'users') continue;
      try {
        var headers = _getCachedHeaders(conn);
        var rows = _getCachedRows(conn);
        if (!rows || rows.length === 0) continue;

        var fieldMapping = _getFieldMapping(config, conn, 'members');

        for (var ri = 0; ri < rows.length; ri++) {
          if (Date.now() - START > MAX_EXECUTION_MS) { ABORTED = true; break; }
          var r = rows[ri];
          var entry = { conn: conn.name };
          for (var fi = 0; fi < MEMBER_FIELDS.length; fi++) {
            var f = MEMBER_FIELDS[fi];
            var sheetColumn = fieldMapping[f] || f;
            entry[f] = r && r[sheetColumn] !== undefined ? r[sheetColumn] : '';
          }
          realMembers.push(entry);
        }
      } catch (e) { /* skip connection error */ }
    }

    var members = (realMembers.length > 0) ? realMembers : DEMO_MEMBERS;
    var result = { ok: true, members: members, fields: MEMBER_FIELDS, total: members.length, isDemo: realMembers.length === 0, aborted: ABORTED };
    // Fòse serializasyon JSON pou evite GAS V8 silent null
    result = JSON.parse(JSON.stringify(result));

    _cachePut(MEMBERS_CACHE_KEY, result);

    return result;
  } catch (e) {
    return { ok: false, error: 'getMembersList: ' + e.message };
  }
}

function updateMember(token, connName, rowIndex, data) {
  if (!verifyToken(token)) throw new Error('Unauthorized');
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const config = getAppConfig();
    const conn = _findConnByName(config, connName);
    if (!conn) return { ok: false, error: 'Pa jwenn koneksyon' };
    const sheet = _openDynamicSheet(conn);
    const headers = _getHeaders(sheet);

    // Apply field mapping in reverse: translate app field names → sheet column names
    var fieldMapping = _getFieldMapping(config, conn, 'members');
    var sheetData = {};
    // Build reverse mapping: sheet column → app field
    var reverseMap = {};
    for (var appField in fieldMapping) {
      reverseMap[fieldMapping[appField]] = appField;
    }
    // Now map data keys from app field names to sheet column names
    for (var key in data) {
      if (data.hasOwnProperty(key)) {
        var sheetCol = fieldMapping[key] || key;
        sheetData[sheetCol] = data[key];
      }
    }

    _updateRow(sheet, rowIndex, sheetData, headers);
    _invalidateCacheFor(conn);
    _clearMembersCache();
    return { ok: true, message: 'Moun mete ajou!' };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

function _findConnByName(config, name) {
  for (var i = 0; i < (config.connections || []).length; i++) {
    if (config.connections[i].name === name) return config.connections[i];
  }
  return null;
}

// ──────────────────────────────────────────────
// MAPPING ENGINE — aplike mappings sou yon objè
// ──────────────────────────────────────────────
function applyMappings(token, data, fromConnName) {
  if (!verifyToken(token)) throw new Error('Unauthorized');
  const config = getAppConfig();
  if (!config || !config.mappings) return { ok: true, data };

  const result = {};
  Object.assign(result, data);

  for (const mapping of config.mappings) {
    if (mapping.fromConn === fromConnName) {
      if (data[mapping.fromColumn] !== undefined) {
        result[mapping.toColumn] = data[mapping.fromColumn];
      }
    }
    if (mapping.toConn === fromConnName) {
      if (data[mapping.toColumn] !== undefined) {
        result[mapping.fromColumn] = data[mapping.toColumn];
      }
    }
  }

  return { ok: true, data: result };
}

// ──────────────────────────────────────────────
// USER MANAGEMENT — CRUD depi users sheet
// ──────────────────────────────────────────────
function getUsersList(token) {
  const session = verifyToken(token);
  if (!session) throw new Error('Unauthorized');

  const config = getAppConfig();
  if (!config) return { ok: false, error: 'Pa gen konfigirasyon', needsSetup: true };

  const usersConn = _findConnByRole(config, 'users');
  if (!usersConn) return { ok: false, error: 'Pa gen users sheet nan konfigirasyon. Ajoute yon koneksyon ak wòl "users".' };

  const headers = _getCachedHeaders(usersConn);
  const rows = _getCachedRows(usersConn);

  return { ok: true, headers, users: rows, connection: usersConn };
}

function addUser(token, userData) {
  const session = verifyToken(token);
  if (!session) throw new Error('Unauthorized');
  if (session.role !== 'admin' && session.role !== 'super_admin') {
    return { ok: false, error: 'Se admin sèlman ka ajoute itilizatè' };
  }
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const config = getAppConfig();
    const usersConn = _findConnByRole(config, 'users');
    if (!usersConn) return { ok: false, error: 'Pa gen users sheet' };

    const sheet = _openDynamicSheet(usersConn);
    const headers = _getHeaders(sheet);

    // Verifye si email la deja egziste
    const rows = _getCachedRows(usersConn);
    const emailCol = headers.find(h =>
      h.toUpperCase().includes('EMAIL') || h.toUpperCase().includes('COURRIEL') || h.toUpperCase().includes('IMEL')
    );
    if (emailCol) {
      for (const row of rows) {
        if (String(row[emailCol] || '').toLowerCase().trim() === (userData.email || '').toLowerCase().trim()) {
          return { ok: false, error: 'Imèl sa deja egziste nan sistèm nan' };
        }
      }
    }

    userData.Timestamp = new Date().toISOString();
    _appendRow(sheet, userData, headers);
    _invalidateCacheFor(usersConn);
    _clearMembersCache();
    return { ok: true, message: 'Itilizatè ajoute avèk siksè!' };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

function updateUser(token, rowIndex, userData) {
  const session = verifyToken(token);
  if (!session) throw new Error('Unauthorized');
  if (session.role !== 'admin' && session.role !== 'super_admin') {
    return { ok: false, error: 'Se admin sèlman ka modifye itilizatè' };
  }
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const config = getAppConfig();
    const usersConn = _findConnByRole(config, 'users');
    if (!usersConn) return { ok: false, error: 'Pa gen users sheet' };

    const sheet = _openDynamicSheet(usersConn);
    const headers = _getHeaders(sheet);

    userData.Timestamp = new Date().toISOString();
    _updateRow(sheet, rowIndex, userData, headers);
    _invalidateCacheFor(usersConn);
    _clearMembersCache();
    return { ok: true, message: 'Itilizatè mete ajou!' };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

function deleteUser(token, rowIndex) {
  const session = verifyToken(token);
  if (!session) throw new Error('Unauthorized');
  if (session.role !== 'admin' && session.role !== 'super_admin') {
    return { ok: false, error: 'Se admin sèlman ka efase itilizatè' };
  }
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const config = getAppConfig();
    const usersConn = _findConnByRole(config, 'users');
    if (!usersConn) return { ok: false, error: 'Pa gen users sheet' };

    const sheet = _openDynamicSheet(usersConn);
    sheet.deleteRow(rowIndex);
    _invalidateCacheFor(usersConn);
    _clearMembersCache();
    return { ok: true, message: 'Itilizatè efase!' };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    lock.releaseLock();
  }
}

// ═══════════════════════════════════════════
// DIAGNOSTIC — tès rapid pou verifye GAS
// ═══════════════════════════════════════════
function ping() {
  return { ok: true, message: 'pong', time: new Date().toISOString() };
}

function testGetMembersList(token) {
  try {
    var config = getAppConfig();
    if (!config) return { ok: false, error: 'Pa gen config', needsSetup: true };
    var members = [];
    for (var ci = 0; ci < (config.connections || []).length; ci++) {
      var conn = config.connections[ci];
      if (conn.role === 'devotion' || conn.role === 'users') continue;
      members.push({ name: conn.name, role: conn.role, spreadsheetId: conn.spreadsheetId ? conn.spreadsheetId.substring(0,10)+'...' : 'N/A', sheetTab: conn.sheetTab || 'default' });
    }
    return { ok: true, memberConnections: members, totalConnections: (config.connections || []).length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
