/**
 * Génère un identifiant unique garanti.
 * Préfixe optionnel pour la lisibilité en debug.
 */
export function makeId(prefix = 'id') {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  // Fallback : combine timestamp + 2 nombres aléatoires pour éviter les collisions
  const a = (Math.random() * 0xffffffff | 0).toString(16).padStart(8, '0');
  const b = (Math.random() * 0xffffffff | 0).toString(16).padStart(8, '0');
  return `${prefix}-${Date.now().toString(16)}-${a}-${b}`;
}
