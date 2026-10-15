// Spanish strings for the landing page: written, not translated. Neutral Latin American Spanish, with tú.
// Vidrio (never cristal), teléfono (never móvil), audífonos, unirse a la lista (never anotarse). Plain text only.
// No spoilers: no lock's answer, no code, nothing about the endings.
export default {
  lang: 'es',
  locale: 'es_LA',
  path: '/es/',
  other: { lang: 'en', path: '/', label: 'EN', name: 'English' },
  meta: {
    title: 'THRESHOLD · Trece puertas. Solo aparecen a través del vidrio.',
    description: 'Un misterio de terror de GAZUM que se juega con la cámara de tu teléfono, en tu propia habitación. Trece puertas. Solo aparecen a través del vidrio. Cada noche se abre una, a las 3:03 de la madrugada.',
    ogAlt: 'THRESHOLD: un pasillo oscuro de noche, visto a través del visor de la cámara de un teléfono, con la puerta del fondo trazada en luz dorada.'
  },
  skip: 'Saltar a la historia',
  home: 'THRESHOLD, inicio',

  hud: { rec: 'REC', saved: 'GUARDADO', iso: 'ISO 3200 · 1/30 · F1.8', isoShort: 'ISO 3200', door: 'PUERTA I' },
  sound: {
    name: 'Sonido', stby: 'STBY', rec: 'REC', paused: 'EN PAUSA',
    hint: 'Mejor con audífonos · suena aunque el teléfono esté en silencio',
    resume: 'Sonido en pausa · toca para seguir',
    unavailable: 'El sonido no está disponible en este dispositivo.'
  },

  hero: {
    file: 'ARCHIVO 01 · REC',
    line: 'Trece puertas. Solo aparecen a través del vidrio.',
    italic: 'Detrás de la última está quien las hizo.',
    play: 'Juega esta noche',
    protoNote: '(el prototipo está en inglés)',
    join: 'Únete a la lista',
    qrTitle: 'Ábrelo en tu teléfono',
    qrAlt: 'Un código QR para threshold.gazum.ai/play',
    orPlay: 'o juega aquí',
    ritual: 'Audífonos. De noche. A solas.',
    meta: 'Prototipo web · iPhone en camino',
    tilt: 'Levanta tu teléfono',
    alt: 'A través de la cámara de un teléfono, de noche: un pasillo oscuro, iluminado solo por un teléfono en el piso. Al fondo, una puerta se va trazando en una línea fina de luz dorada.'
  },

  clock: {
    file: 'ARCHIVO 02 · 03:03',
    lead: 'Un misterio de terror que se juega con la cámara de tu teléfono, en tu propia habitación.',
    rule: 'Cada noche se abre una puerta, a las 3:03 de la madrugada.',
    body: 'Cada puerta es un capítulo de la historia y siete cosas que hacer a través de la cámara. Seis te dan una pieza de lo que pide la séptima.',
    next: 'La próxima puerta se abre en',
    yours: 'tu hora',
    open: 'Hay una puerta abierta · tu hora',
    margin: 'Son las 3:03. Hay una puerta en esta página.',
    alt: 'Valparaíso a las 3 de la madrugada, desde lo alto de una escalera: casas a oscuras, unos pocos faroles, el puerto y el mar negro.'
  },

  gaps: [['03:03', 'Toqué la puerta.'], ['03:03', 'Algo tocó del otro lado.'], ['03:04', 'No está detrás de la puerta.'], ['03:04', 'Está detrás del vidrio.']],

  phone: {
    file: 'ARCHIVO 03 · SU TELÉFONO',
    story: [
      ['lead', 'Lena Ostrova fue la primera en llegar a la última puerta.'],
      ['text', 'Tenía diecinueve años. Jugaba todas las noches a las 3 de la madrugada, en el baño, con la luz apagada.'],
      ['text', 'Encontraron su teléfono en el piso de una iglesia vacía de Valparaíso, con la pantalla encendida y la cámara abierta.'],
      ['lead', 'A Lena nadie la encontró.']
    ],
    left: 'Esto es todo lo que dejó.',
    lock: {
      label: 'La pantalla de bloqueo de su teléfono',
      date: 'Sábado 14 de octubre',
      memo: 'Nota de voz',
      memoLen: '0:13',
      play: 'Escuchar su nota de voz',
      stop: 'Detener su nota de voz',
      playing: 'Su nota de voz se está reproduciendo: solo estática, y algo que respira.',
      missed: 'Llamada perdida',
      calls: [['Jugador Uno', 'Tomás', '1987'], ['Jugadora Dos', 'Amalia', '1999'], ['Jugador Tres', 'Ari', '2011'], ['Jugadora Cuatro', 'Lena', '2023']]
    },
    alt: 'Una iglesia vacía de noche. En el piso de piedra del pasillo central hay un teléfono boca arriba, con la pantalla todavía encendida.'
  },

  glass: {
    file: 'ARCHIVO 04 · A TRAVÉS DEL VIDRIO',
    title: 'Unas treinta maneras de jugar a través del vidrio.',
    lead: 'Inclínalo, tápalo, toca puertas con él, tararéale. Cada puerta pide algo distinto, y solo funciona en una habitación de verdad. Aquí hay seis.',
    tiles: {
      tilt: { k: 'Inclinar', line: 'Inclina el vidrio.', how: 'Arrastra o usa las flechas.', name: 'Inclinar el vidrio', level: 'Nivelado', left: 'Inclinado a la izquierda', right: 'Inclinado a la derecha' },
      cover: { k: 'Tapar', line: 'Tapa el lente.', how: 'Mantén presionado.', name: 'Tapar el lente', dark: 'Algunas palabras solo se ven en la oscuridad.', covered: 'El lente está tapado. En la oscuridad: «Algunas palabras solo se ven en la oscuridad».', clear: 'El lente está despejado.' },
      knock: { k: 'Tocar', line: 'Toca a una puerta de verdad.', how: 'Haz clic o toca para golpear.', name: 'Tocar la puerta', you: 'Tocas la puerta.', back: 'Algo toca del otro lado, una vez.' },
      hum: { k: 'Tararear', line: 'Tararea.', how: 'Mantén presionado.', name: 'Tararear', box: 'Una caja de música toca tres notas y espera.' },
      mirror: { k: 'Cámara frontal', line: 'Voltea el vidrio hacia ti. Tu reflejo llega tarde.', how: 'Muévete y espera.', name: 'Mover tu reflejo', places: ['a la izquierda', 'al centro', 'a la derecha'], you: 'Tú: {p}. Tu reflejo te sigue, tarde.' }
    },
    still: {
      k: 'Quietud',
      line: 'No te muevas. Solo ve lo que se mueve.',
      how: 'Presiona el botón y no te muevas durante seis segundos: ni el mouse, ni las teclas, ni la página.',
      start: 'No me muevo',
      again: 'Otra vez',
      ready: 'Cuando quieras.',
      keep: 'No te muevas.',
      closer: 'Se está acercando.',
      done: 'Llegó cerca y pasó de largo. Nunca te vio.',
      moved: 'Te moviste. Te vio, y ya no está.',
      alt: 'Un baño pequeño de noche, con la luz apagada: un espejo oscuro sobre un lavamanos blanco.'
    },
    trust: 'Las imágenes de la cámara y el micrófono nunca salen de tu teléfono. Sin cuenta. Sin subir nada.',
    warning: 'Un juego de terror: sonidos fuertes repentinos, imágenes que destellan.'
  },

  doors: {
    file: 'ARCHIVO 05 · TRECE PUERTAS',
    title: 'Trece puertas. Trece noches.',
    lead: 'Cada puerta es una noche, siete objetivos y una línea de su nota. Empiezas con la primera línea. El resto sigue a oscuras.',
    hint: 'Pasa el puntero, enfoca o toca una puerta.',
    door: 'Puerta',
    night: 'Noche',
    tonight: 'Abre esta noche · 03:03',
    tonightShort: 'Esta noche',
    dark: 'Sigue a oscuras',
    maker: 'Quien las hizo',
    noteLabel: 'Su nota',
    redacted: 'Esta línea de su nota sigue a oscuras.',
    list: [
      ['I', 'El Laberinto', 'Inclinar'], ['II', 'El Ojo', 'La luz'], ['III', 'El Agua', 'La brújula'], ['IV', 'El Umbral', 'Tocar'],
      ['V', 'El Vidrio', 'Cámara frontal'], ['VI', 'La Escalera', 'Caminar'], ['VII', 'El Silencio', 'Silencio'], ['VIII', 'El Hilo', 'Color'],
      ['IX', 'El Sueño', 'Esconderse'], ['X', 'El Cielo', 'Mirar arriba'], ['XI', 'Los Nombres', 'Las marcas'], ['XII', 'Las Campanas', 'Las campanas'], ['XIII', 'El Creador', '—']
    ],
    notes: { 1: 'Cada habitación esconde un laberinto. Guarda tres brasas. Dale a la puerta sus números en el orden en que el ojo las mira.', 13: 'Detrás de la última puerta está quien las hizo.' }
  },

  join: {
    kicker: 'Deja una dirección',
    title: 'En la web esta noche. Después, el App Store.',
    lead: 'Un correo cuando llegue, y algunos más en el camino.',
    play: 'O juega el prototipo web esta noche',
    label: 'Tu correo',
    placeholder: 'tu@correo.com',
    button: 'Únete a la lista',
    fine: 'Primero, un correo para confirmar que eres tú. Sin spam, y puedes irte de la lista cuando quieras.',
    privacy: 'Privacidad',
    ok: 'Ya casi: revisa tu correo y confirma tu lugar.',
    already: 'Ya estás en la lista. Si todavía no confirmaste, revisa tu correo.',
    bad: 'Ese correo no parece correcto.',
    limit: 'Demasiados intentos por ahora. Vuelve a intentarlo en un rato.',
    fail: 'Algo salió mal. Escríbenos a support@gazum.ai y te sumamos a la lista.',
    sending: 'Enviando…'
  },

  captions: {
    room: '[el siseo de una habitación vacía]',
    ember: '[una brasa quema una línea]',
    door: '[la habitación contiene el aliento]',
    toll: '[una campana, a lo lejos]',
    static: '[estática]',
    breath: '[algo respira del otro lado]',
    knock: '[tocas la puerta]',
    answer: '[algo toca del otro lado]',
    box: '[una caja de música: tres notas, y espera]',
    roll: '[una brasa rueda]',
    dark: '[la oscuridad]',
    shutter: '[un obturador]',
    closer: '[se acerca]',
    gone: '[ya no está]',
    hum: '[la puerta zumba]',
    bell: '[una campana, una vez]',
    rec: '[grabando]'
  },

  footer: {
    by: 'Un juego de',
    tagline: 'Next era gaming',
    fine: 'THRESHOLD está en desarrollo; sus funciones y contenidos pueden cambiar. El prototipo web está en inglés.',
    warn: 'Un juego de terror: sonidos fuertes repentinos, imágenes que destellan.',
    trust: 'Las imágenes de la cámara y el micrófono nunca salen de tu teléfono.',
    rights: '© 2026 GAZUM Corp.',
    privacy: 'Privacidad',
    play: 'Juega el prototipo'
  },

  privacy: {
    title: 'Privacidad',
    updated: 'Última actualización: 15 de octubre de 2026',
    body: [
      'Esta página cubre el sitio web de THRESHOLD y su lista de espera. El juego pide tu cámara, el movimiento de tu teléfono y, en algunas puertas, el micrófono. Las imágenes de la cámara y el sonido se procesan en tu teléfono y nunca salen de él.',
      'Si te unes a la lista de espera, guardamos tu correo y tu idioma para escribirte sobre THRESHOLD: un correo cuando llegue al App Store y algunos más en el camino. Nada más.',
      'Primero te enviamos un correo para confirmar que la dirección es tuya. Una dirección que nunca se confirma se borra en 30 días.',
      'Nunca vendemos tu correo ni lo compartimos con anunciantes. GAZUM Corp. guarda la lista en Amazon Web Services (en Estados Unidos), y los correos salen a través de Resend, nuestro proveedor de correo.',
      'Cada correo después de la confirmación trae un enlace para irte de la lista con un clic, y al irte borramos tu dirección. Para cualquier consulta sobre tus datos, escribe a support@gazum.ai.',
      'Este sitio no usa cookies ni rastreadores. Solo recuerda, en tu propio navegador, si encendiste el sonido.'
    ],
    back: 'Volver a THRESHOLD'
  },

  notFound: {
    title: 'Esta puerta no se abre.',
    text: 'La página que buscas no está aquí. Prueba por donde entraste.',
    back: 'Volver a THRESHOLD'
  },

  play: {
    title: 'Abriendo la puerta…',
    text: 'El prototipo web de THRESHOLD (en inglés). Mejor en un teléfono, de noche, a solas y con sonido.',
    go: 'Abrir el prototipo'
  }
};
