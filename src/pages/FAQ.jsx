import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { HelpCircle, Search, ChevronDown, MessageCircle, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import ClientPageHero from '@/components/client-portal/ClientPageHero';
import PortalMetricCard from '@/components/client-portal/PortalMetricCard';
import ClientSectionHeader from '@/components/client-portal/ClientSectionHeader';

export default function FAQ({ user }) {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [openItems, setOpenItems] = useState({});

  useEffect(() => {
    loadFAQs();
  }, []);

  const loadFAQs = async () => {
    const data = await base44.entities.FAQ.filter({ is_active: true }, 'order');
    setFaqs(data);
    setLoading(false);
  };

  const categoryLabels = {
    all: 'Todas',
    general: 'General',
    envios: 'Envíos',
    pagos: 'Pagos',
    tracking: 'Tracking',
    consolidacion: 'Consolidación'
  };

  const categoryColors = {
    general: 'bg-slate-100 text-slate-800',
    envios: 'bg-blue-100 text-blue-800',
    pagos: 'bg-green-100 text-green-800',
    tracking: 'bg-purple-100 text-purple-800',
    consolidacion: 'bg-orange-100 text-orange-800'
  };

  const normalizeText = (text) => {
    return text.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, '');
  };

  const filteredFAQs = faqs.filter(faq => {
    const searchNormalized = normalizeText(search);
    const questionNormalized = normalizeText(faq.question);
    const answerNormalized = normalizeText(faq.answer);
    
    const matchesSearch = questionNormalized.includes(searchNormalized) ||
                         answerNormalized.includes(searchNormalized);
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', ...new Set(faqs.map(f => f.category))];

  const faqStats = useMemo(() => ({
    total: faqs.length,
    visibles: filteredFAQs.length,
    categorias: categories.length - 1,
    pagos: faqs.filter((faq) => faq.category === 'pagos').length,
  }), [faqs, filteredFAQs.length, categories.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <ClientPageHero
        icon={HelpCircle}
        eyebrow="Finanzas y ayuda"
        title="Preguntas Frecuentes"
        description="Encuentra respuestas rápidas en una vista más clara, ordenada y fácil de explorar."
        badges={[`${faqStats.total} respuestas`, `${faqStats.categorias} categorías`]}
        aside={
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Ayuda rápida</p>
            <div className="rounded-2xl bg-slate-100/90 px-3 py-2 text-sm font-semibold text-slate-700">
              {faqStats.visibles} resultado(s) visibles
            </div>
            <p className="text-sm text-muted-foreground">Filtra por categoría o busca palabras clave para encontrar respuestas al instante.</p>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <PortalMetricCard title="Total" value={faqStats.total} subtitle="Preguntas publicadas" icon={HelpCircle} tone="blue" />
        <PortalMetricCard title="Visibles" value={faqStats.visibles} subtitle="Resultados del filtro" icon={Search} tone="amber" />
        <PortalMetricCard title="Categorías" value={faqStats.categorias} subtitle="Temas disponibles" icon={ChevronDown} tone="violet" />
        <PortalMetricCard title="Pagos" value={faqStats.pagos} subtitle="Ayuda financiera" icon={MessageCircle} tone="blue" />
      </div>

      {/* Search */}
      <Card className="border-border/70 bg-card/95 shadow-card">
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar en preguntas frecuentes..."
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <Button
            key={cat}
            variant={selectedCategory === cat ? 'default' : 'outline'}
            onClick={() => setSelectedCategory(cat)}
            className={selectedCategory === cat ? 'bg-blue-600 hover:bg-blue-700' : ''}
          >
            {categoryLabels[cat]}
          </Button>
        ))}
      </div>

      {/* FAQ List */}
      {filteredFAQs.length === 0 ? (
        <Card className="border-border/70 bg-card/95 shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <HelpCircle className="h-16 w-16 text-slate-300 mb-4" />
            <p className="text-slate-500 text-center">
              {search ? 'No se encontraron resultados' : 'No hay preguntas frecuentes disponibles'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <ClientSectionHeader
            title="Centro de ayuda"
            description="Abre cualquier pregunta para ver la respuesta completa y encontrar orientación más rápido."
          />
          <div className="space-y-3">
          {filteredFAQs.map((faq) => (
            <Collapsible
              key={faq.id}
              open={openItems[faq.id]}
              onOpenChange={(open) => setOpenItems({ ...openItems, [faq.id]: open })}
            >
              <Card className="border border-border/70 bg-card/95 shadow-card overflow-hidden">
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between text-left">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={categoryColors[faq.category]}>
                            {categoryLabels[faq.category]}
                          </Badge>
                        </div>
                        <CardTitle className="text-lg text-slate-800 pr-4">
                          {faq.question}
                        </CardTitle>
                      </div>
                      <ChevronDown 
                        className={`h-5 w-5 text-slate-400 transition-transform flex-shrink-0 ${
                          openItems[faq.id] ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 pb-6">
                    <p className="text-slate-600 whitespace-pre-line">{faq.answer}</p>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
        </>
      )}

      {/* Support CTA */}
      <Card className="border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-card">
        <CardContent className="p-6 text-center">
          <MessageCircle className="h-12 w-12 text-blue-600 mx-auto mb-3" />
          <h3 className="font-semibold text-slate-800 mb-2">¿No encontraste lo que buscabas?</h3>
          <p className="text-slate-600 mb-4">
            Nuestro equipo de soporte está aquí para ayudarte
          </p>
          <Link to={createPageUrl('Support')}>
            <Button className="bg-blue-600 hover:bg-blue-700">
              Contactar Soporte
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}