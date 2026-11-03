import React from 'react';
import { Navigate } from 'react-router-dom';

// El Asistente ATC ahora vive dentro del CRM de atención (ficha del caso).
export default function AdminSupportAssistant() {
  const tab = new URLSearchParams(window.location.search).get('tab') === 'huerfanos' ? 'huerfanos' : 'bandeja';
  return <Navigate to={`/AdminSupportCRM?tab=${tab}`} replace />;
}