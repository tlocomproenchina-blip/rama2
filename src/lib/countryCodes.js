// Lista de prefijos telefónicos internacionales (E.164)
// Usados en el selector de WhatsApp del perfil del cliente.
export const COUNTRY_CODES = [
  { code: '+58', country: 'Venezuela', flag: '🇻🇪' },
  { code: '+1', country: 'Estados Unidos / Canadá', flag: '🇺🇸' },
  { code: '+52', country: 'México', flag: '🇲🇽' },
  { code: '+34', country: 'España', flag: '🇪🇸' },
  { code: '+57', country: 'Colombia', flag: '🇨🇴' },
  { code: '+51', country: 'Perú', flag: '🇵🇪' },
  { code: '+56', country: 'Chile', flag: '🇨🇱' },
  { code: '+54', country: 'Argentina', flag: '🇦🇷' },
  { code: '+55', country: 'Brasil', flag: '🇧🇷' },
  { code: '+593', country: 'Ecuador', flag: '🇪🇨' },
  { code: '+591', country: 'Bolivia', flag: '🇧🇴' },
  { code: '+595', country: 'Paraguay', flag: '🇵🇾' },
  { code: '+598', country: 'Uruguay', flag: '🇺🇾' },
  { code: '+507', country: 'Panamá', flag: '🇵🇦' },
  { code: '+506', country: 'Costa Rica', flag: '🇨🇷' },
  { code: '+503', country: 'El Salvador', flag: '🇸🇻' },
  { code: '+504', country: 'Honduras', flag: '🇭🇳' },
  { code: '+505', country: 'Nicaragua', flag: '🇳🇮' },
  { code: '+502', country: 'Guatemala', flag: '🇬🇹' },
  { code: '+509', country: 'Haití', flag: '🇭🇹' },
  { code: '+1809', country: 'Rep. Dominicana', flag: '🇩🇴' },
  { code: '+53', country: 'Cuba', flag: '🇨🇺' },
  { code: '+1787', country: 'Puerto Rico', flag: '🇵🇷' },
  { code: '+44', country: 'Reino Unido', flag: '🇬🇧' },
  { code: '+33', country: 'Francia', flag: '🇫🇷' },
  { code: '+49', country: 'Alemania', flag: '🇩🇪' },
  { code: '+39', country: 'Italia', flag: '🇮🇹' },
  { code: '+351', country: 'Portugal', flag: '🇵🇹' },
  { code: '+31', country: 'Países Bajos', flag: '🇳🇱' },
  { code: '+32', country: 'Bélgica', flag: '🇧🇪' },
  { code: '+41', country: 'Suiza', flag: '🇨🇭' },
  { code: '+43', country: 'Austria', flag: '🇦🇹' },
  { code: '+45', country: 'Dinamarca', flag: '🇩🇰' },
  { code: '+46', country: 'Suecia', flag: '🇸🇪' },
  { code: '+47', country: 'Noruega', flag: '🇳🇴' },
  { code: '+358', country: 'Finlandia', flag: '🇫🇮' },
  { code: '+353', country: 'Irlanda', flag: '🇮🇪' },
  { code: '+30', country: 'Grecia', flag: '🇬🇷' },
  { code: '+36', country: 'Hungría', flag: '🇭🇺' },
  { code: '+48', country: 'Polonia', flag: '🇵🇱' },
  { code: '+420', country: 'Rep. Checa', flag: '🇨🇿' },
  { code: '+40', country: 'Rumania', flag: '🇷🇴' },
  { code: '+90', country: 'Turquía', flag: '🇹🇷' },
  { code: '+7', country: 'Rusia', flag: '🇷🇺' },
  { code: '+380', country: 'Ucrania', flag: '🇺🇦' },
  { code: '+972', country: 'Israel', flag: '🇮🇱' },
  { code: '+971', country: 'Emiratos Árabes', flag: '🇦🇪' },
  { code: '+966', country: 'Arabia Saudita', flag: '🇸🇦' },
  { code: '+20', country: 'Egipto', flag: '🇪🇬' },
  { code: '+27', country: 'Sudáfrica', flag: '🇿🇦' },
  { code: '+234', country: 'Nigeria', flag: '🇳🇬' },
  { code: '+254', country: 'Kenia', flag: '🇰🇪' },
  { code: '+212', country: 'Marruecos', flag: '🇲🇦' },
  { code: '+86', country: 'China', flag: '🇨🇳' },
  { code: '+852', country: 'Hong Kong', flag: '🇭🇰' },
  { code: '+886', country: 'Taiwán', flag: '🇹🇼' },
  { code: '+81', country: 'Japón', flag: '🇯🇵' },
  { code: '+82', country: 'Corea del Sur', flag: '🇰🇷' },
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+92', country: 'Pakistán', flag: '🇵🇰' },
  { code: '+62', country: 'Indonesia', flag: '🇮🇩' },
  { code: '+60', country: 'Malasia', flag: '🇲🇾' },
  { code: '+65', country: 'Singapur', flag: '🇸🇬' },
  { code: '+66', country: 'Tailandia', flag: '🇹🇭' },
  { code: '+84', country: 'Vietnam', flag: '🇻🇳' },
  { code: '+63', country: 'Filipinas', flag: '🇵🇭' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+64', country: 'Nueva Zelanda', flag: '🇳🇿' },
];

export const DEFAULT_COUNTRY_CODE = '+58';

/**
 * Dado un valor en formato +<prefijo><numero>, intenta separar el prefijo conocido más largo
 * y devuelve { code, number }. Si no encuentra coincidencia, devuelve el código por defecto.
 */
export function splitPhoneNumber(rawValue, fallback = DEFAULT_COUNTRY_CODE) {
  const value = String(rawValue || '').trim();
  if (!value) return { code: fallback, number: '' };
  if (value.startsWith('+')) {
    // Buscar prefijo más largo que coincida (4 → 3 → 2 → 1 dígitos)
    const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
    for (const c of sorted) {
      if (value.startsWith(c.code)) {
        return { code: c.code, number: value.slice(c.code.length).replace(/\D/g, '') };
      }
    }
    // Empieza con + pero no reconocemos el prefijo: dejamos solo dígitos
    return { code: fallback, number: value.slice(1).replace(/\D/g, '') };
  }
  // Sin +, asumimos número local
  return { code: fallback, number: value.replace(/\D/g, '') };
}