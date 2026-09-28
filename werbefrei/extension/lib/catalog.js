// Filterlisten, die Werbefrei kennt, und die Grundeinstellungen.

export const BUILTIN_LIST = 'werbefrei';

export const LISTS = [
  {
    id: BUILTIN_LIST,
    title: 'Werbefrei',
    description: 'Eingebaute Liste für deutschsprachige Nachrichtenseiten. Wirkt sofort und ohne Download.',
    bundled: 'filters/werbefrei.txt',
    ruleset: 'werbefrei',
    enabledByDefault: true,
  },
  {
    id: 'easylist-germany',
    title: 'EasyList Germany',
    description: 'Werbung auf deutschsprachigen Seiten. Gepflegt von der EasyList-Community.',
    url: 'https://easylist.to/easylistgermany/easylistgermany.txt',
    homepage: 'https://easylist.to/',
    enabledByDefault: true,
  },
  {
    id: 'easylist',
    title: 'EasyList',
    description: 'Internationale Grundliste gegen Werbung.',
    url: 'https://easylist.to/easylist/easylist.txt',
    homepage: 'https://easylist.to/',
    enabledByDefault: true,
  },
  {
    id: 'easyprivacy',
    title: 'EasyPrivacy',
    description: 'Tracker und Statistikdienste. Blendet nichts aus, spart aber Datenverkehr.',
    url: 'https://easylist.to/easylist/easyprivacy.txt',
    homepage: 'https://easylist.to/',
    enabledByDefault: false,
  },
];

export const DEFAULT_SETTINGS = {
  paused: false,
  allowlist: [], // Hostnamen ohne "www."
  heuristics: true, // Werbeplätze an Kennzeichnung und leeren Rahmen erkennen
  cookieBanners: true, // gewöhnliche Cookie-Hinweise ausblenden (keine Abo-Abfragen)
  badge: true, // Zahl blockierter Anfragen am Symbol
  lists: Object.fromEntries(LISTS.map((l) => [l.id, l.enabledByDefault])),
  customLists: [], // {id, title, url}
};

// Standard-Gültigkeit einer Liste, wenn sie selbst nichts angibt ("! Expires: 4 days").
export const DEFAULT_EXPIRES_HOURS = 96;
export const MIN_EXPIRES_HOURS = 12;
export const MAX_LIST_BYTES = 12 * 1024 * 1024;
