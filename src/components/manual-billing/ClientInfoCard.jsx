import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Mail, Phone, Tag, MapPin, X } from 'lucide-react';

export default function ClientInfoCard({ client, onClear }) {
  if (!client) return null;
  return (
    <Card className="border-0 shadow-lg">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-800">{client.full_name || client.email}</p>
              {client.shipping_mark && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                  <Tag className="h-3 w-3" /> {client.shipping_mark}
                </span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 text-sm text-slate-600">
          <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-slate-400" /> {client.email}</div>
          {client.whatsapp && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" /> {client.whatsapp}</div>}
          {client.city && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" /> {client.city}</div>}
        </div>
      </CardContent>
    </Card>
  );
}