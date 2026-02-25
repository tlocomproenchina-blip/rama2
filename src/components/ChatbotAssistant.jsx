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
      // Get user data and pricing info
      const [packages, consolidations, faqs, pricingConfigs, stateConfigs] = await Promise.all([
        base44.entities.Package.filter({ client_email: user.email }),
        base44.entities.Consolidation.filter({ client_email: user.email }),
        base44.entities.FAQ.filter({ is_active: true }),
        base44.entities.PricingConfig.filter({ config_key: 'main' }),
        base44.entities.StateConfig.filter({ is_active: true })
      ]);

      const pricing = pricingConfigs[0] || {};
      const states = stateConfigs.map(s => `${s.state_name}: $${s.shipping_rate}`).join(', ');

      // Build context
      const context = `
INFORMACIÓN DEL USUARIO:
- Nombre: ${user.first_name} ${user.last_name}
- Email: ${user.email}
- Shipping Mark: ${user.shipping_mark || 'No asignado aún'}
- Ciudad: ${user.city || 'No especificada'}
- Estado: ${user.state || 'No especificado'}
- WhatsApp: ${user.whatsapp || 'No especificado'}

PAQUETES DEL USUARIO (${packages.length} en total):
${packages.slice(0, 5).map(p => `- Tracking: ${p.tracking_number}, Estado: ${p.status}, Tipo: ${p.shipping_type}`).join('\n')}
${packages.length > 5 ? `... y ${packages.length - 5} paquetes más` : ''}

CONSOLIDACIONES DEL USUARIO (${consolidations.length} en total):
${consolidations.slice(0, 3).map(c => `- Tracking: ${c.consolidation_tracking}, Estado: ${c.status}, Costo: $${c.total_cost || 'Pendiente'}`).join('\n')}
${consolidations.length > 3 ? `... y ${consolidations.length - 3} consolidaciones más` : ''}

TARIFAS Y PRECIOS:
- Tarifa base regular: $${pricing.base_rate_regular || 690}
- Tarifa base alto riesgo: $${pricing.base_rate_high_risk || 790}
- Beneficio: ${pricing.profit_percentage || 10}%
- Puerta a puerta: $${pricing.door_to_door_cost || 20}
- Tarifas por estado: ${states}

FÓRMULA DE CÁLCULO:
Para envíos marítimos: Precio = (Tarifa Base × (1 + %Beneficio/100)) + Tarifa Estado + Puerta a Puerta
El peso volumétrico se calcula: (Largo × Ancho × Alto en cm) / 6000

PREGUNTAS FRECUENTES:
${faqs.map(faq => `P: ${faq.question}\nR: ${faq.answer}`).join('\n\n')}
`;

      const prompt = `Eres un asistente virtual de atención al cliente para una empresa de logística y envíos desde China a Venezuela. Tu nombre es "Asistente TLEC".

PERSONALIDAD Y COMPORTAMIENTO:
- Actúa como un HUMANO REAL, no como un bot
- Sé proactivo: si el cliente pide un cálculo, HAZLO tú mismo, no lo envíes a otra herramienta
- Sé muy cálido, empático y conversacional
- Usa un lenguaje natural y cercano
- Puedes usar emojis con moderación para ser expresivo
- Entiende y valida las emociones del cliente
- Si alguien está frustrado, reconócelo primero antes de ayudar

CAPACIDADES - LO QUE PUEDES HACER:
✅ Calcular precios de envío cuando te den dimensiones y peso
✅ Explicar el estado de sus paquetes y consolidaciones
✅ Responder preguntas sobre procesos y tiempos
✅ Dar información de su cuenta (shipping mark, ciudad, etc.)
✅ Responder todas las preguntas frecuentes
✅ Hacer cálculos matemáticos necesarios

EJEMPLOS DE CÓMO RESPONDER:
❌ MAL: "Por favor usa la calculadora de envíos para obtener el precio"
✅ BIEN: "¡Claro! Déjame calcular eso para ti. Con una caja de 50x50x50 cm y 10kg, el costo sería aproximadamente $X. Esto incluye el envío marítimo más el servicio puerta a puerta 📦"

❌ MAL: "Tu pregunta está fuera de mi alcance"
✅ BIEN: "Hmm, esa es una excelente pregunta pero no tengo la información exacta en este momento. ¿Te parece si contactamos al equipo de soporte que puede ayudarte mejor con eso? 😊"

IMPORTANTE:
- Cuando te pidan cálculos de envío, HAZLO TÚ usando las tarifas que tienes
- Muestra tu trabajo: explica brevemente cómo llegaste al resultado
- Si falta información (como el peso o dimensiones), pregunta amablemente
- Sé útil y resuelve problemas, no solo respondas con "no puedo"

CONTEXTO DEL CLIENTE:
${context}

PREGUNTA DEL CLIENTE:
${userMessage}

Responde de manera natural, útil y humana. Si puedes calcular algo, HAZLO:`;

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