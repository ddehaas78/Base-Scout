# Contributing to Base Scout / Contribuer à Base Scout

Thanks for helping! Issues and pull requests are welcome, in English or French.
Merci de ton aide ! Les issues et pull requests sont les bienvenues, en anglais ou en français.

## Report a problem or an idea / Signaler un problème ou une idée

1. Go to the [Issues](../../issues) tab and search first: someone may already have reported it.
2. Click **New issue** and pick a template:
   - **Bug**: something is wrong or broken (a structure that isn't in the game, a wrong chest, a button that does nothing…)
   - **Idea**: a new feature or a change
3. Fill in the template. For wrong structures, chests or biomes, give the seed, the Java version picked on the site, the coordinates, and what you see in game (`/locate` helps a lot). Screenshots help too: drag them into the text box.
4. Keep one problem or one idea per issue.

Please don't share the seed of a server that isn't yours.

---

1. Va dans l'onglet [Issues](../../issues) et cherche d'abord : quelqu'un l'a peut-être déjà signalé.
2. Clique **New issue** et choisis un modèle : **Bug** (quelque chose ne marche pas) ou **Idea** (une nouvelle fonctionnalité).
3. Remplis le modèle : seed, version Java choisie sur le site, coordonnées, et ce que tu vois en jeu (`/locate` aide beaucoup). Ajoute des captures en les glissant dans le texte.
4. Un seul problème ou une seule idée par issue.

## Change the code / Modifier le code

The site is a single file, `index.html`, **built** from the files in `sources/`. Never edit `index.html` by hand.

1. Fork the repo and clone it.
2. Edit what you need in `sources/`:
   - `sources/page.html`: the page's layout
   - `sources/js/*.js`: the code, joined in file-name order
   - `sources/style.css`, `sources/theme-mc.css`: the look
   - `sources/worker.js`, `sources/wasm/`: map and search computations (cubiomes, built to WebAssembly)
   - `sources/i18n/`: translations and the game data generators
3. If you add text to the page, add its translations to `sources/i18n/ui.py`, then run `python3 build_js.py` in `sources/i18n`.
4. Rebuild the page: `python3 sources/build.py`, then open `index.html` in your browser and check your change.
5. Add a line to the version table in `README.md`.
6. Commit `sources/` **and** the rebuilt `index.html`, push, and open a pull request.

The README describes every file and how each feature works: read the part about what you're changing first.

## A few rules / Quelques règles

- Keep the Minecraft look (fonts, textures, panels) for anything new.
- Things computed from the seed must match the game. Say in the pull request how you checked (seed, version, coordinates, in game or with `/locate`).
- No private seeds, server addresses or personal data in commits.
