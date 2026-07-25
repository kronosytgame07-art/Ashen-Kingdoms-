import { Game }           from './core/Game.js';
import { ProfileManager } from './core/ProfileManager.js';

/*
 * Compatibilité temporaire entre VillageRenderer et BuildingArtist.
 * VillageRenderer expose north/south/east/west tandis que BuildingArtist
 * utilise top/bottom/left/right. Sans ces alias, le premier rendu du Trône
 * corrompu déclenche une TypeError et donne l'impression que la map freeze.
 *
 * Les propriétés sont non énumérables pour ne pas perturber les boucles,
 * sauvegardes JSON ou spreads d'objets.
 */
function installIsoRendererCompatibility() {
  const aliases = {
    top: 'north',
    bottom: 'south',
    left: 'east',
    right: 'west'
  };

  for (const [alias, source] of Object.entries(aliases)) {
    if (Object.getOwnPropertyDescriptor(Object.prototype, alias)) continue;
    Object.defineProperty(Object.prototype, alias, {
      configurable: true,
      enumerable: false,
      get() {
        if (this && this.d && this.d !== this) return this.d[alias];
        return this?.[source];
      }
    });
  }
}

installIsoRendererCompatibility();

const profiles      = new ProfileManager();
const canvas        = document.getElementById('gameCanvas');
const mainMenu      = document.getElementById('mainMenu');
const gameApp       = document.getElementById('app');
const profileList   = document.getElementById('profileList');
const createButton  = document.getElementById('createProfileButton');
const createInput   = document.getElementById('profileNameInput');
const optionsButton = document.getElementById('optionsButton');
const optionsPanel  = document.getElementById('optionsPanel');
const soundToggle   = document.getElementById('soundToggle');
const notifToggle   = document.getElementById('notificationToggle');
let game = null;
let launching = false;

if (!canvas) throw new Error('Canvas #gameCanvas introuvable');

// ── helpers localStorage sécurisés ──────────────────────────────────────────
function lsGet(key, fallback = null) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, value); } catch { /* silencieux en sandbox */ }
}

function showLaunchError(error) {
  console.error('[Ashen Kingdoms] Impossible de charger le royaume :', error);
  let message = document.getElementById('launchError');
  if (!message) {
    message = document.createElement('p');
    message.id = 'launchError';
    message.className = 'profile-empty';
    profileList.before(message);
  }
  message.textContent = `Le royaume n'a pas pu se charger : ${error?.message ?? 'erreur inconnue'}`;
}

function clearLaunchError() {
  document.getElementById('launchError')?.remove();
}

// ── rendu liste profils ──────────────────────────────────────────────────────
function renderProfiles() {
  profileList.replaceChildren();
  const items = profiles.list();
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'profile-empty';
    empty.textContent = 'Aucun royaume. Créez votre première lignée.';
    profileList.append(empty);
    return;
  }
  for (const profile of items) {
    const card = document.createElement('article');
    card.className = 'profile-card';
    const date = new Date(profile.lastPlayedAt).toLocaleDateString('fr-FR');
    card.innerHTML = `
      <div>
        <small>ROYAUME</small>
        <h3>${profile.name}</h3>
        <p>Dernière visite : ${date}</p>
      </div>
      <div class="profile-actions">
        <button data-play="${profile.id}">Entrer</button>
        <button class="secondary" data-rename="${profile.id}">Renommer</button>
        <button class="danger"    data-delete="${profile.id}">Supprimer</button>
      </div>`;
    profileList.append(card);
  }
}

async function launchProfile(id) {
  if (launching) return;
  launching = true;
  clearLaunchError();

  try {
    profiles.select(id);
    const storageKey = profiles.storageKey(id);
    mainMenu.classList.add('hidden');
    gameApp.classList.remove('hidden');

    game?.destroy?.();
    game = new Game(canvas, { storageKey, onReturnToMenu: returnToMainMenu });
    await game.start();
  } catch (error) {
    game?.destroy?.();
    game = null;
    gameApp.classList.add('hidden');
    mainMenu.classList.remove('hidden');
    showLaunchError(error);
  } finally {
    launching = false;
  }
}

function returnToMainMenu() {
  game?.save?.();
  game?.destroy?.();
  game = null;
  gameApp.classList.add('hidden');
  mainMenu.classList.remove('hidden');
  renderProfiles();
}

globalThis.__ashenReturnToMenu = returnToMainMenu;

// Capture les erreurs de rendu au lieu de laisser l'application figée sans explication.
window.addEventListener('error', (event) => {
  if (!game || mainMenu.classList.contains('hidden') === false) return;
  showLaunchError(event.error ?? new Error(event.message));
});
window.addEventListener('unhandledrejection', (event) => {
  if (!game) return;
  showLaunchError(event.reason instanceof Error ? event.reason : new Error(String(event.reason)));
});

// ── événements liste profils ─────────────────────────────────────────────────
profileList.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.play) {
    await launchProfile(button.dataset.play);
  }
  if (button.dataset.rename) {
    const current = profiles.list().find(item => item.id === button.dataset.rename);
    const next = prompt('Nouveau nom du royaume', current?.name ?? '');
    if (next) { profiles.rename(button.dataset.rename, next); renderProfiles(); }
  }
  if (button.dataset.delete && confirm('Supprimer définitivement ce royaume ?')) {
    profiles.remove(button.dataset.delete);
    renderProfiles();
  }
});

// ── bouton Créer un royaume ──────────────────────────────────────────────────
createButton.addEventListener('click', async () => {
  if (launching) return;
  const name    = (createInput?.value ?? '').trim();
  const profile = profiles.create(name || 'Nouveau royaume');
  if (createInput) createInput.value = '';
  renderProfiles();
  await launchProfile(profile.id);
});

// ── bouton Options ───────────────────────────────────────────────────────────
optionsButton?.addEventListener('click', () => {
  optionsPanel?.classList.toggle('hidden');
});

// ── toggles options (localStorage sécurisé) ─────────────────────────────────
if (soundToggle) {
  soundToggle.checked = lsGet('ashen-option-sound', 'on') !== 'off';
  soundToggle.addEventListener('change', () =>
    lsSet('ashen-option-sound', soundToggle.checked ? 'on' : 'off'));
}
if (notifToggle) {
  notifToggle.checked = lsGet('ashen-option-notifications', 'on') !== 'off';
  notifToggle.addEventListener('change', () =>
    lsSet('ashen-option-notifications', notifToggle.checked ? 'on' : 'off'));
}

// ── init ─────────────────────────────────────────────────────────────────────
renderProfiles();