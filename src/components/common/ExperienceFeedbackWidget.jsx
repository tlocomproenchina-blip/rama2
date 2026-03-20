import React, { useMemo, useState } from 'react';
import { MessageSquareHeart, Sparkles } from 'lucide-react';
import { base44 } from '@/components/api/ApiQueueManager';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const allowedPages = ['Home', 'Dashboard', 'ClientPortal', 'AdminDashboard', 'AccountingDashboard'];
const scores = [1, 2, 3, 4, 5];

const getSentiment = (score) => {
  if (score >= 5) return 'love';
  if (score >= 4) return 'good';
  if (score >= 3) return 'ok';
  return 'poor';
};

export default function ExperienceFeedbackWidget({ user, currentPageName }) {
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isVisible = useMemo(() => allowedPages.includes(currentPageName), [currentPageName]);
  if (!isVisible) return null;

  const handleSubmit = async () => {
    if (!score) {
      toast.error('Selecciona una puntuación');
      return;
    }

    setSubmitting(true);
    await base44.entities.DesignFeedback.create({
      page_name: currentPageName,
      score,
      comment,
      user_email: user?.email || 'guest',
      user_role: user?.role || 'guest',
      sentiment: getSentiment(score),
      status: 'new',
      source: 'manual'
    });

    base44.analytics.track({
      eventName: 'design_feedback_submitted',
      properties: {
        page_name: currentPageName,
        score,
        is_authenticated: !!user
      }
    });

    toast.success('Gracias por tu feedback');
    setSubmitting(false);
    setOpen(false);
    setScore(0);
    setComment('');
  };

  return (
    <>
      <div className="fixed bottom-5 right-5 z-[90]">
        <Button onClick={() => setOpen(true)} className="shadow-premium">
          <MessageSquareHeart className="mr-2 h-4 w-4" /> Feedback
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              ¿Cómo se siente esta pantalla?
            </DialogTitle>
            <DialogDescription>
              Tu opinión nos ayuda a seguir elevando el diseño visual y la experiencia general.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex flex-wrap gap-2">
              {scores.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setScore(item)}
                  className={score === item ? 'rounded-full border border-primary bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground' : 'rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground'}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">1 = se siente básico</Badge>
              <Badge variant="outline">5 = se siente premium</Badge>
            </div>

            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              placeholder="Cuéntanos qué mejorarías visualmente en esta pantalla..."
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cerrar</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Enviando...' : 'Enviar feedback'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}