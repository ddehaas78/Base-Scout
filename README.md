# Base Scout

Un site (un seul fichier HTML, sans serveur) pour **Minecraft Java** avec 3 onglets :

1. **Seed map** : la carte du seed, comme Chunkbase, pour l'Overworld, le Nether et l'End ;
2. **Spot finder** (avant « Find a base ») : trouve le meilleur endroit, pour une base ou autre chose, sur un seed, selon les structures et les biomes que tu veux autour ;
3. **Villager** : prédit les offres des villageois de tous les métiers (Java 26.1 et plus) : les rerolls du niveau Novice (par exemple dans combien de rerolls un bibliothécaire propose Mending) (les montées de niveau ne sont plus prédites : sur un serveur, d'autres joueurs font monter des villageois et la liste devient trop aléatoire).

Tout tourne dans le navigateur. La génération du monde vient de **cubiomes** (la bibliothèque C utilisée par les outils de seeds), compilée en WebAssembly et intégrée dans le fichier, avec des corrections pour les versions après 1.21.4 (voir **Versions**).

---

## Fichiers

| Fichier | À quoi il sert |
|---|---|
| `index.html` | Le site complet. On l'ouvre directement dans Chrome ou Edge (double-clic), ou en ligne avec GitHub Pages. Environ 770 Ko. |
| `seeds.txt` | La liste des seeds enregistrés. Le site le lit et l'écrit (voir **Saved seeds**). |
| `sources/` | Les sources, pour modifier le site (voir **Modifier le site**). Pas besoin pour l'utiliser. |
| `.gitignore` | Pour GitHub : `seeds.txt` (tes seeds) n'est pas envoyé, ni les fichiers téléchargés ou temporaires (cubiomes, fichiers de langue du jeu, `__pycache__`). |
| `.gitattributes` | Pour Git : garde les fins de ligne Unix (LF) dans tous les fichiers texte et ne touche jamais à `finder.wasm`. |

Mets `index.html` et `seeds.txt` dans le même dossier.

**Sur GitHub** : le dépôt peut être mis tel quel, `index.html` est à la racine, donc GitHub Pages l'ouvre directement. `seeds.txt` est dans `.gitignore` et reste sur ton ordinateur : en ligne, « Saved seeds » te demande de choisir ton `seeds.txt` local (Chrome / Edge).

---

## Versions

En haut à gauche, **Java version** : toutes les versions de **1.18 à 26.3** (26.3 par défaut). La recherche, les cartes et la liste des structures et biomes suivent la version choisie. Ce qui n'existe pas encore dans une version (par exemple les trial chambers avant 1.21, le Dappled Forest avant 26.3) disparaît des listes. Si un cercle en contient, l'élément est barré et laissé de côté pendant la recherche.

Les changements de génération ont été vérifiés dans les fichiers de données du jeu, version par version :

| Version | Ce qui change |
|---|---|
| 1.18 à 1.21.4 | La génération de cubiomes, telle quelle. |
| 1.20 à 1.21.8 | Correction : les strongholds ne sont **pas** attirés par les cherry groves (bug MC-278965 ; cubiomes le faisait). Quelques strongholds sont ~16 blocs ailleurs que sur Chunkbase. |
| 1.21.5 | Les manoirs peuvent apparaître dans les pale gardens. |
| 1.21.9 | Les strongholds sont attirés par les cherry groves. |
| 26.1 | Aucun changement de génération. |
| 26.2 | Nouveau biome souterrain **Sulfur Caves** (compte pour les strongholds, trial chambers, mineshafts, ruined portals). |
| 26.3 | Nouveau biome **Dappled Forest** (remplace les plaines dans les zones froides, très sèches, à « weirdness » positive) et nouvelle structure **Abandoned Camp**. |

26.3 calcule son terrain en précision réduite (float) : les bords de biomes peuvent bouger d'un bloc environ. Vérifier un endroit en jeu avant de construire.

---

## En haut de la page

- **Java version** : voir plus haut.
- **Java seed** : le seed du monde (nombre ou texte, converti comme le fait Java : un nombre trop grand pour Java est traité comme du texte).
- **Saved seeds** : la liste des seeds enregistrés (voir plus bas).
- Les 3 onglets sont à côté du titre.

---

## Onglet « Spot finder »

### Le principe
On construit ce qu'on veut autour de la base avec **3 cercles** de 500, 1000 et 1500 blocs de diamètre. Les 3 tailles se changent sur une seule ligne sous les cercles.

- On **glisse** une structure ou un biome depuis **Add things** (onglets *Structures* / *Biomes*) dans un cercle. Sur téléphone : toucher un élément, puis un cercle.
- On peut mettre **plusieurs fois la même structure** (le chip affiche ×2, ×3…).
- Pour retirer quelque chose, on le **glisse hors** des cercles.

### Structures
- **Principales** : village, trial chambers, ancient city, stronghold, ocean monument, woodland mansion, pillager outpost, desert pyramid, witch hut.
- **Plus petites** (sous « Smaller structures ») : buried treasure, ruined portal, shipwreck, trail ruins, jungle temple, igloo, ocean ruins, mineshaft, desert well, fossil, amethyst geode, abandoned camp (26.3).
- **Nether** : forteresse, les 4 types de bastions, ruined portal du Nether.

Desert wells, geodes et fossiles sont les endroits où le jeu *essaie* de les placer : une grotte, de l'eau ou le mauvais sol peut encore les empêcher. Les coordonnées du buried treasure sont exactes (le coffre).

### Dimension, Start from
- **Overworld / Nether** : chaque dimension garde ses propres cercles.
- **Start from** : `0, 0`, le **spawn du monde**, ou **Custom X / Z**. La recherche part de ce point en spirale. Les résultats sont triés du plus proche au plus loin de ce point. Avec des coordonnées perso, un **point rouge « Start »** les montre sur la carte.
- En Overworld, la base est toujours sur la terre ferme (jamais dans l'eau).

### Biome size
Les biomes de grottes (Dripstone caves, Lush caves, Deep dark, Sulfur caves) sont cherchés sous terre, à 4 profondeurs (y 16, −8, −32, −56) ; la carte montre toujours la surface.

Dès qu'un biome est dans un cercle, on choisit la taille minimale de sa zone : Any, Small (64+), Medium (128+), Large (256+), Huge (512+).

### Barre d'état
À droite des réglages : état (Searching / Paused / Stopped), distance parcourue, point de départ, surface, nombre de résultats exacts et proches, spawn.

### Résultats
- **Exact matches** : tout est dans le bon cercle. **Close matches** : quelque chose déborde un peu (jusqu'à 1,6× le rayon), en orange.
- **200 résultats** au maximum par liste (« 200+ »). La recherche s'arrête toute seule après une zone, puis **Search further** continue.
- Chaque résultat : coordonnées, biome, distance, chaque élément avec sa distance et sa direction. Un clic le montre sur la carte (les coordonnées sont aussi dans la barre **Picked**). La colonne des résultats est étroite pour laisser la place à la carte.

### La carte à côté des résultats
- Les structures demandées sont en grand, sur un **fond sombre avec un bord de la couleur de leur cercle** (vert, bleu, violet). Les autres sont en petit. Les petites structures n'apparaissent que si on les a demandées.
- Zoom (molette, pincement, + / −), **XZ**, barres **Picked** et **Cursor** comme sur la Seed map.

### Find seeds (chercher un seed, comme le Seed Finder de Chunkbase)
En haut à gauche, **Look in** : **This seed** (la recherche normale dans le seed choisi) ou **Find seeds**.

- Avec **Find seeds**, le site cherche des seeds qui ont les structures de la case **Fixed spots** aux coordonnées données (voir plus bas). Même version et même dimension que pour This seed.
- La barre d'état montre les seeds testés, la vitesse, le nombre trouvé (avec « · 1 in 37 » = un seed sur 37 convient), le temps estimé jusqu'au **prochain seed** (il monte tant que rien de nouveau ne sort : c'est que c'est plus rare que prévu) et le nombre de **cœurs** utilisés (jusqu'à 4, selon le processeur).
- Chaque seed trouvé : **Copy** (copie le seed), **☆ / ★** (le garde dans la liste **Starred**), **Use** (le met dans la case Java seed). Un clic montre la carte de ce seed.
- **200 seeds** au maximum par liste ; **Search** recommence une nouvelle liste (les seeds étoilés restent).
- Les résultats de This seed sont gardés quand on passe d'un mode à l'autre.
- **Fixed spots** : en mode Find seeds, il n'y a plus de cercles (ni Start from) : on glisse une structure dans la case Fixed spots (ou on la touche puis on touche la case), on tape son **X** et son **Z**, on choisit **within** 16, 50, 100 ou 250 blocs et, si on veut, les **biomes** où elle peut être : on glisse des biomes de l'onglet Biomes dans sa case « in » (ou on touche le biome puis la structure) ; elle doit être dans l'un d'eux, un clic sur un biome de la case l'enlève (case vide = « any biome » ; les biomes de grottes sont cherchés sous la structure, aux 4 profondeurs). Seuls les seeds qui ont toutes ces structures à ces endroits sont gardés. Sur la carte, chaque endroit fixé est un cercle rouge en pointillés ; sur les cartes des seeds, chaque structure fixée montre son biome. Les cercles restent pour This seed.
- Comment c'est rapide (l'idée de SeedCrackerX) : l'endroit où une structure peut apparaître ne dépend que des **48 bits du bas** du seed (le « structure seed »). Le site teste d'abord des millions de structure seeds avec le seul calcul de placement, puis, pour ceux qui collent, essaie quelques valeurs des **16 bits du haut** (ils décident des biomes, donc si la structure apparaît vraiment). « Seeds tested » compte alors les structure seeds ; chacun vaut 65 536 seeds.
- **Biome spots** : un biome lâché dans la case (pas sur une structure) devient « ce biome est ici » avec son X / Z. Il compte pour Find seeds et pour Crack.
- **within « same chunk »** : la structure doit commencer dans le chunk tapé (pour Crack).

### Crack the exact seed (retrouver le seed d'un monde, méthode SeedCrackerX)
Sous Fixed spots, le bouton **Crack the exact seed** retrouve LE seed d'un monde qui existe, à partir de structures vues dedans.
1. Mets **une quinzaine de structures**, dans des régions différentes : temples du désert et de la jungle, cabanes de sorcière, igloos, avant-postes, épaves, monuments. Tiens-toi au **milieu** de chaque structure (sur le pont, au milieu de la longueur pour une épave), lis X / Z avec F3 et tape-les. **within** : « same chunk » pour temples, cabanes, igloos, avant-postes et monuments, **16** pour les épaves et le reste (le bouton « set within for cracking » sous Crack le fait pour toutes). Pas besoin de remplir la case « in » des structures : le site vérifie lui-même qu'elles peuvent être dans leur biome.
2. Ajoute **3 à 5 biome spots** : lis le biome avec F3 à quelques endroits, glisse ce biome dans la case et tape le X / Z.
3. Clique sur **Crack the exact seed**. La ligne sous le bouton dit s'il y a assez de structures.

Comment ça marche : (1) les 20 bits du bas du seed se trouvent d'abord, car les positions dans une région de 24 ou 20 chunks ne dépendent pour leurs derniers bits que de ces 20 bits (« liftable bits ») ; (2) les 28 bits suivants sont testés en entier (≈ 270 millions, quelques secondes) pour avoir le structure seed (48 bits) ; (3) les 16 bits du haut ne changent que les biomes : les 65 536 seeds possibles sont gardés seulement si chaque biome spot et chaque structure (dans son biome) collent. SeedCrackerX utilise le « hashed seed » du serveur pour cette dernière étape ; le site ne peut pas le lire, d'où les biome spots. Testé : 16 structures + 6 biome spots → le bon seed, et lui seul, en environ 8 s ; 14 épaves (within 16) + 2 monuments + 5 biome spots → le bon seed aussi, en quelques minutes.
Respecte les règles du serveur : certains interdisent de cracker le seed.
- Attention : certains endroits ne peuvent jamais avoir une structure donnée (entre deux régions, par exemple pour les trial chambers). Si rien ne sort, essaie un « within » plus grand ou des coordonnées un peu différentes.
- Plus il y a de choses dans les cercles, plus c'est lent : les structures rares ou les petits cercles peuvent demander beaucoup de seeds.

---

## Onglet « Seed map »

- **Dimension** : Overworld / Nether / End. Overworld ↔ Nether garde le même endroit (Nether = Overworld ÷ 8).
- **Show on map** : les structures à afficher, avec les petites sous « Smaller structures » (cachées au départ). Overworld, Nether (forteresse, 4 types de bastions avec un anneau de couleur, ruined portal) et End (end ship avec élytres, cités sans bateau, les 20 portails de l'île principale et où ils mènent, portails des îles extérieures).
- Les structures s'affichent à moins de ~20 000 blocs de large. Il faut zoomer plus pour les plus nombreuses : geodes (3 000), fossiles et mineshafts (6 000), buried treasure (8 000). Quand la carte est chargée, les petites structures sont dessinées en petit, sous les principales.
- En haut du panneau : **Go to** et **Picked point** (coordonnées, notes selon la structure : type de bastion, profondeur d'un fossile, etc.), **Find spots here**. Bouton **XZ** sur la carte.
- **Itinéraire** : le petit carré sous **XZ** active le mode itinéraire. Chaque clic sur une structure (ou n'importe où) ajoute une étape, un clic sur une étape la retire. Les étapes sont reliées par une ligne jaune, numérotées, avec la longueur de chaque trajet. À gauche, la section **Route** donne les coordonnées de chaque étape, la distance depuis la précédente et le total ; **Best order** garde la première étape et trouve le chemin le plus court par les autres, **Copy** copie la liste, **Clear** l'efface, un clic sur une étape centre la carte dessus. Un itinéraire par dimension, gardé par seed dans le navigateur. Le même bouton existe sur la carte de **Spot finder** (la liste s'affiche alors sur la carte, en haut à gauche ; un itinéraire par seed et dimension).
- En bas de la carte, deux barres toujours visibles : `Picked X, Z : -520, 936 | -65, 117` et `Cursor …`. Coordonnées de l'Overworld en blanc, du Nether en rouge.
- **Structures faites** : clic droit sur une icône (ou bouton « Mark as done » dans la fenêtre des coffres) pour la marquer comme faite : icône assombrie avec une coche verte. « Hide done » (sous « Show on map ») les cache. Gardé par seed, dans ce navigateur.
- **Plan et coffres** : temple du désert, buried treasure, pillager outpost, bastion (tous les coffres, avec leur hauteur), cité antique, end city (avec ou sans navire), stronghold, mineshaft, temple de la jungle (coffres et distributeurs), igloo (sous-sol), épave, portail en ruine (Overworld et Nether, coffre « près du portail »), forteresse du Nether et campement abandonné (26.3, coffres à leur X et Z exacts ; le plan dit quel modèle de tente et de campement il utilise, et un petit coffre sur l'icône de la carte marque ceux qui ont un coffre secret). **Double-clic** sur la structure (sur la Seed map ou sur la carte à côté des résultats du Spot finder), ou bouton **Chests** dans Picked point de la Seed map. Une fenêtre montre le plan vu du dessus (vraies textures pour le temple du désert ; pour les autres, chaque pièce de la structure avec la texture du jeu — pierre taillée, bibliothèques, cadre du portail, planches et rails, purpur… — nord en haut, avec légende ; zoom à la molette ou avec + / −, déplacement en glissant), les coffres numérotés, et le contenu de chaque coffre rangé comme dans le jeu (grille 9 × 3), avec les livres enchantés (la souris sur un objet donne son nom et ses détails). Contenu calculé à partir de Java 1.21.6 (end city : 1.21.6 aussi, sans l'armure de cheval en cuivre arrivée en 1.21.9). La graine de chaque coffre et le contenu suivent xpple/cubiomes (MIT) ; stronghold et mineshaft sont vérifiés avec ses données de test, les pièces de l'end city avec cubiomes. Limites : pour le bastion, seuls les coffres de la partie de départ sont montrés (pas la salle au trésor) ; une grotte, de l'eau ou le vide peut enlever ou changer des coffres de stronghold et de mineshaft ; l'emplacement des objets dans le coffre n'est **pas encore vérifié en jeu**.

---

## Onglet « Villager » (Java 26.1 et plus)

En 26.1 et plus, les offres des villageois viennent de suites fixes, déterminées par le seed : **une suite par métier et par niveau**, partagée par tous les villageois de ce métier dans le monde. Chaque fois qu'un villageois reçoit les offres d'un niveau, n'importe où, la suite de ce niveau avance de 1. Le niveau Novice du bibliothécaire est vérifié avec les vecteurs de test de villageroll.com et les données du jeu 26.1 à 26.3 ; les autres métiers suivent les mêmes règles mais **ne sont pas encore vérifiés en jeu** (le site le signale en orange).

- **Villager** (en haut à gauche) : le métier, du plus utilisé au moins utilisé (Bibliothécaire, Fermier, Clerc, Armurier, Forgeron d'outils, Forgeron d'armes, Archer, Cartographe, Pêcheur, Maçon, Berger, Boucher, Tanneur). Pour le Cartographe et le Pêcheur, le type de villageois (plaines, désert…), car certaines offres en dépendent. Tout l'onglet suit ce choix.
- **Where are you in the list?** (rerolls du niveau Novice)
  - *I know my roll number* : on tape le numéro (0 sur un monde neuf).
  - *Find my position* : on entre les offres vues sur plusieurs rolls à la suite (slot 1 = offre du haut, prix optionnel). 3 rolls ou plus, c'est mieux.
- **Your librarian / Your villager** : ce qu'il devrait montrer maintenant et au prochain reroll. Boutons **I rerolled, that's what came out** (+1), **Something else came out** (retrouver la position), **Undo**.
- **Wanted books** (bibliothécaire) : Mending par défaut. On ajoute d'autres livres avec un niveau minimum et un prix maximum. Une carte par livre : dans combien de rerolls, roll, prix, slot, et le moins cher des 300 prochains.
- **Tableau** des rolls à venir : pour le bibliothécaire, livre, prix et autre offre, livres voulus en surbrillance, filtres *Books only* / *Wanted books only* / *Books on the left* ; pour les autres métiers, les 2 offres (ce qu'on donne → ce qu'on reçoit), avec les enchantements, couleurs du cuir, effets des flèches et des ragoûts.
- « Rerolls » compte le prochain reroll comme 1. Un roll = casser et reposer le bloc de métier, puis ouvrir le menu.
- Ne pas commercer avant d'avoir la bonne offre : après un échange, les offres sont figées. Sur un serveur, les autres joueurs font avancer les mêmes suites. Le prix en jeu peut varier (réductions, demande). Expérience *Trade Rebalance* désactivée, pas Bedrock.

---

## Icônes

Les icônes de structures sont les **vraies textures d'objets Minecraft** (cloche pour les villages, œil de l'Ender pour les strongholds, etc.), **chargées depuis Internet** à l'ouverture (copie publique des fichiers du jeu 1.21.4, sur jsdelivr ou GitHub). Les bastions ont un contour doré ; le ruined portal du Nether et les portails de l'End ont un petit carré de couleur. Sans Internet, les icônes dessinées à la main restent.

---

## Ce qui est gardé quand on rafraîchit

Dans le navigateur : le mode (This seed / Find seeds) avec les seeds trouvés et étoilés, le seed, la version, l'onglet, les cercles (Overworld et Nether) et leurs tailles, Start from avec X / Z, les résultats et celui choisi (une recherche en cours revient en pause ; **Search further** la continue), la Seed map (endroit, zoom, dimension, point choisi, structures affichées, XZ), et pour Villager le métier, le type de villageois, le niveau affiché à droite, les positions par seed (rerolls et montées de niveau, pour chaque métier), les livres voulus, la langue et les filtres. Au rechargement, aucune recherche ne repart toute seule.

---

## Saved seeds et `seeds.txt`

Le bouton **Saved seeds** enregistre un seed avec un nom, la version, en option les cercles, et la position du bibliothécaire novice (onglet Villager) si elle existe.

- Dans **Chrome / Edge**, le site lit et écrit directement `seeds.txt` (la première fois, il demande de choisir ou créer le fichier).
- Sinon, les seeds sont gardés dans le navigateur.

Format : **un seed par ligne**, les parties séparées par `|` :

```
Serveur des potes: 123456789
Mon monde: 12345 | v26.3 | rings 500/1000/1500 | village=1 trial=2 plains=1@256 | librarian=57
```

- `Nom: seed` est le minimum. Les lignes commençant par `#` sont gardées telles quelles.
- `v26.3` : la version.
- `rings 500/1000/1500` : diamètres des 3 cercles, puis `clé=numéro du cercle`, avec `@taille` pour un biome.
- `librarian=57` : le prochain roll du bibliothécaire.
- **Structures (Overworld)** : `village trial ancient stronghold monument mansion outpost pyramid hut treasure portal shipwreck trail jungle igloo ruins mineshaft well fossil geode camp`
- **Biomes (Overworld)** : `plains meadow cherry flower forest birch dark pale taiga jungle bamboo savanna desert badlands swamp mangrove mushroom snowy icespikes peaks slopes windswept ocean warmocean river beach dappled`, et sous « More biomes » : `sunflower snowytaiga oldbirch oldpine oldspruce sparsejungle savplateau wsavanna woodbad eroded grove jagged frozenpeaks stonypeaks wforest gravelly stonyshore snowybeach frozenriver deepocean lukewarm coldocean frozenocean`, et sous « Cave biomes » : `dripstone lush deepdark sulfur`
- **Nether** : `fortress bas_treasure bas_units bas_hoglin bas_bridge nportal nwastes soulsand crimson warped basalt`

Charger un seed remet le seed, la version, les cercles (en Nether s'ils contiennent des éléments du Nether) et la position du bibliothécaire novice (onglet Villager).

---

## Mise en page

- L'interface est affichée à **80 %** (comme un zoom du navigateur à 80 %). Pour changer : `--ui: 0.8;` en haut de `sources/style.css` (1 = 100 %). Sur téléphone, elle reste à 100 %.
- Sur ordinateur, la page **tient dans la fenêtre** ; les panneaux et listes défilent chacun de leur côté. À partir de 1250 px, carte et résultats sont côte à côte.
- Sur téléphone ou fenêtre étroite, la page défile normalement.

---

## Modifier le site (pour une nouvelle conversation avec Claude)

Ne pas modifier `index.html` (à la racine) à la main : il est **généré**. On modifie les fichiers de `sources/`, puis on reconstruit :

```
cd sources
python3 build.py          # écrit ../index.html
```

Pour une modification, il suffit d'ouvrir le fichier concerné (pas tout le site) :

| Fichier | Rôle |
|---|---|
| `build.py` | Assemble tout en un seul HTML (le wasm est compressé en gzip puis base64 ; la page le décompresse). |
| `page.html` | Le modèle HTML de la page (en-tête, onglets, panneaux), avec les marqueurs `/*STYLE*/`, `/*SCRIPT*/`, `/*WORKER*/`, `/*ICONS*/`, `__WASM_B64__`. |
| `theme-mc.css` | Le style Minecraft, ajouté après style.css (textures du jeu chargées depuis le miroir, police Monocraft). |
| `style.css` | Tout le CSS (thème clair/sombre, mise en page qui tient dans la fenêtre). |
| `js/01-core.js` | Listes des structures, biomes, versions (`VERSIONS`, `SINCE`), fonctions communes. |
| `js/02-rings.js` | Les cercles : glisser-déposer, tailles, palette « Add things », dimension de recherche. |
| `js/03-search.js` | Lancer / arrêter la recherche, barre d'état, liste des résultats. |
| `js/03b-seeds.js` | Le mode Find seeds (workers en parallèle, liste des seeds, Starred, Copy / Use). |
| `js/12-mcselect.js` | Les listes déroulantes au style du site (la liste native reste dessous : valeur et événements inchangés). |
| `js/06f-biomeshow.js` | Seed map, onglet Biomes de « Show on map » : liste des biomes et contour jaune sur la carte. |
| `js/13-tooltip.js` | La bulle du nom complet quand la souris reste 0,33 s sur un bouton ou une pastille, et la bulle des objets dans les coffres (tout de suite). |
| `js/11-i18n.js` | La langue du site : traduit les textes affichés (généré par `i18n/build_js.py`). |
| `js/03c-fixed.js` | La case Fixed spots (structures et biomes à des coordonnées précises) et Crack the exact seed. |
| `js/04-maps.js` | Le moteur de carte commun (`MapView` : tuiles de 128 × 128 cases calculées en parallèle par les moteurs de carte `MAPQ`, du centre vers les bords ; zoom, déplacement, un seul dessin par image) et le dessin des icônes. |
| `js/05-findmap.js` | La carte à côté des résultats (cercles, cadres de couleur, point rouge Start). |
| `js/06-seedmap.js` | L'onglet Seed map (affichage, Picked point, Go to, dimensions). |
| `js/06a-lootdata.js` | Les tables de butin des coffres, créé par `i18n/loot.py` : ne pas modifier à la main. |
| `js/06b-loot.js` | Le butin : graine de chaque coffre (générateur du monde), tirage de la table (Random de Java), enchantements, emplacements dans le coffre. |
| `js/06b-structs.js` | Où sont les coffres de chaque structure : pièces du stronghold, du mineshaft et de l'end city (portés de xpple/cubiomes), départ du bastion, outpost, buried treasure, et la graine de chaque coffre. |
| `js/06a2-looticons.js` | Les icônes des objets des coffres que le miroir de textures 1.21.4 ne montre pas bien : blocs en 3D comme dans le jeu, objets plus récents (fait par `i18n/loot_icons.py`). |
| `js/06d-jigsaw.js` | Le moteur des structures « jigsaw » (bastions, cités antiques, campements abandonnés) : assemblage pièce par pièce comme le jeu, place et graine de chaque coffre, biome exact demandé au moteur. |
| `js/06d-jigsawdata.js` | Les pools et les pièces de ces structures (taille, points d'accroche, coffres), faits par `i18n/jigsaw.py` à partir des fichiers 26.3. |
| `js/06e-done.js` | Les structures faites : bouton de la fenêtre des coffres, menu du clic droit sur les cartes, « Hide done », gardées par seed dans le navigateur. |
| `js/06b2-structs2.js` | Les coffres du temple de la jungle, de l'igloo, de l'épave, du portail en ruine, de la forteresse du Nether et du campement abandonné. `campVariant` donne le modèle de tente et de campement d'un camp. |
| `js/06c-plan.js` | La fenêtre plan et coffres (double-clic sur une structure de la Seed map). |
| `js/06b-route.js` | L'itinéraire des deux cartes (`makeRoute` : étapes, ligne, distances, Best order). |
| `js/07-tabs.js` | Onglets et changements de seed. |
| `js/08-saved-seeds.js` | Saved seeds et `seeds.txt` (lecture, écriture, format). |
| `js/09-librarian.js` | Onglet Villager, bibliothécaire novice (générateur Xoroshiro, livres, recherche de position). |
| `js/09a-jobdata.js` | Les échanges de tous les métiers de villageois (données 26.x), créé par `i18n/jobs.py` : ne pas modifier à la main. |
| `js/09b-levels.js` | Le choix du métier (tout l'onglet Villager le suit), les rerolls Novice des métiers autres que bibliothécaire (à gauche et dans le grand tableau), enchantements, teintures, potions, ragoûts, recherche de position à partir des échanges vus. |
| `i18n/` | Les traductions (`ui.py` pour les textes du site, `game.json` pour les noms du jeu) et `jobs.py` / `loot.py`, qui créent `js/09a-jobdata.js` et `js/06a-lootdata.js` à partir des données du jeu. Voir `i18n/README.txt`. |
| `js/10-boot.js` | Démarrage, sauvegarde au rafraîchissement, lancement des workers : celui de la recherche et 1 à 3 pour les cartes (selon le processeur). |
| `worker.js` | Le moteur de recherche (Web Worker) : tuiles en spirale, test de seeds pour Find seeds (`runSeeds`, `checkSpot`), distance transform pour les biomes, score, cartes du Nether et de l'End. |
| `icons.js` | Les icônes dessinées (`ICON_ART`) et le chargement des textures du jeu (`TEX_FOR`). |
| `wasm/wrap.c` | L'interface C entre cubiomes et JS, plus fossiles, abandoned camps, mineshafts. |
| `wasm/cubiomes-basescout.patch` | Les changements de cubiomes pour 1.21.5 à 26.3. |
| `wasm/finder.wasm` | `wrap.c` + cubiomes compilés. |
| `wasm/build-wasm.sh` | Recompile `finder.wasm` (seulement si on touche à `wrap.c` ou au patch). |

**Recompiler le WebAssembly** (git et wasi-sdk 25 nécessaires) :

```
WASI_SDK=/chemin/vers/wasi-sdk-25.0-x86_64-linux sh sources/wasm/build-wasm.sh
```

Le script télécharge cubiomes (commit `e61f905`, sa dernière version), applique le patch et compile. Le résultat est identique octet par octet à `finder.wasm`.

**Fonctions exportées par le wasm** :

- monde : `set_version(mc, ext)`, `set_seed`, `alloc`, `dealloc`, `spawn`, `colors`, `biome_name` ;
- biomes et structures : `gen_rows`, `find_structs`, `find_strongholds`, `strongholds_rough` (emplacements avant le décalage de biome, 1.19.3+), `strongholds_near` (seulement ceux près d'un point), `pin_scan` (Fixed spots : structure seeds sur 48 bits dont le placement colle), `crack_low` / `crack_high` (Crack : 20 bits du bas, puis les 28 suivants), `find_raw` (placement seul, sans test de biome, pour trier vite les seeds) ;
- Nether et End : `set_seed_dim`, `gen_rows_dim`, `find_structs_dim`, `end_height`, `end_city_ship`, `end_gateways`, `bastion_type`.

**Versions** : `set_version(mc, ext)` prend la version cubiomes (`MC_1_18` = 22, `MC_1_19_2` = 23, `MC_1_19` = 24, `MC_1_20` = 25, `MC_1_21_1` = 26, `MC_1_21_3` = 27, `MC_1_21_WD` = 28) et `ext` pour les changements après 1.21.4 (0 = 1.21.4, 1 = 1.21.5+, 2 = 1.21.9+, 3 = 26.2+, 4 = 26.3+). La table est `VERSIONS` dans `js/01-core.js`.

**IDs de structures pour `find_structs`** :

- cubiomes : Desert pyramid 1, Jungle temple 2, Swamp hut 3, Igloo 4, Village 5, Ocean ruins 6, Shipwreck 7, Monument 8, Mansion 9, Outpost 10, Ruined portal 11, Ruined portal Nether 12, Ancient city 13, Buried treasure 14, Mineshaft 15, Desert well 16, Geode 17, Fortress 18, Bastion 19, End city 20, End gateway 21, Trail ruins 23, Trial chambers 24 ;
- ajoutés par Base Scout : Fossile (près de la surface) 40, Abandoned camp 41, Fossile profond 42.

**Biomes ajoutés** : Dappled Forest = 187, Sulfur Caves = 188.

**Types de bastion** (`bastion_type`) : 0 housing, 1 hoglin, 2 treasure, 3 bridge.

**Données utilisées** : fichiers du jeu de chaque version (miroir misode/mcmeta, y compris les échanges des villageois : `trade_set`, `villager_trade`, `enchantment` et leurs tags en 26.x), fichiers de langue (InventivetalentDev/minecraft-assets), vecteurs de test de villageroll.com.

### Historique des versions

| Version | Ajout |
|---|---|
| v1–4 | Recherche par cercles, résultats exacts et proches, icônes, plusieurs fois la même structure, tri par distance, coordonnées Nether |
| v5 | Onglet Seed map et Saved seeds |
| v6 | `seeds.txt` lu et écrit directement |
| v7 | Cartes du Nether et de l'End |
| v8 | End ships (élytres) |
| v9 | Portails de l'End, avec ceux des îles extérieures |
| v10 | Structures plus visibles, Fade |
| v11 | Types de bastions |
| v12 | Coordonnées X/Z sur la carte |
| v13 | Barres Picked et souris (Seed map) |
| v14 | Recherche dans le Nether |
| v15 | Barres, Fade, XZ et zoom sur la carte de Find a base |
| v16 | Résultats triés depuis le point de départ |
| v17 | Taille des biomes |
| v18 | Nombres à place fixe dans les barres |
| v19 | La page tient dans la fenêtre |
| v20 | Corrections : cercles du Nether perdus dans `seeds.txt`, petites zones de biome manquées, « Find a base here » en Nether, plus de résultats |
| v21 | Onglets à côté du titre, barre d'état en cases |
| v22 | Choix de la version (1.18 à 26.3), Dappled Forest, Sulfur Caves, petites structures, fossiles, abandoned camps, correction des strongholds |
| v23 | Onglet Librarian |
| v24 | Vraies textures du jeu pour les icônes |
| v25 | Point rouge Start, X / Z toujours visibles, 200 résultats, cadres de couleur, tout gardé au rafraîchissement, tailles des cercles sur une ligne |
| v26 | Sources séparées par fonction dans `sources/`, wasm compressé (fichier deux fois plus petit), code inutilisé retiré |
| v27 | Le site s'appelle `index.html` (prêt pour GitHub Pages), `.gitignore` pour `seeds.txt` |
| v28 | Seed map : Go to et Picked point en haut, barres du bas toujours visibles. Find a base : résultats compacts, sans boutons, colonne plus étroite |
| v29 | Barres `X, Z : … \| …` (Overworld en blanc, Nether en rouge), interface à 80 %, bouton Fade retiré |
| v30 | Find seeds : chercher des seeds qui ont ce qu'on veut autour du spawn, de 0,0 ou d'un point (plusieurs cœurs, Starred, Copy / Use). Biome à gauche dans la barre Cursor |
| v31 | Changement de seed bien plus rapide (environ 0,2 s au lieu de 1,5 à 3 s) : une carte grossière s'affiche d'abord, et seuls les anneaux de strongholds qui touchent la zone sont calculés |
| v32 | « More biomes » et « Cave biomes » : 27 biomes en plus (les biomes de grottes sont cherchés sous terre, à 4 profondeurs : 16, −8, −32 et −56) (variantes séparées : sunflower plains, grove, jagged / frozen / stony peaks, stony shore, océans froids et profonds…) |
| v33 | Find seeds : temps restant estimé dans la barre d'état |
| v34 | Find seeds avec un stronghold environ 9× plus rapide : les emplacements grossiers des strongholds (avant le décalage vers un bon biome, 112 blocs au plus) sont testés d'abord (1.19.3+), export wasm `strongholds_rough` |
| v35 | Barre d'état de Find seeds plus courte (« 1 in … » sous Found) ; si elle ne tient pas à côté des réglages, elle passe sur sa propre ligne au lieu de se couper en deux |
| v36 | **Fixed spots** dans Find seeds : structures à des coordonnées précises (± 16 à 250 blocs). Recherche en deux temps comme SeedCrackerX (48 bits du bas pour le placement, puis 16 bits du haut pour les biomes) : des centaines de fois plus rapide pour ces recherches. Strongholds : seul celui près du point est décalé vers son biome (3× plus rapide) |
| v37 | Find seeds sans cercles (Fixed spots seulement) ; chaque endroit fixé peut demander un biome (surface, ou grotte sous la structure) |
| v38 | Find seeds : glisser un biome sur un endroit fixé ; Seeds found prend les trois quarts de la colonne (12 seeds affichés), Starred plus bas |
| v39 | Fixed spots : la liste de biome devient une case où on glisse un ou plusieurs biomes (la structure doit être dans l'un d'eux) |
| v40 | **Crack the exact seed** (méthode SeedCrackerX : 20 bits du bas, 28 suivants, puis 16 du haut par les biomes) ; biome spots ; within « same chunk » ; Found lisible (« 1 · 1 in 117 M ») et « Next seed » au lieu de Time left |
| v41 | Style Minecraft (`theme-mc.css`) : vraies textures du jeu chargées en ligne (carte sur parchemin, panneaux encadrés par une table de craft, boutons en planches de chêne noir, cases d'inventaire, infobulles d'objets pour les résultats, fond de terre), police Monocraft (licence OFL), mention « Not an official Minecraft product » |
| v42 | Lien vers Chunkbase retiré (Seed map) ; palette « Add things » sombre et rangée en 3 colonnes ; bouton actif bien visible |
| v43 | Cases de coordonnées vides au départ (plus de 0 à effacer) ; cliquer un chip puis un cercle / la case marche sur tous les appareils (texte d'aide mis à jour) ; Librarian : choix papier / bibliothèque / livre enchanté avec les vraies images, émeraude à côté de chaque prix |
| v44 | Langue du site (à côté du titre) : anglais, français, espagnol, allemand, italien, portugais, polonais, néerlandais ; noms du jeu tirés des fichiers de langue officiels (`js/11-i18n.js`, sources dans `i18n/`). Search ne bouge plus quand on change de mode ou de dimension. Librarian : « Books on the left », émeraudes seulement à côté des livres, listes déroulantes au style du site |
| v45 | Find seeds : deux onglets, « Fixed spots » et « Around a point » (les cercles reviennent pour chercher des seeds avec des structures et biomes proches). Choix du nombre de cœurs (4 par défaut). Start from / X / Z / Base on land déplacés dans le panneau des cercles : la barre du haut ne bouge plus d'un mode à l'autre |
| v46 | Librarian : colonnes Roll, Rerolls, livre, prix (émeraude + nombre), autre ; « Books on the left » activé par défaut ; les 3 options en boutons du site. Toutes les listes déroulantes dessinées par le site (`js/12-mcselect.js`), dans tous les navigateurs ; barres de défilement grises carrées |
| v47 | « Start from », X, Z et « Base on land » sur une seule ligne ; option « Custom » ; le champ de sauvegarde dit juste « Name » ; lignes des listes déroulantes sans coins arrondis |
| v48 | Cases à cocher et choix en cases carrées façon inventaire (coche en pixels, carré plein) ; plus de petites flèches dans les champs de nombres, boutons - / + pour le numéro de roll ; bouton « Remove » pour retirer un élément cliqué dans les cercles (cliquer un élément de la liste le retire aussi) |
| v49 | Librarian : option « New world » retirée (sans numéro de roll enregistré, le tableau commence au roll 0) |
| v50 | Librarian : panneau « Next level-ups » à droite du tableau : Apprenti, Compagnon, Expert (une liste par niveau, partagée par tout le monde, tirée du seed) ; numéro du prochain niveau, bouton « A librarian leveled up », recherche de la position avec les échanges vus ; Maître : ses 2 échanges fixes (`js/09b-levels.js`) |
| v51 | Bouton « Remove » placé au-dessus de la phrase d'aide (This seed et Around a point) |
| v52 | Tous les métiers dans « Next level-ups », du plus utilisé au moins utilisé (Bibliothécaire, Fermier, Clerc, Armurier, Forgeron d'outils, Forgeron d'armes, Archer, Cartographe, Pêcheur, Maçon, Berger, Boucher, Tanneur), niveaux Novice à Maître ; enchantements des armures et outils, couleurs du cuir, flèches à effet, ragoûts ; type de villageois pour le Cartographe et le Pêcheur. Seul le Bibliothécaire est vérifié en jeu |
| v53 | L'onglet « Librarian » s'appelle maintenant « Villager » (Villageois en français) |
| v54 | Tout l'onglet Villager suit le métier choisi (en haut à gauche) : à gauche et dans le grand tableau, les rerolls du niveau Novice de ce métier (« I rerolled », « Find my position ») ; à droite, ses niveaux Apprenti à Maître |
| v55 | README à jour (onglet Villager, ce qui est gardé, fichiers), exemple de `seeds.txt` sans vrai seed ; `.gitignore` complété (fichiers de langue, `__pycache__`, fichiers système) et `.gitattributes` (fins de ligne LF) |
| v56 | Villager, « Next level-ups » plus clair : grande carte « ce que recevra le prochain villageois » avec ses boutons (+1, Undo, I don't know where I am) et ce qu'a reçu le dernier, astuce pour passer une ligne, « Level-ups already done in this world », livres voulus « dans N montées · N−1 autres avant », colonne Order (Next, 2nd, 3rd…) au lieu de # / In |
| v57 | Seed map et carte de Find a base : itinéraire (carré sous XZ) : clic sur des structures pour les relier, numéros, longueur de chaque trajet, liste des coordonnées, total, Best order (chemin le plus court), Copy, Clear (`js/06b-route.js`) |
| v58 | Case « Base on land » enlevée : en Overworld la base est toujours sur la terre ferme |
| v59 | Optimisation : les cartes ont leur propre moteur (une carte ne met plus la recherche en pause, recherche 30 à 50 % plus rapide), biomes calculés seulement aux endroits candidats quand on ne cherche que des structures, carte redessinée une fois par image, textes et traductions plus réécrits s'ils n'ont pas changé, traductions gardées en mémoire, fond des icônes dessiné une seule fois par taille |
| v60 | Seed map : plan et coffres des temples du désert (double-clic ou bouton « Chests », sauf en mode itinéraire) : plan vu du dessus, 4 coffres, contenu exact de chaque coffre rangé comme dans le jeu, à partir de Java 1.21.6 |
| v61 | Onglets dans l'ordre Seed map, Spot finder, Villager ; « Find a base » s'appelle maintenant **Spot finder** (Chercheur d'endroits en français), et le bouton de Picked point **Find spots here** |
| v62 | Plan et coffres pour buried treasure, pillager outpost, bastion (partie de départ), end city, stronghold et mineshaft : plan des pièces vu du dessus, chaque coffre (ou wagonnet) numéroté avec son contenu ; le double-clic marche aussi sur la carte du Spot finder |
| v63 | Les bastions s'appellent par leur type d'abord (« Treasure (bastion) », « Écuries à hoglins (bastion) »…) ; en laissant la souris un instant sur un bouton ou une pastille, son nom complet s'affiche dans une bulle comme celles du jeu |
| v64 | Plan et coffres aussi pour temple de la jungle, igloo, épave, portail en ruine, forteresse du Nether et campement abandonné (tables de butin et graines d'après xpple/cubiomes, vérifiées avec ses données de test pour la jungle et le campement, pièces de la forteresse identiques à cubiomes) |
| v65 | Campement abandonné : le plan s'ouvre (le nom du biome de la carte est maintenant reconnu, aussi pour les épaves et portails en ruine) ; les igloos avec sous-sol (zombie villageois et pomme dorée dans le coffre) ont une petite pomme dorée sur leur icône |
| v66 | Campement abandonné : le plan dit quelle tente (1 à 10, selon le biome) et quel campement (1 à 49) il utilise et ce que chacun contient (coffres, tonneaux, coffre secret) ; le coffre secret a son propre nom dans les onglets ; sur la carte, un petit coffre sur l'icône marque les campements qui ont un coffre secret |
| v67 | Bulles d'aide après 0,33 s au lieu de 1 s ; dans les coffres, passer la souris sur un objet montre tout de suite une bulle comme dans le jeu : nom (bleu clair si enchanté, jaune si rare), enchantements, effet de la potion ou du ragoût suspect, son de la corne de chèvre, nombre ; pour les cartes d'exploration, la structure vers laquelle elle mène et ses coordonnées probables (la plus proche parmi celles chargées sur les cartes) |
| v68 | Fenêtre des plans sans barre de défilement : le plan prend la place qui reste, le coffre garde sa taille, les cases rapetissent sur petit écran, le plan suit la taille de la fenêtre ; dans les coffres, les blocs sont dessinés en 3D comme dans l'inventaire du jeu (lit de paille, TNT, citrouille, blocs d'or…) et les objets récents (cuivre, lances, cartes d'exploration, armures de nautile, coussin) ont leur vraie icône (`js/06a2-looticons.js`, fait par `i18n/loot_icons.py` à partir des modèles 26.3) |
| v69 | Nouveau moteur `js/06d-jigsaw.js` : assemble les structures « jigsaw » pièce par pièce comme le jeu (JigsawPlacement, mêmes nombres aléatoires, même ordre). **Bastions** : tous les coffres de chaque type (trésor, logements, écuries, pont), avec leur hauteur Y. **Cités antiques** : plan et tous les coffres (double-clic). **Campements abandonnés** : vrai modèle de tente et de campement (l'ancien calcul sautait un tirage et se trompait souvent de campement), coffres à leur X et Z exacts, biome exact demandé au moteur de biomes au milieu de la tente (la carte était trop grossière : un campement de forêt pris pour un de forêt de bouleaux), cartes de campement avec leur nom (« Birch Forest Camp Map »…) et sans celle du biome du coffre ; marque coffre secret sur la carte calculée de la même façon. Vérifié en jeu sur un campement (X 688 Z -2000). Tables de butin refaites depuis les fichiers 26.3 (avant : une préversion 26.4, avec un disque dans les igloos et un bloc dans les cités antiques qui n'existent pas en 26.3) ; tables du trésor et des écuries du bastion ajoutées |
| v70 | Villager : partie « Next level-ups » enlevée (trop aléatoire sur un serveur, où les autres joueurs font aussi monter des villageois) ; le tableau des rolls prend toute la largeur |
| v71 | Cartes en tuiles : la carte se charge par carrés de 128 × 128 cases, demandés dès 60 ms après un zoom ou un déplacement, du centre de l'écran vers les bords, à jusqu'à 3 moteurs en parallèle selon le processeur ; les carrés plus demandés sont abandonnés avant d'être calculés, ceux déjà vus restent en mémoire (retour instantané) ; une passe grossière d'abord quand rien n'est encore affiché. Le centre devient net environ 3 fois plus vite |
| v72 | Coffres : ligne « Best » enlevée sous le coffre (les détails sont dans la bulle de chaque objet) |
| v73 | Structures faites : bouton « Mark as done » dans la fenêtre des coffres (à côté du ×) et clic droit sur une icône de carte (Seed map et Spot finder) ; une structure faite a son icône assombrie avec une coche verte ; « Hide done » sous « Show on map » les cache, avec le nombre de structures faites ; gardé par seed dans le navigateur (`js/06e-done.js`) |
| v74 | Campements : « No plan for this structure » sur les campements en hauteur corrigé : le biome était lu à Y 64, sous terre sous une colline (grottes de spéléothèmes) ; il est maintenant lu au-dessus du sol, où c'est le biome de surface (vérifié : les 512 campements autour de 0, 0 s'ouvrent). Les messages (« No plan for this structure », « Seed saved »…) ont le style des notifications du jeu : en haut à droite, cadre sombre en pixels, une icône (barrière rouge pour ce qui ne marche pas, livre sinon), arrivée en glissant |
| v75 | Structures faites, aussi pour celles sans coffres : bouton « Mark as done » dans Picked point (Seed map) pour toute structure, et double-clic sur une structure sans coffres ouvre le petit menu « Mark as done » (comme le clic droit) ; « Hide done » est maintenant sous la liste des structures ; « Hide done » cache aussi les coordonnées X / Z des structures faites |
| v76 | Picked point : les coordonnées s'affichent comme sur la barre de la carte (blanc Overworld, rouge Nether) ; un clic sur une paire la copie ; boutons Overworld / Nether, « Find spots here » et « Mark as done » enlevés de Picked point (le clic droit et le double-clic gardent « Mark as done ») |
| v77 | Picked point : petit bouton « Done » à côté de « Chests » (pour toute structure) ; les phrases d'explication sous les structures sont enlevées |
| v78 | Première visite : le site s'ouvre sur la Seed map (ensuite, il rouvre le dernier onglet utilisé) ; phrase « Switching between Overworld and Nether… » enlevée sous les dimensions |
| v79 | Seed map : les boutons Overworld / Nether / End sont au-dessus de la carte, dans la même barre que « Dimension » du Spot finder |
| v80 | Seed map : le panneau de gauche a la même largeur que dans le Spot finder, la carte commence au même endroit (plus de décalage en changeant d'onglet) ; la barre au-dessus des panneaux a une hauteur fixe identique dans les deux onglets |
| v81 | Bouton « ✓ Done » de la même hauteur que « Done » (et que « Chests ») |
| v82 | Icônes des structures : les vraies textures sont gardées dans le navigateur, donc au rechargement elles s'affichent tout de suite (plus de flash des icônes dessinées) |
| v83 | Go to : en End, la case « These are … coordinates » est cachée mais garde sa place, donc le panneau ne bouge plus en changeant de dimension |
| v84 | Seed map : « Show on map » a deux onglets, Structures et Biomes ; un clic sur un biome l'entoure en jaune partout sur la carte (plusieurs à la fois possible, choix gardé) |
| v85 | Modèles pour contribuer : `CONTRIBUTING.md` (comment ouvrir une issue et proposer un changement), modèles d'issue Bug et Idea, modèle de pull request (dossier `.github`) |
| v86 | Plans des coffres pour les villages (5 types, choisis par biome comme le jeu) et les chambres des épreuves (coffres, tonneaux, pots, distributeurs, coffres de récompense) ; distributeurs à 9 cases et pots à 1 case ; tables de butin village, épreuves, ruines sous-marines et manoir ajoutées |
| v87 | Icônes colorées comme dans le jeu : armure en cuir, herbes et fougères, potions, flèches à effet |
| v90 | Plans des structures dessinés bloc par bloc avec les textures du jeu (chambres des épreuves, villages, bastions, cités antiques, camps) : vue de dessus comme un plan, toits et plafonds enlevés, murs plus sombres ; villages et camps posés sur l'herbe, le sable ou la neige |
| v91 | Dessin bloc par bloc aussi pour les igloos, épaves, portails en ruine, cités de l'End et avant-postes (avant-poste entier : tour, tentes, cages) ; forts, puits de mine, forteresses, temples de la jungle et trésors en textures avec murs ; coffres en cuivre comptés comme conteneurs (coffre secret des camps : graines des coffres corrigées) ; petit coffre en cuivre sur l'icône des camps avec un coffre secret |
