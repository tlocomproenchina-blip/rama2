import React, { useState, useEffect } from 'react';
import { Mail, MessageCircle, Phone, MapPin, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import PublicPageShell from '@/components/public/PublicPageShell';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sending, setSending] = useState(false);
  const [waNumber, setWaNumber] = useState('');

  useEffect(() => {
    base44.entities.AppConfig.filter({ config_key: 'main' }, '-updated_date', 1)
      .then((rows) => setWaNumber(String(rows?.[0]?.whatsapp_number || '').replace(/\D/g, '')));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      toast.error('Por favor completa todos los campos');
      return;
    }
    setSending(true);
    try {
      await base44.integrations.Core.SendEmail({
        to: 'soporte@tleccargo.com',
        subject: `Nuevo mensaje de contacto: ${form.name}`,
        body: `Nombre: ${form.name}\nEmail: ${form.email}\n\nMensaje:\n${form.message}`,
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
    <PublicPageShell
      eyebrow="Contacto"
      title="Contáctanos"
      description="Estamos aquí para ayudarte. Escríbenos por el medio que prefieras."
    >

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Contact methods */}
          <div className="space-y-4">
            <Card className="border-0 shadow-card">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="p-3 rounded-xl bg-accent text-accent-foreground">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Email</h3>
                  <a href="mailto:soporte@tleccargo.com" className="text-link hover:underline text-sm">
                    soporte@tleccargo.com
                  </a>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="p-3 rounded-xl bg-accent text-accent-foreground">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">WhatsApp</h3>
                  <p className="text-sm text-slate-500">Atención inmediata en horario laboral</p>
                  {waNumber ? (
                    <a
                      href={`https://wa.me/${waNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-link hover:underline text-sm"
                    >
                      Iniciar chat · +{waNumber}
                    </a>
                  ) : (
                    <p className="text-sm text-slate-500">Próximamente</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="p-3 rounded-xl bg-accent text-accent-foreground">
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
                <div className="p-3 rounded-xl bg-accent text-accent-foreground">
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
                <Button type="submit" disabled={sending} className="w-full">
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
    </PublicPageShell>
  );
}