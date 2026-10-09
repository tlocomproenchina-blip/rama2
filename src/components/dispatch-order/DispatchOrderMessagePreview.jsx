import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare } from 'lucide-react';

export default function DispatchOrderMessagePreview({ text }) {
  return (
    <Card className="border-border/70 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4 text-primary" /> Mensaje que recibe el almacén
        </CardTitle>
        <CardDescription>Es el mismo texto del WhatsApp y del archivo TXT.</CardDescription>
      </CardHeader>
      <CardContent>
        <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-border/70 bg-muted/40 p-3 text-xs leading-relaxed text-foreground">
          {text}
        </pre>
      </CardContent>
    </Card>
  );
}