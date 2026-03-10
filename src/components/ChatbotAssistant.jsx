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
  const [failCount, setFailCount] = useState(0);
  const [appConfig, setAppConfig] = useState(null);
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
    if (!isOpen) return;
    (async () => {
      try {
        const cfgs = await base44.entities.AppConfig.filter({ config_key: 'main' });
        if (cfgs.length > 0) setAppConfig(cfgs[0]);
      } catch (_) {}
    })();
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const isUnhelpful = (text) => {
    const t = String(text || '').toLowerCase();
    return /no puedo|no (tengo|sé)|no dispongo|no encuentro|no tengo suficiente|no estoy seguro|no entiendo|problema al procesar|contacta a soporte|por favor contacta|inténtalo de nuevo|intentalo de nuevo/.test(t);
  };

  const needsHuman = (text) => {
    const t = String(text || '').toLowerCase();
    return /(whatsapp|whatsap|whatspp|whats|whatasppp|soporte|agente|humano|operador|hablar con alguien|hablar con una persona|quiero hablar|atenderme)/.test(t);
  };

  const addClarify = () => {
    setMessages(prev => [...prev, { role: 'assistant', content: 'No estoy seguro si te entendí bien. ¿Podrías reformular tu pregunta o darme un poco más de detalle? 😊' }]);
  };

  const getWhatsAppLink = () => {
    const num = String(appConfig?.whatsapp_number || '').replace(/[^\d]/g, '');
    if (!num) return null;
    const msg = appConfig?.whatsapp_message || 'Hola, necesito ayuda con mi envío';
    return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    if (needsHuman(userMessage)) {
      const link = getWhatsAppLink();
      const msg = link
        ? 'Te conecto con un agente por WhatsApp. Toca el botón para abrir el chat.'
        : 'Te conecto con un agente por WhatsApp. (Configura el número en Ajustes > General > WhatsApp)';
      setMessages(prev => [...prev, { role: 'assistant', content: msg, waLink: link || undefined }]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Get user data and pricing info
      const [packages, consolidations, faqs, pricingConfigs, stateConfigs, kbEntries] = await Promise.all([
        base44.entities.Package.filter({ client_email: user.email }),
        base44.entities.Consolidation.filter({ client_email: user.email }),
        base44.entities.FAQ.filter({ is_active: true }),
        base44.entities.PricingConfig.filter({ config_key: 'main' }),
        base44.entities.StateConfig.filter({ is_active: true }),
        base44.entities.KnowledgeBase.filter({ status: 'published' }, '-updated_date', 8)
      ]);

      const pricing = pricingConfigs[0] || {};
      const userStateConfig = stateConfigs.find(s => s.state_code === user.state);
      const userStateRate = userStateConfig?.shipping_rate || 20;
      const states = stateConfigs.map(s => `${s.state_name}: $${s.shipping_rate}`).join(', ');
      const kbContext = (kbEntries || []).map(e => `Q: ${e.title}\nA: ${String(e.content || '').slice(0, 400)}`).join('\n\n');

      // Build context
      const context = `
INFORMACIÓN DEL USUARIO:
- Nombre: ${user.first_name} ${user.last_name}
- Email: ${user.email}
- Shipping Mark: ${user.shipping_mark || 'No asignado aún'}
- Ciudad: ${user.city || 'No especificada'}
- Estado: ${user.state || 'No especificado'}
- Tarifa de su estado: $${userStateRate}
- WhatsApp: ${user.whatsapp || 'No especificado'}

PAQUETES DEL USUARIO (${packages.length} en total):
${packages.slice(0, 5).map(p => `- Tracking: ${p.tracking_number}, Estado: ${p.status}, Tipo: ${p.shipping_type}`).join('\n')}
${packages.length > 5 ? `... y ${packages.length - 5} paquetes más` : ''}

CONSOLIDACIONES DEL USUARIO (${consolidations.length} en total):
${consolidations.slice(0, 3).map(c => `- Tracking: ${c.consolidation_tracking}, Estado: ${c.status}, Costo: $${c.total_cost || 'Pendiente'}`).join('\n')}
${consolidations.length > 3 ? `... y ${consolidations.length - 3} consolidaciones más` : ''}

TARIFAS Y PRECIOS:
- Tarifa base marítimo regular: $${pricing.base_rate_regular || 690} por CBM
- Tarifa base marítimo alto riesgo: $${pricing.base_rate_high_risk || 790} por CBM
- Beneficio: ${pricing.profit_percentage || 10}%
- Puerta a puerta: $${pricing.door_to_door_cost || 20}
- Tarifas por estado: ${states}

CÓMO CALCULAR ENVÍOS MARÍTIMOS:
1. Calcular CBM: (Largo × Ancho × Alto en cm) ÷ 1,000,000
2. Calcular peso volumétrico: (Largo × Ancho × Alto en cm) ÷ 6000
3. Costo base: Tarifa por CBM × CBM calculado
4. Aplicar beneficio: Costo base × (1 + ${pricing.profit_percentage || 10}/100)
5. Sumar tarifa del estado del cliente
6. Sumar puerta a puerta
7. TOTAL = paso 4 + paso 5 + paso 6

BASE DE CONOCIMIENTOS (recientes):
${kbContext || '—'}

PREGUNTAS FRECUENTES:
${faqs.map(faq => `P: ${faq.question}\nR: ${faq.answer}`).join('\n\n')}
`;

      const prompt = `Eres un asistente virtual de atención al cliente para una empresa de logística y envíos desde China a Venezuela. Tu nombre es "Asistente TLEC".

PERSONALIDAD:
- Habla como un HUMANO REAL venezolano, no como un robot
- Sé cálido, amigable y conversacional
- Usa lenguaje natural, nada de fórmulas matemáticas complicadas (NUNCA uses LaTeX ni \\[ \\])
- Sé breve y directo, sin enrollarte
- Usa emojis ocasionalmente 😊📦
- Si alguien está frustrado, valídalo primero

CÓMO CALCULAR ENVÍOS MARÍTIMOS (IMPORTANTE):
Fórmula exacta (paso a paso):
1. CBM = (largo × ancho × alto en cm) ÷ 1,000,000
2. Si CBM < 0.130, usa CBM = 0.130 (mínimo de carga)
3. Tarifa ajustada = $${pricing.base_rate_regular} × ${1 + (pricing.profit_percentage || 10) / 100} = $${(pricing.base_rate_regular * (1 + (pricing.profit_percentage || 10) / 100)).toFixed(2)}
4. Tarifa final = Tarifa ajustada + $${userStateRate} + $${pricing.door_to_door_cost} = $${(pricing.base_rate_regular * (1 + (pricing.profit_percentage || 10) / 100) + userStateRate + pricing.door_to_door_cost).toFixed(2)}
5. TOTAL = Tarifa final × CBM

CRÍTICO: 
- Usa $${userStateRate} como tarifa del estado del usuario (${userStateConfig?.state_name || 'no especificado'})
- Si el CBM real es menor a 0.130, DEBES mencionar que se cobra el mínimo de 0.130 CBM
- La tarifa de estado y puerta a puerta se multiplican por el CBM, NO se suman después
- SI el cliente pregunta por precio en OTRO estado que NO sea ${userStateConfig?.state_name || 'su estado registrado'}, RECHAZA amablemente diciendo algo como: "Según mis registros, tu estado es ${userStateConfig?.state_name}. Solo puedo darte precios para envíos a tu estado. Para consultas de otros estados, por favor contacta a soporte 😊"
- NUNCA des precios de otros estados aunque el cliente insista

AL RESPONDER:
- Solo menciona el CBM y el precio final
- NO muestres cálculos intermedios ni detalles internos
- Sé breve y directo

EJEMPLO:
"Tu caja de 53×53×58 cm ocupa 0.16 CBM. El envío te sale en $125 📦"

EJEMPLOS BUENOS:
"¡Perfecto! Tu caja de 53×53×58 cm ocupa 0.16 CBM. El envío te sale en $122 📦"

"Tu caja de 59×40×15 cm ocupa 0.035 CBM, pero se cobra el mínimo de 0.130 CBM. El envío te sale en $99.58 📦"

"Con esas dimensiones son 0.2 CBM, el envío marítimo te costaría $153 😊"

EJEMPLOS MALOS (NO HACER):
❌ Usar fórmulas matemáticas con símbolos raros
❌ Explicaciones largas y académicas
❌ Decir "por favor usa la calculadora"

CONTEXTO DEL CLIENTE:
${context}

PREGUNTA DEL CLIENTE:
${userMessage}

Responde natural y directo:`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: prompt
      });

      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
      // Aprendizaje global: guardar Q/A en base de conocimientos (no bloquea la UI)
      base44.functions.invoke('learnFromChat', { question: userMessage, answer: response }).catch(() => {});
      const unhelpful = isUnhelpful(response);
      if (!unhelpful) { setFailCount(0); }
      else {
        setFailCount((c) => {
          const next = c + 1;
          if (next === 1) { addClarify(); }
          if (next >= 2) {
            const link = getWhatsAppLink();
            const msg = link
              ? '¿Necesitas más ayuda? Te asignaré un agente humano por WhatsApp.\nToca el botón para abrir el chat.'
              : '¿Necesitas más ayuda? Te asignaré un agente humano por WhatsApp. (Configura el número en Ajustes > General > WhatsApp)';
            setMessages(prev => [...prev, { role: 'assistant', content: msg, waLink: link || undefined }]);
            return 0;
          }
          return next;
        });
      }
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Disculpa, tuve un problema al procesar tu mensaje. ¿Podrías intentarlo de nuevo? Si el problema persiste, por favor contacta a soporte 🙏' 
      }]);
      setFailCount((c) => {
        const next = c + 1;
        if (next === 1) { addClarify(); }
        if (next >= 2) {
          const link = getWhatsAppLink();
          const msg = link
            ? '¿Necesitas más ayuda? Te asignaré un agente humano por WhatsApp.\nToca el botón para abrir el chat.'
            : '¿Necesitas más ayuda? Te asignaré un agente humano por WhatsApp. (Configura el número en Ajustes > General > WhatsApp)';
          setMessages(prev => [...prev, { role: 'assistant', content: msg, waLink: link || undefined }]);
          return 0;
        }
        return next;
      });
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
                  {msg.waLink ? (
                    <div className="space-y-2">
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <a
                        href={msg.waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-md"
                      >
                        Abrir WhatsApp
                      </a>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
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