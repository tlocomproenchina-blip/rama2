// Contenido inicial de los dos documentos de revisión del conocimiento del
// Asistente ATC (propuesta de implementación y borrador del manual operativo).
//
// Cada punto lleva su estado:
//   confirmado  → se pudo comprobar en el sistema o en la configuración vigente.
//   provisional → viene de documentos o de la práctica; falta confirmarlo.
//   pendiente   → hay discrepancia o falta el dato: no se responde al cliente con eso.
//
// Los valores de tarifas y plazos no se copian aquí como verdad: el documento
// apunta a la configuración vigente, que es la que manda.

export const DOC_STATUS_OPTIONS = [
  { key: 'borrador', label: 'Borrador' },
  { key: 'en_revision', label: 'En revisión' },
  { key: 'validado', label: 'Validado' },
];

export const ITEM_STATUS_OPTIONS = [
  { key: 'confirmado', label: 'Confirmado' },
  { key: 'provisional', label: 'Provisional' },
  { key: 'pendiente', label: 'Pendiente de validación' },
];

export function countByStatus(sections) {
  const counts = { confirmado: 0, provisional: 0, pendiente: 0, total: 0 };
  (sections || []).forEach((section) => {
    (section.items || []).forEach((item) => {
      const status = item.status || 'pendiente';
      counts.total += 1;
      if (counts[status] !== undefined) counts[status] += 1;
    });
  });
  return counts;
}

const PROPUESTA = {
  title: 'Propuesta: conocimiento validado para el Asistente ATC',
  subtitle: 'Cómo se arma, se valida y se mantiene la información con la que responde el asistente.',
  purpose:
    'Este documento explica de dónde sale el conocimiento, quién lo aprueba, cómo llega al Asistente ATC y qué límites tiene. Revísalo y marca lo que esté mal o falte.',
  status: 'borrador',
  version: 'v0.1',
  sections: [
    {
      heading: '1. Qué se propone',
      intro: 'Sí es posible que un agente de inteligencia artificial recorra el sistema y arme un documento de conocimiento, y que con ese documento se alimente al Asistente ATC. Se propone hacerlo en etapas y con revisión humana de por medio.',
      paragraphs: [],
      items: [
        { text: 'En esta fase solo se arman y se revisan los documentos. No se publica nada al asistente ni se conecta nada de forma automática.', status: 'confirmado', note: 'Decisión de esta fase, para poder corregir antes de que el asistente use la información.' },
        { text: 'El objetivo final es que el asistente responda con las mismas reglas que aplica el equipo, sin inventar tarifas ni plazos.', status: 'provisional', note: '' },
      ],
    },
    {
      heading: '2. Qué existe hoy y de dónde sale el conocimiento',
      intro: 'El asistente ya trabaja con contexto armado desde el sistema. La propuesta es ordenar ese conocimiento y dejar una sola fuente revisable.',
      paragraphs: [],
      items: [
        { text: 'El Asistente ATC recibe la ficha del cliente, sus cargas, facturas, guías y la tabla de tarifas vigente.', status: 'confirmado', note: 'Se arma desde el sistema en cada consulta.' },
        { text: 'Las instrucciones del asistente ya incluyen reglas de tarifas por destino y del recargo por peso.', status: 'confirmado', note: '' },
        { text: 'El sistema ya guarda una base de conocimiento y preguntas frecuentes que se pueden usar como fuente.', status: 'confirmado', note: '' },
        { text: 'Los tickets y conversaciones anteriores sí contienen respuestas humanas que nunca se validaron: sirven para detectar los temas que más pregunta la gente, nunca para citar una regla.', status: 'confirmado', note: '' },
      ],
    },
    {
      heading: '3. Fuentes autorizadas',
      intro: 'Solo las fuentes autorizadas pueden sostener una respuesta al cliente.',
      paragraphs: [],
      items: [
        { text: 'La configuración vigente del sistema (tarifas, estados, plazos y métodos de pago) manda sobre cualquier otra referencia.', status: 'confirmado', note: '' },
        { text: 'Los módulos y flujos tal como operan hoy en el sistema.', status: 'confirmado', note: '' },
        { text: 'Documentos internos que entregue el equipo: manuales de operación, políticas, contratos y condiciones.', status: 'provisional', note: 'Falta saber qué documentos existen y en qué versión.' },
        { text: 'Las páginas públicas de TLEC CARGO (tarifas publicadas y preguntas frecuentes del sitio), siempre que coincidan con la configuración.', status: 'provisional', note: 'Hoy hay textos publicados con precios antiguos que hay que alinear.' },
      ],
    },
    {
      heading: '4. Cómo se arma el manual adjunto',
      intro: 'El agente lee el sistema y redacta cada regla dejando claro de dónde sale.',
      paragraphs: [],
      items: [
        { text: 'Cada regla del manual sale marcada como Confirmado, Provisional o Pendiente de validación.', status: 'confirmado', note: '' },
        { text: 'Ninguna regla se marca como verdad sin que una persona del equipo la apruebe.', status: 'confirmado', note: '' },
        { text: 'Cuando el sistema y un texto publicado se contradicen, el manual muestra la discrepancia en lugar de elegir una versión.', status: 'confirmado', note: 'En el manual adjunto ya aparecen tres discrepancias detectadas.' },
      ],
    },
    {
      heading: '5. Cómo llegaría el conocimiento al Asistente ATC',
      intro: 'La idea es no tocar el comportamiento del asistente más de lo necesario: se le entrega el manual aprobado junto con el resto del contexto que ya arma.',
      paragraphs: [],
      items: [
        { text: 'Hoy el contexto del asistente se arma por código: datos del cliente, sus cargas y las tarifas vigentes.', status: 'confirmado', note: '' },
        { text: 'Propuesta: el manual aprobado se guarda como documento y se suministra en ese mismo contexto, sin cambiar el resto.', status: 'provisional', note: 'Falta aprobar esta forma de entrega.' },
        { text: 'Una sola fuente: cuando el manual cambie, el asistente usa la versión nueva sin reescribir código.', status: 'provisional', note: '' },
        { text: 'Lo que no se hace: un segundo asistente, ni dejar que el agente decida reglas por su cuenta.', status: 'confirmado', note: '' },
      ],
    },
    {
      heading: '6. Estados y responsables',
      intro: 'Cada punto del manual lleva su estado para que se sepa qué se puede usar y qué no.',
      paragraphs: [],
      items: [
        { text: 'Confirmado: se puede comprobar en el sistema o en la configuración del día.', status: 'confirmado', note: '' },
        { text: 'Provisional: viene de documentos o de la práctica y falta que el área lo confirme.', status: 'confirmado', note: '' },
        { text: 'Pendiente de validación: hay discrepancia o falta el dato. El asistente no responde al cliente con eso hasta que se cierre.', status: 'confirmado', note: '' },
        { text: 'Responsables propuestos: Operaciones y Contabilidad validan reglas y montos; Soporte valida cómo se comunica cada cosa; Administración aprueba la versión final de cada documento.', status: 'provisional', note: 'Falta que ustedes confirmen los nombres.' },
      ],
    },
    {
      heading: '7. Controles y límites del asistente',
      intro: 'El asistente ayuda al ATC, no lo reemplaza ni decide por la empresa.',
      paragraphs: [],
      items: [
        { text: 'El asistente no promete fechas de llegada ni montos que no salgan del sistema.', status: 'provisional', note: 'Falta convertirlo en una regla escrita del asistente.' },
        { text: 'Los casos delicados se escalan a Supervisión; el asistente no cierra casos por su cuenta.', status: 'confirmado', note: '' },
        { text: 'La conversación con Supervisión y las notas internas del equipo siguen siendo internas: nunca se muestran al cliente.', status: 'confirmado', note: '' },
        { text: 'El asistente solo ve los datos del cliente que se está atendiendo.', status: 'confirmado', note: '' },
        { text: 'Este espacio de documentos es de administradores: los empleados de área solo entran a los módulos que tienen asignados.', status: 'confirmado', note: '' },
      ],
    },
    {
      heading: '8. Cómo se mantiene vigente',
      intro: 'Un documento que no se revisa se vuelve un riesgo: el asistente repetiría información vieja con seguridad.',
      paragraphs: [],
      items: [
        { text: 'Cada documento guarda la fecha y el nombre de quien hizo la última revisión.', status: 'confirmado', note: '' },
        { text: 'La revisión se repite al cambiar tarifas, plazos o flujos, y además una vez al trimestre.', status: 'provisional', note: 'Falta fijar el trimestre como compromiso.' },
        { text: 'Todo cambio de configuración que afecte precios obliga a revisar el manual antes de seguir respondiendo con él.', status: 'provisional', note: '' },
      ],
    },
    {
      heading: '9. Riesgos y cómo se cubren',
      intro: '',
      paragraphs: [],
      items: [
        { text: 'Que el agente invente reglas: nada llega al asistente sin aprobación humana.', status: 'confirmado', note: '' },
        { text: 'Que una regla vieja se quede en el documento: cada punto dice de dónde sale y qué revisar.', status: 'confirmado', note: '' },
        { text: 'Que el asistente prometa algo que no se puede cumplir: sus respuestas se limitan a datos del sistema y a lo aprobado.', status: 'provisional', note: '' },
        { text: 'Que los documentos se llenen de datos de clientes: aquí solo van reglas, nunca información personal.', status: 'confirmado', note: '' },
      ],
    },
    {
      heading: '10. Decisiones que necesitamos de ustedes',
      intro: 'Con estas definiciones el manual puede pasar a contexto del asistente.',
      paragraphs: [],
      items: [
        { text: 'Revisar el manual adjunto y marcar lo que esté mal o falte.', status: 'pendiente', note: '' },
        { text: 'Decidir si el asistente puede dar montos estimados al cliente o solo escalarlos.', status: 'pendiente', note: '' },
        { text: 'Nombrar quién queda como dueño de estos documentos.', status: 'pendiente', note: '' },
      ],
    },
    {
      heading: '11. Etapas',
      intro: '',
      paragraphs: [],
      items: [
        { text: 'Etapa 1 (esta): los dos documentos quedan en el panel para revisión, sin efecto sobre las respuestas.', status: 'confirmado', note: '' },
        { text: 'Etapa 2: el manual aprobado pasa a contexto del Asistente ATC y se prueba con casos reales.', status: 'provisional', note: '' },
        { text: 'Etapa 3: el agente propone actualizaciones cuando cambia la configuración, siempre con revisión previa.', status: 'pendiente', note: '' },
      ],
    },
  ],
};

const MANUAL = {
  title: 'Manual operativo de TLEC CARGO (borrador para revisión)',
  subtitle: 'Reglas con las que trabaja hoy el sistema: para revisar, corregir y luego usar como contexto del asistente.',
  purpose:
    'Cada punto está marcado como Confirmado, Provisional o Pendiente de validación. Corrige lo que esté mal: lo que quede aprobado es lo que el asistente podrá afirmar.',
  status: 'borrador',
  version: 'v0.1',
  sections: [
    {
      heading: '1. Alcance de este manual',
      intro: 'Este manual reúne las reglas con las que trabaja TLEC CARGO hoy dentro del sistema.',
      paragraphs: [],
      items: [
        { text: 'Un dato se marca como Confirmado solo cuando se puede comprobar en el sistema o en la configuración vigente.', status: 'confirmado', note: '' },
        { text: 'Lo marcado como Provisional o Pendiente de validación no debe usarse para responder a un cliente hasta que el equipo lo confirme.', status: 'confirmado', note: '' },
        { text: 'Tarifas y montos cambian por configuración: el asistente debe leer el valor del día, no repetir un número de memoria.', status: 'confirmado', note: '' },
      ],
    },
    {
      heading: '2. Estados de una carga',
      intro: 'Estos son los estados que el sistema maneja hoy para una carga.',
      paragraphs: [],
      items: [
        { text: 'Pre-alerta: el cliente declaró la carga, todavía no ha llegado al almacén.', status: 'confirmado', note: '' },
        { text: 'Recibido: la carga llegó al almacén de China y se registraron su peso y medidas reales.', status: 'confirmado', note: '' },
        { text: 'Rechazado: la recepción se rechazó.', status: 'confirmado', note: 'El motivo no queda como dato aparte: lo escribe el operador en la nota de recepción. Falta definir qué motivos se comunican al cliente.' },
        { text: 'Consolidado: la carga se agrupó para salir del almacén.', status: 'confirmado', note: '' },
        { text: 'En tránsito: la carga salió y está en camino.', status: 'confirmado', note: '' },
        { text: 'Disponible: la carga está disponible en el almacén de destino.', status: 'confirmado', note: '' },
        { text: 'Despachado: la carga se despachó desde el almacén.', status: 'confirmado', note: '' },
        { text: 'Entregado: la carga se entregó al cliente.', status: 'confirmado', note: '' },
        { text: 'Sin cliente: carga huérfana, llegó sin pre-alerta y sin titular asignado.', status: 'confirmado', note: '' },
      ],
    },
    {
      heading: '3. Recepción en el almacén de China',
      intro: '',
      paragraphs: [],
      items: [
        { text: 'Al registrar la recepción se guardan el peso y las medidas reales de la carga.', status: 'confirmado', note: '' },
        { text: 'Se pueden adjuntar hasta 3 fotos de la carga recibida.', status: 'confirmado', note: '' },
        { text: 'Las fotos de recepción se envían al mayorista cuando corresponde; si todavía no hay foto, el aviso queda pendiente hasta que exista.', status: 'confirmado', note: '' },
        { text: 'La fecha en la que la carga se reconoce en el almacén de Venezuela queda guardada y es la que usa el resumen diario para avisar al cliente.', status: 'confirmado', note: '' },
        { text: 'Si una carga llega sin pre-alerta y sin titular, entra como huérfana.', status: 'confirmado', note: '' },
      ],
    },
    {
      heading: '4. Paquetes huérfanos',
      intro: '',
      paragraphs: [],
      items: [
        { text: 'Los huérfanos quedan en la lista de Paquetes Huérfanos con estado sin cliente.', status: 'confirmado', note: '' },
        { text: 'Cuando se le asigna un cliente, el paquete sigue en esa lista hasta que se cumplan dos condiciones: que conste recibido en almacén y que se haya enviado su foto de recepción al mayorista.', status: 'confirmado', note: '' },
        { text: 'La lectura del tracking por inteligencia artificial no siempre logra leer la foto; cuando no puede, el paquete se marca para no reintentarlo automáticamente.', status: 'confirmado', note: '' },
        { text: 'El reclamo automático por inteligencia artificial tiene un presupuesto mensual: al superar la mitad del presupuesto el sistema cambia a una ruta sin costo de créditos.', status: 'confirmado', note: '' },
        { text: 'Un mayorista reportó que sus paquetes huérfanos no aparecen en su portal. El caso sigue abierto.', status: 'pendiente', note: 'No dar la situación por resuelta al cliente mayorista hasta cerrar el caso.' },
      ],
    },
    {
      heading: '5. Consolidación y despacho',
      intro: '',
      paragraphs: [],
      items: [
        { text: 'La consolidación agrupa cargas de un cliente y se aprueba desde el sistema. También existe la consolidación automática al vencer el período de espera.', status: 'confirmado', note: '' },
        { text: 'El despacho se arma con guías, que pueden salir del período de facturas pagadas, del escáner de despacho, de un lote de etiquetas o a mano.', status: 'confirmado', note: '' },
        { text: 'Una guía emitida sigue abierta: las cajas y bultos que se escaneen después para ese cliente se suman a la misma guía.', status: 'confirmado', note: '' },
        { text: 'Cada guía se entrega y se anota quién recibió la carga; a partir de ahí queda como entregada.', status: 'confirmado', note: '' },
        { text: 'Las cajas consolidadas se imprimen con etiqueta continua, indicando su posición dentro del lote del cliente.', status: 'confirmado', note: '' },
      ],
    },
    {
      heading: '6. Cómo se cobra un envío',
      intro: 'El detalle de tarifas vive en la configuración del sistema. Aquí quedan las reglas, no los montos.',
      paragraphs: [],
      items: [
        { text: 'Toda la carga se cobra por su volumen real en CBM, con la tarifa del estado de destino.', status: 'confirmado', note: '' },
        { text: 'La tarifa de cada estado se administra en Configuración: es la que rige y la que el asistente debe leer.', status: 'confirmado', note: '' },
        { text: 'No hay mínimo de envío ni tarifa fija por rango: la carga se cobra por su volumen real, por pequeña que sea.', status: 'confirmado', note: 'La tabla de tarifas fijas para cargas menores a 0.130 CBM quedó fuera de uso.' },
        { text: 'La recepción de cada paquete suma 1 USD.', status: 'confirmado', note: '' },
        { text: 'El seguro de carga se cobra como un porcentaje del valor FOB declarado.', status: 'confirmado', note: '' },
        { text: 'La entrega es puerta a puerta en la dirección del cliente y va incluida en la tarifa por CBM: no se cobra un precio fijo por bulto.', status: 'confirmado', note: '' },
      ],
    },
    {
      heading: '7. Recargo por peso',
      intro: 'Una sola regla para todas las superficies: la calculadora, el asistente, las páginas públicas y la lista de precios del cliente.',
      paragraphs: [],
      items: [
        { text: 'Desde 400 kg inclusive la tarifa por CBM se cobra al doble (x2); hasta 399 kg se cobra la tarifa normal del estado de destino.', status: 'confirmado', note: '' },
        { text: 'El x2 aplica igual en carga regular y en carga de alto riesgo o sensible.', status: 'confirmado', note: '' },
        { text: 'El mismo umbral rige en la calculadora, en el asistente de ATC, en las páginas públicas y en la lista de precios del cliente: no hay dos precios según dónde se consulte.', status: 'confirmado', note: '' },
      ],
    },
    {
      heading: '8. Seguro de carga',
      intro: '',
      paragraphs: [],
      items: [
        { text: 'El seguro es un porcentaje del valor FOB y el porcentaje se configura en el sistema.', status: 'confirmado', note: '' },
        { text: 'El seguro puede quedar como obligatorio: en ese caso el cliente debe pagarlo antes de poder aprobar su pre-alerta.', status: 'confirmado', note: '' },
        { text: 'Si el pago del seguro se rechaza, el cliente tiene 12 horas para pagarlo; si el plazo vence, el paquete queda sin seguro de forma permanente.', status: 'confirmado', note: '' },
        { text: 'Cuando el seguro es obligatorio, el cliente debe aceptar el contrato de la aseguradora.', status: 'confirmado', note: '' },
        { text: 'Falta confirmar si el plazo de 12 horas se comunica igual en los correos y en las respuestas del asistente.', status: 'pendiente', note: '' },
      ],
    },
    {
      heading: '9. Comprobante de entrega del vendedor',
      intro: '',
      paragraphs: [],
      items: [
        { text: 'El cliente carga la fecha en que el vendedor entregó la carga al almacén y una foto que lo respalda.', status: 'confirmado', note: '' },
        { text: 'El plazo para cargarlo es de 10 días naturales contados desde la pre-alerta.', status: 'confirmado', note: '' },
        { text: 'Pasado el plazo, solo un administrador puede habilitar una excepción para ese paquete.', status: 'confirmado', note: '' },
        { text: 'Falta confirmar qué se responde al cliente cuando el plazo ya venció y no hay excepción.', status: 'pendiente', note: '' },
      ],
    },
    {
      heading: '10. Facturación y pagos',
      intro: '',
      paragraphs: [],
      items: [
        { text: 'El cliente ve sus facturas y abonos; los pagos los aprueba un administrador.', status: 'confirmado', note: '' },
        { text: 'En la facturación manual el administrador marca a mano qué bultos y qué recibos entran, para no cobrar dos veces lo mismo.', status: 'confirmado', note: '' },
        { text: 'Las cargas en almacén aparecen sin seleccionar por defecto: el administrador confirma qué se factura.', status: 'confirmado', note: '' },
        { text: 'A los clientes de mayoristas se les cobra 1 USD por cada tracking recibido, en concepto de manejo.', status: 'confirmado', note: '' },
        { text: 'Falta confirmar si ese manejo de 1 USD aplica también a clientes que no son de mayoristas.', status: 'pendiente', note: '' },
      ],
    },
    {
      heading: '11. Clientes mayoristas',
      intro: '',
      paragraphs: [],
      items: [
        { text: 'Cada conexión con un mayorista tiene sus propias tarifas por CBM y por bulto.', status: 'confirmado', note: '' },
        { text: 'Las facturas de los clientes de un mayorista se envían al correo del mayorista, no al correo del cliente final.', status: 'confirmado', note: '' },
        { text: 'El sistema consulta a diario los clientes nuevos del mayorista y su historial de pre-alertas.', status: 'confirmado', note: '' },
        { text: 'Cuando una carga del mayorista se recibe en China, se le avisa con la foto de recepción.', status: 'confirmado', note: '' },
        { text: 'Del lado del mayorista falta configurar la dirección de su historial y revisar los duplicados que dejó el proceso de unificación.', status: 'pendiente', note: '' },
      ],
    },
    {
      heading: '12. Portal compartido',
      intro: '',
      paragraphs: [],
      items: [
        { text: 'Permite que un aliado consulte cargas con un enlace, con o sin código de acceso, y con alcance general o limitado a ciertos mayoristas, clientes y Shipping Marks.', status: 'confirmado', note: '' },
        { text: 'Cada consulta y cada exportación quedan registradas con su fecha y su resultado.', status: 'confirmado', note: '' },
        { text: 'El enlace se guarda cifrado: solo se muestra en el momento de generarlo.', status: 'confirmado', note: '' },
      ],
    },
    {
      heading: '13. Atención al cliente (Soporte y ATC)',
      intro: '',
      paragraphs: [],
      items: [
        { text: 'El cliente abre casos con una categoría (pago, envío, tracking, consolidación, actualizar datos u otro) y una prioridad.', status: 'confirmado', note: '' },
        { text: 'El asistente ATC atiende el caso y puede escalarlo a Supervisión con un resumen de la situación.', status: 'confirmado', note: '' },
        { text: 'Lo que escribe el supervisor es interno: nunca se envía al cliente.', status: 'confirmado', note: '' },
        { text: 'El ATC no entra al módulo de Supervisor y no tiene accesos directos a él.', status: 'confirmado', note: '' },
        { text: 'Los cambios en los datos de un paquete (tracking, seguro o fecha de despacho) los solicita el ATC y los aplica Supervisión, con comprobante adjunto.', status: 'confirmado', note: '' },
        { text: 'Las notas internas del equipo nunca se muestran al cliente.', status: 'confirmado', note: '' },
        { text: 'Falta definir qué puede afirmar el ATC sin escalar: plazos, montos y compensaciones.', status: 'pendiente', note: '' },
      ],
    },
    {
      heading: '14. Reglas de comunicación con el cliente',
      intro: 'Estas reglas todavía no están escritas en el sistema: se proponen para el asistente.',
      paragraphs: [],
      items: [
        { text: 'No confirmar fechas de llegada ni montos que no salgan del sistema.', status: 'provisional', note: '' },
        { text: 'En disputas de tracking en el almacén de China, validar la fecha de entrega del vendedor y su comprobante antes de escalar.', status: 'confirmado', note: '' },
        { text: 'No prometer compensaciones ni reembolsos: eso lo define Supervisión.', status: 'provisional', note: '' },
        { text: 'Responder en español, usando solo los datos del cliente que se está atendiendo.', status: 'provisional', note: '' },
      ],
    },
    {
      heading: '15. Puntos que hay que cerrar antes de usar este manual',
      intro: '',
      paragraphs: [],
      items: [
        { text: 'Qué puede afirmar el ATC sin escalar a Supervisión.', status: 'pendiente', note: '' },
        { text: 'Qué puede afirmar el ATC sin escalar a Supervisión.', status: 'pendiente', note: '' },
        { text: 'Caso abierto: huérfanos del mayorista que no aparecen en su portal.', status: 'pendiente', note: '' },
      ],
    },
  ],
};

export const DEFAULT_DOCS = { propuesta: PROPUESTA, manual: MANUAL };

export const DOC_TABS = [
  { key: 'propuesta', label: 'Propuesta' },
  { key: 'manual', label: 'Manual operativo' },
];