/* Komplettlösung Prolog. Schrittarten:
   ['act', verb, ziel, gegenstand?]   Verb auf ein Objekt/Ausgang/Figur im aktuellen Raum
   ['item', verb, gegenstand, mit?]    Verb auf einen Inventargegenstand (mit = zweiter Gegenstand)
   ['queue', regex, ...]               Antworten für den nächsten Dialog vormerken (Reihenfolge)
   ['room', id] ['has', ...] ['hasnot', ...] ['flag', name] ['noflag', name] ['codex', id]
   ['goto', raum, x, y, dir] ['eval', 'js-code mit g und ATL'] */
export const steps = [
  ['room', 'p_office'],
  ['act', 'open', 'schublade'], ['has', 'flasche'],
  ['act', 'take', 'seil'], ['has', 'seil'],
  ['act', 'take', 'thermos'], ['has', 'kaffee'],
  ['act', 'use', 'brief'], ['flag', 'brief_gelesen'],
  ['act', 'use', 'regal'], ['codex', 'platon'],
  ['act', 'look', 'foto'],
  ['act', 'walk', 'tuer'], ['room', 'p_hall'],
  ['act', 'look', 'vitrine2'], ['codex', 'apkallu'],
  ['queue', 'brauche den Schlüssel', 'Wissen Sie, was', 'Bis später'], ['act', 'talk', 'hank'],
  ['queue', 'schriftlich', 'Kessler', 'Ich gehe dann'], ['act', 'talk', 'greaves'], ['has', 'notiz'], ['flag', 'greaves_im_hof'],
  ['act', 'give', 'hank', 'notiz'], ['has', 'schluessel'], ['hasnot', 'notiz'],
  ['act', 'give', 'hank', 'kaffee'], ['flag', 'hank_kaffee'],
  ['act', 'walk', 'treppe'], ['room', 'p_hall'],
  ['act', 'use', 'treppe', 'schluessel'], ['room', 'p_attic'],
  ['act', 'look', 'regal'],
  ['act', 'pull', 'schnur'], ['flag', 'licht'],
  ['act', 'open', 'truhe'], ['codex', 'thera'],
  ['act', 'push', 'kisten'], ['flag', 'kisten_verschoben'],
  ['act', 'take', 'leiter'], ['has', 'leiter'],
  ['act', 'use', 'regal', 'leiter'], ['flag', 'kiste_gefallen'], ['hasnot', 'leiter'],
  ['act', 'take', 'figur'], ['has', 'figur'],
  ['act', 'walk', 'treppe'], ['room', 'p_hall'],
  ['act', 'walk', 'hof'], ['room', 'p_courtyard'], ['noflag', 'kessler_geflohen'],
  ['item', 'use', 'figur', 'taschenmesser'], ['has', 'perle'],
  ['act', 'walk', 'durchgang'], ['room', 'p_hall'],
  ['act', 'walk', 'hof'], ['room', 'p_courtyard'], ['flag', 'kessler_geflohen'], ['has', 'visitenkarte'], ['hasnot', 'figur'],
  ['queue', 'Vesper', 'Figur unter Verschluss', 'New York'], ['act', 'talk', 'greaves'],
  ['act', 'walk', 'tor'], ['room', 'map'],
];
