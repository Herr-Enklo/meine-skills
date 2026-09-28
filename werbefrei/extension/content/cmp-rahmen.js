// Werbefrei – läuft in eingebetteten Rahmen und meldet, welche Art von Einwilligungsdialog ein
// Sourcepoint-Rahmen zeigt. Ein gewöhnlicher Cookie-Dialog darf ausgeblendet werden. Ein Dialog,
// der die Wahl "mit Werbung zustimmen oder Abo abschließen" stellt (Pur-Abo, contentpass), bleibt
// stehen: Ihn auszublenden hieße, die Bezahlschranke zu umgehen. Hat man in den Einstellungen
// "Abo-Abfragen automatisch beantworten" eingeschaltet, klickt dieses Skript dort "Einwilligen".
//
// In anderen Rahmen sucht es nur nach Abo-Abfragen, die eine Seite in einen eigenen Rahmen legt
// (gmx.net), und beantwortet sie auf Wunsch; ausgeblendet wird dort nichts.

(() => {
  'use strict';
  if (window === window.top) return;
  // Sourcepoint lädt jeden Dialog als eigene Seite mit message_id in der Adresse.
  const isSourcepoint = /[?&]message_id=\d+/.test(location.search);

  const PAY = /\bpur\b|pur-abo|abonn|\babo\b|contentpass|freechoice|werbefrei|ohne werbung|subscribe|subscription|€/i;
  const CONSENT = /cookie|datenschutz|privacy|einwillig|consent|tracking|personenbezogen/i;
  // Wie ACCEPT_TEXT in content.js (beide Listen gleich halten).
  const ACCEPT_TEXT = /^(alle[ns]?\s+)?(cookies\s+)?(akzeptieren|zustimmen|annehmen|erlauben)(\s+(und|&)\s+(weiter|schließen|fortfahren))?$|^einwilligen(\s+und\s+weiter)?$|^(ich\s+bin\s+)?einverstanden$|^(accept|agree|allow)(\s+all)?(\s+cookies)?$/i;
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
  const INTERVAL = 300;
  const GIVE_UP = 15000; // danach keine Meldung mehr: Der Dialog bleibt dann sichtbar.
  const started = Date.now();
  let lastText = '';
  let stableRounds = 0;
  let sentNormal = false;
  let sentButtonOnly = false;
  let isPay = false; // Dieser Rahmen gehört zu einer Abo-Abfrage.
  let accepted = false;

  // Sourcepoints Knopf für "Zustimmen" / "Einwilligen und weiter" (Auswahltyp 11 = alles akzeptieren).
  const ACCEPT = 'button.sp_choice_type_11';

  // frei: kein Sourcepoint-Rahmen; die Seite muss dann nichts über den Dialog erfahren.
  const send = (art, frei = false) => chrome.runtime.sendMessage({ type: 'cmpRahmen', art, frei }).catch(() => null);

  function acceptButton() {
    if (isSourcepoint) return document.querySelector(ACCEPT);
    return [...document.querySelectorAll('button, [role="button"], a, input[type="button"], input[type="submit"]')].find(
      (b) => ACCEPT_TEXT.test((b.innerText || b.value || '').replace(/\s+/g, ' ').trim()) && b.checkVisibility(),
    );
  }

  /**
   * Den Zustimmungsknopf klicken, sobald er da ist (höchstens fünf Sekunden lang suchen). Bleibt er
   * danach sichtbar, nachklicken: Manche Dialoge hängen ihre Handler erst nach dem Anzeigen an.
   */
  function accept(tries = 0) {
    if (accepted) return;
    const button = acceptButton();
    if (button && !button.disabled) {
      accepted = true;
      clickUntilGone(button);
      return;
    }
    if (tries < 20) setTimeout(() => accept(tries + 1), 250);
  }

  function clickUntilGone(button, attempt = 0) {
    if (!button.isConnected) return;
    button.click();
    if (attempt >= 3) return;
    setTimeout(() => {
      if (button.isConnected && button.checkVisibility()) clickUntilGone(button, attempt + 1);
    }, 1500 * (attempt + 1));
  }

  function onVerdict(res) {
    if (res?.bezahl === true) isPay = true;
    if (res?.einwilligen === true) accept();
  }

  // Wird "Abo-Abfragen automatisch beantworten" eingeschaltet, während der Dialog schon offen ist,
  // kommt die Aufforderung nachträglich. Geklickt wird nur in einem Rahmen, der als Abo-Abfrage gilt.
  chrome.runtime.onMessage.addListener((msg, sender) => {
    if (sender.id !== chrome.runtime.id || msg?.type !== 'werbefrei:einwilligen') return false;
    if (isPay) accept();
    return false;
  });

  /**
   * Text des Dialogs, ohne den Quelltext von Skripten und Styles und ohne ausdrücklich versteckte
   * Teile. Nicht nach gerenderter Sichtbarkeit filtern: Hat Werbefrei den Dialog schon ausgeblendet,
   * wird der Rahmen nicht mehr gerendert, und ein später erscheinendes Abo-Angebot muss trotzdem
   * noch erkannt werden.
   */
  function visibleText() {
    if (!document.body) return '';
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const el = node.parentElement;
        if (!el || SKIP.has(el.tagName) || el.closest('[hidden], [aria-hidden="true"]')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let text = '';
    for (let n = walker.nextNode(); n; n = walker.nextNode()) text += ` ${n.data}`;
    return text.replace(/\s+/g, ' ').trim();
  }

  function check() {
    const text = visibleText();
    if (PAY.test(text)) {
      // Abo-Angebot gefunden, auch wenn vorher schon "normal" gemeldet wurde: sofort melden. Die
      // Antwort sagt, ob "Einwilligen" geklickt werden soll.
      isPay = true;
      send('bezahl').then(onVerdict);
      return;
    }
    const hasButton = document.querySelector('button, [role="button"]') !== null;
    stableRounds = text === lastText ? stableRounds + 1 : 0;
    lastText = text;
    if (!sentNormal && hasButton && text.length >= 40 && stableRounds >= 2) {
      sentNormal = true;
      send('normal');
    }
    // Nur ein Zustimmungsknopf, der übrige Dialog steht in der Seite selbst (golem.de). Ob das eine
    // Abo-Abfrage ist, entscheidet das Inhaltsskript der Seite; ausgeblendet wird so ein Rahmen nie.
    if (!sentNormal && !sentButtonOnly && document.querySelector(ACCEPT) && text.length < 40 && stableRounds >= 2) {
      sentButtonOnly = true;
      send('knopf').then(onVerdict);
    }
    if (Date.now() - started < GIVE_UP) setTimeout(check, INTERVAL);
  }

  /**
   * Andere Rahmen: Abo-Abfrage mit Einwilligungstext, Abo-Angebot und eindeutigem Zustimmungsknopf,
   * in einem Rahmen von mindestens 300 × 200 Pixeln. Werbe-Rahmen fallen fast immer schon am
   * günstigen Vorfilter über textContent heraus.
   */
  let otherTries = 0;
  function checkOther() {
    const raw = document.body?.textContent || '';
    if (innerWidth >= 300 && innerHeight >= 200 && CONSENT.test(raw) && PAY.test(raw)) {
      const text = visibleText();
      if (CONSENT.test(text) && PAY.test(text) && acceptButton()) {
        isPay = true;
        send('bezahl', true).then(onVerdict);
        return;
      }
    }
    if (++otherTries < 20) setTimeout(checkOther, 750);
  }

  if (isSourcepoint) check();
  else checkOther();
})();
