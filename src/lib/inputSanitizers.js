export const removeDiacritics = (str) => (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const stripSpecialCharacters = (str) => removeDiacritics(str).replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

export const sanitizeCodeLike = (str) => stripSpecialCharacters(str).replace(/\s+/g, '');

export const getDigits = (str) => (str || '').replace(/\D/g, '');

export const sanitizeWhatsApp = (value) => {
  let str = String(value || '').replace(/[^\d+]/g, '');
  if (str.startsWith('+')) {
    str = '+' + str.slice(1).replace(/[+]/g, '');
  } else {
    str = str.replace(/[+]/g, '');
  }
  return str;
};

export const sanitizeClientProfileData = (data = {}) => ({
  ...data,
  first_name: data.first_name !== undefined ? stripSpecialCharacters(data.first_name) : data.first_name,
  last_name: data.last_name !== undefined ? stripSpecialCharacters(data.last_name) : data.last_name,
  city: data.city !== undefined ? stripSpecialCharacters(data.city) : data.city,
  address: data.address !== undefined ? stripSpecialCharacters(data.address) : data.address,
  cedula: data.cedula !== undefined ? sanitizeCodeLike(data.cedula) : data.cedula,
  shipping_mark: data.shipping_mark,
  whatsapp: data.whatsapp !== undefined ? getDigits(data.whatsapp) : data.whatsapp,
});

export const sanitizePackageData = (data = {}) => ({
  ...data,
  tracking_number: data.tracking_number !== undefined ? sanitizeCodeLike(data.tracking_number) : data.tracking_number,
  shipping_mark: data.shipping_mark !== undefined ? sanitizeCodeLike(data.shipping_mark) : data.shipping_mark,
  description: data.description !== undefined ? stripSpecialCharacters(data.description) : data.description,
  invoice_number: data.invoice_number !== undefined ? sanitizeCodeLike(data.invoice_number) : data.invoice_number,
});