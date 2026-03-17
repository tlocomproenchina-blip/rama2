import React, { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from 'sonner';

export default function EmailAIAssistant({ appName, onApply }) {
  const [idea, setIdea] = useState('');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!idea.trim()) {
      toast.error('Escribe la idea del email');
      return;
    }

    setGenerating(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Redacta un email comercial profesional en español para la empresa ${appName || 'TLEC CARGO'}.

Idea del usuario:
${idea}

Devuelve:
- Un asunto claro y atractivo.
- Un cuerpo en HTML limpio, listo para pegar en un editor de email.
- Usa párrafos, títulos cortos y listas si ayudan.
- No uses Markdown.
- No incluyas explicaciones extra ni notas fuera del email.`,
        response_json_schema: {
          type: 'object',
          properties: {
            subject: { type: 'string' },
            html_body: { type: 'string' }
          },
          required: ['subject', 'html_body']
        }
      });

      onApply({
        subject: result.subject || '',
        body: result.html_body || ''
      });
      toast.success('Email redactado con IA');
    } catch (error) {
      toast.error('No se pudo generar el email');
    }
    setGenerating(false);
  };

  return (
    <Card className="border border-blue-100 bg-blue-50/50 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-blue-600" />
          Asistente IA para redactar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label>Dime la idea del email</Label>
          <Textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            rows={4}
            placeholder="Ej: quiero avisar a los clientes que esta semana tendremos promociones en envíos marítimos y recordarles que actualicen su shipping mark"
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleGenerate} disabled={generating} className="bg-blue-600 hover:bg-blue-700">
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Redactar con IA
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}