import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useNavState } from '@/components/sidebar/navStore';
import { findSection, setLastTab } from '@/components/sidebar/sectionsConfig';

// Pestañas de la sección actual, arriba del contenido de la página.
export default function SectionTabs({ currentPage }) {
  const { sections, flags } = useNavState();
  const section = findSection(sections, currentPage);
  if (!section || section.pages.length <= 1) return null;

  return (
    <div className="-mx-1 mb-4 overflow-x-auto border-b border-border [scrollbar-width:none]">
      <div className="flex w-max gap-1 px-1">
        {section.pages.map((x) => {
          const isActive = x.page === currentPage;
          return (
            <Link
              key={x.page}
              to={createPageUrl(x.page)}
              data-tour={x.page}
              onClick={() => setLastTab(section.id, x.page)}
              className={[
                'relative flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {x.label}
              {flags?.[x.page] && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}