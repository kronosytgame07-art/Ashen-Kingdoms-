# Ashen Kingdoms — audit technique

## Problèmes constatés dans le prototype initial

### `index.html`
- Interface entièrement câblée sur un unique script global.
- Aucun point d’entrée modulaire.
- Informations de bâtiment limitées au nom et au niveau.
- Menu de construction sans durée ni description détaillée.

### `styles.css`
- Direction visuelle cohérente mais règles très compactes et difficiles à maintenir.
- Peu de variantes de feedback pour succès et erreur.
- Responsive paysage déjà présent, mais sans structure dédiée à une future UI plus riche.

### `src/game.js`
- Environ 700 lignes regroupant état, sauvegarde, grille, rendu, input, économie et UI.
- Fort couplage entre DOM, Canvas et logique métier.
- Coordonnées historiques `x/y` utilisées à la fois pour la grille et la caméra.
- Recalcul de l’interface à chaque frame.
- Configuration des bâtiments directement dans le moteur.
- Sauvegarde non versionnée et migration implicite fragile.
- Aucun gestionnaire d’assets réutilisable.
- Extension future vers combat, files de construction ou backend difficile.

## Plan appliqué

### Quick wins
1. Passage au point d’entrée ES modules.
2. Séparation des données bâtiment.
3. Centralisation des conversions grille/écran et des collisions.
4. Sauvegarde versionnée avec migration `x/y` vers `col/row`.
5. Feedbacks succès/erreur et descriptions de bâtiments.
6. Mise à jour UI limitée à quatre fois par seconde au lieu de chaque frame.

### Refonte structurelle
- `src/core/Game.js` : orchestration et règles de jeu.
- `src/core/Grid.js` : coordonnées et collisions.
- `src/core/Renderer.js` : rendu Canvas.
- `src/core/SaveManager.js` : persistance.
- `src/core/AssetManager.js` : préchargement/cache d’images.
- `src/data/buildings.js` : coûts, tailles, production, niveaux.
- `src/ui/GameUI.js` : DOM et feedback utilisateur.
- `src/main.js` : démarrage et gestion d’erreur globale.

## Fondations désormais disponibles
- Placement souris/tactile.
- Drag de caméra et pincement à deux doigts.
- Validation visuelle verte/rouge.
- Remparts posables en glissant.
- Coûts et temps de construction configurables.
- Améliorations à coût et durée croissants.
- Production passive de ressources.
- Structure `buildQueue` prête pour une vraie file d’attente.
- Cache d’assets avec fallback procédural.
- Sauvegarde locale versionnée, migrable vers API.

## Prochaines étapes recommandées
1. Importer les sprites PNG transparents dans `assets/buildings/`.
2. Ajouter une file de bâtisseurs avec nombre limité de constructions simultanées.
3. Ajouter capacité de stockage réelle et bâtiments de stockage.
4. Ajouter rotation uniquement pour les bâtiments dont l’asset possède plusieurs orientations.
5. Ajouter particules dédiées : fumée, cendres, runes et poussière de construction.
6. Ajouter sons courts et réglages audio.
7. Créer un modèle de données compatible backend : compte, village, inventaire, timers serveur.
8. Ensuite seulement poser les fondations du combat et des raids.

La monétisation et le multijoueur ne doivent pas être engagés avant stabilisation de la boucle construction/amélioration/économie et avant mise en place d’une autorité serveur.
