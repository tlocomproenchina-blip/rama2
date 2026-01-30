import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Loader2, Percent, DollarSign, Calendar, Users, Tag, TrendingUp, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminPromotions({ user }) {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPromo, setEditingPromo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    discount_type: 'percentage',
    discount_value: 0,
    applies_to: 'total',
    start_date: '',
    end_date: '',
    is_active: true,
    promo_code: '',
    min_purchase: 0,
    max_uses: null,
    target_segment: 'all'
  });

  useEffect(() => {
    loadPromotions();
  }, []);

  const loadPromotions = async () => {
    const data = await base44.entities.Promotion.list('-created_date');
    setPromotions(data);
    setLoading(false);
  };

  const handleOpenModal = (promo = null) => {
    if (promo) {
      setEditingPromo(promo);
      setFormData(promo);
    } else {
      setEditingPromo(null);
      setFormData({
        name: '',
        description: '',
        discount_type: 'percentage',
        discount_value: 0,
        applies_to: 'total',
        start_date: '',
        end_date: '',
        is_active: true,
        promo_code: '',
        min_purchase: 0,
        max_uses: null,
        target_segment: 'all'
      });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.start_date || !formData.end_date) {
      toast.error('Completa todos los campos requeridos');
      return;
    }

    setSaving(true);
    try {
      if (editingPromo) {
        await base44.entities.Promotion.update(editingPromo.id, formData);
        toast.success('Promoción actualizada');
      } else {
        await base44.entities.Promotion.create(formData);
        toast.success('Promoción creada');
      }
      setShowModal(false);
      loadPromotions();
    } catch (error) {
      toast.error('Error al guardar');
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta promoción?')) return;
    
    try {
      await base44.entities.Promotion.delete(id);
      toast.success('Promoción eliminada');
      loadPromotions();
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  const handleToggleActive = async (promo) => {
    try {
      await base44.entities.Promotion.update(promo.id, { is_active: !promo.is_active });
      loadPromotions();
      toast.success(promo.is_active ? 'Promoción desactivada' : 'Promoción activada');
    } catch (error) {
      toast.error('Error al actualizar');
    }
  };

  const activePromotions = promotions.filter(p => p.is_active && new Date(p.end_date) > new Date());
  const expiredPromotions = promotions.filter(p => new Date(p.end_date) <= new Date());
  const inactivePromotions = promotions.filter(p => !p.is_active);

  const filteredPromotions = filter === 'all' ? promotions :
    filter === 'active' ? activePromotions :
    filter === 'expired' ? expiredPromotions : inactivePromotions;

  const stats = {
    total: promotions.length,
    active: activePromotions.length,
    expired: expiredPromotions.length,
    totalUses: promotions.reduce((sum, p) => sum + (p.current_uses || 0), 0)
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestión de Promociones</h1>
          <p className="text-slate-500">Crea y administra ofertas y descuentos especiales</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Promoción
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Promociones</p>
                <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
              </div>
              <Tag className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Activas</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Expiradas</p>
                <p className="text-2xl font-bold text-slate-600">{stats.expired}</p>
              </div>
              <Calendar className="h-8 w-8 text-slate-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Usos</p>
                <p className="text-2xl font-bold text-purple-600">{stats.totalUses}</p>
              </div>
              <Users className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="active">Activas</TabsTrigger>
          <TabsTrigger value="expired">Expiradas</TabsTrigger>
          <TabsTrigger value="inactive">Inactivas</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Promotions List */}
      <div className="grid gap-4">
        {filteredPromotions.length === 0 ? (
          <Card className="border-0 shadow-lg">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Tag className="h-16 w-16 text-slate-300 mb-4" />
              <p className="text-slate-500">No hay promociones</p>
            </CardContent>
          </Card>
        ) : (
          filteredPromotions.map(promo => (
            <Card key={promo.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-slate-800">{promo.name}</h3>
                      {promo.is_active && new Date(promo.end_date) > new Date() ? (
                        <Badge className="bg-green-100 text-green-800">Activa</Badge>
                      ) : new Date(promo.end_date) <= new Date() ? (
                        <Badge className="bg-slate-100 text-slate-800">Expirada</Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-800">Inactiva</Badge>
                      )}
                      {promo.promo_code && (
                        <Badge variant="outline" className="font-mono">{promo.promo_code}</Badge>
                      )}
                    </div>
                    
                    <p className="text-slate-600 mb-3">{promo.description}</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        {promo.discount_type === 'percentage' ? (
                          <><Percent className="h-4 w-4 text-blue-600" /> {promo.discount_value}% OFF</>
                        ) : (
                          <><DollarSign className="h-4 w-4 text-green-600" /> ${promo.discount_value} OFF</>
                        )}
                      </div>
                      <div className="text-slate-600">
                        Aplica a: {promo.applies_to === 'shipping' ? 'Envío' : promo.applies_to === 'insurance' ? 'Seguro' : 'Total'}
                      </div>
                      <div className="text-slate-600">
                        Segmento: {promo.target_segment}
                      </div>
                      <div className="text-slate-600">
                        Usos: {promo.current_uses || 0}{promo.max_uses ? `/${promo.max_uses}` : ''}
                      </div>
                    </div>
                    
                    <div className="flex gap-4 mt-3 text-sm text-slate-500">
                      <span>Inicio: {new Date(promo.start_date).toLocaleDateString()}</span>
                      <span>Fin: {new Date(promo.end_date).toLocaleDateString()}</span>
                      {promo.min_purchase > 0 && <span>Mín: ${promo.min_purchase}</span>}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={promo.is_active}
                      onCheckedChange={() => handleToggleActive(promo)}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleOpenModal(promo)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleDelete(promo.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPromo ? 'Editar Promoción' : 'Nueva Promoción'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Nombre de la Promoción *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Ej: Descuento Verano 2026"
                />
              </div>
              
              <div className="col-span-2 space-y-2">
                <Label>Descripción</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Describe la promoción..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo de Descuento *</Label>
                <Select value={formData.discount_type} onValueChange={(val) => setFormData({...formData, discount_type: val})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Porcentaje (%)</SelectItem>
                    <SelectItem value="fixed_amount">Monto Fijo ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Valor del Descuento *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.discount_value}
                  onChange={(e) => setFormData({...formData, discount_value: parseFloat(e.target.value) || 0})}
                  placeholder={formData.discount_type === 'percentage' ? '15' : '10.00'}
                />
              </div>

              <div className="space-y-2">
                <Label>Aplica a</Label>
                <Select value={formData.applies_to} onValueChange={(val) => setFormData({...formData, applies_to: val})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total">Total</SelectItem>
                    <SelectItem value="shipping">Solo Envío</SelectItem>
                    <SelectItem value="insurance">Solo Seguro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Segmento Objetivo</Label>
                <Select value={formData.target_segment} onValueChange={(val) => setFormData({...formData, target_segment: val})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los Clientes</SelectItem>
                    <SelectItem value="new_customers">Clientes Nuevos</SelectItem>
                    <SelectItem value="returning_customers">Clientes Recurrentes</SelectItem>
                    <SelectItem value="high_value">Alto Valor</SelectItem>
                    <SelectItem value="inactive">Inactivos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Fecha de Inicio *</Label>
                <Input
                  type="datetime-local"
                  value={formData.start_date}
                  onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label>Fecha de Fin *</Label>
                <Input
                  type="datetime-local"
                  value={formData.end_date}
                  onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label>Código Promocional (opcional)</Label>
                <Input
                  value={formData.promo_code}
                  onChange={(e) => setFormData({...formData, promo_code: e.target.value.toUpperCase()})}
                  placeholder="VERANO2026"
                />
              </div>

              <div className="space-y-2">
                <Label>Compra Mínima ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.min_purchase}
                  onChange={(e) => setFormData({...formData, min_purchase: parseFloat(e.target.value) || 0})}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label>Máximo de Usos (opcional)</Label>
                <Input
                  type="number"
                  value={formData.max_uses || ''}
                  onChange={(e) => setFormData({...formData, max_uses: e.target.value ? parseInt(e.target.value) : null})}
                  placeholder="Ilimitado"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(val) => setFormData({...formData, is_active: val})}
                />
                <Label>Activar inmediatamente</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editingPromo ? 'Actualizar' : 'Crear'} Promoción
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}