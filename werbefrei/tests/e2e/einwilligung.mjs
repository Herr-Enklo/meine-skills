// Einwilligungsdialoge auf Nachrichtenseiten bestätigen. Ohne Einwilligung laden die meisten
// deutschen Nachrichtenseiten gar keine Werbung, dann gäbe es für den Vergleich nichts zu messen.
//
// Fast alle großen Seiten nutzen Sourcepoint: ein iframe (Adresse mit "message_id="), darin der
// Knopf mit der Klasse sp_choice_type_11 ("Zustimmen", "Einwilligen und weiter", "Alle akzeptieren").
// Dazu OneTrust (#onetrust-accept-btn-handler) und als Rückfall die üblichen Knopftexte.

const TEXTS = /^(alle akzeptieren|alles akzeptieren|akzeptieren|akzeptieren und weiter|akzeptieren & weiter|zustimmen|alle zustimmen|zustimmen und weiter|einwilligen|einwilligen und weiter|alle einwilligen|einverstanden|ich bin einverstanden|mit werbung weiterlesen|alle cookies akzeptieren|accept all|agree)$/i;

async function clickIfVisible(locator) {
  if (!(await locator.count().catch(() => 0))) return null;
  const first = locator.first();
  if (!(await first.isVisible().catch(() => false))) return null;
  const text = ((await first.innerText({ timeout: 500 }).catch(() => '')) || '').replace(/\s+/g, ' ').trim();
  await first.click({ timeout: 3000 }).catch(() => {});
  return text || 'ohne Text';
}

/** Bestätigt die Einwilligung. Gibt den Knopftext zurück oder null, wenn kein Dialog kam. */
export async function acceptConsent(page, { timeout = 14000 } = {}) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    for (const frame of page.frames()) {
      if (!frame.url().includes('message_id=')) continue;
      const text = await clickIfVisible(frame.locator('button.sp_choice_type_11'));
      if (text) return settle(page, text);
    }
    const onetrust = await clickIfVisible(page.locator('#onetrust-accept-btn-handler'));
    if (onetrust) return settle(page, onetrust);
    for (const frame of page.frames()) {
      const buttons = frame.locator('button, [role="button"]');
      const n = Math.min(await buttons.count().catch(() => 0), 80);
      for (let i = 0; i < n; i++) {
        const b = buttons.nth(i);
        const raw = (await b.innerText({ timeout: 300 }).catch(() => '')) || '';
        const text = raw.replace(/\s+/g, ' ').replace(/[\s›»>→]+$/, '').trim();
        if (TEXTS.test(text) && (await b.isVisible().catch(() => false))) {
          await b.click({ timeout: 3000 }).catch(() => {});
          return settle(page, text);
        }
      }
    }
    await page.waitForTimeout(700);
  }
  return null;
}

async function settle(page, text) {
  // Manche Seiten laden nach der Einwilligung neu oder leiten zurück zum Artikel (golem.de).
  await page.waitForTimeout(1500);
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  return text;
}
