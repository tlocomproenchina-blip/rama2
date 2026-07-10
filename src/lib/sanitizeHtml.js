// Sanitiza HTML antes de renderizarlo con dangerouslySetInnerHTML.
// Elimina etiquetas peligrosas, atributos de eventos (on*) y URLs javascript:/data:.

const BLOCKED_TAGS = 'script, style, iframe, object, embed, form, link, meta, base';
const URL_ATTRS = ['href', 'src', 'xlink:href', 'action', 'formaction'];

export function sanitizeHtml(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(String(html), 'text/html');

  doc.querySelectorAll(BLOCKED_TAGS).forEach((el) => el.remove());

  doc.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = String(attr.value || '').replace(/[\s\u0000-\u001F]/g, '').toLowerCase();
      if (name.startsWith('on') || name === 'srcdoc') {
        el.removeAttribute(attr.name);
      } else if (
        URL_ATTRS.includes(name) &&
        (value.startsWith('javascript:') || value.startsWith('vbscript:') || value.startsWith('data:text/html'))
      ) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return doc.body.innerHTML;
}