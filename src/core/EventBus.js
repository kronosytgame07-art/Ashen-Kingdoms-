/**
 * EventBus — canal d'événements global pour découpler les modules.
 * Usage : EventBus.on('battle:end', handler) / EventBus.emit('battle:end', data)
 */
const listeners = new Map();

export const EventBus = {
  on(event, handler) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(handler);
    return () => this.off(event, handler);
  },

  off(event, handler) {
    listeners.get(event)?.delete(handler);
  },

  emit(event, data) {
    listeners.get(event)?.forEach((handler) => {
      try { handler(data); }
      catch (error) { console.error(`[EventBus] Erreur dans le handler "${event}":`, error); }
    });
  },

  clear() { listeners.clear(); }
};
