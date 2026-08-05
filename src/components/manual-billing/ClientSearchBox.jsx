import React from 'react';
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Loader2, User } from 'lucide-react';
import useClientSearch from '@/hooks/useClientSearch';

export default function ClientSearchBox({ onSelect }) {
  const { query, setQuery, results, setResults, searching } = useClientSearch({ limit: 15, exact: true });

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar cliente por nombre, email, shipping mark o WhatsApp..."
          className="pl-10"
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />}
      </div>

      {results.length > 0 && (
        <Card className="border shadow-sm">
          <CardContent className="p-2 max-h-72 overflow-y-auto">
            {results.map((u) => (
              <button
                key={u.id}
                onClick={() => { onSelect(u); setQuery(''); setResults([]); }}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 flex items-center gap-3"
              >
                <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate">{u.full_name || u.email}</p>
                  <p className="text-xs text-slate-500 truncate">{u.email} {u.shipping_mark ? `· ${u.shipping_mark}` : ''}</p>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}