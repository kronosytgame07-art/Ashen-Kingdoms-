import { BUILDINGS } from '../data/buildings.js';
import { UNITS } from '../data/units.js';

const emptyTroops = () => Object.fromEntries(Object.keys(UNITS).map((type) => [type, 0]));
const makeClanId = () => globalThis.crypto?.randomUUID?.() || `clan-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export class ClanManager {
  ensureState(state) {
    state.clan ??= { id: null, name: '', role: null, members: [], donationsGiven: 0, donationsReceived: 0 };
    for (const building of state.buildings ?? []) {
      if (building.type === 'clanCastle') building.reinforcements ??= emptyTroops();
    }
  }

  createClan(state, name) {
    this.ensureState(state);
    const clean = String(name ?? '').trim().slice(0, 24);
    if (clean.length < 3) return { ok: false, reason: 'Le nom du clan doit contenir au moins 3 caractères' };
    state.clan = {
      id: makeClanId(),
      name: clean,
      role: 'leader',
      members: [{ id: 'local-player', name: 'Seigneur des cendres', role: 'leader' }],
      donationsGiven: 0,
      donationsReceived: 0
    };
    return { ok: true };
  }

  leaveClan(state) {
    this.ensureState(state);
    state.clan = { id: null, name: '', role: null, members: [], donationsGiven: 0, donationsReceived: 0 };
    return { ok: true };
  }

  capacity(building) {
    const config = BUILDINGS.clanCastle.reinforcementHousing;
    return config.base + (building.level - 1) * config.perLevel;
  }

  housing(building) {
    return Object.entries(building.reinforcements ?? {}).reduce((sum, [type, amount]) => sum + (UNITS[type]?.housing ?? 0) * amount, 0);
  }

  canReceive(building, type) {
    const unit = UNITS[type];
    if (!unit) return false;
    return this.housing(building) + unit.housing <= this.capacity(building);
  }

  receiveLocalReinforcement(state, building, type) {
    this.ensureState(state);
    if (!state.clan.id) return { ok: false, reason: 'Rejoignez ou créez un clan avant de recevoir des renforts' };
    if (building.readyAt > Date.now()) return { ok: false, reason: 'Le Château de Clan est encore en construction' };
    if (!this.canReceive(building, type)) return { ok: false, reason: 'Capacité de renforts insuffisante' };
    building.reinforcements[type] = (building.reinforcements[type] ?? 0) + 1;
    state.clan.donationsReceived = (state.clan.donationsReceived ?? 0) + 1;
    return { ok: true };
  }

  donateFromCampfires(state, building, type) {
    this.ensureState(state);
    if (!state.clan.id) return { ok: false, reason: 'Rejoignez ou créez un clan avant de donner des troupes' };
    const source = (state.buildings ?? []).find((item) => item.type === 'campfire' && (item.garrison?.[type] ?? 0) > 0);
    if (!source) return { ok: false, reason: 'Aucune troupe de ce type disponible dans vos Brasiers' };
    if (!this.canReceive(building, type)) return { ok: false, reason: 'Le Château de Clan est plein' };
    source.garrison[type] -= 1;
    building.reinforcements[type] = (building.reinforcements[type] ?? 0) + 1;
    state.clan.donationsGiven = (state.clan.donationsGiven ?? 0) + 1;
    state.clan.donationsReceived = (state.clan.donationsReceived ?? 0) + 1;
    return { ok: true };
  }

  takeDefenders(building) {
    const troops = { ...emptyTroops(), ...(building.reinforcements ?? {}) };
    building.reinforcements = emptyTroops();
    return troops;
  }
}