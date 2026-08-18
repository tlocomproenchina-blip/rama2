// Sube una imagen base64 a Bunny Storage y devuelve la URL pública del CDN.
// Lógica compartida para reutilizar entre funciones backend.

export async function uploadToBunny(imageBase64, filename = "upload") {
  const storageKey = Deno.env.get("BUNNY_STORAGE_KEY");
  const storageZone = Deno.env.get("BUNNY_STORAGE_ZONE");
  const cdnHost = Deno.env.get("BUNNY_CDN_HOST");
  if (!storageKey || !storageZone || !cdnHost) {
    throw new Error("Falta configuración de Bunny (key/zone/cdn host)");
  }

  // Decodificar base64 a bytes
  const binary = atob(imageBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  // Generar ruta única
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  const safeName = filename.replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 40);
  const path = `tlec/${ts}-${safeName || rand}.jpg`;

  const uploadUrl = `https://storage.bunnycdn.com/${storageZone}/${path}`;
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      AccessKey: storageKey,
      "Content-Type": "application/octet-stream",
    },
    body: bytes,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Error subiendo a Bunny (${res.status}): ${errText}`);
  }

  return `https://${cdnHost.replace(/^https?:\/\//, "")}/${path}`;
}