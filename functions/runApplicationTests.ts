import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const errors = [];
    const warnings = [];
    const passed = [];

    // Test 1: Entidades básicas - Package
    try {
      const packages = await base44.entities.Package.list();
      if (Array.isArray(packages)) {
        passed.push('✓ Lectura de paquetes');
      }
    } catch (error) {
      errors.push({
        test: 'Package.list()',
        error: error.message,
        severity: 'critical'
      });
    }

    // Test 2: Entidades básicas - Consolidation
    try {
      const consolidations = await base44.entities.Consolidation.list();
      if (Array.isArray(consolidations)) {
        passed.push('✓ Lectura de consolidaciones');
      }
    } catch (error) {
      errors.push({
        test: 'Consolidation.list()',
        error: error.message,
        severity: 'critical'
      });
    }

    // Test 3: Entidades - Invoice
    try {
      const invoices = await base44.entities.Invoice.list();
      if (Array.isArray(invoices)) {
        passed.push('✓ Lectura de facturas');
      }
    } catch (error) {
      errors.push({
        test: 'Invoice.list()',
        error: error.message,
        severity: 'critical'
      });
    }

    // Test 4: Entidades - EmailLog
    try {
      const emailLogs = await base44.entities.EmailLog.list();
      if (Array.isArray(emailLogs)) {
        passed.push('✓ Lectura de logs de email');
      }
    } catch (error) {
      errors.push({
        test: 'EmailLog.list()',
        error: error.message,
        severity: 'critical'
      });
    }

    // Test 5: Entidades - Notification
    try {
      const notifications = await base44.entities.Notification.list();
      if (Array.isArray(notifications)) {
        passed.push('✓ Lectura de notificaciones');
      }
    } catch (error) {
      errors.push({
        test: 'Notification.list()',
        error: error.message,
        severity: 'critical'
      });
    }

    // Test 6: Entidades - MarketingCampaign
    try {
      const campaigns = await base44.entities.MarketingCampaign.list();
      if (Array.isArray(campaigns)) {
        passed.push('✓ Lectura de campañas marketing');
      }
    } catch (error) {
      errors.push({
        test: 'MarketingCampaign.list()',
        error: error.message,
        severity: 'critical'
      });
    }

    // Test 7: Entidades - SupportTicket
    try {
      const tickets = await base44.entities.SupportTicket.list();
      if (Array.isArray(tickets)) {
        passed.push('✓ Lectura de tickets de soporte');
      }
    } catch (error) {
      errors.push({
        test: 'SupportTicket.list()',
        error: error.message,
        severity: 'critical'
      });
    }

    // Test 8: AppConfig
    try {
      const config = await base44.entities.AppConfig.filter({ config_key: 'main' });
      if (Array.isArray(config)) {
        passed.push('✓ Lectura de configuración');
      }
    } catch (error) {
      errors.push({
        test: 'AppConfig.filter()',
        error: error.message,
        severity: 'critical'
      });
    }

    // Test 9: Filtros complejos - Package con estado
    try {
      const receivedPackages = await base44.entities.Package.filter({ status: 'recibido' });
      if (Array.isArray(receivedPackages)) {
        passed.push('✓ Filtro de paquetes por estado');
      }
    } catch (error) {
      errors.push({
        test: 'Package.filter({ status })',
        error: error.message,
        severity: 'warning'
      });
    }

    // Test 10: Filtros complejos - Consolidation con status
    try {
      const transitConsolidations = await base44.entities.Consolidation.filter({ status: 'en_transito' });
      if (Array.isArray(transitConsolidations)) {
        passed.push('✓ Filtro de consolidaciones por estado');
      }
    } catch (error) {
      errors.push({
        test: 'Consolidation.filter({ status })',
        error: error.message,
        severity: 'warning'
      });
    }

    // Test 11: Entidades - ConsolidationRequest
    try {
      const requests = await base44.entities.ConsolidationRequest.list();
      if (Array.isArray(requests)) {
        passed.push('✓ Lectura de solicitudes de consolidación');
      }
    } catch (error) {
      errors.push({
        test: 'ConsolidationRequest.list()',
        error: error.message,
        severity: 'warning'
      });
    }

    // Test 12: User auth
    try {
      if (user && user.email) {
        passed.push('✓ Autenticación de usuario funcionando');
      }
    } catch (error) {
      errors.push({
        test: 'User authentication',
        error: error.message,
        severity: 'critical'
      });
    }

    // Test 13: Verificar que user es admin
    try {
      if (user.role === 'admin') {
        passed.push('✓ Rol de administrador verificado');
      } else {
        warnings.push('⚠ Usuario actual no es administrador');
      }
    } catch (error) {
      errors.push({
        test: 'Admin role check',
        error: error.message,
        severity: 'critical'
      });
    }

    const report = {
      timestamp: new Date().toISOString(),
      testDate: new Date().toLocaleDateString('es-ES'),
      totalTests: passed.length + errors.length,
      passed: passed.length,
      failed: errors.length,
      warnings: warnings.length,
      passedTests: passed,
      errors: errors,
      warnings: warnings,
      status: errors.length === 0 ? 'passed' : errors.some(e => e.severity === 'critical') ? 'failed' : 'warning'
    };

    return Response.json(report);
  } catch (error) {
    return Response.json({
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
});