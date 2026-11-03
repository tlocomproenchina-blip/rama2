import { useSyncExternalStore } from 'react';

// Estado de navegación que calcula la barra lateral (secciones visibles y puntos
// rojos) y que las pestañas reutilizan, sin repetir consultas.
let state = { sections: [], flags: {} };
const listeners = new Set();

export function setNavState(next) {
  state = next;
  listeners.forEach((l) => l());
}

const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };

export function useNavState() {
  return useSyncExternalStore(subscribe, () => state);
}