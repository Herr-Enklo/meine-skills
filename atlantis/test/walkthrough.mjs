/* Reihenfolge der Kapitel im automatischen Durchlauf. Jedes Modul exportiert
   `steps` (Schrittliste) und optional `setup` (Schritte, die das Kapitel für einen
   Einzeltest vorbereiten: benötigte Gegenstände, Flags, Raumwechsel). `travel` ist der
   Kartenhotspot, über den das Kapitel im Gesamtlauf von der Reisekarte aus erreicht wird. */
export const chapters = [
  { name: 'Prolog', file: './steps_prolog.mjs' },
  { name: 'NewYork', file: './steps_newyork.mjs', travel: 'ort_newyork' },
  { name: 'Aegypten', file: './steps_egypt.mjs', travel: 'ort_alexandria' },
  { name: 'Kreta', file: './steps_crete.mjs', travel: 'ort_kreta' },
  { name: 'Mesopotamien', file: './steps_mesopotamia.mjs', travel: 'ort_eridu' },
  { name: 'Thera', file: './steps_thera.mjs', travel: 'ort_thera' },
  { name: 'Atlantis', file: './steps_atlantis.mjs' },
];
