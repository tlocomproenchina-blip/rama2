// 24 capitales de estado venezolano con datos para landing pages SEO.
// slug = fragmento de URL (/envios-maritimos-china-[slug])
// state_code = código que coincide con StateConfig y la calculadora de envíos.

export const CITY_LANDINGS = [
  { slug: 'caracas', city: 'Caracas', state_code: 'caracas', state_name: 'Distrito Capital', transit_lcl: '75-90 días', transit_fcl: '60-75 días' },
  { slug: 'maracaibo', city: 'Maracaibo', state_code: 'zulia', state_name: 'Zulia', transit_lcl: '80-95 días', transit_fcl: '65-80 días' },
  { slug: 'valencia', city: 'Valencia', state_code: 'carabobo', state_name: 'Carabobo', transit_lcl: '75-90 días', transit_fcl: '60-75 días' },
  { slug: 'maracay', city: 'Maracay', state_code: 'aragua', state_name: 'Aragua', transit_lcl: '75-90 días', transit_fcl: '60-75 días' },
  { slug: 'barquisimeto', city: 'Barquisimeto', state_code: 'lara', state_name: 'Lara', transit_lcl: '78-92 días', transit_fcl: '63-78 días' },
  { slug: 'merida', city: 'Mérida', state_code: 'merida', state_name: 'Mérida', transit_lcl: '80-95 días', transit_fcl: '65-80 días' },
  { slug: 'san-cristobal', city: 'San Cristóbal', state_code: 'tachira', state_name: 'Táchira', transit_lcl: '80-95 días', transit_fcl: '65-80 días' },
  { slug: 'barcelona', city: 'Barcelona', state_code: 'anzoategui', state_name: 'Anzoátegui', transit_lcl: '78-92 días', transit_fcl: '63-78 días' },
  { slug: 'ciudad-bolivar', city: 'Ciudad Bolívar', state_code: 'bolivar', state_name: 'Bolívar', transit_lcl: '80-95 días', transit_fcl: '65-80 días' },
  { slug: 'maturin', city: 'Maturín', state_code: 'monagas', state_name: 'Monagas', transit_lcl: '80-95 días', transit_fcl: '65-80 días' },
  { slug: 'coro', city: 'Coro', state_code: 'falcon', state_name: 'Falcón', transit_lcl: '80-95 días', transit_fcl: '65-80 días' },
  { slug: 'barinas', city: 'Barinas', state_code: 'barinas', state_name: 'Barinas', transit_lcl: '80-95 días', transit_fcl: '65-80 días' },
  { slug: 'trujillo', city: 'Trujillo', state_code: 'trujillo', state_name: 'Trujillo', transit_lcl: '80-95 días', transit_fcl: '65-80 días' },
  { slug: 'guanare', city: 'Guanare', state_code: 'portuguesa', state_name: 'Portuguesa', transit_lcl: '80-95 días', transit_fcl: '65-80 días' },
  { slug: 'san-juan-de-los-morros', city: 'San Juan de los Morros', state_code: 'guarico', state_name: 'Guárico', transit_lcl: '78-92 días', transit_fcl: '63-78 días' },
  { slug: 'san-fernando', city: 'San Fernando', state_code: 'apure', state_name: 'Apure', transit_lcl: '80-95 días', transit_fcl: '65-80 días' },
  { slug: 'cumana', city: 'Cumaná', state_code: 'sucre', state_name: 'Sucre', transit_lcl: '82-96 días', transit_fcl: '67-82 días' },
  { slug: 'la-asuncion', city: 'La Asunción', state_code: 'nueva_esparta', state_name: 'Nueva Esparta', transit_lcl: '82-96 días', transit_fcl: '67-82 días' },
  { slug: 'puerto-ayacucho', city: 'Puerto Ayacucho', state_code: 'amazonas', state_name: 'Amazonas', transit_lcl: '85-100 días', transit_fcl: '70-85 días' },
  { slug: 'tucupita', city: 'Tucupita', state_code: 'delta_amacuro', state_name: 'Delta Amacuro', transit_lcl: '85-100 días', transit_fcl: '70-85 días' },
  { slug: 'san-carlos', city: 'San Carlos', state_code: 'cojedes', state_name: 'Cojedes', transit_lcl: '78-92 días', transit_fcl: '63-78 días' },
  { slug: 'san-felipe', city: 'San Felipe', state_code: 'yaracuy', state_name: 'Yaracuy', transit_lcl: '78-92 días', transit_fcl: '63-78 días' },
  { slug: 'los-teques', city: 'Los Teques', state_code: 'miranda', state_name: 'Miranda', transit_lcl: '75-90 días', transit_fcl: '60-75 días' },
  { slug: 'la-guaira', city: 'La Guaira', state_code: 'vargas', state_name: 'La Guaira', transit_lcl: '75-90 días', transit_fcl: '60-75 días' },
];

export const getCityBySlug = (slug) => CITY_LANDINGS.find((c) => c.slug === slug) || null;

export const cityLandingPath = (slug) => `/envios-maritimos-china-${slug}`;