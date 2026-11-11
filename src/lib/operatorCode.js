import { base44 } from '@/api/base44Client';

// Código del operador de almacén que está imprimiendo (OP 01, OP 02...).
// Se guarda en el dispositivo para que las etiquetas lo lleven aunque no haya conexión.
const KEY = 'tlec-operator-code';

const isWarehouseOperator = (user) =>
  user?.role === 'admin' && String(user?.custom_role || '').trim().toLowerCase() === 'almacen';

const store = (code) => {
  try {
    if (code) localStorage.setItem(KEY, String(code));
    else localStorage.removeItem(KEY);
  } catch (_) {}
};

// Texto que se imprime en la esquina inferior derecha ('' si quien imprime no es operador de almacén).
export const getOperatorLabel = () => {
  try {
    const code = localStorage.getItem(KEY);
    return code ? `OP ${code}` : '';
  } catch (_) {
    return '';
  }
};

// Se llama al cargar la sesión: guarda el código del operador (pidiéndolo al sistema si aún no
// lo tiene) o lo borra si quien entró no es operador de almacén.
export const syncOperatorCode = async (user) => {
  if (!isWarehouseOperator(user)) {
    store('');
    return '';
  }
  if (user.operator_code) {
    store(user.operator_code);
    return user.operator_code;
  }
  const res = await base44.functions.invoke('getMyOperatorCode', {});
  const code = res?.data?.operator_code || '';
  store(code);
  return code;
};