import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets, waitUntil } from "base44:runtime";
import { uploadToBunny } from "../../shared/bunnyUpload.ts";

// Webhook de recepción cross-empresa.
// La app del cliente (otra cuenta Base44) llama este endpoint cada vez que
// registran un nuevo tracking. Si el tracking coincide con uno nuestro,
// marcamos el paquete como recibido y guardamos la foto.
//
// Headers: x-api-key: <PARTNER_WEBHOOK_API_KEY>
// Body JSON: { tracking_number, photo (base64), partner_name?, notes? }
// Respuesta: { matched: true|false, package_id?, already_received?, photo_url? }

export default async function (req: Request): Promise<Response> {
  try {
    // 1. Validar API key
    const apiKey =
      req.headers.get("x-api-key") || req.headers.get("X-Api-Key");
    const expectedKey = secrets.get("PARTNER_WEBHOOK_API_KEY");
    if (!expectedKey) {
      console.error("[partnerReceptionWebhook] PARTNER_WEBHOOK_API_KEY no configurado");
      return Response.json(
        { error: "Webhook no configurado" },
        { status: 500 }
      );
    }
    if (!apiKey || apiKey !== expectedKey) {
      console.warn("[partnerReceptionWebhook] API key inválida");
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }

    // 2. Parsear body
    const body = await req.json();
    const { tracking_number, photo, partner_name, notes } = body;
    if (!tracking_number || typeof tracking_number !== "string") {
      return Response.json(
        { error: "tracking_number es requerido" },
        { status: 400 }
      );
    }

    const base44 = createClientFromRequest(req);
    const partner = partner_name || "Empresa externa";
    console.log(
      `[partnerReceptionWebhook] Recibido tracking=${tracking_number} partner=${partner}`
    );

    // 3. Buscar paquete por tracking_number (service role, sin usuario autenticado)
    const packages = await base44.asServiceRole.entities.Package.filter({
      tracking_number,
    });
    const pkg = packages?.[0];

    if (!pkg) {
      console.log(
        `[partnerReceptionWebhook] No match para tracking=${tracking_number}`
      );
      return Response.json(
        { matched: false, tracking_number },
        { status: 200 }
      );
    }

    // 4. Idempotencia: si ya está recibido o avanzado, no duplicar
    const alreadyReceived = [
      "recibido",
      "consolidado",
      "en_transito",
      "disponible",
      "despachado",
      "entregado",
    ].includes(pkg.status);

    if (alreadyReceived) {
      console.log(
        `[partnerReceptionWebhook] Tracking ${tracking_number} ya estaba ${pkg.status} (idempotente)`
      );
      return Response.json(
        {
          matched: true,
          already_received: true,
          package_id: pkg.id,
          status: pkg.status,
        },
        { status: 200 }
      );
    }

    // 5. Subir foto a Bunny CDN (si viene)
    let photoUrl: string | null = null;
    if (photo && typeof photo === "string") {
      try {
        photoUrl = await uploadToBunny(photo, `partner-${tracking_number}`);
      } catch (uploadErr) {
        console.error(
          `[partnerReceptionWebhook] Error subiendo foto para ${tracking_number}:`,
          uploadErr.message
        );
        // Continuamos sin foto — el paquete se marca recibido igual
      }
    }

    // 6. Actualizar paquete
    const updateData: Record<string, unknown> = {
      status: "recibido",
      received_date: new Date().toISOString(),
      received_by: partner,
      reception_source: "externo",
      reception_partner: partner,
    };

    if (notes) {
      updateData.reception_notes = notes;
    }

    if (photoUrl) {
      const existingImages = Array.isArray(pkg.package_image_urls)
        ? pkg.package_image_urls
        : [];
      updateData.package_image_urls = [...existingImages, photoUrl].slice(0, 3);
      updateData.package_image_url = photoUrl;
    }

    await base44.asServiceRole.entities.Package.update(pkg.id, updateData);
    console.log(
      `[partnerReceptionWebhook] Tracking ${tracking_number} marcado como recibido (pkg=${pkg.id})`
    );

    // 7. Notificar a los admins (post-response, no bloquea la respuesta)
    waitUntil(
      (async () => {
        try {
          const admins = await base44.asServiceRole.entities.User.filter({
            role: "admin",
          });
          const adminList = Array.isArray(admins) ? admins : [];
          for (const admin of adminList) {
            await base44.asServiceRole.entities.Notification.create({
              user_email: admin.email,
              title: "📦 Recepción externa",
              message: `Tracking ${tracking_number} marcado como recibido por ${partner}${photoUrl ? " (con foto)" : ""}`,
              type: "package",
              icon: "package",
              reference_id: pkg.id,
              entity_type: "Package",
              priority: "medium",
            });
          }
        } catch (notifErr) {
          console.error(
            "[partnerReceptionWebhook] Error notificando admins:",
            notifErr.message
          );
        }
      })()
    );

    return Response.json(
      {
        matched: true,
        package_id: pkg.id,
        status: "recibido",
        photo_url: photoUrl,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[partnerReceptionWebhook] Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}