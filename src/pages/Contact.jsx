import React, { useState } from 'react';
import { Mail, MessageCircle, Phone, MapPin, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import HomeHeader from '@/components/home/HomeHeader';
import HomeFooter from '@/components/home/HomeFooter';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      toast.error('Por favor completa todos los campos');
      return;
    }
    setSending(true);
    try {
      await base44.functions.invoke('submitContactForm', {
        name: form.name,
        email: form.email,
        message: form.message,
      });
      toast.success('¡Mensaje enviado! Te responderemos pronto.');
      setForm({ name: '', email: '', message: '' });
    } catch (error) {
      console.error('Contact form error:', error);
      toast.error('No se pudo enviar el mensaje. Intenta de nuevo.');
    }
    setSending(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <HomeHeader />
      <main className="flex-1 max-w-5xl mx-auto px-6 py-12 md:py-16 w-full">
        <header className="mb-10">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-slate-800">
            Contáctanos
          </h1>
          <p className="mt-3 text-lg text-slate-500">
            Estamos aquí para ayudarte. Escríbenos por el medio que prefieras.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Contact methods */}
          <div className="space-y-4">
            <Card className="border-0 shadow-card">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Email</h3>
                  <a href="mailto:soporte@tleccargo.com" className="text-blue-600 hover:underline text-sm">
                    soporte@tleccargo.com
                  </a>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="p-3 rounded-xl bg-emerald-100 text-emerald-600">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">WhatsApp</h3>
                  <p className="text-sm text-slate-500">Atención inmediata en horario laboral</p>
                  <a
                    href="https://wa.me/584121234567"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 hover:underline text-sm"
                  >
                    Iniciar chat
                  </a>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="p-3 rounded-xl bg-amber-100 text-amber-600">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Teléfono</h3>
                  <p className="text-sm text-slate-500">Lun – Vie · 9:00 a 18:00 (Caracas)</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="p-3 rounded-xl bg-purple-100 text-purple-600">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Oficinas</h3>
                  <p className="text-sm text-slate-500">Almacenes en Guangzhou (China) y Caracas (Venezuela).</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contact form */}
          <Card className="border-0 shadow-card">
            <CardContent className="p-6">
              <h2 className="font-display text-2xl font-bold text-slate-800 mb-1">Envíanos un mensaje</h2>
              <p className="text-sm text-slate-500 mb-5">Te responderemos en menos de 24 horas hábiles.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Tu nombre"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="tu@email.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Mensaje</Label>
                  <Textarea
                    id="message"
                    rows={5}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="¿En qué podemos ayudarte?"
                    required
                  />
                </div>
                <Button type="submit" disabled={sending} className="w-full bg-blue-600 hover:bg-blue-700">
                  {sending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
                  ) : (
                    <><Send className="h-4 w-4 mr-2" /> Enviar mensaje</>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
      <HomeFooter />
    </div>
  );
}