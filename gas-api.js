/**
 * gas-api.js — GAS Web App API vía HTTPS dirèk
 * Rele web app URL la dirèkteman, pa bezwen service account ni OAuth
 * Devotion Tracker API
 */

const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxLGShoS-hNVaE3zIFbeBhbzQWjDpEYjXgnIHpWqm60_9p2nq8CsjrIDxUD3sRKLAfz/exec';

// ── Rele yon fonksyon GAS via Web App URL ────
async function callFunction(functionName, args = []) {
  try {
    const payload = { action: functionName, args: args };

    const response = await fetch(GAS_WEBAPP_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await response.text();

    // Si repons lan se HTML (pa JSON), se yon erè oswa yon redirect
    if (text.trim().startsWith('<')) {
      // Tcheke si se yon paj erè Google
      if (text.includes('Page introuvable') || text.includes('Impossible')) {
        return { ok: false, error: 'GAS web app pa reponn. Verifye deplwaman an.', needsSetup: true };
      }
      if (text.includes('Sign in') || text.includes('signin')) {
        return { ok: false, error: 'GAS web app mande siyati. Ou dwe louvri URL la nan yon navigatè premye.', needsSetup: true };
      }
      return { ok: false, error: 'GAS retounen HTML olye JSON' };
    }

    try {
      return JSON.parse(text);
    } catch {
      return { ok: false, error: 'Pa ka analize repons GAS la', raw: text.substring(0, 200) };
    }
  } catch (err) {
    if (err.code === 'ENOTFOUND') {
      return { ok: false, error: 'Pa ka konekte ak Google' };
    }
    return { ok: false, error: err.message };
  }
}

async function authenticate() {
  // Web App la pa bezwen otantifikasyon patikilye
  // Men nou verifye si URL la aksesib
  try {
    const result = await callFunction('checkHasConfig', ['admin@jrispace.com']);
    if (result.ok === false && result.needsSetup) {
      console.log('⚠️  GAS web app pa aksesib pou kounye a.');
      console.log('   Ale nan ' + GAS_WEBAPP_URL + ' nan yon navigatè,');
      console.log('   siyen ak kont Google ou, epi re-otorize script la si nesesè.\n');
      return null;
    }
    console.log('✅ GAS Web App reponn');
    return true;
  } catch (err) {
    console.log('⚠️  GAS Web App pa aksesib:', err.message);
    return null;
  }
}

module.exports = { authenticate, callFunction, GAS_WEBAPP_URL };
