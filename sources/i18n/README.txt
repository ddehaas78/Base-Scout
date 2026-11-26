Interface translations (js/11-i18n.js is made from these):
  ui.py       the site's English texts -> fr, es, de, it, pt, pl, nl (edit here)
  game.json   official game names (biomes, enchantments, items) from the game's language files
  jobs.py     writes ../js/09a-jobdata.js (every villager job's trades) and job_keys.json, from misode/mcmeta
              (branch data: data/minecraft) and the lang files: python3 jobs.py <data/minecraft> <lang folder>
  loot.py     writes ../js/06a-lootdata.js (chest loot tables) and loot_keys.json:
              python3 loot.py <data/minecraft> <lang folder> <xpple/cubiomes loot/loot_tables/chests>
  game.py     rebuilds game.json from the game's lang files put in a lang/ folder here (uses job_keys.json)
              (e.g. from https://raw.githubusercontent.com/misode/mcmeta/assets/assets/minecraft/lang/fr_fr.json)
  build_js.py writes ../js/11-i18n.js; then run ../build.py
