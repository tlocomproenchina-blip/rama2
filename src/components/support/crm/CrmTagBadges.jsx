import React from 'react';
import { describeTag } from '@/lib/crmTags';

export default function CrmTagBadges({ tags = [], catalog = [] }) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => {
        const { label, className } = describeTag(tag, catalog);
        return (
          <span key={tag} className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${className}`}>
            {label}
          </span>
        );
      })}
    </div>
  );
}