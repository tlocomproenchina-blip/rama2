import { useState, useCallback } from 'react';
import { base44 } from '@/components/api/ApiQueueManager';
import { toast } from 'sonner';

const INITIAL_PACKAGE = {
  tracking_number: '',
  description: '',
  shipping_type: 'aereo',
  has_insurance: false,
  fob_value: '',
  package_image_url: '',
};

/**
 * Hook que encapsula el flujo de agregar un paquete a un cliente desde AdminClients:
 * estado del modal, upload de imagen, validación de tracking duplicado, creación,
 * notificación al cliente y actualización optimista del contador local.
 */
export default function useAddClientPackage({ user, onPackageAdded }) {
  const [addingPackage, setAddingPackage] = useState(false);
  const [packageClient, setPackageClient] = useState(null);
  const [newPackage, setNewPackage] = useState(INITIAL_PACKAGE);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);

  const openAddPackage = useCallback((client) => {
    setPackageClient(client);
    setNewPackage(INITIAL_PACKAGE);
    setAddingPackage(true);
  }, []);

  // Wrapper que limpia el estado cuando el dialog se cierra (X, overlay click, Cancel)
  const setAddingPackageSafe = useCallback((open) => {
    setAddingPackage(open);
    if (!open) {
      setPackageClient(null);
      setNewPackage(INITIAL_PACKAGE);
    }
  }, []);

  const handleImageUpload = useCallback(async (file) => {
    if (!file) return;
    setUploadingImage(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setNewPackage((prev) => ({ ...prev, package_image_url: file_url }));
      toast.success('Imagen subida');
    } catch (error) {
      toast.error('Error al subir imagen');
    }
    setUploadingImage(false);
  }, []);

  const handleAddPackage = useCallback(async () => {
    if (!newPackage.tracking_number || !newPackage.description) {
      toast.error('Completa tracking y descripción');
      return;
    }
    setSaving(true);
    try {
      const existingPackages = await base44.entities.Package.filter({ tracking_number: newPackage.tracking_number });
      if (existingPackages.length > 0) {
        toast.error('Este número de tracking ya está registrado en el sistema');
        setSaving(false);
        return;
      }

      await base44.entities.Package.create({
        tracking_number: newPackage.tracking_number,
        client_email: packageClient.email,
        shipping_mark: packageClient.shipping_mark || '',
        shipping_type: newPackage.shipping_type,
        description: newPackage.description,
        status: 'recibido',
        has_insurance: newPackage.has_insurance,
        fob_value: newPackage.has_insurance ? parseFloat(newPackage.fob_value) || 0 : 0,
        package_image_url: newPackage.package_image_url || '',
        received_date: new Date().toISOString(),
        received_by: user?.email,
      });

      const { sendNotification } = await import('@/components/NotificationUtils');
      sendNotification({
        to: packageClient.email,
        subject: '📦 Paquete recibido en warehouse',
        body: `Tu paquete ${newPackage.tracking_number} ha sido recibido en nuestro warehouse.\n\nDescripción: ${newPackage.description}\nTipo: ${newPackage.shipping_type === 'aereo' ? 'Aéreo' : 'Marítimo'}\n\nIngresa al sistema para más detalles.`,
        type: 'package',
        icon: 'package',
        referenceId: newPackage.tracking_number,
      });

      toast.success('Paquete agregado exitosamente');
      onPackageAdded?.(packageClient.email);
      setAddingPackage(false);
      setPackageClient(null);
      setNewPackage(INITIAL_PACKAGE);
    } catch (error) {
      toast.error('Error al agregar paquete');
    }
    setSaving(false);
  }, [newPackage, packageClient, user?.email, onPackageAdded]);

  return {
    addingPackage,
    setAddingPackage: setAddingPackageSafe,
    packageClient, setPackageClient,
    newPackage, setNewPackage,
    uploadingImage,
    saving, setSaving,
    openAddPackage,
    handleImageUpload,
    handleAddPackage,
  };
}