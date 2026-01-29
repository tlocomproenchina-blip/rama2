import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { HelpCircle, Search, ChevronDown, MessageCircle, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

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

  const filteredFAQs = faqs.filter(faq => {
    const matchesSearch = faq.question.toLowerCase().includes(search.toLowerCase()) ||
                         faq.answer.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', ...new Set(faqs.map(f => f.category))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50">
          <HelpCircle className="h-8 w-8 text-blue-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Preguntas Frecuentes</h1>
          <p className="text-slate-500 mt-2">Encuentra respuestas a las preguntas más comunes</p>
        </div>
      </div>

      {/* Search */}
      <Card className="border-0 shadow-lg">
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
        <Card className="border-0 shadow-lg">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <HelpCircle className="h-16 w-16 text-slate-300 mb-4" />
            <p className="text-slate-500 text-center">
              {search ? 'No se encontraron resultados' : 'No hay preguntas frecuentes disponibles'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredFAQs.map((faq) => (
            <Collapsible
              key={faq.id}
              open={openItems[faq.id]}
              onOpenChange={(open) => setOpenItems({ ...openItems, [faq.id]: open })}
            >
              <Card className="border-0 shadow-lg overflow-hidden">
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
      )}

      {/* Support CTA */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
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