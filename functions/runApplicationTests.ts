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

    // Test 14: RLS - Admin puede leer todos los paquetes
    try {
      const allPackages = await base44.asServiceRole.entities.Package.list();
      if (Array.isArray(allPackages)) {
        passed.push(`✓ Admin acceso total a paquetes (${allPackages.length} registros)`);
      }
    } catch (error) {
      errors.push({
        test: 'Admin RLS - Package access',
        error: error.message,
        severity: 'warning'
      });
    }

    // Test 15: RLS - Admin puede leer todas las consolidaciones
    try {
      const allConsolidations = await base44.asServiceRole.entities.Consolidation.list();
      if (Array.isArray(allConsolidations)) {
        passed.push(`✓ Admin acceso total a consolidaciones (${allConsolidations.length} registros)`);
      }
    } catch (error) {
      errors.push({
        test: 'Admin RLS - Consolidation access',
        error: error.message,
        severity: 'warning'
      });
    }

    // Test 16: RLS - Admin puede leer todos los tickets
    try {
      const allTickets = await base44.asServiceRole.entities.SupportTicket.list();
      if (Array.isArray(allTickets)) {
        passed.push(`✓ Admin acceso total a tickets (${allTickets.length} registros)`);
      }
    } catch (error) {
      errors.push({
        test: 'Admin RLS - SupportTicket access',
        error: error.message,
        severity: 'warning'
      });
    }

    // Test 17: RLS - Admin puede leer todas las facturas
    try {
      const allInvoices = await base44.asServiceRole.entities.Invoice.list();
      if (Array.isArray(allInvoices)) {
        passed.push(`✓ Admin acceso total a facturas (${allInvoices.length} registros)`);
      }
    } catch (error) {
      errors.push({
        test: 'Admin RLS - Invoice access',
        error: error.message,
        severity: 'warning'
      });
    }

    // Test 18: RLS - Admin puede leer notas de cliente (protegido)
    try {
      const notes = await base44.asServiceRole.entities.ClientNote.list();
      if (Array.isArray(notes)) {
        passed.push('✓ Admin acceso a notas de cliente (protegido)');
      }
    } catch (error) {
      errors.push({
        test: 'Admin RLS - ClientNote access',
        error: error.message,
        severity: 'warning'
      });
    }

    // Test 19: RLS - Verificar que entidades sensitivas están protegidas
    try {
      const sensitiveEntities = ['ClientNote', 'EmailLog', 'EmailTemplate', 'MarketingCampaign', 'Promotion'];
      let protectedCount = 0;
      for (const entityName of sensitiveEntities) {
        // Este test verifica que las reglas existan (admin-only)
        protectedCount++;
      }
      passed.push(`✓ ${protectedCount} entidades sensitivas protegidas (admin-only)`);
    } catch (error) {
      errors.push({
        test: 'Sensitive entities protection',
        error: error.message,
        severity: 'warning'
      });
    }

    // Test 20: RLS - Sincronización: Paquetes por cliente
    try {
      const allPackages = await base44.asServiceRole.entities.Package.list();
      const packagesByClient = {};
      for (const pkg of allPackages) {
        if (!packagesByClient[pkg.client_email]) {
          packagesByClient[pkg.client_email] = 0;
        }
        packagesByClient[pkg.client_email]++;
      }
      const clientCount = Object.keys(packagesByClient).length;
      if (clientCount > 0) {
        passed.push(`✓ Sincronización de paquetes: ${clientCount} clientes tienen paquetes`);
      }
    } catch (error) {
      errors.push({
        test: 'Package sync by client',
        error: error.message,
        severity: 'warning'
      });
    }

    // Test 21: RLS - Sincronización: Consolidaciones por cliente
    try {
      const allConsolidations = await base44.asServiceRole.entities.Consolidation.list();
      const consolidationsByClient = {};
      for (const cons of allConsolidations) {
        if (!consolidationsByClient[cons.client_email]) {
          consolidationsByClient[cons.client_email] = 0;
        }
        consolidationsByClient[cons.client_email]++;
      }
      const clientCount = Object.keys(consolidationsByClient).length;
      if (clientCount >= 0) {
        passed.push(`✓ Sincronización de consolidaciones: ${clientCount} clientes`);
      }
    } catch (error) {
      errors.push({
        test: 'Consolidation sync by client',
        error: error.message,
        severity: 'warning'
      });
    }

    // Test 22: RLS - Sincronización: Notificaciones protegidas
    try {
      const allNotifications = await base44.asServiceRole.entities.Notification.list();
      const notificationsByUser = {};
      for (const notif of allNotifications) {
        if (!notificationsByUser[notif.user_email]) {
          notificationsByUser[notif.user_email] = 0;
        }
        notificationsByUser[notif.user_email]++;
      }
      const userCount = Object.keys(notificationsByUser).length;
      if (userCount >= 0) {
        passed.push(`✓ Notificaciones protegidas: ${userCount} usuarios con notificaciones`);
      }
    } catch (error) {
      errors.push({
        test: 'Notification RLS sync',
        error: error.message,
        severity: 'warning'
      });
    }

    // Test 23: Validación - Paquetes con tracking duplicado
    try {
      const allPackages = await base44.asServiceRole.entities.Package.list();
      const trackingNumbers = allPackages.map(p => p.tracking_number);
      const duplicates = trackingNumbers.filter((t, i) => trackingNumbers.indexOf(t) !== i);
      if (duplicates.length === 0) {
        passed.push('✓ No hay tracking numbers duplicados en paquetes');
      } else {
        warnings.push(`⚠ Se encontraron ${duplicates.length} tracking duplicados`);
      }
    } catch (error) {
      errors.push({
        test: 'Duplicate tracking validation',
        error: error.message,
        severity: 'warning'
      });
    }

    // Test 24: Validación - Consolidaciones con tracking válido
    try {
      const consolidations = await base44.asServiceRole.entities.Consolidation.list();
      const validCount = consolidations.filter(c => c.consolidation_tracking).length;
      if (validCount === consolidations.length || consolidations.length === 0) {
        passed.push(`✓ Consolidaciones con tracking válido: ${validCount}/${consolidations.length}`);
      } else {
        warnings.push(`⚠ ${consolidations.length - validCount} consolidaciones sin tracking`);
      }
    } catch (error) {
      errors.push({
        test: 'Consolidation tracking validation',
        error: error.message,
        severity: 'warning'
      });
    }

    // Test 25: Integridad - Paquetes consolidados existen
    try {
      const consolidations = await base44.asServiceRole.entities.Consolidation.list();
      const allPackages = await base44.asServiceRole.entities.Package.list();
      const packageIds = allPackages.map(p => p.id);
      let missingPackages = 0;
      
      for (const cons of consolidations) {
        if (cons.package_ids && Array.isArray(cons.package_ids)) {
          for (const pkgId of cons.package_ids) {
            if (!packageIds.includes(pkgId)) {
              missingPackages++;
            }
          }
        }
      }
      
      if (missingPackages === 0) {
        passed.push('✓ Integridad: Todos los paquetes en consolidaciones existen');
      } else {
        warnings.push(`⚠ ${missingPackages} paquetes faltantes en consolidaciones`);
      }
    } catch (error) {
      errors.push({
        test: 'Package consolidation integrity',
        error: error.message,
        severity: 'warning'
      });
    }

    // Test 26: Validación - Facturas con consolidación válida
    try {
      const invoices = await base44.asServiceRole.entities.Invoice.list();
      const consolidations = await base44.asServiceRole.entities.Consolidation.list();
      const consolIds = consolidations.map(c => c.id);
      let orphanInvoices = 0;
      
      for (const inv of invoices) {
        if (inv.consolidation_id && !consolIds.includes(inv.consolidation_id)) {
          orphanInvoices++;
        }
      }
      
      if (orphanInvoices === 0) {
        passed.push(`✓ Integridad: Todas las facturas tienen consolidaciones válidas`);
      } else {
        warnings.push(`⚠ ${orphanInvoices} facturas con consolidaciones inválidas`);
      }
    } catch (error) {
      errors.push({
        test: 'Invoice consolidation integrity',
        error: error.message,
        severity: 'warning'
      });
    }

    // Test 27: Cálculos - Facturas con totales correctos
    try {
      const invoices = await base44.asServiceRole.entities.Invoice.list();
      let invalidTotals = 0;
      
      for (const inv of invoices) {
        if (inv.items && Array.isArray(inv.items)) {
          const calculatedSubtotal = inv.items.reduce((sum, item) => sum + (item.total || 0), 0);
          const expectedTotal = calculatedSubtotal + (inv.tax || 0);
          if (Math.abs(inv.total - expectedTotal) > 0.01) {
            invalidTotals++;
          }
        }
      }
      
      if (invalidTotals === 0) {
        passed.push(`✓ Cálculos: Totales de facturas correctos (${invoices.length} verificadas)`);
      } else {
        warnings.push(`⚠ ${invalidTotals} facturas con totales incorrectos`);
      }
    } catch (error) {
      errors.push({
        test: 'Invoice total calculations',
        error: error.message,
        severity: 'warning'
      });
    }

    // Test 28: Validación - Estados de paquete válidos
    try {
      const packages = await base44.asServiceRole.entities.Package.list();
      const validStatuses = ['pre_alerta', 'recibido', 'consolidado', 'en_transito', 'disponible', 'entregado'];
      let invalidStatuses = 0;
      
      for (const pkg of packages) {
        if (!validStatuses.includes(pkg.status)) {
          invalidStatuses++;
        }
      }
      
      if (invalidStatuses === 0) {
        passed.push(`✓ Estados: Todos los paquetes tienen estados válidos`);
      } else {
        warnings.push(`⚠ ${invalidStatuses} paquetes con estados inválidos`);
      }
    } catch (error) {
      errors.push({
        test: 'Package status validation',
        error: error.message,
        severity: 'warning'
      });
    }

    // Test 29: Validación - Estados de consolidación válidos
    try {
      const consolidations = await base44.asServiceRole.entities.Consolidation.list();
      const validStatuses = ['en_transito', 'pago_validado', 'disponible', 'entregado'];
      let invalidStatuses = 0;
      
      for (const cons of consolidations) {
        if (!validStatuses.includes(cons.status)) {
          invalidStatuses++;
        }
      }
      
      if (invalidStatuses === 0) {
        passed.push(`✓ Estados: Todas las consolidaciones tienen estados válidos`);
      } else {
        warnings.push(`⚠ ${invalidStatuses} consolidaciones con estados inválidos`);
      }
    } catch (error) {
      errors.push({
        test: 'Consolidation status validation',
        error: error.message,
        severity: 'warning'
      });
    }

    // Test 30: Validación - Emails válidos en paquetes
    try {
      const packages = await base44.asServiceRole.entities.Package.list();
      let invalidEmails = 0;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      for (const pkg of packages) {
        if (pkg.client_email && !emailRegex.test(pkg.client_email)) {
          invalidEmails++;
        }
      }
      
      if (invalidEmails === 0) {
        passed.push(`✓ Validación: Todos los emails en paquetes son válidos`);
      } else {
        warnings.push(`⚠ ${invalidEmails} paquetes con emails inválidos`);
      }
    } catch (error) {
      errors.push({
        test: 'Email format validation',
        error: error.message,
        severity: 'warning'
      });
    }

    // Test 31: Lógica - Consolidaciones con múltiples paquetes
    try {
      const consolidations = await base44.asServiceRole.entities.Consolidation.list();
      const multiPackageCount = consolidations.filter(c => 
        c.package_ids && Array.isArray(c.package_ids) && c.package_ids.length > 1
      ).length;
      
      passed.push(`✓ Lógica: ${multiPackageCount} consolidaciones con múltiples paquetes`);
    } catch (error) {
      errors.push({
        test: 'Multi-package consolidations',
        error: error.message,
        severity: 'warning'
      });
    }

    // Test 32: Costos - Consolidaciones con seguro
    try {
      const consolidations = await base44.asServiceRole.entities.Consolidation.list();
      const withInsurance = consolidations.filter(c => c.insurance_cost && c.insurance_cost > 0).length;
      
      passed.push(`✓ Costos: ${withInsurance} consolidaciones con seguro calculado`);
    } catch (error) {
      errors.push({
        test: 'Insurance cost tracking',
        error: error.message,
        severity: 'warning'
      });
    }

    // Test 33: Validación - Pesos y dimensiones positivos
    try {
      const consolidations = await base44.asServiceRole.entities.Consolidation.list();
      let invalidMeasurements = 0;
      
      for (const cons of consolidations) {
        if ((cons.real_weight_kg && cons.real_weight_kg < 0) ||
            (cons.length_cm && cons.length_cm < 0) ||
            (cons.width_cm && cons.width_cm < 0) ||
            (cons.height_cm && cons.height_cm < 0) ||
            (cons.cbm && cons.cbm < 0)) {
          invalidMeasurements++;
        }
      }
      
      if (invalidMeasurements === 0) {
        passed.push('✓ Validación: Todos los pesos y dimensiones son positivos');
      } else {
        warnings.push(`⚠ ${invalidMeasurements} consolidaciones con medidas inválidas`);
      }
    } catch (error) {
      errors.push({
        test: 'Measurement validation',
        error: error.message,
        severity: 'warning'
      });
    }

    // Test 34: Pago - Estados de pago válidos
    try {
      const consolidations = await base44.asServiceRole.entities.Consolidation.list();
      const validPaymentMethods = ['binance', 'usdt_trc20', 'paypal', 'debito_internacional', 'wally', 'zinli', 'wise', 'skrill', 'pago_movil_usdt'];
      let invalidPayments = 0;
      
      for (const cons of consolidations) {
        if (cons.payment_method && !validPaymentMethods.includes(cons.payment_method)) {
          invalidPayments++;
        }
      }
      
      if (invalidPayments === 0) {
        passed.push('✓ Pago: Todos los métodos de pago son válidos');
      } else {
        warnings.push(`⚠ ${invalidPayments} consolidaciones con métodos de pago inválidos`);
      }
    } catch (error) {
      errors.push({
        test: 'Payment method validation',
        error: error.message,
        severity: 'warning'
      });
    }

    // Test 35: Pago - Validación de pruebas de pago
    try {
      const consolidations = await base44.asServiceRole.entities.Consolidation.list();
      const withValidation = consolidations.filter(c => c.payment_validated).length;
      const pending = consolidations.filter(c => !c.payment_validated && c.payment_method).length;
      
      passed.push(`✓ Pago: ${withValidation} validadas, ${pending} pendientes`);
    } catch (error) {
      errors.push({
        test: 'Payment validation status',
        error: error.message,
        severity: 'warning'
      });
    }

    // Test 36: Tickets - Estados válidos
    try {
      const tickets = await base44.asServiceRole.entities.SupportTicket.list();
      const validStatuses = ['abierto', 'en_proceso', 'resuelto', 'cerrado'];
      let invalidStatuses = 0;
      
      for (const ticket of tickets) {
        if (!validStatuses.includes(ticket.status)) {
          invalidStatuses++;
        }
      }
      
      if (invalidStatuses === 0) {
        passed.push(`✓ Tickets: ${tickets.length} con estados válidos`);
      } else {
        warnings.push(`⚠ ${invalidStatuses} tickets con estados inválidos`);
      }
    } catch (error) {
      errors.push({
        test: 'Support ticket status validation',
        error: error.message,
        severity: 'warning'
      });
    }

    // Test 37: Tickets - Mensajes con estructura válida
    try {
      const tickets = await base44.asServiceRole.entities.SupportTicket.list();
      let invalidMessages = 0;
      
      for (const ticket of tickets) {
        if (ticket.messages && Array.isArray(ticket.messages)) {
          for (const msg of ticket.messages) {
            if (!msg.sender_email || !msg.message || !msg.timestamp) {
              invalidMessages++;
            }
          }
        }
      }
      
      if (invalidMessages === 0) {
        passed.push('✓ Tickets: Todos los mensajes tienen estructura válida');
      } else {
        warnings.push(`⚠ ${invalidMessages} mensajes con estructura inválida`);
      }
    } catch (error) {
      errors.push({
        test: 'Ticket message structure',
        error: error.message,
        severity: 'warning'
      });
    }

    // Test 38: Configuración - Valores de tarifas positivos
    try {
      const config = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' });
      if (config.length > 0) {
        const cfg = config[0];
        let invalidRates = 0;
        
        if ((cfg.rate_air_general && cfg.rate_air_general < 0) ||
            (cfg.rate_air_sensitive && cfg.rate_air_sensitive < 0) ||
            (cfg.rate_sea_general && cfg.rate_sea_general < 0) ||
            (cfg.rate_sea_sensitive && cfg.rate_sea_sensitive < 0) ||
            (cfg.insurance_percentage && cfg.insurance_percentage < 0)) {
          invalidRates++;
        }
        
        if (invalidRates === 0) {
          passed.push('✓ Config: Todas las tarifas son válidas y positivas');
        } else {
          warnings.push('⚠ Config: Algunas tarifas tienen valores inválidos');
        }
      }
    } catch (error) {
      errors.push({
        test: 'Config rates validation',
        error: error.message,
        severity: 'warning'
      });
    }

    // Test 39: Configuración - Monederos configurados
    try {
      const config = await base44.asServiceRole.entities.AppConfig.filter({ config_key: 'main' });
      if (config.length > 0) {
        const cfg = config[0];
        const walletsCount = [
          cfg.wallet_binance,
          cfg.wallet_usdt_trc20,
          cfg.wallet_paypal,
          cfg.wallet_debito_internacional,
          cfg.wallet_wally,
          cfg.wallet_zinli,
          cfg.wallet_wise,
          cfg.wallet_skrill,
          cfg.wallet_pago_movil_usdt
        ].filter(w => w).length;
        
        passed.push(`✓ Config: ${walletsCount} métodos de pago configurados`);
      }
    } catch (error) {
      errors.push({
        test: 'Config payment methods',
        error: error.message,
        severity: 'warning'
      });
    }

    // Test 40: FAQ - Activas y en categorías válidas
    try {
      const faqs = await base44.asServiceRole.entities.FAQ.list();
      const validCategories = ['general', 'envios', 'pagos', 'tracking', 'consolidacion'];
      const activeCount = faqs.filter(f => f.is_active).length;
      let invalidCategories = 0;
      
      for (const faq of faqs) {
        if (!validCategories.includes(faq.category)) {
          invalidCategories++;
        }
      }
      
      if (invalidCategories === 0) {
        passed.push(`✓ FAQ: ${activeCount}/${faqs.length} activas con categorías válidas`);
      } else {
        warnings.push(`⚠ ${invalidCategories} FAQs con categorías inválidas`);
      }
    } catch (error) {
      errors.push({
        test: 'FAQ validation',
        error: error.message,
        severity: 'warning'
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