// Mock API — remplace google.script.run localman
// Mode LIVE: rele GAS deployment via proxy (/gas-proxy)
// Mode FALLBACK: sèvi ak done fo si GAS pa disponib
// Devotion Tracker Mock API

var LOCAL_TOKEN = null;
var MOCK_DATA_VERSION = Date.now();

function _mockBumpDataVersion() {
  MOCK_DATA_VERSION = Date.now();
}

// ── Done fo (fallback si GAS pa reponn) ────────
var MOCK_USERS = [
  { email: 'admin@jrispace.com', pin: '1234', role: 'super_admin', name: 'Super Admin', campus: 'Tabarre' },
  { email: 'tgdr.media@tabernacleofglory.net', pin: '1234', role: 'super_admin', name: 'Media Admin', campus: 'Delmas' },
  { email: 'user@demo.com', pin: '0000', role: 'user', name: 'Itilizatè Demo', campus: 'Pétion-Ville' },
];

var MOCK_MEMBERS = [
  { conn:"Members", ID:"1", CAMPUS:"Delmas", "FIRST NAME":"Jean", "LAST NAME":"Pierre", PHONE:"+509 34 56 7890", "HOME PHONE":"", "WORK PHONE":"", EMAIL:"jean.pierre@email.com", "WORK EMAIL":"", GENDER:"M", DOB:"15/03/1990", ADDRESS:"15 Rue Capois", CITY:"Port-au-Prince", STATE:"Ouest", "ZIP CODE":"HT6110", COUNTRY:"Haïti", HP:"", LADDER:"1", "ADMIN POSITION":"", SIDE:"", MINISTRY:"Louange", "OTHER MINISTRIES":"", "OTHER CAMPUSES":"", STATUS:"Actif", TEMPERAMENT:"Sanguin", "SPIRITUAL GIFT":"Enseignement", "LOVE LANGUAGE":"Service", PHOTO:"", "MARITAL STATUS":"Marié(e)", "PROFILE LINK":"", EDUCATION:"Université", PROFESSION:"Enseignant", "CAMPUS TYPE":"Principal", TRAINING:"Niveau 1", LEVEL:"Membre", "CLEAN PHONE":"50934567890", "INTEGRATION DATE":"01/01/2024", _ComputedName:"Pierre Jean", LadderID:"L001", "Default Image":"", "LEADERSHIP LADDER":"", "LADDER VIEW FILTERING":"", Volunteers:"", "IS BAPTIZED":"Oui", "BAPTISM DATE":"15/06/2005", "IS GRADUATED":"Oui", "GRADUATION DATE":"15/06/2023", GATE:"Porte 1" },
  { conn:"Members", ID:"2", CAMPUS:"Pétion-Ville", "FIRST NAME":"Marie", "LAST NAME":"Joseph", PHONE:"+509 37 89 0123", "HOME PHONE":"+509 22 33 4455", "WORK PHONE":"", EMAIL:"marie.joseph@email.com", "WORK EMAIL":"mj@travail.com", GENDER:"F", DOB:"22/08/1985", ADDRESS:"38 Rue Darguin", CITY:"Pétion-Ville", STATE:"Ouest", "ZIP CODE":"HT6140", COUNTRY:"Haïti", HP:"", LADDER:"2", "ADMIN POSITION":"Secrétaire", SIDE:"Droite", MINISTRY:"Jeunesse", "OTHER MINISTRIES":"Enfants", "OTHER CAMPUSES":"Delmas", STATUS:"Actif", TEMPERAMENT:"Colérique", "SPIRITUAL GIFT":"Intercession", "LOVE LANGUAGE":"Paroles", PHOTO:"", "MARITAL STATUS":"Célibataire", "PROFILE LINK":"https://facebook.com/marie", EDUCATION:"Master", PROFESSION:"Avocat", "CAMPUS TYPE":"Principal", TRAINING:"Niveau 2", LEVEL:"Leader", "CLEAN PHONE":"50937890123", "INTEGRATION DATE":"15/03/2023", _ComputedName:"Joseph Marie", LadderID:"L002", "Default Image":"", "LEADERSHIP LADDER":"", "LADDER VIEW FILTERING":"", Volunteers:"Oui", "IS BAPTIZED":"Oui", "BAPTISM DATE":"10/12/1998", "IS GRADUATED":"Oui", "GRADUATION DATE":"20/08/2024", GATE:"Porte 2" },
  { conn:"Members", ID:"3", CAMPUS:"Tabarre", "FIRST NAME":"Paul", "LAST NAME":"Dorsainvil", PHONE:"+509 31 45 6789", "HOME PHONE":"", "WORK PHONE":"+509 29 87 6543", EMAIL:"paul.dorsainvil@email.com", "WORK EMAIL":"", GENDER:"M", DOB:"10/11/1992", ADDRESS:"5 Avenue Lamartinière", CITY:"Tabarre", STATE:"Ouest", "ZIP CODE":"HT6120", COUNTRY:"Haïti", HP:"", LADDER:"3", "ADMIN POSITION":"Trésorier", SIDE:"Gauche", MINISTRY:"Finances", "OTHER MINISTRIES":"Administration", "OTHER CAMPUSES":"", STATUS:"Actif", TEMPERAMENT:"Mélancolique", "SPIRITUAL GIFT":"Administration", "LOVE LANGUAGE":"Temps", PHOTO:"", "MARITAL STATUS":"Marié(e)", "PROFILE LINK":"", EDUCATION:"BAC+5", PROFESSION:"Comptable", "CAMPUS TYPE":"Principal", TRAINING:"Niveau 3", LEVEL:"Leader", "CLEAN PHONE":"50931456789", "INTEGRATION DATE":"01/09/2022", _ComputedName:"Dorsainvil Paul", LadderID:"L003", "Default Image":"", "LEADERSHIP LADDER":"", "LADDER VIEW FILTERING":"", Volunteers:"", "IS BAPTIZED":"Non", "BAPTISM DATE":"", "IS GRADUATED":"Non", "GRADUATION DATE":"", GATE:"Porte 3" },
];

var MOCK_DEVOTIONS = (function() {
  var rows = [];
  for (var i = 0; i < 25; i++) {
    var date = new Date(2026, 0, 1 + i);
    var fullName = ['Jean Pierre','Marie Joseph','Paul Dorsainvil','Sarah Michel','Daniel Monplaisir'][i % 5];
    var datePosted = (date.getMonth()+1)+'/'+date.getDate()+'/'+date.getFullYear();
    var cleanPhone = '509' + String(34000000 + i * 1234);
    rows.push({
      _row: i + 2, ID: String(i + 1), 'UNIQUE ID': ('0000000' + (i + 1).toString(16)).slice(-8),
      'USER ID': String(i + 1),
      Timestamp: date.toISOString(),
      'Reporter Name': 'Super Admin',
      'FULL NAME': fullName,
      'DATE': datePosted,
      'DATE POSTED': datePosted,
      CAMPUS: ['Delmas','Pétion-Ville','Tabarre'][i % 3],
      MINISTRY: ['Louange','Jeunesse','Finances','Enfants','Intercession'][i % 5],
      'FULL PHONE NUMBER': '+509 ' + cleanPhone.slice(3),
      PHONE: '+509 ' + cleanPhone.slice(3),
      'HP Number': '',
      LADDER: String((i % 3) + 1),
      'Clean Phone Number': cleanPhone,
      'CLEAN PHONE': cleanPhone,
      'Name and Date': fullName + ' - ' + datePosted,
      _ComputedName: 'Demo ' + (i + 1),
    });
  }
  return rows;
})();

var MOCK_HEADERS = Object.keys(MOCK_DEVOTIONS[0]).filter(function(k) { return k !== '_row'; });
MOCK_HEADERS.unshift('_row');

var MOCK_CONFIG = {
  connections: [
    { name: "Devotionals", role: "devotion", spreadsheetId: "mock_id_1", sheetTab: "DEVOTION TRACKER" },
    { name: "Members", role: "lookup", spreadsheetId: "mock_id_2", sheetTab: "DB" },
    { name: "Users", role: "users", spreadsheetId: "mock_id_3", sheetTab: "USERS" },
  ],
  mappings: [
    { fromConn: "Devotionals", fromColumn: "CLEAN PHONE", toColumn: "CLEAN PHONE", toConn: "Members" },
    { fromConn: "Devotionals", toColumn: "_ComputedName", toConn: "Members", fromColumn: "FULL NAME" },
    { fromConn: "Devotionals", toColumn: "CAMPUS", toConn: "Members", fromColumn: "CAMPUS" },
  ],
  fieldMappings: {
    Devotionals: {},
    devotionals: {},
    Members: {},
    members: {},
  },
};

var MEMBER_FIELDS = [
  'ID','USER ID','CAMPUS','FULL NAME','FIRST NAME','LAST NAME','PHONE','HOME PHONE','WORK PHONE',
  'EMAIL','WORK EMAIL','GENDER','DOB','ADDRESS','CITY','STATE','ZIP CODE',
  'COUNTRY','HP','HP Number','LADDER','ADMIN POSITION','SIDE','MINISTRY','OTHER MINISTRIES',
  'OTHER CAMPUSES','STATUS','TEMPERAMENT','SPIRITUAL GIFT','LOVE LANGUAGE',
  'PHOTO','MARITAL STATUS','PROFILE LINK','EDUCATION','PROFESSION','CAMPUS TYPE',
  'TRAINING','LEVEL','CLEAN PHONE','INTEGRATION DATE','_ComputedName','LadderID',
  'Default Image','LEADERSHIP LADDER','LADDER VIEW FILTERING','Volunteers',
  'IS BAPTIZED','BAPTISM DATE','IS GRADUATED','GRADUATION DATE','GATE',
];

function _mockShortId() {
  return Math.random().toString(16).slice(2, 10).padEnd(8, '0');
}

// ── Handlers fo (fallback) ─────────────────────
var _mockHandlers = {
  authenticate: function(email, pin) {
    var cleanEmail = (email || '').toLowerCase().trim();
    var user = MOCK_USERS.find(function(u) { return u.email === cleanEmail && u.pin === pin; });
    if (user) {
      var token = 'local_' + Date.now();
      LOCAL_TOKEN = token;
      return { ok: true, token: token, user: { email: user.email, role: user.role, name: user.name } };
    }
    return { ok: false, error: 'Email pa rekonèt nan sistèm nan' };
  },
  verifyToken: function(token) {
    if (token === LOCAL_TOKEN) return { email: 'admin@jrispace.com', role: 'super_admin', name: 'Super Admin' };
    return null;
  },
  logout: function(token) { LOCAL_TOKEN = null; },
  checkHasConfig: function(token) {
    return { ok: true, hasConfig: true, config: JSON.parse(JSON.stringify(MOCK_CONFIG)) };
  },
  getMembersList: function(token) {
    return { ok: true, members: JSON.parse(JSON.stringify(MOCK_MEMBERS)), fields: MEMBER_FIELDS, total: MOCK_MEMBERS.length };
  },
  updateMember: function(token, connName, rowIndex, data) {
    var members = MOCK_MEMBERS;
    if (members[rowIndex]) Object.keys(data).forEach(function(k) { members[rowIndex][k] = data[k]; });
    _mockBumpDataVersion();
    return { ok: true, message: 'Moun mete ajou!' };
  },
  searchDriveSheets: function(token, query) {
    return { ok: true, files: [
      { id: 'mock_devotion', name: 'Devotionals ' + query, owner: 'demo@test.com' },
      { id: 'mock_members', name: 'Members ' + query, owner: 'demo@test.com' },
      { id: 'mock_users', name: 'Users ' + query, owner: 'demo@test.com' },
    ]};
  },
  listSpreadsheetTabs: function(token, id) {
    return { ok: true, tabs: [
      { name: 'DEVOTION TRACKER', index: 0 }, { name: 'DB', index: 1 }, { name: 'USERS', index: 2 },
    ], name: 'Demo Spreadsheet' };
  },
  listSheetColumns: function(token, id, tab) {
    var names = tab === 'DB' ? MEMBER_FIELDS : (tab === 'USERS' ? ['_row','EMAIL','FULL NAME','CAMPUS','ROLE','PIN','Timestamp'] : MOCK_HEADERS);
    return { ok: true, columns: names.map(function(name, index) { return { name: name, index: index }; }) };
  },
  saveFullConfig: function(token, config) { _mockBumpDataVersion(); return { ok: true, message: 'Konfigirasyon anrejistre!' }; },
  resetConfig: function(token) { _mockBumpDataVersion(); return { ok: true, message: 'Konfigirasyon efase!' }; },
  getDataManifest: function(token) {
    var base = 'local:' + MOCK_DATA_VERSION + ':';
    var devotionKey = 'devotions:' + MOCK_DEVOTIONS.length;
    var membersKey = 'members:' + MOCK_MEMBERS.length;
    var usersKey = 'users:' + MOCK_USERS.length;
    return {
      ok: true,
      cacheVersion: 'local',
      ttlSeconds: 21600,
      generatedAt: Date.now(),
      dataVersion: String(MOCK_DATA_VERSION),
      signatures: {
        devotion: [{ role: 'devotion', key: devotionKey, lastRow: MOCK_DEVOTIONS.length + 1 }],
        members: [{ role: 'lookup', key: membersKey, lastRow: MOCK_MEMBERS.length + 1 }],
        users: [{ role: 'users', key: usersKey, lastRow: MOCK_USERS.length + 1 }],
        connections: [],
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
  },
  getTrackerData: function(token, opts) {
    opts = opts || {};
    var rows = MOCK_DEVOTIONS;
    var page = Math.max(0, opts.page || 0);
    var pageSize = Math.min(100, Math.max(1, opts.pageSize || 25));
    if (opts.search) {
      var term = opts.search.toLowerCase();
      rows = rows.filter(function(r) { return MOCK_HEADERS.some(function(h) { return String(r[h] || '').toLowerCase().includes(term); }); });
    }
    if (opts.sortCol && MOCK_HEADERS.indexOf(opts.sortCol) >= 0) {
      var col = opts.sortCol, dir = opts.sortDir === 'desc' ? -1 : 1;
      rows.sort(function(a, b) { var av = String(a[col] || '').toLowerCase(); var bv = String(b[col] || '').toLowerCase(); return av < bv ? -dir : av > bv ? dir : 0; });
    }
    var total = rows.length;
    var start = page * pageSize;
    var sliced = rows.slice(start, start + pageSize);
    return { ok: true, headers: MOCK_HEADERS, rows: sliced, colMap: {}, total: total, page: page, pageSize: pageSize, connection: MOCK_CONFIG.connections[0] };
  },
  addDevotion: function(token, entry) {
    entry = entry || {};
    var row = {};
    Object.keys(entry).forEach(function(k) { row[k] = entry[k]; });
    row._row = MOCK_DEVOTIONS.length + 2;
    row['UNIQUE ID'] = row['UNIQUE ID'] || _mockShortId();
    row.Timestamp = row.Timestamp || new Date().toISOString();
    row['Reporter Name'] = row['Reporter Name'] || 'Super Admin';
    if (!row['DATE POSTED'] && !row.DATE) {
      var now = new Date();
      row['DATE POSTED'] = (now.getMonth()+1)+'/'+now.getDate()+'/'+now.getFullYear();
    }
    MOCK_DEVOTIONS.push(row);
    Object.keys(row).forEach(function(k) {
      if (MOCK_HEADERS.indexOf(k) < 0) MOCK_HEADERS.push(k);
    });
    _mockBumpDataVersion();
    return { ok: true, message: 'Devotion anrejistre avèk siksè!' };
  },
  updateDevotion: function(token, rowIndex, entry) { _mockBumpDataVersion(); return { ok: true, message: 'Devotion mete ajou!' }; },
  deleteDevotion: function(token, rowIndex) { _mockBumpDataVersion(); return { ok: true, message: 'Devotion efase!' }; },
  lookupByPhone: function(token, phone) {
    var clean = (phone || '').replace(/\D/g, '').trim();
    if (clean.length < 4) return { ok: true, found: false, error: 'Tape omwen 4 chif pou chèche' };
    var matches = MOCK_MEMBERS.filter(function(m) {
      var mp = (m.PHONE || '').replace(/\D/g, '').trim();
      return mp && mp.endsWith(clean);
    }).map(function(m) {
      return { member: m, headers: MEMBER_FIELDS, fromConn: 'Members', phoneValue: m.PHONE, enriched: false };
    });
    if (matches.length) return { ok: true, found: true, members: matches, member: matches[0].member, headers: MEMBER_FIELDS, fromConn: 'Members', enriched: false };
    return { ok: true, found: false, error: 'Pa jwenn moun sa' };
  },
  getDevotionalsList: function(token) {
    var devotionals = MOCK_DEVOTIONS.map(function(r) { return { name: r['FULL NAME'] || '', date: r['DATE POSTED'] || '', month: '2026-01', campus: r.CAMPUS || '', ministry: r.MINISTRY || '' }; });
    return { ok: true, devotionals: devotionals, total: devotionals.length };
  },
  ping: function() { return { ok: true, message: 'pong', time: new Date().toISOString() }; },
  getDashboardStats: function(token) {
    return { ok: true, stats: {
      totalDevotions: MOCK_DEVOTIONS.length, todayCount: 3, totalMembers: MOCK_MEMBERS.length + 15, totalUsers: MOCK_USERS.length,
      byMonth: { '2026-01': 25 }, byCampus: { Delmas: 10, 'Pétion-Ville': 8, Tabarre: 7 },
      byReporter: { 'Jean Pierre': 5, 'Marie Joseph': 4, 'Paul Dorsainvil': 3 },
      byMinistry: { Louange: 8, Jeunesse: 6, Finances: 5, Enfants: 4, Intercession: 2 },
    }, connections: MOCK_CONFIG.connections, mappings: MOCK_CONFIG.mappings };
  },
  getUsersList: function(token) {
    return { ok: true, headers: ['_row','EMAIL','FULL NAME','CAMPUS','ROLE','PIN','Timestamp'], users: MOCK_USERS.map(function(u,i) { return { _row: i + 2, EMAIL: u.email, 'FULL NAME': u.name, CAMPUS: u.campus, ROLE: u.role, PIN: u.pin, Timestamp: new Date().toISOString() }; }), connection: MOCK_CONFIG.connections[2] };
  },
  addUser: function(token, data) { _mockBumpDataVersion(); return { ok: true, message: 'Itilizatè ajoute avèk siksè!' }; },
  updateUser: function(token, idx, data) { _mockBumpDataVersion(); return { ok: true, message: 'Itilizatè mete ajou!' }; },
  deleteUser: function(token, idx) { _mockBumpDataVersion(); return { ok: true, message: 'Itilizatè efase!' }; },
  googleSignIn: function() {
    var mockUser = MOCK_USERS[0];
    LOCAL_TOKEN = 'local_' + Date.now();
    return { ok: true, token: LOCAL_TOKEN, user: { email: mockUser.email, role: mockUser.role, name: mockUser.name } };
  },
  clearCache: function() { _mockBumpDataVersion(); return { ok: true, message: 'Cache netwaye!' }; },
  getDriveAuthUrl: function() { return { ok: true, authorized: true }; },
  sendEmail: function(token, data) { return { ok: true, message: 'Email sent to ' + (data.to || 'unknown') }; },
};

// ── google.script.run — LIVE via proxy ─────────
window.google = window.google || {};
google.script = google.script || {};

var _lastSuccess = null;
var _lastFailure = null;
var _useMockFallback = false; // true apre premye échec

function _callGAS(action, args, successFn, failureFn) {
  var delay = typeof MOCK_DELAY !== 'undefined' ? MOCK_DELAY : 300;
  setTimeout(function() {
    // Si deja nan mod "fallback" (API pa reponn), sèvi ak mock
    if (_useMockFallback) {
      var fn = _mockHandlers[action];
      if (!fn) { if (failureFn) failureFn(new Error('Fonksyon ' + action + ' pa disponib')); return; }
      try {
        var result = fn.apply(null, args);
        if (result && result.ok === false && failureFn) failureFn(new Error(result.error || 'Erè'));
        else if (successFn) successFn(result);
      } catch (e) { if (failureFn) failureFn(e); }
      return;
    }

    // Eseye API lokal /api/action
    fetch('/api/' + action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args: Array.from(args) }),
    })
    .then(function(response) { return response.json(); })
    .then(function(result) {
      if (result && result.needsSetup) {
        // Pa gen OAuth2 → aktive fallback
        console.warn('GAS API not available (needs OAuth2 setup), switching to mock');
        _useMockFallback = true;
        // Rele tèt nou ak fallback la
        _callGAS(action, args, successFn, failureFn);
      } else if (result && result.ok === false && failureFn) {
        failureFn(new Error(result.error || 'Erè GAS'));
      } else if (successFn) {
        successFn(result);
      }
    })
    .catch(function(err) {
      // API pa reponn → aktive fallback
      console.warn('GAS API fail, switching to mock fallback:', err.message);
      _useMockFallback = true;
      _callGAS(action, args, successFn, failureFn);
    });
  }, delay);
}

google.script.run = {
  withSuccessHandler: function(fn) { _lastSuccess = fn; return this; },
  withFailureHandler: function(fn) { _lastFailure = fn; return this; },
};

// Jenere tout fonksyon yo (memm non ak _mockHandlers)
Object.keys(_mockHandlers).forEach(function(name) {
  google.script.run[name] = function() {
    _callGAS(name, arguments, _lastSuccess, _lastFailure);
  };
});
