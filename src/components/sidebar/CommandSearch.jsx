import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { createPageUrl } from '@/utils';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from '@/components/ui/command';

// Buscador de páginas (Ctrl+K). Solo muestra las páginas que el usuario puede abrir.
export default function CommandSearch({ open, onOpenChange, sections, isAdmin, onNavigate }) {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onOpenChange]);

  const go = (page) => {
    onOpenChange(false);
    onNavigate(page);
    navigate(createPageUrl(page));
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar una página…" />
      <CommandList>
        <CommandEmpty>No hay páginas con ese nombre.</CommandEmpty>
        {sections.map((section) => (
          <CommandGroup key={section.id} heading={section.label}>
            {section.pages.map((x) => (
              <CommandItem key={x.page} value={`${x.label} ${section.label} ${x.page}`} onSelect={() => go(x.page)}>
                <span className="flex-1">{x.label}</span>
                <span className="text-xs text-muted-foreground">{section.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        {isAdmin && (
          <CommandGroup heading="Datos">
            <CommandItem
              value="buscar clientes paquetes shipping mark"
              onSelect={() => { onOpenChange(false); window.dispatchEvent(new Event('open-global-search')); }}
            >
              <Search className="h-4 w-4" />
              <span className="flex-1">Buscar clientes, paquetes o shipping marks</span>
              <span className="text-xs text-muted-foreground">Ctrl+Shift+K</span>
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}