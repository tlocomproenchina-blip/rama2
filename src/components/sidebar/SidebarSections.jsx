import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { prefetchPageData } from '@/lib/adminPagePrefetch';
import { findSection, sectionTarget } from '@/components/sidebar/sectionsConfig';

// Barra lateral compacta: una fila por sección.
export default function SidebarSections({ sections, currentPage, flags, onNavigate }) {
  const active = findSection(sections, currentPage);

  return (
    <div className="space-y-0.5">
      {sections.map((section) => {
        const Icon = section.icon;
        const isActive = active?.id === section.id;
        const target = sectionTarget(section);
        const hasDot = section.pages.some((x) => flags?.[x.page]);
        return (
          <Link
            key={section.id}
            to={createPageUrl(target)}
            data-tour-pages={section.pages.map((x) => x.page).join(' ')}
            onMouseEnter={() => prefetchPageData(target)}
            onClick={() => onNavigate(target)}
            className={[
              'flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
              isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            ].join(' ')}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">{section.label}</span>
            {hasDot && <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />}
          </Link>
        );
      })}
    </div>
  );
}