/**
 * EventBus.js — Singleton publish/subscribe event bus.
 * Decouples Game, UI, Economy, Battle and other modules.
 *
 * Usage:
 *   import { bus } from './EventBus.js';
 *   bus.on('resources:changed', handler);
 *   bus.emit('resources:changed', { gold: 500 });
 *   bus.off('resources:changed', handler);
 */

class EventBus {
  constructor() { this._listeners = new Map(); }

  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    this._listeners.get(event)?.delete(fn);
  }

  emit(event, payload) {
    this._listeners.get(event)?.forEach((fn) => {
      try { fn(payload); }
      catch (err) { console.error(`[EventBus] Error in listener for "${event}":`, err); }
    });
  }

  once(event, fn) {
    const wrapper = (payload) => { fn(payload); this.off(event, wrapper); };
    return this.on(event, wrapper);
  }

  clear(event) {
    if (event) this._listeners.delete(event);
    else this._listeners.clear();
  }
}

export const bus = new EventBus();

/**
 * Catalogue of all events emitted across the game.
 * Use these constants to avoid typo bugs.
 */
export const EVENTS = {
  RESOURCES_CHANGED : 'resources:changed',
  BUILDING_PLACED   : 'building:placed',
  BUILDING_UPGRADED : 'building:upgraded',
  BUILDING_REMOVED  : 'building:removed',
  BUILDING_READY    : 'building:ready',
  UNIT_TRAINED      : 'unit:trained',
  UNIT_DEPLOYED     : 'unit:deployed',
  BATTLE_STARTED    : 'battle:started',
  BATTLE_FINISHED   : 'battle:finished',
  QUEST_COMPLETED   : 'quest:completed',
  CLAN_CREATED      : 'clan:created',
  CLAN_LEFT         : 'clan:left',
  EXTRACTOR_COLLECTED: 'extractor:collected',
  SAVE_REQUESTED    : 'save:requested',
  PROFILE_CHANGED   : 'profile:changed',
};
