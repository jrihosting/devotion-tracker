/**
 * Devotion Tracker — Google Apps Script Web App
 * Sylvenson Richard | JRiSpace (jrispace.com)
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
    SUPER_ADMIN: {
      email: 'admin@jrispace.com',
      pin: '1234',
      role: 'super_admin',
      name: 'Super Admin',
    },
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
    .setTitle('Devotion Tracker — JRiSpace')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setFaviconUrl('https://jrispace.com/favicon.ico');
  return output;
}

function include(file) {
  return HtmlService.createHtmlOutputFromFile(file).getContent();
}

// ──────────────────────────────────────────────
// AUTH
// ──────────────────────────────────────────────
function authenticate(email, pin) {
  const cleanEmail = email.toLowerCase().trim();

  // 1. Tcheke super admin anvan
  const sa = CONFIG.AUTH.SUPER_ADMIN;
  if (sa && sa.email === cleanEmail && sa.pin === pin) {
    const token = Utilities.getUuid();
    const props = PropertiesService.getUserProperties();
    const tokens = JSON.parse(props.getProperty(CONFIG.AUTH.PROPERTY_KEY) || '{}');
    tokens[token] = { email: cleanEmail, role: sa.role, name: sa.name, loginAt: new Date().toISOString() };
    props.setProperty(CONFIG.AUTH.PROPERTY_KEY, JSON.stringify(tokens));
    return { ok: true, token, user: { email: cleanEmail, role: sa.role, name: sa.name } };
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
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
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
  saveAppConfig(config);
  return { ok: true, message: 'Konfigirasyon anrejistre!' };
}

function resetConfig(token) {
  if (!verifyToken(token)) throw new Error('Unauthorized');
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(CONFIG.CONFIG_KEY);
  return { ok: true, message: 'Konfigirasyon efase!' };
}

// ──────────────────────────────────────────────
// CACHE LAYER — CacheService pou akselere
// ──────────────────────────────────────────────
const CACHE_TTL = 300; // 5 minit (pi bon pase 30s pou gwo done)

function _cacheKey(conn, kind) {
  return `dt_${conn.spreadsheetId}_${conn.sheetTab || '_default'}_${kind}`;
}

function _cacheGet(key) {
  try {
    const cache = CacheService.getScriptCache();
    const raw = cache.get(key);
    if (raw) return JSON.parse(raw);
    // Retry via PropertiesService (pou gwo data)
    const props = PropertiesService.getScriptProperties();
    const fallback = props.getProperty(key);
    if (fallback) return JSON.parse(fallback);
  } catch (e) { /* ignore cache errors */ }
  return null;
}

function _cachePut(key, data, ttl) {
  try {
    const json = JSON.stringify(data);
    const expiry = ttl || CACHE_TTL;
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

function _cacheRemove(conn) {
  try {
    const cache = CacheService.getScriptCache();
    cache.remove(_cacheKey(conn, 'headers'));
    cache.remove(_cacheKey(conn, 'rows'));
  } catch (e) { /* ignore */ }
}

// ──────────────────────────────────────────────
// DYNAMIC SHEET HELPERS — baze sou config
// ──────────────────────────────────────────────
function _openDynamicSheet(conn) {
  const ss = SpreadsheetApp.openById(conn.spreadsheetId);
  return conn.sheetTab ? ss.getSheetByName(conn.sheetTab) : ss.getSheets()[0];
}

function _getCachedHeaders(conn) {
  const key = _cacheKey(conn, 'headers');
  let cached = _cacheGet(key);
  if (cached) return cached;
  const sheet = _openDynamicSheet(conn);
  const maxCols = sheet.getLastColumn();
  cached = maxCols === 0 ? [] : sheet.getRange(1, 1, 1, maxCols).getValues()[0];
  _cachePut(key, cached);
  return cached;
}

function _getCachedRows(conn) {
  const key = _cacheKey(conn, 'rows');
  let cached = _cacheGet(key);
  if (cached) return cached;

  const sheet = _openDynamicSheet(conn);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];

  const headers = lastCol === 0 ? [] : sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const rows = data.map((row, idx) => {
    const obj = { _row: idx + 2 };
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });

  _cachePut(key, rows);
  return rows;
}

// Ankò pou retro-konpatibilite
function _getHeaders(sheet) {
  const maxCols = sheet.getLastColumn();
  if (maxCols === 0) return [];
  return sheet.getRange(1, 1, 1, maxCols).getValues()[0];
}

function _getAllRows(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return [];
  const headers = _getHeaders(sheet);
  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return data.map((row, idx) => {
    const obj = { _row: idx + 2 };
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
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
    const cache = CacheService.getScriptCache();
    cache.removeAll();
    return { ok: true, message: 'Cache netwaye!' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ──────────────────────────────────────────────
// CHECK PERMISSIONS — fòse otorizasyon Drive
// ──────────────────────────────────────────────
function getDriveAuthUrl() {
  const info = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);
  const status = info.getAuthorizationStatus();
  if (status === ScriptApp.AuthorizationStatus.REQUIRED) {
    return { ok: false, authUrl: info.getAuthorizationUrl() };
  }
  return { ok: true };
}

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
  if (!verifyToken(token)) throw new Error('Unauthorized');
  const config = getAppConfig();
  if (!config) return { ok: false, error: 'Pa gen konfigirasyon', needsSetup: true };

  const devotionConn = _findConnByRole(config, 'devotion');
  if (!devotionConn) return { ok: false, error: 'Pa gen koneksyon devotion' };

  const sheet = _openDynamicSheet(devotionConn);
  const headers = _getHeaders(sheet);

  const idCol = headers[0];
  const lastId = sheet.getLastRow() >= 1
    ? sheet.getRange(sheet.getLastRow(), 1).getValue()
    : 0;
  entry[idCol] = (parseInt(lastId) || 0) + 1;
  entry.Timestamp = new Date().toISOString();

  if (!entry['DATE POSTED']) {
    entry['DATE POSTED'] = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MM/dd/yyyy');
  }

  _appendRow(sheet, entry, headers);
  _invalidateCacheFor(devotionConn);
  return { ok: true, message: 'Devotion anrejistre avèk siksè!' };
}

// ──────────────────────────────────────────────
// UPDATE / DELETE DEVOTION
// ──────────────────────────────────────────────
function updateDevotion(token, rowIndex, entry) {
  if (!verifyToken(token)) throw new Error('Unauthorized');
  const config = getAppConfig();
  const devotionConn = _findConnByRole(config, 'devotion');
  if (!devotionConn) return { ok: false, error: 'Pa gen koneksyon devotion' };

  const sheet = _openDynamicSheet(devotionConn);
  const headers = _getHeaders(sheet);
  entry.Timestamp = new Date().toISOString();
  _updateRow(sheet, rowIndex, entry, headers);
  _invalidateCacheFor(devotionConn);
  return { ok: true, message: 'Devotion mete ajou!' };
}

function deleteDevotion(token, rowIndex) {
  if (!verifyToken(token)) throw new Error('Unauthorized');
  const config = getAppConfig();
  const devotionConn = _findConnByRole(config, 'devotion');
  if (!devotionConn) return { ok: false, error: 'Pa gen koneksyon devotion' };

  const sheet = _openDynamicSheet(devotionConn);
  sheet.deleteRow(rowIndex);
  _invalidateCacheFor(devotionConn);
  return { ok: true, message: 'Devotion efase!' };
}

// ──────────────────────────────────────────────
// PHONE LOOKUP — chèche moun dinamik
// ──────────────────────────────────────────────
function lookupByPhone(token, phone) {
  if (!verifyToken(token)) throw new Error('Unauthorized');
  if (!phone || phone.trim() === '') {
    return { ok: true, found: false, error: 'Pa gen nimewo' };
  }

  const config = getAppConfig();
  if (!config) return { ok: false, error: 'Pa gen konfigirasyon', needsSetup: true };

  const cleanPhone = phone.toString().replace(/[\s\-\(\)\.]/g, '').trim();

  // Chèche nan tout koneksyon ki gen MAPPINGS
  const results = [];

  for (const conn of (config.connections || [])) {
    if (conn.role === 'devotion' || conn.role === 'users') continue; // Sote sheet devotion prensipal la
    const headers = _getCachedHeaders(conn);
    const rows = _getCachedRows(conn);

    const phoneCols = [];
    headers.forEach((h, i) => {
      const upper = h.toUpperCase();
      if (upper.includes('PHONE') || upper.includes('TEL') || upper.includes('HP')) {
        phoneCols.push(i);
      }
    });

    // Si gen mappings, ajoute phone columns ki nan mapping yo
    if (config.mappings) {
      for (const mapping of config.mappings) {
        if (mapping.fromConn === conn.name || mapping.toConn === conn.name) {
          const mapHeaders = [mapping.fromColumn, mapping.toColumn];
          mapHeaders.forEach(mh => {
            const idx = headers.indexOf(mh);
            if (idx >= 0 && !phoneCols.includes(idx)) phoneCols.push(idx);
          });
        }
      }
    }

    for (const row of rows) {
      for (const colIdx of phoneCols) {
        const val = row[headers[colIdx]];
        if (val) {
          const cleanVal = val.toString().replace(/[\s\-\(\)\.]/g, '').trim();
          if (cleanVal === cleanPhone || cleanVal.includes(cleanPhone) || cleanPhone.includes(cleanVal)) {
            results.push({
              fromConn: conn.name,
              member: row,
              headers,
            });
          }
        }
      }
    }
  }

  // Aplike mappings si yo jwenn moun
  if (results.length > 0 && config.mappings) {
    const enriched = {};
    Object.assign(enriched, results[0].member);

    for (const mapping of config.mappings) {
      // Chèche si yon moun jwenn nan either side of mapping
      for (const result of results) {
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
    }

    return {
      ok: true,
      found: true,
      member: enriched,
      headers: results[0].headers,
      fromConn: results[0].fromConn,
      enriched: true,
    };
  }

  if (results.length > 0) {
    return {
      ok: true,
      found: true,
      member: results[0].member,
      headers: results[0].headers,
      fromConn: results[0].fromConn,
      enriched: false,
    };
  }

  return { ok: true, found: false, error: 'Pa jwenn moun sa nan baz done a' };
}

// ──────────────────────────────────────────────
// DASHBOARD — Stats dinamik
// ──────────────────────────────────────────────
function getDashboardStats(token) {
  if (!verifyToken(token)) throw new Error('Unauthorized');
  const config = getAppConfig();
  if (!config) return { ok: false, error: 'Pa gen konfigirasyon', needsSetup: true };

  const devotionConn = _findConnByRole(config, 'devotion');
  if (!devotionConn) return { ok: false, error: 'Pa gen koneksyon devotion', needsSetup: true };

  const headers = _getCachedHeaders(devotionConn);
  const rows = _getCachedRows(devotionConn);

  const totalDevotions = rows.length;

  const byMonth = {};
  const dateCol = headers.find(h => h.toUpperCase().includes('DATE'));
  const campusCol = headers.find(h => h.toUpperCase().includes('CAMPUS'));
  const ministryCol = headers.find(h => h.toUpperCase().includes('MINISTRY'));
  const reporterCol = headers.find(h =>
    h.toUpperCase().includes('REPORTER') || h.toUpperCase().includes('FULL NAME')
  );

  // Total members across all connections (except devotion)
  let totalMembers = 0;
  for (const conn of (config.connections || [])) {
    if (conn.role === 'devotion' || conn.role === 'users') continue;
    try {
      const s = _openDynamicSheet(conn);
      totalMembers += Math.max(0, s.getLastRow() - 1);
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
// MEMBER LIST
// ──────────────────────────────────────────────
function getMembersList(token) {
  if (!verifyToken(token)) throw new Error('Unauthorized');
  const config = getAppConfig();
  if (!config) return { ok: false, error: 'Pa gen konfigirasyon', needsSetup: true };

  const allMembers = [];

  for (const conn of (config.connections || [])) {
    if (conn.role === 'devotion' || conn.role === 'users') continue;
    try {
      const headers = _getCachedHeaders(conn);
      const rows = _getCachedRows(conn);

      const nameCol = headers.find(h =>
        h.toUpperCase().includes('FULL NAME') || h.toUpperCase().includes('_COMPUTED') ||
        h.toUpperCase().includes('FIRST NAME') || h.toUpperCase().includes('NAME')
      ) || headers[0];

      const phoneCol = headers.find(h =>
        h.toUpperCase().includes('PHONE NUMBER') || h.toUpperCase().includes('PHONE') ||
        h.toUpperCase().includes('TEL')
      );

      rows.forEach(r => {
        allMembers.push({
          name: nameCol ? r[nameCol] : '',
          phone: phoneCol ? r[phoneCol] : '',
          conn: conn.name,
        });
      });
    } catch (e) { /* skip problematic connections */ }
  }

  return { ok: true, members: allMembers };
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
  return { ok: true, message: 'Itilizatè ajoute avèk siksè!' };
}

function updateUser(token, rowIndex, userData) {
  const session = verifyToken(token);
  if (!session) throw new Error('Unauthorized');
  if (session.role !== 'admin' && session.role !== 'super_admin') {
    return { ok: false, error: 'Se admin sèlman ka modifye itilizatè' };
  }

  const config = getAppConfig();
  const usersConn = _findConnByRole(config, 'users');
  if (!usersConn) return { ok: false, error: 'Pa gen users sheet' };

  const sheet = _openDynamicSheet(usersConn);
  const headers = _getHeaders(sheet);

  userData.Timestamp = new Date().toISOString();
  _updateRow(sheet, rowIndex, userData, headers);
  _invalidateCacheFor(usersConn);
  return { ok: true, message: 'Itilizatè mete ajou!' };
}

function deleteUser(token, rowIndex) {
  const session = verifyToken(token);
  if (!session) throw new Error('Unauthorized');
  if (session.role !== 'admin' && session.role !== 'super_admin') {
    return { ok: false, error: 'Se admin sèlman ka efase itilizatè' };
  }

  const config = getAppConfig();
  const usersConn = _findConnByRole(config, 'users');
  if (!usersConn) return { ok: false, error: 'Pa gen users sheet' };

  const sheet = _openDynamicSheet(usersConn);
  sheet.deleteRow(rowIndex);
  _invalidateCacheFor(usersConn);
  return { ok: true, message: 'Itilizatè efase!' };
}
