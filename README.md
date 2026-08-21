# meine-skills

Persönlicher Claude-Code-Plugin-Marketplace. Enthält eigene Skills, versioniert und auf jedem Rechner installierbar.

## Struktur

```
meine-skills/
├── .claude-plugin/
│   └── marketplace.json        # Katalog aller Plugins in diesem Repo
└── plugins/
    └── paketierung/
        ├── .claude-plugin/
        │   └── plugin.json     # Beschreibt das Plugin "paketierung"
        └── skills/
            └── code-review/
                └── SKILL.md     # Ein Skill: /paketierung:code-review
```

## Installation (auf jedem Rechner mit Claude Code)

```
/plugin marketplace add Herr-Enklo/meine-skills
/plugin install paketierung@meine-skills
```

Danach `/reload-plugins`, falls die Installation das meldet.

Skill aufrufen:

```
/paketierung:code-review <PR-URL oder Dateipfad>
```

## Änderungen ausrollen

1. Datei ändern, z. B. `plugins/paketierung/skills/code-review/SKILL.md`
2. Commit + Push nach GitHub
3. Auf jedem Rechner: `/plugin marketplace update meine-skills`

## Neuen Skill zum bestehenden Plugin hinzufügen

Neuen Ordner unter `plugins/paketierung/skills/<name>/` mit eigener `SKILL.md` anlegen. Kein weiterer Eintrag in `marketplace.json` nötig, das Plugin lädt alle Skills in seinem `skills/`-Ordner.

## Neues Plugin hinzufügen

1. Ordner `plugins/<neuer-name>/` mit eigener `.claude-plugin/plugin.json` und `skills/` anlegen
2. Eintrag in der Wurzel-`marketplace.json` unter `"plugins"` ergänzen, `"source"` zeigt auf den neuen Ordner
