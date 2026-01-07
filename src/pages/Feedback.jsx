import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Star, Package, Loader2, CheckCircle, ThumbsUp } from 'lucide-react';
import { toast } from 'sonner';

export default function Feedback({ user }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [consolidation, setConsolidation] = useState(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [formData, setFormData] = useState({
    rating: 0,
    service_quality: '',
    delivery_condition: '',
    comments: '',
    would_recommend: null
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const conId = urlParams.get('consolidation_id');

    if (!conId) {
      toast.error('Consolidación no especificada');
      navigate(createPageUrl('Dashboard'));
      return;
    }

    try {
      const cons = await base44.entities.Consolidation.list();
      const targetCon = cons.find(c => c.id === conId);

      if (!targetCon || targetCon.client_email !== user.email) {
        toast.error('Consolidación no encontrada');
        navigate(createPageUrl('Dashboard'));
        return;
      }

      // Check if feedback already exists
      const existingFeedback = await base44.entities.Feedback.filter({ consolidation_id: conId });
      if (existingFeedback.length > 0) {
        setAlreadySubmitted(true);
      }

      setConsolidation(targetCon);
    } catch (error) {
      toast.error('Error al cargar datos');
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.rating === 0) {
      toast.error('Por favor selecciona una calificación');
      return;
    }

    if (!formData.service_quality || !formData.delivery_condition || formData.would_recommend === null) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }

    setSubmitting(true);
    try {
      await base44.entities.Feedback.create({
        consolidation_id: consolidation.id,
        consolidation_tracking: consolidation.consolidation_tracking,
        client_email: user.email,
        rating: formData.rating,
        service_quality: formData.service_quality,
        delivery_condition: formData.delivery_condition,
        comments: formData.comments,
        would_recommend: formData.would_recommend
      });

      // Notify admins
      const admins = await base44.entities.User.filter({ role: 'admin' });
      for (const admin of admins) {
        base44.entities.Notification.create({
          user_email: admin.email,
          title: '⭐ Nueva Retroalimentación',
          message: `${user.email} dejó feedback (${formData.rating}⭐) para ${consolidation.consolidation_tracking}`,
          type: 'general',
          icon: 'check',
          reference_id: consolidation.id
        }).catch(err => console.error('Notification error:', err));
      }

      toast.success('¡Gracias por tu retroalimentación!');
      setTimeout(() => navigate(createPageUrl('Dashboard')), 2000);
    } catch (error) {
      toast.error('Error al enviar retroalimentación');
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (alreadySubmitted) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-12 text-center">
            <CheckCircle className="h-16 w-16 mx-auto mb-4 text-emerald-600" />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">¡Gracias!</h2>
            <p className="text-slate-600 mb-6">Ya has enviado tu retroalimentación para esta consolidación.</p>
            <Button onClick={() => navigate(createPageUrl('Dashboard'))} className="bg-blue-600 hover:bg-blue-700">
              Volver al Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Tu Opinión es Importante</h1>
        <p className="text-slate-600">Ayúdanos a mejorar nuestro servicio</p>
      </div>

      {/* Consolidation Info */}
      <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-white">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Consolidación Entregada</p>
              <p className="font-mono font-bold text-slate-800">{consolidation?.consolidation_tracking}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feedback Form */}
      <form onSubmit={handleSubmit}>
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Cuéntanos tu experiencia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Star Rating */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Calificación General *</Label>
              <div className="flex gap-2 justify-center py-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFormData({ ...formData, rating: star })}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={`h-12 w-12 ${
                        star <= formData.rating
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
              {formData.rating > 0 && (
                <p className="text-center text-slate-600 font-medium">
                  {formData.rating === 5 && '⭐ ¡Excelente!'}
                  {formData.rating === 4 && '👍 Muy bueno'}
                  {formData.rating === 3 && '😊 Bueno'}
                  {formData.rating === 2 && '😐 Regular'}
                  {formData.rating === 1 && '😞 Necesitamos mejorar'}
                </p>
              )}
            </div>

            {/* Service Quality */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Calidad del Servicio *</Label>
              <RadioGroup value={formData.service_quality} onValueChange={(val) => setFormData({ ...formData, service_quality: val })}>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'excelente', label: '⭐ Excelente' },
                    { value: 'bueno', label: '👍 Bueno' },
                    { value: 'regular', label: '😐 Regular' },
                    { value: 'malo', label: '😞 Malo' }
                  ].map((option) => (
                    <div key={option.value} className={`flex items-center space-x-2 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      formData.service_quality === option.value ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'
                    }`}>
                      <RadioGroupItem value={option.value} id={option.value} />
                      <Label htmlFor={option.value} className="cursor-pointer font-medium">{option.label}</Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* Delivery Condition */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Estado de la Entrega *</Label>
              <RadioGroup value={formData.delivery_condition} onValueChange={(val) => setFormData({ ...formData, delivery_condition: val })}>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'perfecto', label: '✨ Perfecto' },
                    { value: 'bueno', label: '✅ Bueno' },
                    { value: 'dañado', label: '⚠️ Dañado' }
                  ].map((option) => (
                    <div key={option.value} className={`flex items-center space-x-2 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      formData.delivery_condition === option.value ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'
                    }`}>
                      <RadioGroupItem value={option.value} id={`delivery_${option.value}`} />
                      <Label htmlFor={`delivery_${option.value}`} className="cursor-pointer font-medium">{option.label}</Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* Would Recommend */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">¿Recomendarías nuestro servicio? *</Label>
              <RadioGroup value={formData.would_recommend === null ? '' : formData.would_recommend.toString()} onValueChange={(val) => setFormData({ ...formData, would_recommend: val === 'true' })}>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'true', label: '👍 Sí, lo recomendaría' },
                    { value: 'false', label: '👎 No lo recomendaría' }
                  ].map((option) => (
                    <div key={option.value} className={`flex items-center space-x-2 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      formData.would_recommend?.toString() === option.value ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'
                    }`}>
                      <RadioGroupItem value={option.value} id={`recommend_${option.value}`} />
                      <Label htmlFor={`recommend_${option.value}`} className="cursor-pointer font-medium">{option.label}</Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* Comments */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Comentarios Adicionales</Label>
              <Textarea
                value={formData.comments}
                onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                placeholder="Cuéntanos más sobre tu experiencia (opcional)..."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(createPageUrl('Dashboard'))}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
            ) : (
              <><ThumbsUp className="h-4 w-4 mr-2" /> Enviar Retroalimentación</>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}