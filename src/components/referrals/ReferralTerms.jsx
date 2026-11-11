import React from 'react';
import { TERMS } from '@/lib/referralTerms';

export default function ReferralTerms() {
  return (
    <div className="space-y-4 text-sm">
      {TERMS.map((s) => (
        <div key={s.title}>
          <p className="font-display font-semibold text-foreground">{s.title}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
            {s.items.map((i) => <li key={i}>{i}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}