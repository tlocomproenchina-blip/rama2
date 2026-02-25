import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { X, MessageCircle, Send, Loader2, User, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function ChatbotAssistant({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: `¡Hola ${user?.first_name || 'amigo'}! 👋 Soy tu asistente virtual. Estoy aquí para ayudarte con cualquier duda sobre tus envíos o nuestros servicios. ¿En qué puedo ayudarte hoy?`
      }]);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      // Get user data
      const [packages, consolidations, faqs] = await Promise.all([
        base44.entities.Package.filter({ client_email: user.email }),
        base44.entities.Consolidation.filter({ client_email: user.email }),
        base44.entities.FAQ.filter({ is_active: true })
      ]);

      // Build context
      const context = `
INFORMACIÓN DEL USUARIO:
- Nombre: ${user.first_name} ${user.last_name}
- Email: ${user.email}
- Shipping Mark: ${user.shipping_mark || 'No asignado aún'}
- Ciudad: ${user.city || 'No especificada'}
- WhatsApp: ${user.whatsapp || 'No especificado'}

PAQUETES DEL USUARIO (${packages.length} en total):
${packages.slice(0, 5).map(p => `- Tracking: ${p.tracking_number}, Estado: ${p.status}, Tipo: ${p.shipping_type}`).join('\n')}
${packages.length > 5 ? `... y ${packages.length - 5} paquetes más` : ''}

CONSOLIDACIONES DEL USUARIO (${consolidations.length} en total):
${consolidations.slice(0, 3).map(c => `- Tracking: ${c.consolidation_tracking}, Estado: ${c.status}, Costo: $${c.total_cost}`).join('\n')}
${consolidations.length > 3 ? `... y ${consolidations.length - 3} consolidaciones más` : ''}

PREGUNTAS FRECUENTES:
${faqs.map(faq => `P: ${faq.question}\nR: ${faq.answer}`).join('\n\n')}
`;

      const prompt = `Eres un asistente virtual de atención al cliente para una empresa de logística y envíos desde China a Venezuela. Tu nombre es "Asistente TLEC".

PERSONALIDAD Y TONO:
- Sé muy humano, cálido y empático
- Entiende las emociones del cliente (frustración, preocupación, ansiedad por sus envíos)
- Usa un lenguaje natural, cercano y amigable
- Puedes usar emojis ocasionalmente para ser más expresivo
- Valida los sentimientos del cliente ("Entiendo tu preocupación...", "Es completamente normal sentirse así...")
- Evita respuestas mecánicas o robotizadas

REGLAS IMPORTANTES:
1. SOLO responde sobre:
   - Información de la cuenta del usuario (sus paquetes, consolidaciones, shipping mark)
   - Preguntas frecuentes disponibles
   - Procesos generales de la empresa
2. Si NO conoces la respuesta o el tema está fuera de tu alcance, di amablemente:
   "Me encantaría ayudarte con eso, pero creo que el equipo de soporte podrá darte una respuesta más precisa. Te recomiendo crear un ticket de soporte o contactarnos por WhatsApp para que te ayuden directamente 🙏"
3. Mantén las respuestas concisas pero completas
4. Si el cliente está frustrado, primero reconoce su emoción antes de dar la respuesta

CONTEXTO DEL CLIENTE:
${context}

PREGUNTA DEL CLIENTE:
${userMessage}

Responde de manera natural, empática y útil:`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: prompt
      });

      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Disculpa, tuve un problema al procesar tu mensaje. ¿Podrías intentarlo de nuevo? Si el problema persiste, por favor contacta a soporte 🙏' 
      }]);
    }

    setLoading(false);
  };

  if (!isOpen) {
    return (
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all"
      >
        <MessageCircle className="h-6 w-6" />
      </motion.button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)]"
      >
        <Card className="shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-full">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">Asistente Virtual</h3>
                <p className="text-xs text-blue-100">Siempre aquí para ayudarte</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="text-white hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Messages */}
          <div className="h-[400px] overflow-y-auto p-4 space-y-4 bg-slate-50">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div className={`flex-shrink-0 ${msg.role === 'user' ? 'bg-blue-600' : 'bg-slate-300'} rounded-full p-2`}>
                  {msg.role === 'user' ? (
                    <User className="h-4 w-4 text-white" />
                  ) : (
                    <Bot className="h-4 w-4 text-slate-700" />
                  )}
                </div>
                <div
                  className={`max-w-[75%] rounded-2xl p-3 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-800 shadow-sm'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <div className="flex-shrink-0 bg-slate-300 rounded-full p-2">
                  <Bot className="h-4 w-4 text-slate-700" />
                </div>
                <div className="bg-white rounded-2xl p-3 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-white border-t">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe tu mensaje..."
                disabled={loading}
                className="flex-1"
              />
              <Button
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <p className="text-xs text-slate-400 mt-2 text-center">
              Presiona Enter para enviar
            </p>
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}