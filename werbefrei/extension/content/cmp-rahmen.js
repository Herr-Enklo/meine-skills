// Werbefrei – läuft in eingebetteten Rahmen und meldet, welche Art von Einwilligungsdialog ein
// Sourcepoint-Rahmen zeigt. Ein gewöhnlicher Cookie-Dialog darf ausgeblendet werden. Ein Dialog,
// der die Wahl "mit Werbung zustimmen oder Abo abschließen" stellt (Pur-Abo, contentpass), bleibt
// stehen: Ihn auszublenden hieße, die Bezahlschranke zu umgehen. Hat man in den Einstellungen
// "Abo-Abfragen automatisch beantworten" eingeschaltet, klickt dieses Skript dort "Einwilligen".

(() => {
  'use strict';
  if (window === window.top) return;
  // Sourcepoint lädt jeden Dialog als eigene Seite mit message_id in der Adresse.
  if (!/[?&]message_id=\d+/.test(location.search)) return;

  const PAY = /\bpur\b|pur-abo|abonn|\babo\b|contentpass|werbefrei|ohne werbung|subscribe|subscription|€/i;
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
  const INTERVAL = 300;
  const GIVE_UP = 15000; // danach keine Meldung mehr: Der Dialog bleibt dann sichtbar.
  const started = Date.now();
  let lastText = '';
  let stableRounds = 0;
  let sentNormal = false;
  let sentButtonOnly = false;

  // Sourcepoints Knopf für "Zustimmen" / "Einwilligen und weiter" (Auswahltyp 11 = alles akzeptieren).
  const ACCEPT = 'button.sp_choice_type_11';

  const send = (art) => chrome.runtime.sendMessage({ type: 'cmpRahmen', art }).catch(() => null);

  /** Den Zustimmungsknopf klicken, sobald er da ist; einmal, höchstens fünf Sekunden lang suchen. */
  function accept(tries = 0) {
    const button = document.querySelector(ACCEPT);
    if (button && !button.disabled) {
      button.click();
      return;
    }
    if (tries < 20) setTimeout(() => accept(tries + 1), 250);
  }

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
      send('bezahl').then((res) => {
        if (res?.einwilligen === true) accept();
      });
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
      send('knopf').then((res) => {
        if (res?.einwilligen === true) accept();
      });
    }
    if (Date.now() - started < GIVE_UP) setTimeout(check, INTERVAL);
  }

  check();
})();
