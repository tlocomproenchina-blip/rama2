import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Moon, Sun } from 'lucide-react';

const STORAGE_KEY = 'tlec-dark-mode';

export function getDarkModePreference() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'enabled') return true;
    if (v === 'disabled') return false;
  } catch (_) {}
  // Default: follow system preference
  return null;
}

export function isDarkModeActive() {
  const pref = getDarkModePreference();
  if (pref !== null) return pref;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch (_) {
    return false;
  }
}

export function applyDarkMode(enabled) {
  document.documentElement.classList.toggle('dark', !!enabled);
}

export function setDarkModePreference(enabled) {
  try {
    if (enabled === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, enabled ? 'enabled' : 'disabled');
  } catch (_) {}
  applyDarkMode(enabled);
  try { window.dispatchEvent(new CustomEvent('tlec-dark-mode-change')); } catch (_) {}
}

export default function DarkModeToggleCard() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(isDarkModeActive());
  }, []);

  const handleToggle = (checked) => {
    setEnabled(checked);
    setDarkModePreference(checked);
  };

  return (
    <Card className="rounded-2xl border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {enabled ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          Modo Noche
        </CardTitle>
        <CardDescription>
          Activa o desactiva el tema oscuro para toda la aplicación. Por defecto sigue la preferencia del sistema.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/40">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">Tema oscuro</p>
            <p className="text-xs text-muted-foreground">
              {enabled ? 'Activado: fondo oscuro con texto claro' : 'Desactivado: fondo claro con texto oscuro'}
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={handleToggle} />
        </div>
      </CardContent>
    </Card>
  );
}