/*! Lannita Codes · https://lannitacodes.tumblr.com/ · librería de skins para Foroactivo (Forja 0.2.1) · módulos: preferencias, estado, grupos, listas, campos, numeros, titulos, pestanas, desplegables, usuario, tablon, tooltips, copiar, borrador, editor, anclas, toolbar, ultimos, pie, portadas, afiliados, insignias, reinos, conectados, cuentagrupos, vigilar, cabeceras, ficha, barraeditor, cabeceraforo, masmenu, personalizar, insertar, ventanas, perfil, busqueda */
/* =============================================================================
 * Forja · núcleo de la librería (window.FORJA)
 * -----------------------------------------------------------------------------
 * Utilidades para skins y scripts de Foroactivo. Sin dependencias (jQuery 1.7
 * de Foroactivo NO se usa). Funciona en cualquier skin, no solo en las de Forja.
 *
 * Configuración: define window.FORJA_CONFIG antes de cargar la librería, o
 * llama a FORJA.configurar({...}) después. Ver docs/libreria.md.
 * ========================================================================== */
(function (w, d) {
  'use strict';
  if (w.FORJA && w.FORJA.version) return;

  var modulos = [];
  var DEFECTO = {
    skin: (d.documentElement.getAttribute('data-fj-skin') || 'forja'),
    modulos: null,            // null = todos los registrados; o lista de nombres
    pausa: 300,               // ms entre peticiones encadenadas a otras páginas
    cacheMinutos: 10,         // caché de páginas traídas (sessionStorage)
    modos: ['oscuro', 'claro'],
    modoInicial: null,        // null = el del <html data-fj-mode>; 'sistema' = prefers-color-scheme
    temas: [],                // subtemas disponibles (data-fj-theme)
    tamanos: [0.9, 1, 1.07, 1.14],
    staff: [],                // [{ id, nombre, rol, color, avatar }]
    selectorAvatarPerfil: '#profile-advanced-right .module img, #profile-advanced-right img, .profile-avatar img, dl.left-box dt img',
    tooltips: '[data-fj-tip]',
    depurar: false
  };

  var F = {
    version: '0.2.1',
    config: {},
    _modulos: modulos
  };

  function mezclar(destino, origen) {
    for (var k in origen) if (Object.prototype.hasOwnProperty.call(origen, k)) destino[k] = origen[k];
    return destino;
  }
  F.configurar = function (obj) { mezclar(F.config, obj || {}); return F.config; };
  F.configurar(DEFECTO);
  if (w.FORJA_CONFIG) F.configurar(w.FORJA_CONFIG);

  F.log = function () { if (F.config.depurar && w.console) console.log.apply(console, ['[forja]'].concat([].slice.call(arguments))); };

  /* --- Listo (DOM) ------------------------------------------------------- */
  F.listo = function (fn) {
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', fn);
    else fn();
  };

  /* --- Selección ---------------------------------------------------------- */
  F.$ = function (sel, raiz) { return (raiz || d).querySelector(sel); };
  F.$$ = function (sel, raiz) { return [].slice.call((raiz || d).querySelectorAll(sel)); };

  /* --- Texto ---------------------------------------------------------------- */
  F.slug = function (s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  };

  /* --- Página actual -------------------------------------------------------- */
  F.pagina = (function () {
    var p = w.location.pathname, m;
    var r = { ruta: p, tipo: 'otra', id: null };
    if (p === '/' || p === '/forum' || p === '/index.htm' || p === '/index.php') r.tipo = 'indice';
    else if ((m = p.match(/^\/f(\d+)/))) { r.tipo = 'foro'; r.id = +m[1]; }
    else if ((m = p.match(/^\/t(\d+)/))) { r.tipo = 'tema'; r.id = +m[1]; }
    else if ((m = p.match(/^\/u(\d+)/))) { r.tipo = 'perfil'; r.id = +m[1]; }
    else if ((m = p.match(/^\/g(\d+)/))) { r.tipo = 'grupo'; r.id = +m[1]; }
    else if ((m = p.match(/^\/h(\d+)/))) { r.tipo = 'html'; r.id = +m[1]; }
    else if (/^\/post/.test(p)) r.tipo = 'publicar';
    else if (/^\/privmsg/.test(p)) r.tipo = 'mp';
    else if (/^\/memberlist/.test(p)) r.tipo = 'miembros';
    else if (/^\/groups/.test(p)) r.tipo = 'grupos';
    else if (/^\/search/.test(p)) r.tipo = 'buscar';
    else if (/^\/portal/.test(p)) r.tipo = 'portal';
    else if (/^\/profile/.test(p)) r.tipo = 'editar-perfil';
    else if (/^\/(login|register)/.test(p)) r.tipo = 'acceso';
    var forzada = d.documentElement.getAttribute('data-fj-pagina'); // para vistas previas y páginas HTML
    if (forzada) r.tipo = forzada;
    return r;
  })();

  /* --- Usuario actual (de _userdata) ---------------------------------------- */
  F.usuario = (function () {
    var u = w._userdata || {};
    return {
      conectado: u.session_logged_in === 1 || u.session_logged_in === '1',
      id: +u.user_id || -1,
      nombre: u.username || '',
      nivel: +u.user_level || 0,          // 1 = admin, 2 = moderador
      avatar: u.avatar_link || '',
      avatarHtml: u.avatar || '',
      color: u.groupcolor ? '#' + String(u.groupcolor).replace('#', '') : '',
      mensajes: +u.user_posts || 0,
      mp: +u.user_nb_privmsg || 0,
      toolbar: u.activate_toolbar === 1 || u.activate_toolbar === '1',
      toolbarFija: u.fix_toolbar === 1 || u.fix_toolbar === '1'
    };
  })();

  /* --- Almacenamiento local seguro ------------------------------------------- */
  function clave(k) { return 'fj:' + F.config.skin + ':' + k; }
  F.guardar = function (k, v) { try { w.localStorage.setItem(clave(k), JSON.stringify(v)); } catch (e) { /* navegación privada */ } };
  F.leer = function (k, defecto) {
    try { var v = w.localStorage.getItem(clave(k)); return v === null ? defecto : JSON.parse(v); } catch (e) { return defecto; }
  };

  /* --- Traer otras páginas del foro (cola + caché) ---------------------------- */
  var cola = Promise.resolve();
  F.traer = function (url, opciones) {
    opciones = opciones || {};
    var minutos = opciones.cacheMinutos != null ? opciones.cacheMinutos : F.config.cacheMinutos;
    var kc = 'fj:pag:' + url;
    if (minutos > 0) {
      try {
        var c = JSON.parse(w.sessionStorage.getItem(kc) || 'null');
        if (c && Date.now() - c.t < minutos * 60000) return Promise.resolve(new DOMParser().parseFromString(c.h, 'text/html'));
      } catch (e) { /* sin caché */ }
    }
    var p = cola.then(function () {
      return fetch(url, { credentials: 'same-origin' }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' en ' + url);
        return r.text();
      }).then(function (html) {
        if (minutos > 0) { try { w.sessionStorage.setItem(kc, JSON.stringify({ t: Date.now(), h: html })); } catch (e) { /* lleno */ } }
        return new DOMParser().parseFromString(html, 'text/html');
      });
    });
    cola = p.catch(function () {}).then(function () { return new Promise(function (ok) { setTimeout(ok, F.config.pausa); }); });
    return p;
  };

  /* --- Color: lee el color de grupo de un nombre de usuario ------------------ */
  F.colorDe = function (el) {
    if (!el) return '';
    var con = el.matches && el.matches('[style*="color"]') ? el : el.querySelector('[style*="color"]');
    if (!con) return '';
    var m = con.getAttribute('style').match(/color\s*:\s*([^;]+)/i);
    return m ? m[1].trim() : '';
  };

  F.vars = function (el, obj) { for (var k in obj) el.style.setProperty(k, obj[k]); };

  /* --- Módulos ---------------------------------------------------------------- */
  F.modulo = function (nombre, fn) { modulos.push({ nombre: nombre, fn: fn }); };
  F.arrancar = function () {
    var activos = F.config.modulos;
    modulos.forEach(function (m) {
      if (activos && activos.indexOf(m.nombre) === -1) return;
      try { m.fn(F); F.log('módulo', m.nombre); }
      catch (e) { if (w.console) console.warn('[forja] el módulo ' + m.nombre + ' falló:', e); }
    });
    d.documentElement.classList.add('fj-listo');
  };

  w.FORJA = F;
})(window, document);

/* preferencias · modo claro/oscuro, subtemas y tamaño de texto, recordados en el navegador.
 * Botones (en cualquier sitio de la página):
 *   [data-fj-mode-toggle]        alterna entre los dos modos de config.modos
 *   [data-fj-mode-set="claro"]   fija un modo
 *   [data-fj-theme-set="nieve"]  aplica un subtema ("" para volver al tema base)
 *   [data-fj-font="1" | "-1" | "0"]  sube, baja o restablece el tamaño de texto
 * El HTML lleva data-fj-mode y data-fj-theme; el CSS de la skin reacciona a ellos. */
FORJA.modulo('preferencias', function (F) {
  var html = document.documentElement;
  var modos = F.config.modos || [];
  if (modos.length > 1) html.setAttribute('data-fj-modes', String(modos.length));

  function ponerModo(m, guardar) {
    if (modos.indexOf(m) === -1) return;
    html.setAttribute('data-fj-mode', m);
    if (guardar) F.guardar('modo', m);
  }
  function ponerTema(t, guardar) {
    if (t) html.setAttribute('data-fj-theme', t); else html.removeAttribute('data-fj-theme');
    if (guardar) F.guardar('tema', t || '');
  }
  function ponerTamano(i, guardar) {
    var t = F.config.tamanos;
    i = Math.max(0, Math.min(t.length - 1, i));
    html.style.setProperty('--fj-font-factor', t[i]);
    html.setAttribute('data-fj-font', String(i));
    if (guardar) F.guardar('tamano', i);
  }

  // Estado inicial (el fragmento del <head> ya lo aplicó para evitar parpadeo; aquí se asegura).
  var guardado = F.leer('modo', null);
  if (guardado) ponerModo(guardado);
  else if (F.config.modoInicial === 'sistema' && window.matchMedia) {
    ponerModo(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro');
  }
  var tema = F.leer('tema', '');
  if (tema && F.config.temas.indexOf(tema) !== -1) ponerTema(tema);
  var base = F.config.tamanos.indexOf(1);
  ponerTamano(F.leer('tamano', base === -1 ? 0 : base));

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-fj-mode-toggle],[data-fj-mode-set],[data-fj-theme-set],[data-fj-font]');
    if (!b) return;
    if (b.hasAttribute('data-fj-mode-toggle')) {
      var actual = html.getAttribute('data-fj-mode');
      ponerModo(modos[(modos.indexOf(actual) + 1) % modos.length], true);
    } else if (b.hasAttribute('data-fj-mode-set')) {
      ponerModo(b.getAttribute('data-fj-mode-set'), true);
    } else if (b.hasAttribute('data-fj-theme-set')) {
      ponerTema(b.getAttribute('data-fj-theme-set'), true);
    } else {
      var paso = +b.getAttribute('data-fj-font');
      var i = +html.getAttribute('data-fj-font') || 0;
      ponerTamano(paso === 0 ? base : i + paso, true);
    }
  });

  F.modo = function (m) { if (m) ponerModo(m, true); return html.getAttribute('data-fj-mode'); };
  F.tema = function (t) { if (t !== undefined) ponerTema(t, true); return html.getAttribute('data-fj-theme') || ''; };
});

/* estado · clases en <body> para que el CSS reaccione sin más JavaScript:
 *   fj-pagina--indice | foro | tema | perfil | publicar | mp | miembros | html…
 *   fj-conectado / fj-invitado, fj-admin, fj-moderador, fj-mp-nuevo, fj-con-toolbar
 * y el color de grupo del usuario conectado como --fj-user-color en <html>. */
FORJA.modulo('estado', function (F) {
  var b = document.body, u = F.usuario, c = b.classList;
  c.add('fj-pagina--' + F.pagina.tipo);
  c.add(u.conectado ? 'fj-conectado' : 'fj-invitado');
  if (u.nivel === 1) c.add('fj-admin');
  if (u.nivel === 2) c.add('fj-moderador');
  if (u.mp > 0 || document.querySelector('.new-message, .toread-message')) c.add('fj-mp-nuevo');
  if (u.toolbar && u.toolbarFija) c.add('fj-con-toolbar');
  if (u.color) document.documentElement.style.setProperty('--fj-user-color', u.color);
});

/* grupos · color de grupo por mensaje.
 * Lee el color del nombre del autor (Foroactivo lo pone en style="color:…") y lo
 * deja en --fj-group sobre el mensaje, para que avatar, bordes, negritas o la
 * selección de texto se pinten con él. Sirve para [data-fj-post] y .post. */
FORJA.modulo('grupos', function (F) {
  F.$$('[data-fj-post], .post').forEach(function (post) {
    if (post.style.getPropertyValue('--fj-group')) return;
    var nombre = post.querySelector('.fj-author__name, .postprofile dt strong, .postprofile .username, .author');
    var color = F.colorDe(nombre);
    if (!color) return;
    F.vars(post, { '--fj-group': color });
    post.setAttribute('data-fj-color', color);
  });

  // Listas de personajes (miembros, grupos, MP, búsqueda): cada fila toma el color del grupo de su usuario
  F.$$('table.table1 tbody tr, #memberlist tr, table.forumline tr, ul.topiclist li.row').forEach(function (fila) {
    if (fila.hasAttribute('data-fj-fila')) return;
    var color = F.colorDe(fila.querySelector('a[href^="/u"]'));
    if (!color) return;
    F.vars(fila, { '--fj-group': color });
    fila.setAttribute('data-fj-fila', '');
  });

  // Perfil público: el color del grupo del usuario visitado tiñe sus módulos
  if (F.pagina.tipo === 'perfil') {
    var nombre = document.querySelector('#profile-advanced-right .module-title, h1, .h3');
    var c = F.colorDe(nombre) || F.colorDe(document.querySelector('#profile-advanced-right'));
    if (c) F.vars(document.body, { '--fj-group': c });
  }
});


/* listas · foros y temas del índice y de los subforos.
 * - Estado de lectura: convierte el icono de Foroactivo (FORUM_FOLDER_IMG / TOPIC_FOLDER_IMG)
 *   en clases is-nuevo, is-cerrado, is-fijo, is-anuncio.
 * - Datos por foro desde su descripción (panel > Foros), sin tocar plantillas:
 *     <span data-fj-img="https://…"></span>     imagen del foro → --fj-forum-img
 *     <span data-fj-color="#9c3232"></span>     color propio      → --fj-forum-color
 *     <span data-fj-icono="espada"></span>      icono de Forja    → data-fj-icono en el foro
 *     <span data-fj-enlace="/h1-guia"></span>   «falso subforo»: el foro lleva a esa dirección
 *     <span data-fj-tipo="rol"></span>          tipo de foro: rol (tarjeta grande con imagen),
 *                                               info (ficha pequeña) o nada (la variante normal)
 *     <span data-fj-lugar="El Norte"></span>     antetítulo de las tarjetas de rol
 *   (los iconos que se usen así hay que añadirlos a "iconos_extra" en skin.json)
 * - Lo mismo sin tocar descripciones, desde FORJA_CONFIG.foros, por número de foro:
 *     foros: { "7": { tipo: "rol", img: "https://…", lugar: "El Norte" }, "1": { tipo: "info" } } */
FORJA.modulo('listas', function (F) {
  function estado(el, img) {
    if (!img) return;
    var s = (img.getAttribute('src') || '').toLowerCase();
    if (/unread|new|nuevo/.test(s)) el.classList.add('is-nuevo');
    if (/lock|locked|closed/.test(s)) el.classList.add('is-cerrado');
    if (/sticky/.test(s)) el.classList.add('is-fijo');
    if (/announce/.test(s)) el.classList.add('is-anuncio');
  }

  var porForo = F.config.foros || {};
  function dato(desc, attr) { var el = desc.querySelector('[' + attr + ']'); return el ? el.getAttribute(attr) : ''; }

  F.$$('[data-fj-forum]').forEach(function (foro) {
    estado(foro, foro.querySelector('.fj-forum__state'));
    var desc = foro.querySelector('.fj-forum__desc');
    if (!desc) return;
    var enl = foro.querySelector('a.forumtitle');
    var num = enl && (enl.getAttribute('href') || '').match(/\/f(\d+)-/);
    var conf = (num && (porForo[num[1]] || porForo['f' + num[1]])) || {};
    var url = dato(desc, 'data-fj-img') || conf.img;
    if (url) {
      F.vars(foro, { '--fj-forum-img': 'url("' + url.replace(/"/g, '%22') + '")' });
      foro.classList.add('tiene-imagen');
    }
    var tipo = dato(desc, 'data-fj-tipo') || conf.tipo;
    if (tipo) {
      foro.setAttribute('data-fj-tipo', tipo);
      var titulo = foro.querySelector('.fj-forum__title');
      if (tipo === 'rol' && titulo && !foro.querySelector('.fj-forum__rotulo')) {
        // Rótulo sobre la imagen: antetítulo (lugar) + nombre del foro
        var rotulo = document.createElement('div');
        rotulo.className = 'fj-forum__rotulo';
        var lugar = dato(desc, 'data-fj-lugar') || conf.lugar;
        if (lugar) { var l = document.createElement('span'); l.className = 'fj-forum__lugar'; l.textContent = lugar; rotulo.appendChild(l); }
        titulo.parentNode.insertBefore(rotulo, titulo);
        rotulo.appendChild(titulo);
      }
    }
    var col = desc.querySelector('[data-fj-color]');
    if (col) F.vars(foro, { '--fj-forum-color': col.getAttribute('data-fj-color') });
    var ico = desc.querySelector('[data-fj-icono]');
    if (ico) foro.setAttribute('data-fj-icono', ico.getAttribute('data-fj-icono'));
    // Hueco para icono o inicial (variantes como foro/medallon)
    var hueco = foro.querySelector('.fj-forum__icono');
    if (hueco) {
      // Icono de Lannita Icons en la descripción: <span class="li li-crown"></span>
      var lan = desc.querySelector('.li[class*="li-"]');
      if (ico) { hueco.classList.add('fj-ico'); hueco.setAttribute('data-fj-ico', ico.getAttribute('data-fj-icono')); }
      else if (lan) {
        lan.classList.forEach(function (c) { if (c === 'li' || c.indexOf('li-') === 0) hueco.classList.add(c); });
      }
      else {
        var t = foro.querySelector('.forumtitle');
        hueco.setAttribute('data-fj-inicial', t ? t.textContent.trim().charAt(0).toUpperCase() : '');
      }
    }
    // «Falso subforo»: <span data-fj-enlace="/h1-guia"></span> hace que el foro lleve a otra página
    // (una guía en página HTML, un tema concreto…). El foro real puede quedarse vacío y cerrado.
    var enlace = desc.querySelector('[data-fj-enlace]');
    if (enlace) {
      var destino = enlace.getAttribute('data-fj-enlace');
      foro.classList.add('es-enlace');
      F.$$('a.forumtitle, a.fj-forum__cover', foro).forEach(function (a) { a.setAttribute('href', destino); });
    }
    if (!desc.textContent.trim() && !desc.querySelector('img')) desc.classList.add('is-vacia');
    // El icono «ver el último mensaje» va oculto: el título del último tema lleva directamente a ese mensaje
    var iconoF = foro.querySelector('.fj-forum__lastuser a img'), ultTema = foro.querySelector('.fj-forum__lasttopic');
    if (iconoF && ultTema) ultTema.setAttribute('href', iconoF.parentNode.getAttribute('href'));
  });

  // Columna del último mensaje: con etiqueta y, si nadie ha respondido, sin repetir el autor (ya sale a la izquierda)
  var txtResp = F.config.textoUltimaRespuesta || 'Última respuesta', txtAbierto = F.config.textoAbierto || 'Abierto';
  F.$$('[data-fj-topic]').forEach(function (tema) {
    estado(tema, tema.querySelector('.fj-topic__state'));
    var info = tema.querySelector('.fj-topic__lastinfo'), dd = tema.querySelector('.fj-topic__counts dd');
    if (!info) return;
    // El icono «ver el último mensaje» va oculto: la fecha pasa a ser el enlace a ese mensaje
    var icono = info.querySelector('a img'), fecha = info.lastElementChild;
    if (icono && fecha && fecha !== icono.parentNode.parentNode && !fecha.querySelector('a')) {
      var l = document.createElement('a');
      l.className = 'fj-topic__lastlink';
      l.href = icono.parentNode.getAttribute('href');
      l.title = icono.getAttribute('title') || '';
      l.textContent = fecha.textContent.trim();
      fecha.textContent = '';
      fecha.appendChild(l);
    }
    if (!dd) return;
    var resp = parseInt(dd.textContent.replace(/\D/g, ''), 10);
    if (isNaN(resp)) return;
    info.setAttribute('data-fj-etiqueta', resp ? txtResp : txtAbierto);
    if (!resp) info.classList.add('sin-respuestas');
  });
});

/* campos · etiqueta los campos de perfil de cada mensaje para poder estilarlos uno a uno.
 * Cada .fj-field recibe data-fj-campo="<nombre-en-slug>" y el mensaje recibe
 * data-campo-<slug>="valor". Ejemplos de CSS:
 *   .fj-field[data-fj-campo="dragones"] { … }
 *   .post[data-campo-reino="norte"] { --fj-group: … } */
FORJA.modulo('campos', function (F) {
  F.$$('[data-fj-post] .fj-field, .post .fj-field').forEach(function (campo) {
    var et = campo.querySelector('.label');
    if (!et) return;
    var nombre = F.slug(et.textContent.replace(/:\s*$/, ''));
    if (!nombre) return;
    campo.setAttribute('data-fj-campo', nombre);
    var valor = campo.querySelector('.fj-field__value');
    var post = campo.closest('[data-fj-post], .post');
    if (post && valor) post.setAttribute('data-campo-' + nombre, F.slug(valor.textContent));
  });
});

/* numeros · aísla la primera cifra de un texto para destacarla.
 * <p data-fj-numero>Nuestros miembros han publicado un total de 26115 mensajes</p>
 *   → <p><span class="fj-num">26.115</span> Nuestros miembros han publicado… mensajes</p>
 * data-fj-restar="1" resta 1 a la cifra (Foroactivo cuenta al admin como miembro). */
FORJA.modulo('numeros', function (F) {
  F.$$('[data-fj-numero]').forEach(function (el) {
    if (el.querySelector('.fj-num')) return;
    var restar = parseInt(el.getAttribute('data-fj-restar') || '0', 10) || 0;
    var recorrer = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var nodo;
    while ((nodo = recorrer.nextNode())) {
      var m = nodo.nodeValue.match(/\d[\d.,]*/);
      if (!m) continue;
      var n = parseInt(m[0].replace(/[.,]/g, ''), 10);
      if (!isNaN(n) && restar) n = Math.max(0, n - restar);
      var span = document.createElement('span');
      span.className = 'fj-num';
      span.textContent = isNaN(n) ? m[0] : n.toLocaleString('es-ES');
      nodo.nodeValue = nodo.nodeValue.replace(m[0], '').replace(/\s{2,}/g, ' ');
      el.insertBefore(span, el.firstChild);
      break;
    }
  });
});

/* titulos · títulos de exhibición desde el nombre de la categoría o del foro, sin tocar plantillas.
 * <h2 data-fj-titulo>Antetítulo // Título con *palabra*</h2>
 *   → <h2><span class="fj-titulo__ante">Antetítulo</span>Título con <em class="fj-titulo__enfasis">palabra</em></h2>
 * - « // » separa el antetítulo (opcional).
 * - *entre asteriscos* marca la parte en segundo estilo. Sin asteriscos, va la última palabra
 *   (si el título tiene más de una). Con data-fj-titulo="sin-enfasis" no se marca nada automático.
 * - En el resto de sitios donde Foroactivo repite el nombre (migas, selector «Saltar a», título de
 *   la pestaña, enlaces de la cabecera del tema) se quita la sintaxis: «La corte». */
FORJA.modulo('titulos', function (F) {
  function texto(padre, t) { if (t) padre.appendChild(document.createTextNode(t)); }
  F.$$('[data-fj-titulo]').forEach(function (el) {
    if (el.querySelector('.fj-titulo__enfasis, .fj-titulo__ante')) return;
    // Solo títulos de texto plano (con o sin un enlace que lo envuelva)
    // Foroactivo envuelve el nombre de la categoría en su propio <h2> (y a veces en un enlace)
    var destino = el;
    while (destino.children.length === 1 && /^(A|H2|H3|SPAN)$/.test(destino.firstElementChild.tagName)) destino = destino.firstElementChild;
    if (destino.children.length) return;
    var crudo = destino.textContent.replace(/\s+/g, ' ').trim();
    if (!crudo) return;
    var ante = '', titulo = crudo, corte = crudo.indexOf(' // ');
    if (corte > -1) { ante = crudo.slice(0, corte).trim(); titulo = crudo.slice(corte + 4).trim(); }

    var trozos = titulo.split(/\*([^*]+)\*/);
    if (trozos.length === 1 && el.getAttribute('data-fj-titulo') !== 'sin-enfasis') {
      var i = titulo.lastIndexOf(' ');
      trozos = i > 0 ? [titulo.slice(0, i + 1), titulo.slice(i + 1), ''] : [titulo];
    }
    destino.textContent = '';
    if (ante) {
      var a = document.createElement('span');
      a.className = 'fj-titulo__ante';
      a.textContent = ante;
      destino.appendChild(a);
    }
    trozos.forEach(function (t, n) {
      if (n % 2 === 0) return texto(destino, t);
      var em = document.createElement('em');
      em.className = 'fj-titulo__enfasis';
      em.textContent = t;
      destino.appendChild(em);
    });
    el.setAttribute('aria-label', (ante ? ante + ': ' : '') + titulo.replace(/\*/g, ''));
    el.classList.add('fj-titulo');
  });

  // Limpieza: «Antetítulo // Título *x*» → «Título x» fuera de los títulos de exhibición
  var SINTAXIS = /\s\/\/\s|\*[^*]+\*/;
  function limpiar(t) {
    var i = t.indexOf(' // ');
    if (i > -1) t = t.slice(i + 4);
    return t.replace(/\*([^*]+)\*/g, '$1');
  }
  // Se trabaja sobre los nodos de texto (las migas meten el nombre en un <span>) y se repite al
  // cargar la página, porque Foroactivo rellena el selector «Saltar a» más tarde.
  function limpiarTodo() {
    F.$$('.fj-crumbs, .fj-topichead__nav, a.nav, select, a.forumtitle, a.topictitle, .fj-forum__sub').forEach(function (raiz) {
      if (raiz.closest('[data-fj-titulo]')) return;
      var w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT), n;
      while ((n = w.nextNode())) if (SINTAXIS.test(n.nodeValue)) n.nodeValue = limpiar(n.nodeValue);
    });
    if (SINTAXIS.test(document.title)) document.title = limpiar(document.title);
  }
  limpiarTodo();
  window.addEventListener('load', limpiarTodo);
  setTimeout(limpiarTodo, 1500);
});

/* pestanas · pestañas accesibles para tablones, baúles, fichas… también dentro de mensajes.
 * <div data-fj-tabs>
 *   <button data-fj-tab="a">Uno</button> <button data-fj-tab="b">Dos</button>
 *   <div data-fj-panel="a">…</div> <div data-fj-panel="b">…</div>
 * </div>
 * La primera pestaña se abre sola. Con data-fj-tabs="nombre" se recuerda la última abierta.
 * Funciona en contenido cargado después: escucha clics en todo el documento. */
FORJA.modulo('pestanas', function (F) {
  function grupoDe(el) { return el.closest('[data-fj-tabs]'); }
  function propios(grupo, sel) { return F.$$(sel, grupo).filter(function (x) { return grupoDe(x) === grupo; }); }

  function abrir(grupo, id, guardar) {
    var tabs = propios(grupo, '[data-fj-tab]');
    var panels = propios(grupo, '[data-fj-panel]');
    if (!tabs.some(function (t) { return t.getAttribute('data-fj-tab') === id; })) id = tabs[0] && tabs[0].getAttribute('data-fj-tab');
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-fj-tab') === id;
      t.setAttribute('role', 'tab');
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.setAttribute('tabindex', on ? '0' : '-1');
      t.classList.toggle('is-activa', on);
    });
    panels.forEach(function (p) {
      var on = p.getAttribute('data-fj-panel') === id;
      p.setAttribute('role', 'tabpanel');
      p.hidden = !on;
      p.classList.toggle('is-activa', on);
    });
    var nombre = grupo.getAttribute('data-fj-tabs');
    if (guardar && nombre) F.guardar('tab:' + nombre, id);
  }

  function preparar(raiz) {
    F.$$('[data-fj-tabs]', raiz).forEach(function (g) {
      if (g.__fjTabs) return;
      g.__fjTabs = true;
      var nombre = g.getAttribute('data-fj-tabs');
      var marcada = propios(g, '[data-fj-tab][aria-selected="true"]')[0];
      abrir(g, (nombre && F.leer('tab:' + nombre, null)) || (marcada && marcada.getAttribute('data-fj-tab')));
    });
  }
  preparar(document);
  F.pestanas = preparar;

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-fj-tab]');
    if (!t || !grupoDe(t)) return;
    e.preventDefault();
    abrir(grupoDe(t), t.getAttribute('data-fj-tab'), true);
  });
  document.addEventListener('keydown', function (e) {
    var t = e.target.closest && e.target.closest('[data-fj-tab]');
    if (!t || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
    var g = grupoDe(t), tabs = propios(g, '[data-fj-tab]'), i = tabs.indexOf(t);
    var sig = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    abrir(g, sig.getAttribute('data-fj-tab'), true);
    sig.focus();
  });
});

/* desplegables · un botón que abre y cierra otro elemento.
 * <button data-fj-toggle="id-del-objetivo">…</button>  → alterna .is-open en #id-del-objetivo
 * Escape cierra todos; un clic fuera también. */
FORJA.modulo('desplegables', function (F) {
  function botones(id) { return F.$$('[data-fj-toggle="' + id + '"]'); }
  function poner(id, abierto) {
    var obj = document.getElementById(id);
    if (!obj) return;
    obj.classList.toggle('is-open', abierto);
    botones(id).forEach(function (b) { b.setAttribute('aria-expanded', abierto ? 'true' : 'false'); });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-fj-toggle]');
    if (b) {
      var id = b.getAttribute('data-fj-toggle');
      var obj = document.getElementById(id);
      poner(id, !(obj && obj.classList.contains('is-open')));
      return;
    }
    F.$$('[data-fj-toggle]').forEach(function (bt) {
      var id = bt.getAttribute('data-fj-toggle'), obj = document.getElementById(id);
      if (obj && obj.classList.contains('is-open') && !obj.contains(e.target)) poner(id, false);
    });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    F.$$('[data-fj-toggle]').forEach(function (b) { poner(b.getAttribute('data-fj-toggle'), false); });
  });
});

/* usuario · tarjeta del usuario conectado en cualquier [data-fj-user-card] y saludo en [data-fj-saludo].
 * Conectado: avatar, nombre con su color y enlaces a perfil y mensajes.
 * Invitado: enlaces a conectarse y registrarse. */
FORJA.modulo('usuario', function (F) {
  var u = F.usuario;
  // Saludo: <p data-fj-saludo>Bienvenido/a</p> → «Bienvenido/a, <em>Nombre</em>» (invitado: config.textoInvitado)
  F.$$('[data-fj-saludo]').forEach(function (el) {
    var base = el.textContent.trim() || 'Bienvenido/a';
    var nombre = u.conectado ? u.nombre : (F.config.textoInvitado || 'viajero');
    el.textContent = base + ', ';
    var em = document.createElement('em'); em.textContent = nombre; el.appendChild(em);
  });
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  F.$$('[data-fj-user-card]').forEach(function (caja) {
    if (u.conectado) {
      caja.innerHTML =
        (u.avatar ? '<a href="/u' + u.id + '"><img src="' + esc(u.avatar) + '" alt=""></a>' : '') +
        '<div><strong' + (u.color ? ' style="color:' + esc(u.color) + '"' : '') + '>' + esc(u.nombre) + '</strong>' +
        '<small><a href="/profile?mode=editprofile">Perfil</a> · <a href="/privmsg?folder=inbox">Mensajes' + (u.mp ? ' (' + u.mp + ')' : '') + '</a></small></div>';
    } else {
      caja.innerHTML = '<div><small><a href="/login">Conectarse</a> · <a href="/register">Registrarse</a></small></div>';
    }
  });
});

/* tablon · rellena el tablón sin tocar plantillas.
 *
 * Staff: <div data-fj-staff></div> + FORJA.configurar({ staff: [
 *          { id: 1, nombre: 'Win or Die', rol: 'Admin', color: '#2E879C', avatar: 'https://…' },
 *          { id: 6, rol: 'Moderación' }            // sin avatar ni nombre: se leen del perfil
 *        ]})
 *   El número de tarjetas se adapta solo a la cantidad de staffers.
 *
 * Novedades: <div data-fj-feed="/t12-novedades"></div>
 *   Copia el contenido del PRIMER mensaje de ese tema. El staff edita ese mensaje y el
 *   tablón cambia (con la caché de config.cacheMinutos).
 *   Con data-fj-feed="ultimos" muestra los últimos temas (módulo ultimos).
 *
 * Periodo activo de rol: <div data-fj-periodo></div> + FORJA.configurar({ periodo: {
 *          nombre: 'Primavera', rol: 'Año 260 de la Corona', icono: 'rosa', enlace: '/t5-ambientacion',
 *          datos: [{ etiqueta: 'Trama', texto: 'El Torneo de la Rosa' }, { etiqueta: 'Clima', texto: '…' }],
 *          inicio: '2026-10-15', fin: '2026-12-15'     // fechas reales: barra de progreso y plazo
 *        }})
 *   Sin periodo configurado, el bloque [data-fj-periodo-bloque] se oculta. */
FORJA.modulo('tablon', function (F) {
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  F.$$('[data-fj-staff]').forEach(function (caja) {
    var lista = F.config.staff || [];
    if (!lista.length) return;
    caja.innerHTML = '';
    caja.style.setProperty('--fj-staff-count', lista.length);
    lista.forEach(function (s) {
      // Cada miembro: su ficha (lleva al perfil) y, al lado, un botón de MP. Las variantes que no lo
      // muestran (pila, rejilla) dejan el envoltorio en display: contents y ocultan el botón.
      var item = document.createElement('div');
      item.className = 'fj-staff__item';
      var a = document.createElement('a');
      a.className = 'fj-staff__card';
      a.href = '/u' + s.id;
      if (s.color) item.style.setProperty('--fj-staff-color', s.color);
      a.innerHTML = '<img alt="" loading="lazy" src="' + esc(s.avatar || '') + '"' + (s.avatar ? '' : ' hidden') + '>' +
        '<span class="fj-staff__name">' + esc(s.nombre || '…') + '</span>' +
        (s.rol ? '<span class="fj-staff__role">' + esc(s.rol) + '</span>' : '');
      var mp = document.createElement('a');
      mp.className = 'fj-staff__mp';
      mp.href = '/privmsg?mode=post&u=' + s.id;
      var rotular = function (n) { var t = (F.config.textoMpStaff || 'Escribir a') + ' ' + (n || 'staff'); mp.setAttribute('aria-label', t); mp.setAttribute('data-fj-tip', t); };
      rotular(s.nombre);
      mp.innerHTML = '<span class="fj-ico" data-fj-ico="mensaje-nuevo"></span>';
      item.appendChild(a); item.appendChild(mp);
      caja.appendChild(item);
      if (s.avatar && s.nombre && s.color) return;
      F.traer('/u' + s.id).then(function (doc) {
        var img = doc.querySelector(F.config.selectorAvatarPerfil);
        var im = a.querySelector('img');
        if (!s.avatar && img) { im.src = img.getAttribute('src'); im.hidden = false; }
        if (!s.nombre) {
          var t = doc.querySelector('h1 .usr_grp_clr, h1 span[style], h1') || doc.querySelector('title');
          var nombre = t ? t.textContent.replace(/^.*(::|\s-\s)\s*/, '').trim() : '';
          a.querySelector('.fj-staff__name').textContent = nombre;
          rotular(nombre);
          if (!s.color) { var col = F.colorDe(doc.querySelector('h1')); if (col) item.style.setProperty('--fj-staff-color', col); }
        }
      }).catch(function (e) { F.log('staff', e); });
    });
  });

  // Enlace «Escribir al staff»: MP a la primera persona del staff. Si la variante ya pone un botón de MP
  // en cada ficha (fichas), el CSS lo oculta y queda solo como respaldo sin JS.
  F.$$('[data-fj-staff-contacto]').forEach(function (a) {
    var lista = F.config.staff || [];
    if (lista.length) a.href = '/privmsg?mode=post&u=' + lista[0].id;
  });

  F.$$('[data-fj-periodo]').forEach(function (caja) {
    var p = F.config.periodo, bloque = caja.closest('[data-fj-periodo-bloque]') || caja;
    if (!p || !p.nombre) { bloque.hidden = true; return; }
    var h = '<div class="fj-periodo__cabeza">' + (p.icono ? '<span class="fj-ico" data-fj-ico="' + esc(p.icono) + '"></span>' : '') +
      '<div>' + (p.enlace ? '<a class="fj-periodo__nombre" href="' + esc(p.enlace) + '">' + esc(p.nombre) + '</a>' : '<strong class="fj-periodo__nombre">' + esc(p.nombre) + '</strong>') +
      (p.rol ? '<span class="fj-periodo__rol">' + esc(p.rol) + '</span>' : '') + '</div></div>';
    if (p.datos && p.datos.length) {
      h += '<dl class="fj-periodo__datos">' + p.datos.map(function (d) { return '<dt>' + esc(d.etiqueta) + '</dt><dd>' + esc(d.texto) + '</dd>'; }).join('') + '</dl>';
    }
    var ini = p.inicio ? new Date(p.inicio + 'T00:00:00') : null, fin = p.fin ? new Date(p.fin + 'T23:59:59') : null;
    if (fin && !isNaN(fin)) {
      var ahora = Date.now(), dias = Math.ceil((fin - ahora) / 86400000);
      var pc = ini && !isNaN(ini) ? Math.max(0, Math.min(100, (ahora - ini) / (fin - ini) * 100)) : null;
      var fecha = fin.toLocaleDateString('es', { day: 'numeric', month: 'long' });
      if (pc != null) h += '<div class="fj-periodo__barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(pc) + '" style="--fj-periodo-p:' + pc.toFixed(1) + '%"><span></span></div>';
      h += '<p class="fj-periodo__plazo">' + (dias > 1 ? 'Cierra el ' + fecha + ' · quedan ' + dias + ' días' : dias === 1 ? 'Cierra mañana' : dias === 0 ? 'Cierra hoy' : 'Periodo cerrado el ' + fecha) + '</p>';
    }
    caja.innerHTML = h;
  });

  F.$$('[data-fj-feed]').forEach(function (caja) {
    var url = caja.getAttribute('data-fj-feed');
    if (!url || url === '#' || url === 'ultimos') return; // «ultimos» lo pinta el módulo ultimos
    caja.classList.add('is-cargando');
    F.traer(url).then(function (doc) {
      var msg = doc.querySelector('.postbody .content > div, .postbody .content, .post .content');
      if (msg) caja.innerHTML = msg.innerHTML;
      if (F.pestanas) F.pestanas(caja);
    }).catch(function (e) { F.log('feed', e); }).then(function () { caja.classList.remove('is-cargando'); });
  });
});

/* tooltips · globo de ayuda propio, con el estilo de la skin.
 * <span data-fj-tip="Texto del globo">…</span>
 * Selector configurable en config.tooltips (por defecto solo [data-fj-tip],
 * para no cambiar los title de Foroactivo). */
FORJA.modulo('tooltips', function (F) {
  var sel = F.config.tooltips;
  if (!sel) return;
  var globo = document.createElement('div');
  globo.className = 'fj-tooltip';
  globo.setAttribute('role', 'tooltip');
  globo.hidden = true;
  document.body.appendChild(globo);

  function texto(el) { return el.getAttribute('data-fj-tip') || el.getAttribute('title') || ''; }
  function mostrar(el) {
    var t = texto(el);
    if (!t) return;
    if (el.hasAttribute('title')) { el.setAttribute('data-fj-tip', t); el.removeAttribute('title'); }
    globo.textContent = t;
    globo.hidden = false;
    var r = el.getBoundingClientRect(), g = globo.getBoundingClientRect();
    var x = Math.max(8, Math.min(window.innerWidth - g.width - 8, r.left + r.width / 2 - g.width / 2));
    var y = r.top - g.height - 8;
    if (y < 8) y = r.bottom + 8;
    globo.style.left = (x + window.scrollX) + 'px';
    globo.style.top = (y + window.scrollY) + 'px';
  }
  function ocultar() { globo.hidden = true; }
  document.addEventListener('mouseover', function (e) { var el = e.target.closest(sel); if (el) mostrar(el); });
  document.addEventListener('mouseout', function (e) { if (e.target.closest(sel)) ocultar(); });
  document.addEventListener('focusin', function (e) { var el = e.target.closest(sel); if (el) mostrar(el); });
  document.addEventListener('focusout', ocultar);
});

/* copiar · botón «Copiar» en los bloques de código de los mensajes ([code] de Foroactivo) y en
 * cualquier botón con data-fj-copiar="selector". Pensado para los temas de «códigos de tablillas»:
 * el usuario copia la tablilla entera con un clic.
 *   <button data-fj-copiar="#mi-tablilla">Copiar</button>
 * Textos: config.textoCopiar / config.textoCopiado. */
FORJA.modulo('copiar', function (F) {
  var txtCopiar = F.config.textoCopiar || 'Copiar';
  var txtHecho = F.config.textoCopiado || 'Copiado';

  function copiar(texto, boton) {
    var hecho = function () {
      if (!boton) return;
      var antes = boton.textContent;
      boton.textContent = txtHecho;
      boton.classList.add('is-hecho');
      setTimeout(function () { boton.textContent = antes; boton.classList.remove('is-hecho'); }, 1600);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(texto).then(hecho, function () { respaldo(texto); hecho(); });
    } else { respaldo(texto); hecho(); }
  }
  function respaldo(texto) {
    var t = document.createElement('textarea');
    t.value = texto; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } catch (e) { /* nada más que hacer */ }
    document.body.removeChild(t);
  }
  F.copiar = copiar;

  F.$$('dl.codebox').forEach(function (caja) {
    var codigo = caja.querySelector('code, .cont_code');
    var dt = caja.querySelector('dt');
    if (!codigo || !dt || caja.querySelector('.fj-copiar')) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'fj-copiar'; b.textContent = txtCopiar;
    b.addEventListener('click', function () { copiar(codigo.innerText, b); });
    dt.appendChild(b);
  });

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-fj-copiar]');
    if (!b) return;
    var obj = document.querySelector(b.getAttribute('data-fj-copiar'));
    if (obj) copiar(obj.value != null && obj.tagName === 'TEXTAREA' ? obj.value : obj.innerText, b);
  });
});

/* borrador · guarda en el navegador lo que se escribe al publicar o responder y, si la página se
 * cierra o falla el envío, ofrece recuperarlo. Un borrador por tema / foro / mensaje privado.
 * Se borra al enviar. Solo en las páginas de publicar (/post) y de mensajes privados.
 * Textos: config.textoBorrador, config.textoRecuperar, config.textoDescartar. */
FORJA.modulo('borrador', function (F) {
  var tipo = F.pagina.tipo;
  if (tipo !== 'publicar' && tipo !== 'mp' && !document.querySelector('form[name="post"] textarea')) return;
  var area = document.getElementById('text_editor_textarea') || document.querySelector('form[name="post"] textarea[name="message"]');
  var form = area && area.form;
  if (!area || !form) return;

  var q = new URLSearchParams(location.search);
  var modo = q.get('mode') || (form.mode && form.mode.value) || 'msg';
  if (modo === 'editpost') return; // al editar ya existe el texto en el servidor
  var clave = 'borrador:' + modo + ':' + (q.get('t') || q.get('f') || q.get('u') || q.get('p') || location.pathname);

  // Foroactivo usa SCEditor (plugin de jQuery): si está, se lee y escribe a través de él.
  function editor() {
    try { return window.jQuery && jQuery(area).sceditor && jQuery(area).sceditor('instance'); } catch (e) { return null; }
  }
  function leerTexto() { var ed = editor(); return ed && ed.val ? ed.val() : area.value; }
  function ponerTexto(t) { var ed = editor(); if (ed && ed.val) ed.val(t); else area.value = t; }

  var guardado = F.leer(clave, null);
  if (guardado && guardado.texto && !leerTexto().trim()) {
    var aviso = document.createElement('div');
    aviso.className = 'fj-borrador';
    aviso.innerHTML = '<span>' + (F.config.textoBorrador || 'Tienes un borrador sin enviar') + ' (' +
      new Date(guardado.t).toLocaleString() + ').</span> ' +
      '<button type="button" class="fj-btn fj-btn--main" data-accion="recuperar">' + (F.config.textoRecuperar || 'Recuperar') + '</button> ' +
      '<button type="button" class="fj-btn" data-accion="descartar">' + (F.config.textoDescartar || 'Descartar') + '</button>';
    area.parentNode.insertBefore(aviso, area);
    aviso.addEventListener('click', function (e) {
      var a = e.target.getAttribute('data-accion');
      if (a === 'recuperar') ponerTexto(guardado.texto);
      if (a === 'descartar') F.guardar(clave, null);
      if (a) aviso.remove();
    });
  }

  var ultimo = '';
  function guardar() {
    var t = leerTexto();
    if (t === ultimo) return;
    ultimo = t;
    F.guardar(clave, t.trim() ? { t: Date.now(), texto: t } : null);
  }
  setInterval(guardar, 5000);
  window.addEventListener('beforeunload', guardar);
  form.addEventListener('submit', function (e) {
    var boton = e.submitter;
    // Solo se borra al publicar de verdad (no al previsualizar)
    if (!boton || /post|submit/i.test(boton.name || '')) F.guardar(clave, null);
  });
});

/* editor · viste el editor de mensajes de Foroactivo (SCEditor) con la skin.
 * El área de escritura es un iframe: el CSS del foro no llega dentro, así que se le pasa una hoja
 * con los colores y la letra que tiene la skin en ese momento (modo claro/oscuro y subtema incluidos).
 * Se aplica al cargar, cuando Foroactivo termina de crear el editor y cada vez que cambia el modo. */
FORJA.modulo('editor', function (F) {
  function hoja() {
    var cs = getComputedStyle(document.body);
    var v = function (n) { return cs.getPropertyValue(n).trim(); };
    return 'html,body{background:' + v('--fj-surface-2') + ' !important;color:' + v('--fj-text') + ' !important;}' +
      'body{font-family:' + v('--fj-font-post') + ';font-size:16px;line-height:1.7;margin:0;padding:.2em .1em;}' +
      'a{color:' + v('--fj-link') + ';}' +
      'blockquote{margin:.6em 0;padding:.5em .9em;border-left:3px solid ' + v('--fj-accent') + ';background:' + v('--fj-surface') + ';}' +
      'code,pre{font-family:' + v('--fj-font-mono') + ';background:' + v('--fj-surface') + ';padding:.1em .3em;border-radius:4px;}' +
      'img{max-width:100%;height:auto;}' +
      '::selection{background:' + v('--fj-accent') + ';color:' + v('--fj-on-accent') + ';}';
  }
  // La caja de emoticonos de Foroactivo (#smileyContainer) también es un iframe del mismo dominio
  function vestirEmoticonos() {
    F.$$('#smileyContainer iframe, #smiley-box iframe').forEach(function (fr) {
      try {
        var d = fr.contentDocument;
        if (!d || !d.head) return;
        var st = d.getElementById('fj-emoticonos') || d.head.appendChild(d.createElement('style'));
        st.id = 'fj-emoticonos';
        var cs = getComputedStyle(document.body), v = function (n) { return cs.getPropertyValue(n).trim(); };
        st.textContent = 'html,body,table,td,tr{background:' + v('--fj-surface') + ' !important;color:' + v('--fj-text') + ' !important;border-color:' + v('--fj-border') + ' !important;}' +
          'input,select{background:' + v('--fj-surface-2') + ' !important;color:' + v('--fj-text') + ' !important;border:1px solid ' + v('--fj-border') + ' !important;border-radius:4px;padding:.3em .5em;}' +
          'a{color:' + v('--fj-link') + ';}img{transition:transform .15s}img:hover{transform:scale(1.2)}';
      } catch (e) { F.log('emoticonos', e); }
    });
  }
  F.$$('#smileyContainer iframe, #smiley-box iframe').forEach(function (fr) { fr.addEventListener('load', vestirEmoticonos); });

  function vestir() {
    vestirEmoticonos();
    if (!window.jQuery || !jQuery.fn || !jQuery.fn.sceditor) return;
    var css = hoja();
    jQuery('textarea').each(function () {
      var ed;
      try { ed = jQuery(this).sceditor('instance'); } catch (e) { return; }
      if (!ed || !ed.css) return;
      try { ed.css(css); } catch (e) { F.log('editor', e); }
    });
  }
  vestir();
  window.addEventListener('load', vestir);
  setTimeout(vestir, 1200);
  setTimeout(vestir, 3500);
  // Al cambiar de modo o de subtema, el editor también cambia
  if (window.MutationObserver) {
    new MutationObserver(function () { setTimeout(vestir, 30); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['data-fj-mode', 'data-fj-theme'] });
  }
});

/* anclas · al entrar a un mensaje concreto (/t12-tema#345), Foroactivo redimensiona las imágenes
 * después de cargar y la página salta a otro sitio. Este módulo vuelve a colocar el mensaje en
 * pantalla cuando las imágenes terminan de cargar, teniendo en cuenta la barra fija del menú. */
FORJA.modulo('anclas', function (F) {
  var h = location.hash.replace('#', '');
  if (!/^p?\d+$/.test(h)) return;
  function ir() {
    var el = document.getElementById(h) || document.getElementById('p' + h.replace(/^p/, ''));
    if (!el) return;
    var nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fj-nav-height')) || 0;
    var y = el.getBoundingClientRect().top + window.pageYOffset - nav - 12;
    window.scrollTo(0, Math.max(0, y));
  }
  window.addEventListener('load', function () { setTimeout(ir, 250); setTimeout(ir, 900); });
  document.addEventListener('resized', ir);
});

/* toolbar · una sola cabecera.
 * Mueve el menú de usuario y las notificaciones de la barra de Foroactivo (#fa_right)
 * a la barra de la skin ([data-fj-nav]) y oculta la barra de Foroactivo.
 * Se mueve el bloque entero con sus id: FAToolbar.js abre y cierra los menús
 * poniendo las clases .welcome / .notification en #fa_right, así que sigue funcionando.
 * Si la skin no tiene barra o Foroactivo no pinta la suya, no hace nada. */
FORJA.modulo('toolbar', function (F) {
  var intentos = 0;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  function integrar() {
    var nav = F.$('[data-fj-nav]'), der = document.getElementById('fa_right');
    if (!nav || !der) { if (++intentos < 20) setTimeout(integrar, 150); return; }
    if (der.closest('[data-fj-nav]')) return;

    var hueco = document.createElement('div');
    hueco.className = 'fj-nav__cuenta';
    hueco.appendChild(der);
    var prefs = nav.querySelector('.fj-nav__prefs');
    if (prefs) prefs.parentNode.insertBefore(hueco, prefs);
    else (nav.querySelector('.fj-nav__inner') || nav).appendChild(hueco);
    document.documentElement.classList.add('fj-toolbar-integrada');

    var u = F.usuario, w = document.getElementById('fa_welcome');
    if (w && u.conectado) {
      w.innerHTML = (u.avatar ? '<img class="fj-cuenta__avatar" src="' + esc(u.avatar) + '" alt="">' : '<span class="fj-ico" data-fj-ico="perfil"></span>') +
        '<span class="fj-cuenta__nombre"' + (u.color ? ' style="color:' + esc(u.color) + '"' : '') + '>' + esc(u.nombre) + '</span>';
      w.title = 'Tu cuenta';
    }
    var n = document.getElementById('fa_notifications');
    if (n) {
      Array.prototype.slice.call(n.childNodes).forEach(function (c) { if (c.nodeType === 3) n.removeChild(c); });
      n.insertAdjacentHTML('afterbegin', '<span class="fj-ico" data-fj-ico="campana"></span>');
      n.title = 'Notificaciones'; n.classList.add('fj-ib');
      n.setAttribute('aria-label', 'Notificaciones');
    }
  }
  integrar();
});

/* ultimos · los últimos temas del foro, como lista legible.
 *
 * Dónde se pinta:
 *   <div data-fj-feed="ultimos"></div>  o  <div data-fj-ultimos></div>
 *   (en el tablón basta con poner "tema_novedades": "ultimos" en skin.json).
 *   Si no hay hueco, el widget «Últimos temas» de Foroactivo se rehace donde está.
 *
 * De dónde salen:
 *   1. El widget «Últimos temas» si está activo en la página (trae el color de grupo del autor).
 *      Al usarlo en un hueco, el widget se quita de la columna.
 *   2. Si no, el RSS del foro (/rss): título, autor, foro y fecha. Sin widgets activos.
 *
 * Config: FORJA.configurar({ ultimos: { max: 6 } }) */
FORJA.modulo('ultimos', function (F) {
  var reTema = /\/t\d+/, reUser = /\/u\d+/;
  var max = (F.config.ultimos && F.config.ultimos.max) || 6;
  var huecos = F.$$('[data-fj-feed="ultimos"], [data-fj-ultimos]');

  function limpiarTitulo(t) { return String(t || '').replace(/^»\s*/, '').trim(); }

  // --- 1. El widget de Foroactivo -------------------------------------------
  function leerWidget(caja) {
    var origen = caja.querySelector('.js-marquee') || caja;
    var temas = Array.prototype.filter.call(origen.querySelectorAll('a[href]'), function (a) {
      return reTema.test(a.getAttribute('href')) && a.textContent.trim();
    });
    if (temas.length < 2) return null;
    var items = [], actual = null, nodos = [];
    (function recorrer(el) {
      Array.prototype.forEach.call(el.childNodes, function (n) {
        if (n.nodeType === 1 && n.tagName === 'A') nodos.push(n);
        else if (n.nodeType === 3) nodos.push(n);
        else if (n.nodeType === 1 && !/^(SCRIPT|IMG|STYLE)$/.test(n.tagName)) recorrer(n);
      });
    })(origen);
    nodos.forEach(function (n) {
      if (n.nodeType === 1 && reTema.test(n.getAttribute('href')) && n.textContent.trim()) {
        actual = { href: n.getAttribute('href'), titulo: limpiarTitulo(n.textContent), fecha: '', autor: null };
        items.push(actual);
      } else if (actual && n.nodeType === 1 && reUser.test(n.getAttribute('href') || '')) {
        if (!actual.autor) actual.autor = n.cloneNode(true);
      } else if (actual && n.nodeType === 3 && !actual.autor) {
        actual.fecha += n.textContent;
      }
    });
    items.forEach(function (it) { it.fecha = it.fecha.replace(/\s+/g, ' ').replace(/\s*por\s*$/i, '').replace(/^[\s»]+/, '').trim(); });
    return { items: items, temas: temas, origen: origen };
  }
  function widgets() {
    return F.$$('.fj-side .module, #comments_scroll_div').map(function (m) {
      return m.id === 'comments_scroll_div' ? (m.closest('.module') || m) : m;
    }).filter(function (m, i, a) {
      return a.indexOf(m) === i && /ltimos temas|temas recientes/i.test(m.textContent) && m.querySelector('a[href*="/t"]');
    });
  }

  // --- 2. El RSS --------------------------------------------------------------
  function relativa(fecha) {
    var d = new Date(fecha); if (isNaN(d)) return '';
    var s = (d - Date.now()) / 1000, rtf = window.Intl && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat('es', { numeric: 'auto' }) : null;
    if (!rtf) return d.toLocaleDateString();
    var abs = Math.abs(s);
    if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
    if (abs < 86400 * 30) return rtf.format(Math.round(s / 86400), 'day');
    return d.toLocaleDateString();
  }
  function leerRSS() {
    return F.traer('/rss', { cacheMinutos: 2 }).then(function (doc) {
      var vistos = {}, items = [];
      Array.prototype.forEach.call(doc.querySelectorAll('item'), function (it) {
        var q = function (s) { var e = it.querySelector(s); return e ? e.textContent.trim() : ''; };
        var url = (q('guid') || q('comments')).replace(/^https?:\/\/[^/]+/, '').replace(/#.*$/, '');
        var m = url.match(/^\/t(\d+)/);
        if (!m || vistos[m[1]]) return;
        vistos[m[1]] = 1;
        var autor = q('dc\\:creator') || q('creator') || q('author');
        items.push({ href: url, titulo: limpiarTitulo(q('title')), foro: q('category'), fecha: relativa(q('pubDate')), autorTexto: autor });
      });
      return items;
    });
  }

  // --- Pintar -------------------------------------------------------------------
  function lista(items) {
    var ol = document.createElement('ol');
    ol.className = 'fj-ultimos';
    items.slice(0, max).forEach(function (it) {
      var li = document.createElement('li');
      li.className = 'fj-ultimos__item';
      var a = document.createElement('a');
      a.className = 'fj-ultimos__titulo'; a.href = it.href; a.textContent = it.titulo;
      li.appendChild(a);
      var meta = document.createElement('span');
      meta.className = 'fj-ultimos__meta';
      var partes = [];
      if (it.autor) { it.autor.className = 'fj-ultimos__autor'; partes.push(it.autor); }
      else if (it.autorTexto) { var b = document.createElement('span'); b.className = 'fj-ultimos__autor'; b.textContent = it.autorTexto; partes.push(b); }
      if (it.foro) partes.push(document.createTextNode('en ' + it.foro));
      if (it.fecha) { var t = document.createElement('time'); t.textContent = it.fecha; partes.push(t); }
      partes.forEach(function (p, i) { if (i) meta.appendChild(document.createTextNode(' · ')); meta.appendChild(p); });
      li.appendChild(meta);
      ol.appendChild(li);
    });
    return ol;
  }
  function vaciarColumnas() {
    F.$$('.fj-side').forEach(function (col) { if (!col.querySelector('.module')) col.hidden = true; });
  }

  var ws = widgets();
  if (huecos.length) {
    var datos = ws.length ? leerWidget(ws[0].querySelector('#comments_scroll_div') || ws[0]) : null;
    var pintar = function (items) {
      huecos.forEach(function (h) {
        h.innerHTML = '';
        h.classList.remove('is-cargando');
        if (items.length) h.appendChild(lista(items));
        else h.textContent = h.getAttribute('data-fj-vacio') || 'Todavía no hay temas.';
      });
    };
    if (datos && datos.items.length) {
      pintar(datos.items);
      ws.forEach(function (w) { w.parentNode.removeChild(w); });
      vaciarColumnas();
    } else {
      huecos.forEach(function (h) { h.classList.add('is-cargando'); });
      leerRSS().then(pintar).catch(function (e) { F.log('ultimos', e); pintar([]); });
    }
    return;
  }

  // Sin hueco: el widget se rehace donde está
  ws.forEach(function (w) {
    var caja = w.querySelector('#comments_scroll_div') || w.querySelector('.inner') || w;
    var datos = leerWidget(caja);
    if (!datos || !datos.items.length) return;
    var marco = caja.id === 'comments_scroll_div' ? caja : null;
    if (marco) { marco.innerHTML = ''; marco.removeAttribute('style'); }
    else {
      marco = caja;
      Array.prototype.slice.call(caja.childNodes).forEach(function (n) {
        var guardar = n.nodeType === 1 && (/(^|\s)(h3|corners-top|corners-bottom)(\s|$)/.test(n.className) || n.tagName === 'H3');
        if (!guardar) caja.removeChild(n);
      });
    }
    marco.appendChild(lista(datos.items));
  });
});

/* pie · columnas del pie (agradecimientos, créditos…) desde la configuración, sin tocar plantillas.
 *   <div data-fj-pie></div> + FORJA.configurar({ pie: [
 *     { titulo: 'Agradecimientos', enlaces: [{ texto: 'Foros hermanos', detalle: 'Por la acogida', url: '/f12-afiliados' }] },
 *     { titulo: 'Créditos', enlaces: [{ texto: 'Cabecera', detalle: 'C. D. Friedrich (dominio público)' }] }
 *   ]})
 *   Cada enlace: texto (obligatorio), detalle y url (opcionales). Sin `pie`, el hueco se oculta.
 *
 * Imágenes: <div data-fj-imagen="pie"></div> + FORJA.configurar({ imagenes: { pie: 'https://…', estadisticas: 'https://…' } })
 *   pone --fj-img en el elemento; el CSS de la variante la usa de fondo (si no hay, la de la cabecera). */
FORJA.modulo('pie', function (F) {
  var imgs = F.config.imagenes || {};
  F.$$('[data-fj-imagen]').forEach(function (el) {
    var url = imgs[el.getAttribute('data-fj-imagen')];
    if (url) el.style.setProperty('--fj-img', 'url("' + String(url).replace(/["\\]/g, '') + '")');
  });
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  F.$$('[data-fj-pie]').forEach(function (caja) {
    var cols = F.config.pie || [];
    if (!cols.length) return;
    caja.innerHTML = cols.map(function (c) {
      return '<section class="fj-pie__bloque">' + (c.titulo ? '<h2>' + esc(c.titulo) + '</h2>' : '') + '<ul>' +
        (c.enlaces || []).map(function (e) {
          var t = e.url ? '<a href="' + esc(e.url) + '"' + (/^https?:/.test(e.url) ? ' target="_blank" rel="noopener"' : '') + '>' + esc(e.texto) + '</a>' : '<strong>' + esc(e.texto) + '</strong>';
          return '<li>' + t + (e.detalle ? '<small>' + esc(e.detalle) + '</small>' : '') + '</li>';
        }).join('') + '</ul></section>';
    }).join('');
  });
});

/* portadas · imagen de cada tema en las listas de temas (subforos, búsquedas), sacada de su primer mensaje.
 *
 * Qué imagen se usa, por orden:
 *   1. La que el autor marque en el primer mensaje: <span data-fj-portada="https://…"></span>
 *      (o cualquier elemento con data-fj-portada; también vale sobre una <img>)
 *   2. La primera imagen del primer mensaje (sin contar emoticonos ni imágenes pequeñas)
 *   3. Un fondo de imagen en línea (style="background-image:url(…)") del primer mensaje: las cabeceras de tablilla
 * Si no hay ninguna, el tema se queda sin portada.
 *
 * Cada tema se consulta una vez, cuando su fila entra en pantalla, y el resultado se guarda en el navegador
 * (localStorage) durante config.portadas.dias (7 por defecto): las visitas siguientes no piden nada.
 * Pone --fj-topic-img y la clase tiene-portada en el tema; cómo se ve lo decide la skin.
 * Dentro de un foro con imagen propia (FORJA_CONFIG.foros[n].img), los temas sin portada reciben esa imagen como
 * fondo de respaldo: --fj-topic-fondo y la clase con-fondo (la skin puede mostrar un trozo distinto en cada fila). */
FORJA.modulo('portadas', function (F) {
  var temas = F.$$('[data-fj-topic]');
  if (!temas.length) return;
  var opc = F.config.portadas || {};
  var vida = (opc.dias || 7) * 864e5;
  var cache = F.leer('portadas', {});
  var ahora = Date.now();

  // limpia entradas viejas para que no crezca sin fin
  Object.keys(cache).forEach(function (k) { if (!cache[k] || ahora - cache[k][1] > vida) delete cache[k]; });

  function idTema(t) {
    var a = t.querySelector('a.topictitle');
    var m = a && (a.getAttribute('href') || '').match(/\/t(\d+)(?:p\d+)?-/);
    return m ? m[1] : '';
  }
  function poner(t, url) {
    if (!url) return;
    F.vars(t, { '--fj-topic-img': 'url("' + url.replace(/"/g, '%22') + '")' });
    t.classList.add('tiene-portada');
  }
  function valida(src) {
    return src && !/^data:/.test(src) && !/smiles|smilies|emoji|\/fa\/i\/|icon_/i.test(src);
  }
  function primeraImagen(msg) {
    var marca = msg.querySelector('[data-fj-portada]');
    if (marca) return marca.getAttribute('data-fj-portada') || marca.getAttribute('src') || '';
    var imgs = msg.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      var im = imgs[i], src = im.getAttribute('src') || '';
      var an = parseInt(im.getAttribute('width'), 10), al = parseInt(im.getAttribute('height'), 10);
      if ((an && an < 80) || (al && al < 80)) continue;
      if (valida(src)) return src;
    }
    var fondos = msg.querySelectorAll('[style*="url("]');
    for (var j = 0; j < fondos.length; j++) {
      var m = fondos[j].getAttribute('style').match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/);
      if (m && valida(m[1])) return m[1];
    }
    return '';
  }
  function guardar(id, url) { cache['t' + id] = [url || '', Date.now()]; F.guardar('portadas', cache); }

  function consultar(t) {
    var id = t.getAttribute('data-fj-tema'), a = t.querySelector('a.topictitle');
    if (!id || !a) return;
    var url = a.getAttribute('href').replace(/(\/t\d+)p\d+-/, '$1-').replace(/#.*$/, '');
    F.traer(url, { cacheMinutos: 0 }).then(function (doc) {
      var msg = doc.querySelector('.fj-post__text, .postbody .content, .post .content');
      var img = msg ? primeraImagen(msg) : '';
      guardar(id, img);
      poner(t, img);
    }).catch(function (e) { F.log('portadas', e); });
  }

  var foro = F.pagina.tipo === 'foro' && (F.config.foros || {})[F.pagina.id];
  var fondo = foro && foro.img ? 'url("' + foro.img.replace(/"/g, '%22') + '")' : '';

  var pendientes = [];
  temas.forEach(function (t) {
    if (fondo) { F.vars(t, { '--fj-topic-fondo': fondo }); t.classList.add('con-fondo'); }
    var id = idTema(t);
    if (!id) return;
    t.setAttribute('data-fj-tema', id);
    var c = cache['t' + id];
    if (c) poner(t, c[0]);
    else pendientes.push(t);
  });
  if (!pendientes.length) return;

  if ('IntersectionObserver' in window) {
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        obs.unobserve(e.target);
        consultar(e.target);
      });
    }, { rootMargin: '200px 0px' });
    pendientes.forEach(function (t) { obs.observe(t); });
  } else {
    pendientes.forEach(consultar);
  }
});

/* afiliados · franja de afiliaciones (foros hermanos, afiliados y directorios) que el staff edita desde un mensaje.
 *
 * Fuente: el PRIMER mensaje del tema de config.afiliados.tema. Dentro, cada grupo empieza con un título en negrita
 * (o encabezado) que contenga «hermanos», «afiliad…» o «directorio», y debajo van los botones:
 *     [b]Foros hermanos[/b]
 *     [url=https://otroforo.com][img]https://…/boton.png[/img][/url]
 *     [b]Afiliados[/b]
 *     [url=…][img]…[/img][/url] [url=…][img]…[/img][/url]
 *     [b]Directorios[/b]
 *     [url=…][img]…[/img][/url]
 *   El resto del mensaje (instrucciones para pedir afiliación, etc.) se ignora: solo cuentan los enlaces con imagen
 *   (y los enlaces de texto que estén debajo de un título de grupo).
 * Sin fuente, también vale config.afiliados.listas = { hermanos: [{ nombre, url, img }], afiliados: [...], directorios: [...] }.
 *
 * Hueco: <div data-fj-afiliados></div> en la plantilla. Si no existe, se crea detrás de config.afiliados.tras.
 * config.afiliados.huecos = { hermanos: 2, afiliados: 6, directorios: 0 }: botones vacíos «+» que llevan a
 * config.afiliados.pedir mientras falten afiliados. Un grupo sin botones y sin huecos no se muestra.
 * El resultado se guarda en el navegador config.afiliados.minutos (30 por defecto). */
FORJA.modulo('afiliados', function (F) {
  var c = F.config.afiliados;
  if (!c) return;
  var caja = F.$('[data-fj-afiliados]');
  if (!caja && c.tras) {
    var ancla = F.$(c.tras);
    if (ancla) { caja = document.createElement('div'); caja.setAttribute('data-fj-afiliados', ''); ancla.parentNode.insertBefore(caja, ancla.nextSibling); }
  }
  if (!caja) return;

  var GRUPOS = ['hermanos', 'afiliados', 'directorios'];
  var textos = Object.assign({ hermanos: 'Foros hermanos', afiliados: 'Afiliados', directorios: 'Directorios', pedir: 'Pedir afiliación', hueco: 'Tu foro aquí' }, c.textos || {});
  var huecos = Object.assign({ hermanos: 2, afiliados: 6, directorios: 0 }, c.huecos || {});
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); };

  function grupoDe(texto) {
    var t = (texto || '').trim().toLowerCase();
    if (!t || t.length > 40) return '';
    if (/herman/.test(t)) return 'hermanos';
    if (/directori/.test(t)) return 'directorios';
    if (/afilia|amig|élite|elite/.test(t)) return 'afiliados';
    return '';
  }
  function leerMensaje(msg) {
    var listas = { hermanos: [], afiliados: [], directorios: [] }, actual = '';
    var vistos = {};
    F.$$('h1, h2, h3, h4, h5, h6, strong, b, [data-fj-grupo], a', msg).forEach(function (el) {
      if (el.tagName !== 'A') {
        var g = el.getAttribute('data-fj-grupo') || grupoDe(el.textContent);
        if (g) actual = g;
        return;
      }
      var url = el.getAttribute('href') || '', img = el.querySelector('img');
      if (!url || /^#|^javascript:/i.test(url) || vistos[url + (img ? img.src : '')]) return;
      if (!img && !actual) return;            // enlaces de texto sueltos (instrucciones): fuera
      vistos[url + (img ? img.src : '')] = 1;
      listas[actual || 'afiliados'].push({
        url: url, img: img ? img.getAttribute('src') : '',
        nombre: (img && (img.getAttribute('alt') || img.getAttribute('title'))) || el.getAttribute('title') || el.textContent.trim() || url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]
      });
    });
    return listas;
  }

  function pintar(listas) {
    var html = '';
    GRUPOS.forEach(function (g) {
      var items = (listas && listas[g]) || [], vacios = Math.max(0, (huecos[g] || 0) - items.length);
      if (!items.length && !vacios) return;
      html += '<div class="fj-afiliados__grupo fj-afiliados__grupo--' + g + '"><h2 class="fj-afiliados__titulo">' + esc(textos[g]) + '</h2><ul class="fj-afiliados__lista">';
      items.forEach(function (it) {
        var externo = /^https?:/i.test(it.url) && it.url.indexOf(location.host) === -1;
        html += '<li><a class="fj-afiliado' + (it.img ? '' : ' fj-afiliado--texto') + '" href="' + esc(it.url) + '" title="' + esc(it.nombre) + '"' +
          (externo ? ' target="_blank" rel="noopener"' : '') + '>' +
          (it.img ? '<img src="' + esc(it.img) + '" alt="' + esc(it.nombre) + '" loading="lazy">' : esc(it.nombre)) + '</a></li>';
      });
      for (var i = 0; i < vacios; i++) {
        html += '<li><a class="fj-afiliado fj-afiliado--hueco" href="' + esc(c.pedir || c.tema || '#') + '" title="' + esc(textos.hueco) + '" aria-label="' + esc(textos.hueco) + '"></a></li>';
      }
      html += '</ul></div>';
    });
    if (!html) { caja.hidden = true; return; }
    if (c.pedir || c.tema) html += '<a class="fj-afiliados__pedir" href="' + esc(c.pedir || c.tema) + '">' + esc(textos.pedir) + '</a>';
    caja.className = 'fj-afiliados';
    caja.setAttribute('aria-label', textos.afiliados);
    caja.innerHTML = html;
    caja.hidden = false;
  }

  if (!c.tema) { pintar(c.listas || {}); return; }
  var guardado = F.leer('afiliados', null), vida = (c.minutos || 30) * 60000;
  if (guardado && guardado.tema === c.tema) pintar(guardado.listas);
  else pintar(c.listas || {});
  if (guardado && guardado.tema === c.tema && Date.now() - guardado.t < vida) return;
  F.traer(c.tema, { cacheMinutos: 0 }).then(function (doc) {
    var msg = doc.querySelector('.fj-post__text, .postbody .content, .post .content');
    if (!msg) return;
    var listas = leerMensaje(msg);
    F.guardar('afiliados', { tema: c.tema, t: Date.now(), listas: listas });
    pintar(listas);
  }).catch(function (e) { F.log('afiliados', e); });
});

/* insignias · icono de grupo delante de cada nombre de usuario de ese grupo (con su color) y en la leyenda.
 *
 * config.insignias = { "3": "corona", "4": "lobo", … }   número de grupo (el de /g3-…) → icono de Forja
 *
 * Se hace con CSS generado sobre las clases que ya pone Foroactivo (span.group-3.usr_grp_clr en los nombres,
 * a.usr_grp_clr[href^="/g3-"] en la leyenda), así que también sirve para lo que se pinte después (listas traídas
 * por otros módulos, conectados en 24 h…). Los iconos tienen que estar en la skin: ponlos en "iconos_extra". */
FORJA.modulo('insignias', function (F) {
  var mapa = F.config.insignias;
  if (!mapa) return;
  var selectores = [], reglas = '';
  Object.keys(mapa).forEach(function (g) {
    var n = String(g).replace(/\D/g, ''), ico = String(mapa[g] || '').replace(/[^a-z0-9-]/gi, '');
    if (!n || !ico) return;
    var nombre = '.group-' + n + '.usr_grp_clr::before', leyenda = 'a.usr_grp_clr[href^="/g' + n + '-"]::before';
    selectores.push(nombre, leyenda);
    reglas += nombre + ',' + leyenda + '{--fj-insignia:var(--fj-ico-' + ico + ')}' +
      'a.usr_grp_clr[href^="/g' + n + '-"] .group-icon{display:none}';
  });
  if (!selectores.length) return;
  var st = document.createElement('style');
  st.id = 'fj-insignias';
  st.textContent = selectores.join(',') + '{content:"";display:inline-block;inline-size:.9em;block-size:.9em;margin-inline-end:.3em;' +
    'vertical-align:-.08em;background:currentColor;-webkit-mask:var(--fj-insignia) center/contain no-repeat;mask:var(--fj-insignia) center/contain no-repeat}' + reglas;
  document.head.appendChild(st);
  document.documentElement.classList.add('fj-con-insignias');
});

/* reinos · une cada grupo de Foroactivo con un color de la paleta de la skin.
 * Un reino (`"norte"`) usa --fj-reino-norte-texto para los nombres (con contraste en el modo activo) y --fj-reino-norte
 * (identidad) para bordes y detalles. Una variable (`"--fj-accent"`) se usa tal cual: sirve para el staff u otros
 * grupos que no son un reino. El color del grupo en el panel queda como respaldo (sin JavaScript, en el chat…).
 * config.reinos = { "4": "norte", "5": "occidente", "2": "--fj-accent" }  (número de grupo de /g4-… → reino o variable) */
FORJA.modulo('reinos', function (F) {
  var r = F.config.reinos;
  if (!r || !Object.keys(r).length) return;
  var texto = function (v) { return /^--/.test(v) ? 'var(' + v + ')' : 'var(--fj-reino-' + v + '-texto)'; };
  var marca = function (v) { return /^--/.test(v) ? 'var(' + v + ')' : 'var(--fj-reino-' + v + ')'; };
  var limpio = {};
  Object.keys(r).forEach(function (g) {
    var id = String(g).replace(/\D/g, ''), v = String(r[g]).replace(/[^a-z0-9-]/gi, '');
    if (id && v) limpio[id] = v;
  });
  var css = Object.keys(limpio).map(function (id) {
    return ':is(.group-' + id + '.usr_grp_clr, a[href^="/g' + id + '-"]){color:' + texto(limpio[id]) + '!important}' +
      '.group-' + id + '.usr_grp_clr strong{color:inherit!important}';
  }).join('');
  var st = document.createElement('style');
  st.id = 'fj-reinos';
  st.textContent = css;
  document.head.appendChild(st);
  // color del panel de cada grupo (lo llevan los nombres en style) → para reconocer el del usuario conectado
  var porColor = {};
  F.$$('.usr_grp_clr[class*="group-"]').forEach(function (n) {
    var g = (n.className.match(/group-(\d+)/) || [])[1], c = (n.getAttribute('style') || '').match(/color:\s*([^;]+)/);
    if (g && c && limpio[g]) porColor[c[1].trim().toLowerCase()] = limpio[g];
  });
  var mio = F.usuario && F.usuario.color && porColor[String(F.usuario.color).toLowerCase()];
  if (mio) document.documentElement.style.setProperty('--fj-user-color', marca(mio));
  // en los mensajes, el color del grupo del autor para bordes y detalles
  F.$$('[data-fj-post]').forEach(function (p) {
    var n = p.querySelector('.usr_grp_clr[class*="group-"]'), g = n && (n.className.match(/group-(\d+)/) || [])[1];
    if (g && limpio[g]) p.style.setProperty('--fj-group', marca(limpio[g]));
  });
});

/* conectados · quién ha pasado por el foro: ahora, en las últimas 24 h y en las últimas 48 h.
 *
 * config.conectados = {
 *   ahora: '.fj-escaparate__resumen, .fj-escaparate__fichas, .fj-escaparate__nota',  // lo que se ve en «Ahora»
 *   horas: [24, 48],        // pestañas además de «Ahora»
 *   minutos: 10,            // cuánto guarda el navegador la lista
 *   claseLista: '…'         // clase extra para la lista de 24/48 h (p. ej. la de las fichas de «Ahora»)
 * }
 * Las pestañas se ponen en [data-fj-conectados] o, si no hay, delante del primer elemento de «ahora».
 * 24 h y 48 h salen de la lista de miembros ordenada por última visita (/memberlist?mode=lastvisit&order=DESC):
 * esa columna tiene que estar visible (Panel > Usuarios > Lista de miembros). Si no se puede leer, no hay pestañas.
 * Los nombres conservan el color y la insignia de su grupo. */
FORJA.modulo('conectados', function (F) {
  var c = F.config.conectados;
  if (!c) return;
  var deAhora = c.ahora ? F.$$(c.ahora) : [];
  var caja = F.$('[data-fj-conectados]');
  if (!caja && deAhora.length) {
    caja = document.createElement('div');
    caja.setAttribute('data-fj-conectados', '');
    deAhora[0].parentNode.insertBefore(caja, deAhora[0]);
  }
  if (!caja) return;
  var horas = c.horas || [24, 48];
  var t = Object.assign({ ahora: 'Ahora', h: ' h', vacio: 'Nadie en las últimas {h} horas', cargando: 'Consultando…' }, c.textos || {});
  var MESES = { ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11 };

  function cuando(txt) {
    var s = (txt || '').trim().toLowerCase(), hoy = new Date(), base = null, m;
    if (/^hoy/.test(s)) base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    else if (/^ayer/.test(s)) base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
    else if ((m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))) base = new Date(+(m[3].length === 2 ? '20' + m[3] : m[3]), +m[2] - 1, +m[1]);
    else if ((m = s.match(/(\d{1,2})\s+([a-zé]{3})[a-zé]*\.?\s+(\d{4})/))) base = new Date(+m[3], MESES[m[2]] != null ? MESES[m[2]] : NaN, +m[1]);
    if (!base || isNaN(base)) return NaN;
    var h = s.match(/(\d{1,2}):(\d{2})/);
    if (h) base.setHours(+h[1], +h[2]); else base.setHours(23, 59);
    return base.getTime();
  }

  function leerPagina(doc) {
    var filas = [], col = -1;
    F.$$('tr', doc).forEach(function (tr) {
      var celdas = tr.children;
      if (col < 0) {
        for (var i = 0; i < celdas.length; i++) if (/última visita|ultima visita|last visit/i.test(celdas[i].textContent)) col = i;
        return;
      }
      if (!celdas[col]) return;
      var enl = F.$$('a[href^="/u"]', tr);   // el primero suele ser el avatar: queremos el del nombre
      var a = enl.filter(function (x) { return x.querySelector('.usr_grp_clr, span[style*="color"], strong'); })[0] ||
        enl.filter(function (x) { return !x.querySelector('img') && x.textContent.trim(); })[0];
      if (!a) return;
      a = a.cloneNode(true);
      F.$$('img', a).forEach(function (im) { im.remove(); });   // en la lista de miembros, avatar y nombre comparten enlace
      filas.push({ html: a.outerHTML.replace(/>\s+</g, '><'), t: cuando(celdas[col].textContent) });
    });
    return filas;
  }

  function traerTodos() {
    var limite = Date.now() - Math.max.apply(null, horas) * 3600000, todos = [];
    function pagina(desde, vuelta) {
      return F.traer('/memberlist?mode=lastvisit&order=DESC&start=' + desde, { cacheMinutos: 0 }).then(function (doc) {
        var filas = leerPagina(doc);
        todos = todos.concat(filas);
        var ultima = filas[filas.length - 1];
        if (filas.length && ultima.t >= limite && vuelta < 3) return pagina(desde + filas.length, vuelta + 1);
        return todos;
      });
    }
    return pagina(0, 0);
  }

  var lista = document.createElement('p');
  lista.className = 'fj-conectados__lista' + (c.claseLista ? ' ' + c.claseLista : '');
  lista.style.display = 'none';
  var tabs = document.createElement('div');
  tabs.className = 'fj-conectados__tabs';
  tabs.setAttribute('role', 'tablist');
  caja.className = 'fj-conectados';
  caja.appendChild(tabs);
  (deAhora.length ? deAhora[deAhora.length - 1] : caja).insertAdjacentElement('afterend', lista);

  var datos = null;
  function boton(clave, texto) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'fj-conectados__tab'; b.setAttribute('role', 'tab');
    b.setAttribute('data-fj-ventana', clave); b.innerHTML = texto;
    b.setAttribute('aria-selected', clave === 'ahora' ? 'true' : 'false');
    tabs.appendChild(b);
    return b;
  }
  boton('ahora', t.ahora);
  var botones = horas.map(function (h) { return boton(String(h), h + t.h + ' <b data-fj-cuenta></b>'); });

  function enVentana(h) {
    var desde = Date.now() - h * 3600000;
    return (datos || []).filter(function (f) { return f.t >= desde; });
  }
  function mostrar(clave) {
    F.$$('.fj-conectados__tab', tabs).forEach(function (b) { b.setAttribute('aria-selected', b.getAttribute('data-fj-ventana') === clave ? 'true' : 'false'); });
    var esAhora = clave === 'ahora';
    deAhora.forEach(function (el) { el.style.display = esAhora ? '' : 'none'; });
    lista.style.display = esAhora ? 'none' : '';
    if (esAhora) return;
    if (!datos) { lista.innerHTML = '<span class="fj-conectados__vacio">' + t.cargando + '</span>'; return; }
    var gente = enVentana(+clave);
    lista.innerHTML = gente.length ? gente.map(function (f) { return f.html; }).join('<span class="fj-conectados__sep">, </span>')
      : '<span class="fj-conectados__vacio">' + t.vacio.replace('{h}', clave) + '</span>';
  }
  tabs.addEventListener('click', function (e) {
    var b = e.target.closest('.fj-conectados__tab');
    if (b) mostrar(b.getAttribute('data-fj-ventana'));
  });
  function listo(filas) {
    datos = filas;
    botones.forEach(function (b, i) { b.querySelector('[data-fj-cuenta]').textContent = enVentana(horas[i]).length; });
    var activo = tabs.querySelector('[aria-selected="true"]');
    if (activo) mostrar(activo.getAttribute('data-fj-ventana'));
  }

  var guardado = F.leer('conectados', null); if (guardado && guardado.v !== 3) guardado = null;
  var vida = (c.minutos || 10) * 60000;
  if (guardado && Date.now() - guardado.t < vida) { listo(guardado.filas); return; }
  traerTodos().then(function (filas) {
    if (!filas.length) { caja.hidden = true; return; }
    F.guardar('conectados', { v: 3, t: Date.now(), filas: filas });
    listo(filas);
  }).catch(function (e) { F.log('conectados', e); caja.hidden = true; });
});

/* cuentagrupos · cuántos miembros tiene cada grupo, junto a los enlaces a /gN-… (la leyenda de grupos).
 *
 * config.cuentaGrupos = { donde: '.fj-escaparate__casas', minutos: 60, textos: { uno: 'miembro', varios: 'miembros' } }
 *
 * Lee la página /groups (una sola petición; cada grupo dice «Miembros del Grupo : N») y lo guarda en el navegador
 * `minutos`. Añade al enlace <span class="fj-cuenta-grupo"><b>N</b><span>miembros</span></span>; la skin decide
 * cómo se ve (Estandarte: la cifra siempre y la palabra al pasar el ratón). */
FORJA.modulo('cuentagrupos', function (F) {
  var c = F.config.cuentaGrupos;
  if (!c) return;
  var enlaces = F.$$((c.donde ? c.donde + ' ' : '') + 'a[href^="/g"]').filter(function (a) { return /^\/g\d+-/.test(a.getAttribute('href')); });
  if (!enlaces.length) return;
  var t = Object.assign({ uno: 'miembro', varios: 'miembros' }, c.textos || {});

  function pintar(cuentas) {
    enlaces.forEach(function (a) {
      var n = a.getAttribute('href').match(/^\/g(\d+)-/)[1];
      if (cuentas[n] == null) return;
      var s = a.querySelector('.fj-cuenta-grupo') || document.createElement('span');
      s.className = 'fj-cuenta-grupo';
      s.innerHTML = '<b>' + cuentas[n] + '</b><span>' + (+cuentas[n] === 1 ? t.uno : t.varios) + '</span>';
      a.appendChild(s);
      a.setAttribute('aria-label', a.textContent.replace(/\s+/g, ' ').trim());
    });
  }

  var g = F.leer('cuentagrupos', null);
  if (g) pintar(g.c);
  if (g && Date.now() - g.t < (c.minutos || 60) * 60000) return;
  F.traer('/groups', { cacheMinutos: 0 }).then(function (doc) {
    var cuentas = {};
    F.$$('a[href^="/g"]', doc).forEach(function (a) {
      var m = (a.getAttribute('href') || '').match(/^\/g(\d+)-/), fila = a.closest('li, tr, dd, p');
      if (!m || !fila) return;
      var n = fila.textContent.match(/:\s*(\d+)\s*$/);
      if (n) cuentas[m[1]] = +n[1];
    });
    if (!Object.keys(cuentas).length) return;
    F.guardar('cuentagrupos', { t: Date.now(), c: cuentas });
    pintar(cuentas);
  }).catch(function (e) { F.log('cuentagrupos', e); });
});

/* vigilar · botón para vigilar o dejar de vigilar cada tema desde la lista de temas, sin entrar en él.
 *
 * Qué temas vigila el usuario sale de /search?search_id=watchsearch (una petición; se guarda en el navegador
 * config.vigilar.minutos, 15 por defecto, y se actualiza al pulsar). El botón llama a la misma dirección que el
 * enlace «Vigilar este tema» del tema (/tN-…?watch=topic o ?unwatch=topic) y cambia de estado si Foroactivo responde.
 * Solo para usuarios conectados. Pone <button class="fj-vigilar" aria-pressed> en cada [data-fj-topic] (dentro de
 * config.vigilar.dentro, si se indica) y .is-vigilado en el tema. */
FORJA.modulo('vigilar', function (F) {
  var c = F.config.vigilar;
  if (!c || !F.usuario || !F.usuario.conectado) return;
  var temas = F.$$('[data-fj-topic]');
  if (!temas.length) return;
  var t = Object.assign({ vigilar: 'Vigilar este tema', dejar: 'Dejar de vigilar', vigilando: 'Vigilando' }, c.textos || {});
  var icono = c.icono || 'ojo';

  function idDe(href) { var m = (href || '').match(/\/t(\d+)(?:p\d+)?-/); return m ? m[1] : ''; }
  var guardado = F.leer('vigilados', null), vigilados = guardado ? guardado.ids : null;

  function marcar(tema, si) {
    tema.classList.toggle('is-vigilado', si);
    var b = tema.querySelector('.fj-vigilar');
    if (!b) return;
    b.setAttribute('aria-pressed', si ? 'true' : 'false');
    var txt = si ? t.dejar : t.vigilar;
    b.setAttribute('aria-label', txt); b.setAttribute('data-fj-tip', txt);
  }
  function guardar() { F.guardar('vigilados', { t: Date.now(), ids: vigilados }); }

  temas.forEach(function (tema) {
    var a = tema.querySelector('a.topictitle'), id = a && idDe(a.getAttribute('href'));
    if (!id || tema.querySelector('.fj-vigilar')) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'fj-vigilar fj-ib';
    b.innerHTML = '<span class="fj-ico" data-fj-ico="' + icono + '"></span>';
    (c.dentro && tema.querySelector(c.dentro) || tema).appendChild(b);
    tema.setAttribute('data-fj-tema', id);
    marcar(tema, !!(vigilados && vigilados.indexOf(id) > -1));
    b.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (b.disabled) return;
      var quiero = b.getAttribute('aria-pressed') !== 'true';
      var url = a.getAttribute('href').replace(/(\/t\d+)p\d+-/, '$1-').replace(/[?#].*$/, '') + (quiero ? '?watch=topic' : '?unwatch=topic');
      b.disabled = true; b.classList.add('is-cargando');
      // Foroactivo responde con una página «Informaciones» («Ya no estás observando este tema», etc.)
      fetch(url, { credentials: 'same-origin' }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        vigilados = vigilados || [];
        var i = vigilados.indexOf(id);
        if (quiero && i < 0) vigilados.push(id);
        if (!quiero && i > -1) vigilados.splice(i, 1);
        guardar();
        marcar(tema, quiero);
      }).catch(function (err) { F.log('vigilar', err); b.classList.add('is-error'); setTimeout(function () { b.classList.remove('is-error'); }, 1500); })
        .then(function () { b.disabled = false; b.classList.remove('is-cargando'); });
    });
  });

  if (guardado && Date.now() - guardado.t < (c.minutos || 15) * 60000) return;
  F.traer('/search?search_id=watchsearch', { cacheMinutos: 0 }).then(function (doc) {
    vigilados = F.$$('a.topictitle', doc).map(function (a) { return idDe(a.getAttribute('href')); }).filter(Boolean);
    guardar();
    temas.forEach(function (tema) { marcar(tema, vigilados.indexOf(tema.getAttribute('data-fj-tema')) > -1); });
  }).catch(function (e) { F.log('vigilar', e); });
});

/* cabeceras · barra superior de cada mensaje: imagen de cabecera, emblema del grupo y rango del personaje.
 *
 * config.cabeceras = {
 *   campo: 'cabecera',          // campo de perfil (Panel > Usuarios > Perfiles) con el enlace a la imagen
 *   porDefecto: 'https://…',    // imagen para quien no haya puesto ninguna (siempre hay una)
 *   grupos: { "3": 'https://…' } // opcional: imagen por defecto distinta según el grupo
 * }
 * El campo tiene que mostrarse en los mensajes (el módulo campos le pone data-fj-campo); aquí se oculta y su valor
 * pasa a --fj-post-cabecera. El emblema usa el icono del grupo de config.insignias y el rango se copia de la ficha.
 * Marca la cabecera con .tiene-cabecera; cómo se ve lo decide la skin. */
FORJA.modulo('cabeceras', function (F) {
  var c = F.config.cabeceras;
  if (!c) return;
  var iconos = F.config.insignias || {}, campoSlug = c.campo || 'cabecera';

  F.$$('[data-fj-post]').forEach(function (post) {
    var head = post.querySelector('.fj-post__head');
    if (!head || head.classList.contains('tiene-cabecera')) return;

    // imagen: la del perfil (si es un enlace válido), la del grupo o la de por defecto
    var url = '', campo = post.querySelector('[data-fj-campo="' + campoSlug + '"]');
    if (campo) {
      var valor = campo.querySelector('.fj-field__value') || campo, el = valor.querySelector('a[href], img[src]');
      url = (el ? (el.getAttribute('href') || el.getAttribute('src')) : valor.textContent).trim();
      if (!/^https?:\/\/[^\s"'<>]+$/i.test(url)) url = '';
      campo.hidden = true;
    }
    var nombre = head.querySelector('.fj-post__name [class*="group-"]');
    var grupo = nombre && (nombre.className.match(/group-(\d+)/) || [])[1];
    url = url || (grupo && c.grupos && c.grupos[grupo]) || c.porDefecto || '';
    if (url) F.vars(post, { '--fj-post-cabecera': 'url("' + url.replace(/"/g, '%22') + '")' });
    head.classList.add('tiene-cabecera');

    // emblema del grupo
    if (grupo && iconos[grupo]) {
      var em = document.createElement('span');
      em.className = 'fj-post__emblema';
      em.setAttribute('aria-hidden', 'true');
      em.innerHTML = '<span class="fj-ico" data-fj-ico="' + String(iconos[grupo]).replace(/[^a-z0-9-]/gi, '') + '"></span>';
      head.insertBefore(em, head.firstChild);
    }

    // rango del personaje (texto o imagen de rango)
    var rango = post.querySelector('.fj-author__rank'), texto = rango && rango.textContent.trim(), img = rango && rango.querySelector('img');
    if (texto || img) {
      var r = document.createElement('span');
      r.className = 'fj-post__rango';
      if (texto) r.textContent = texto; else r.appendChild(img.cloneNode(true));
      var fecha = head.querySelector('.fj-post__date');
      if (fecha) fecha.parentNode.insertBefore(r, fecha); else (head.querySelector('.fj-post__headtext') || head).appendChild(r);
    }
  });
});

/* ficha · convierte campos de perfil del mensaje en una ficha de personaje: atributos numéricos con barra,
 * habilidades como etiquetas y enlaces (ficha, cronología, baúl…) junto a los iconos de contacto.
 *
 * config.ficha = {
 *   atributos: ['fuerza', 'destreza', …], // campos «Número» (Panel > Usuarios > Perfiles), en este orden
 *   maximo: 10,                           // valor máximo de la barra
 *   habilidades: 'habilidades',           // campo de texto con la lista separada por comas
 *   enlaces: ['ficha', 'cronologia', 'baul'], // campos con un enlace (https://… o /t12-…)
 *   contadores: ['monedas', 'mensajes'],  // cifras sueltas en una fila (icono con .fj-contador[data-fj-contador="…"])
 *   color: 'color'                        // campo de texto con el color de acento del usuario (#c0504d, rgb(…), nombre)
 * }
 * El color se pone como --fj-autor-color en el mensaje: las tablillas lo usan si no llevan su propio --tb-color.
 * Los nombres son el slug del nombre del campo (el módulo campos pone data-fj-campo). Los campos usados se ocultan.
 * Cada enlace sale como <a class="fj-contact__extra" data-fj-enlace="ficha">: el icono lo pone la skin con
 * .fj-contact__extra[data-fj-enlace="ficha"] { --fj-ico: var(--fj-ico-pergamino); } */
FORJA.modulo('ficha', function (F) {
  var c = F.config.ficha;
  if (!c) return;
  var max = c.maximo || 10;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (x) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x]; }); };
  var etiqueta = function (campo) { var l = campo.querySelector('.label'); return (l ? l.textContent : '').replace(/:\s*$/, '').trim(); };
  var valorDe = function (campo) { var v = campo.querySelector('.fj-field__value'); return v ? v.textContent.trim() : ''; };

  F.$$('[data-fj-post]').forEach(function (post) {
    if (post.hasAttribute('data-fj-ficha')) return;
    post.setAttribute('data-fj-ficha', '');
    var campos = post.querySelector('.fj-fields');
    var buscar = function (slug) { return post.querySelector('[data-fj-campo="' + slug + '"]'); };

    // color de acento del usuario
    var cc = c.color && buscar(c.color);
    if (cc) {
      cc.hidden = true;
      var col = valorDe(cc).replace(/\s+/g, '');
      if (/^(#[0-9a-f]{3,8}|(rgb|hsl|oklch)a?\([\d.,%\s/-]+\)|[a-z]{3,20})$/i.test(col) && window.CSS && CSS.supports('color', col)) post.style.setProperty('--fj-autor-color', col);
    }

    // atributos
    var filas = '';
    (c.atributos || []).forEach(function (slug) {
      var campo = buscar(slug);
      if (!campo) return;
      campo.hidden = true;
      var n = parseInt(valorDe(campo), 10);
      if (isNaN(n)) return;
      n = Math.max(0, Math.min(n, max));
      filas += '<div class="fj-atributo" style="--fj-valor:' + n + ';--fj-max:' + max + '"><span class="fj-atributo__nombre">' + esc(etiqueta(campo)) +
        '</span><b class="fj-atributo__valor">' + n + '</b><span class="fj-atributo__barra" aria-hidden="true"></span></div>';
    });

    // habilidades
    var chips = '', hab = c.habilidades && buscar(c.habilidades);
    if (hab) {
      hab.hidden = true;
      valorDe(hab).split(/\s*[,;·\n]\s*/).filter(Boolean).forEach(function (h) { chips += '<li>' + esc(h) + '</li>'; });
    }
    // contadores (monedas, mensajes…)
    var cifras = '';
    (c.contadores || []).forEach(function (slug) {
      var campo = buscar(slug);
      if (!campo) return;
      campo.hidden = true;
      var v = valorDe(campo);
      if (!v) return;
      cifras += '<span class="fj-contador" data-fj-contador="' + esc(slug) + '" title="' + esc(etiqueta(campo)) + '"><b>' + esc(v) +
        '</b><span class="fj-contador__nombre">' + esc(etiqueta(campo)) + '</span></span>';
    });
    if (campos && (filas || chips || cifras)) {
      var bloque = document.createElement('div');
      bloque.className = 'fj-ficha';
      bloque.innerHTML = (filas ? '<div class="fj-atributos">' + filas + '</div>' : '') + (chips ? '<ul class="fj-habilidades">' + chips + '</ul>' : '') +
        (cifras ? '<div class="fj-contadores">' + cifras + '</div>' : '');
      campos.insertBefore(bloque, campos.firstChild);
    }

    // enlaces junto al contacto
    var contacto = post.querySelector('.fj-contact');
    (c.enlaces || []).forEach(function (slug) {
      var campo = buscar(slug);
      if (!campo) return;
      campo.hidden = true;
      var v = campo.querySelector('.fj-field__value a[href]');
      var url = (v ? v.getAttribute('href') : valorDe(campo)).trim();
      if (!contacto || !/^(https?:\/\/[^\s"'<>]+|\/[^\s"'<>]*)$/i.test(url)) return;
      var a = document.createElement('a');
      a.className = 'fj-contact__extra';
      a.href = url;
      a.title = etiqueta(campo);
      a.setAttribute('data-fj-enlace', slug);
      a.innerHTML = '<span class="fj-hidden">' + esc(etiqueta(campo)) + '</span>';
      contacto.appendChild(a);
    });
  });
});

/* barraeditor · cambia los iconos de la barra del editor (SCEditor de Foroactivo, sprite de colores) por iconos
 * de Forja dibujados con el color del texto. Los iconos viajan dentro del propio código (no gastan CSS).
 * Botón sin icono en la lista: se queda el de Foroactivo. Vale para la respuesta rápida, publicar y MP. */
FORJA.modulo('barraeditor', function (F) {
  var ICONOS = {"negrita":"<path d='M7 5h5.5a3.5 3.5 0 0 1 0 7H7z'/><path d='M7 12h6.5a3.5 3.5 0 0 1 0 7H7z'/>","cursiva":"<path d='M10 5h8'/><path d='M6 19h8'/><path d='M14 5 10 19'/>","subrayado":"<path d='M7 4v7a5 5 0 0 0 10 0V4'/><path d='M5 20h14'/>","tachado":"<path d='M4 12h16'/><path d='M16.5 7.5C16 5.6 14.2 4.5 12 4.5c-2.6 0-4.5 1.4-4.5 3.4 0 1.4.8 2.4 2.4 3.1'/><path d='M8 16.2c.6 2 2.3 3.3 4.3 3.3 2.7 0 4.7-1.5 4.7-3.6 0-.9-.3-1.6-.9-2.2'/>","alinear-izquierda":"<path d='M4 6h16'/><path d='M4 10h10'/><path d='M4 14h16'/><path d='M4 18h10'/>","alinear-centro":"<path d='M4 6h16'/><path d='M7 10h10'/><path d='M4 14h16'/><path d='M7 18h10'/>","alinear-derecha":"<path d='M4 6h16'/><path d='M10 10h10'/><path d='M4 14h16'/><path d='M10 18h10'/>","justificar":"<path d='M4 6h16'/><path d='M4 10h16'/><path d='M4 14h16'/><path d='M4 18h16'/>","citar":"<path d='M5 7h5v5c0 3-1.5 5-4 6'/><path d='M14 7h5v5c0 3-1.5 5-4 6'/>","codigo":"<path d='m8 7-5 5 5 5'/><path d='m16 7 5 5-5 5'/>","spoiler":"<path d='M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z'/><circle cx='12' cy='12' r='2.5'/><path d='M4 4l16 16'/>","ocultar":"<path d='M3 10c2.5 3.3 5.5 5 9 5s6.5-1.7 9-5'/><path d='m6 13.5-1.8 2.3'/><path d='M12 15v3'/><path d='m18 13.5 1.8 2.3'/>","subir-imagen":"<path d='M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 8.5a4.5 4.5 0 0 1-1 9.5'/><path d='M12 12v8'/><path d='m9 15 3-3 3 3'/>","imagen":"<rect x='3' y='4' width='18' height='16' rx='2'/><circle cx='9' cy='9.5' r='1.5'/><path d='m21 16-5-5-9 9'/>","enlace":"<path d='M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1'/><path d='M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'/>","incrustar":"<rect x='3' y='5' width='18' height='14' rx='2'/><path d='m10 10-2 2 2 2'/><path d='m14 10 2 2-2 2'/>","video":"<rect x='3' y='5.5' width='18' height='13' rx='3'/><path d='m10.5 9.5 4 2.5-4 2.5z'/>","titulo":"<path d='M6 5v14'/><path d='M18 5v14'/><path d='M6 12h12'/>","tamano-texto":"<path d='M3.5 18 8.5 6l5 12'/><path d='M5.2 14h6.6'/><path d='m15 18 2.5-6 2.5 6'/><path d='M15.8 16.2h3.4'/>","gota":"<path d='M12 3s6.5 7 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10 12 3 12 3z'/>","fuente":"<path d='M5 19h4'/><path d='M7 19 12 5l5 14'/><path d='M15 19h4'/><path d='M9.2 13.5h5.6'/>","quitar-formato":"<path d='M5 5h12'/><path d='M11 5 8 18'/><path d='m14 14 5 5'/><path d='m19 14-5 5'/>","calendario":"<rect x='3' y='5' width='18' height='16' rx='2'/><path d='M3 10h18'/><path d='M8 3v4M16 3v4'/>","reloj":"<circle cx='12' cy='12' r='9'/><path d='M12 7v5l3 2'/>","codigo-fuente":"<path d='M9 4H6v16h3'/><path d='M15 4h3v16h-3'/><path d='m13.5 8.5-3 7'/>","lista":"<path d='M9 6h11M9 12h11M9 18h11'/><path d='M4.5 6h.01M4.5 12h.01M4.5 18h.01'/>","lista-numerada":"<path d='M10 6h10M10 12h10M10 18h10'/><path d='M4 4.5h1.5V9'/><path d='M4 9h3'/><path d='M4 14.5a1.5 1.5 0 0 1 3 .2c0 1-3 2.3-3 4.3h3'/>","linea":"<path d='M3 12h18'/><path d='M8 7h8'/><path d='M8 17h8'/>","tabla":"<rect x='3.5' y='4.5' width='17' height='15' rx='2'/><path d='M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10'/>","opciones":"<circle cx='5' cy='12' r='1.1'/><circle cx='12' cy='12' r='1.1'/><circle cx='19' cy='12' r='1.1'/>","subindice":"<path d='m4 6 8 10'/><path d='m12 6-8 10'/><path d='M16 15.5a1.6 1.6 0 0 1 3.2.2c0 1.1-3.2 2.3-3.2 4.3h3.4'/>","superindice":"<path d='m4 8 8 10'/><path d='m12 8-8 10'/><path d='M16 4.5a1.6 1.6 0 0 1 3.2.2c0 1.1-3.2 2.3-3.2 4.3h3.4'/>","desplazar-horizontal":"<path d='M3 12h18'/><path d='m7 8-4 4 4 4'/><path d='m17 8 4 4-4 4'/>","desplazar-vertical":"<path d='M12 3v18'/><path d='m8 7 4-4 4 4'/><path d='m8 17 4 4 4-4'/>","dado":"<rect x='4' y='4' width='16' height='16' rx='3'/><circle cx='9' cy='9' r='1.2' fill='currentColor'/><circle cx='12' cy='12' r='1.2' fill='currentColor'/><circle cx='15' cy='15' r='1.2' fill='currentColor'/>","pegar-texto":"<rect x='5' y='4.5' width='14' height='16' rx='2'/><path d='M9 4.5V3.5h6v1'/><path d='M9 10h6M9 13.5h6M9 17h4'/>"};
  var BOTON = {
    bold: 'negrita', italic: 'cursiva', underline: 'subrayado', strike: 'tachado',
    left: 'alinear-izquierda', center: 'alinear-centro', right: 'alinear-derecha', justify: 'justificar',
    quote: 'citar', code: 'codigo', faspoiler: 'spoiler', fahide: 'ocultar',
    servimg: 'subir-imagen', image: 'imagen', link: 'enlace', embed: 'incrustar', youtube: 'video',
    headers: 'titulo', size: 'tamano-texto', color: 'gota', font: 'fuente', removeformat: 'quitar-formato',
    date: 'calendario', time: 'reloj', source: 'codigo-fuente',
    bulletlist: 'lista', orderedlist: 'lista-numerada', horizontalrule: 'linea', table: 'tabla', more: 'opciones',
    subscript: 'subindice', superscript: 'superindice', fascroll: 'desplazar-horizontal', faupdown: 'desplazar-vertical',
    farand: 'dado', pastetext: 'pegar-texto'
  };

  function vestir() {
    var hechos = 0;
    F.$$('.sceditor-toolbar a.sceditor-button').forEach(function (b) {
      if (b.classList.contains('fj-con-icono')) return;
      var m = b.className.match(/sceditor-button-([\w-]+)/), icono = m && ICONOS[BOTON[m[1]]];
      if (!icono) return;
      var hueco = b.querySelector('div') || b;
      hueco.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icono + '</svg>';
      b.classList.add('fj-con-icono');
      hechos++;
    });
    F.$$('.sceditor-toolbar').forEach(function (t) { t.classList.add('fj-barra'); });
    return hechos;
  }

  // Foroactivo crea el editor después de cargar la página (y la respuesta rápida, a veces más tarde)
  var intentos = 0;
  (function esperar() {
    vestir();
    if (++intentos < 24) setTimeout(esperar, intentos < 8 ? 250 : 1000);
  })();
});

/* cabeceraforo · dentro de un foro con imagen (config.foros[N].img), la cabecera lleva esa imagen en grande,
 * con el lugar (config.foros[N].lugar) encima del nombre. Un subforo sin imagen propia hereda la del foro
 * más cercano de sus migas que la tenga. Marca .fj-forumhead.con-imagen y pone --fj-forohead-img; el resto, la skin. */
FORJA.modulo('cabeceraforo', function (F) {
  if (F.pagina.tipo !== 'foro') return;
  var head = F.$('.fj-forumhead');
  if (!head || head.classList.contains('con-imagen')) return;
  var foros = F.config.foros || {}, ids = [F.pagina.id], conf = null;
  var migas = head.querySelector('.fj-crumbs');
  if (migas) F.$$('a[href]', migas).reverse().forEach(function (a) {
    var m = (a.getAttribute('href') || '').match(/^\/f(\d+)-/);
    if (m) ids.push(+m[1]);
  });
  for (var i = 0; i < ids.length && !conf; i++) {
    var c = foros[ids[i]] || foros['f' + ids[i]];
    if (c && c.img) conf = c;
  }
  if (!conf || !/^https?:\/\//i.test(conf.img)) return;
  head.classList.add('con-imagen');
  F.vars(head, { '--fj-forohead-img': 'url("' + String(conf.img).replace(/"/g, '%22') + '")' });
  if (conf.lugar) {
    var p = document.createElement('p');
    p.className = 'fj-forumhead__lugar';
    p.textContent = conf.lugar;
    head.insertBefore(p, head.querySelector('.fj-forumhead__title'));
  }
});

/* masmenu · el «¡Más!» de Foroactivo (atajos de búsqueda, favoritos, copiar BBCode, imprimir) pasa a ser un botón
 * de icono «⋯» junto a las flechas del tema o al buscador del foro, con su ventana debajo. Se cierra al pulsar fuera.
 * También cambia el «Go» de la ventana de buscar por «Buscar». La forma la pone la skin (.fj-mas, .fj-mas__btn). */
FORJA.modulo('masmenu', function (F) {
  var ir = F.$('#search_menu input[type="submit"]');
  if (ir && /^go$/i.test(ir.value)) ir.value = 'Buscar';

  var menu = document.getElementById('plus_menu');
  var btn = F.$('a[href*="plus_menu"]');
  if (!menu || !btn || menu.hasAttribute('data-fj-mas')) return;
  menu.setAttribute('data-fj-mas', '');
  var texto = btn.textContent.trim() || 'Más';
  btn.className = 'fj-mas__btn fj-ib fj-ib--marco';
  btn.title = 'Más opciones';
  btn.setAttribute('aria-label', 'Más opciones');
  btn.setAttribute('aria-haspopup', 'true');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '<span class="fj-hidden">' + texto + '</span>';
  var salto = btn.nextElementSibling;
  if (salto && salto.tagName === 'BR') salto.parentNode.removeChild(salto);

  var caja = document.createElement('span');
  caja.className = 'fj-mas';
  var flechas = F.$('.fj-topichead .fj-topichead__nav'), acciones = F.$('.fj-forumhead__actions');
  if (flechas) flechas.insertBefore(caja, flechas.firstChild);
  else if (acciones) acciones.appendChild(caja);
  else btn.parentNode.insertBefore(caja, btn);
  caja.appendChild(btn);
  caja.appendChild(menu);

  var abierto = function () { return menu.style.display !== 'none'; };
  btn.addEventListener('click', function () {
    setTimeout(function () { btn.setAttribute('aria-expanded', abierto() ? 'true' : 'false'); }, 0);
  });
  document.addEventListener('click', function (e) {
    if (!caja.contains(e.target) && abierto()) { menu.style.display = 'none'; btn.setAttribute('aria-expanded', 'false'); }
  });
});

/* personalizar · editor visual de tablillas. En cada bloque de código que contiene una tablilla ([code] con
 * class="fj-tb…") añade el botón «Personalizar»: abre la tablilla en una ventana, se escribe encima de ella como en
 * un documento y, en el panel, se cambian el color, las imágenes, los enlaces, los estados y las filas. «Copiar el
 * código» devuelve el HTML limpio, cada bloque en una línea (Foroactivo convierte los saltos en <br>).
 * Textos: config.personalizar = { boton: 'Personalizar' } */
FORJA.modulo('personalizar', function (F) {
  var opc = F.config.personalizar || {};
  var d = document;
  var VARS_COLOR = /^--(tb-color|tb-voz|tb-oro|c-color|g-color)$/;
  var VARS_IMG = /^--(tb-img|tb-portada|foto|rel|c-img|b-img)$/;
  var NOMBRES = { '--tb-color': 'Color de acento', '--tb-voz': 'Color de los diálogos', '--tb-oro': 'Color de los filos', '--tb-img': 'Imagen principal o retrato', '--tb-portada': 'Imagen de cabecera', '--foto': 'Retrato', '--rel': 'Retrato', '--c-color': 'Color de la casa', '--c-img': 'Imagen de la casa', '--g-color': 'Color del grupo', '--b-img': 'Imagen' };
  var ESTADOS = { 'is-ocupado': 'Ocupado', 'is-reservado': 'Reservado', 'is-libre': 'Libre' };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (x) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x]; }); };

  function variables(el) {
    var out = [], st = el.getAttribute('style') || '';
    st.split(';').forEach(function (par) {
      var i = par.indexOf(':'); if (i < 0) return;
      var k = par.slice(0, i).trim(), v = par.slice(i + 1).trim();
      if (VARS_COLOR.test(k) || VARS_IMG.test(k)) out.push([k, v]);
    });
    return out;
  }
  // cualquier color CSS (también oklch o var()) a #rrggbb, pintándolo en un píxel
  function aHex(v, ctx) {
    var el = d.createElement('i');
    el.style.color = v; (ctx || d.body).appendChild(el);
    var col = getComputedStyle(el).color; el.remove();
    var c = d.createElement('canvas'); c.width = c.height = 1;
    var x = c.getContext('2d'); x.fillStyle = col; x.fillRect(0, 0, 1, 1);
    var p = x.getImageData(0, 0, 1, 1).data;
    return '#' + [p[0], p[1], p[2]].map(function (n) { return ('0' + n.toString(16)).slice(-2); }).join('');
  }
  function campoVar(el, k, v) {
    var id = 'fjp' + Math.random().toString(36).slice(2, 8), html;
    if (k === '--tb-color') return campoAcento(el);
    if (VARS_COLOR.test(k)) html = '<input type="color" id="' + id + '" value="' + aHex(v, el) + '">';
    else html = '<input type="url" id="' + id + '" placeholder="https://…" value="' + esc((v.match(/url\(\s*['"]?([^'")]*)/) || [])[1] || '') + '">';
    var p = d.createElement('div');
    p.className = 'fj-pers__campo';
    p.innerHTML = '<label for="' + id + '">' + (NOMBRES[k] || k) + '</label>' + html;
    var inp = p.querySelector('#' + id);
    inp.addEventListener('input', function () {
      el.style.setProperty(k, VARS_COLOR.test(k) ? inp.value : (inp.value ? 'url(' + inp.value.trim() + ')' : 'none'));
    });
    return p;
  }

  // Colores de los grupos del foro: los nombres de la leyenda del índice llevan su color en style
  var grupos = null;
  function coloresDeGrupos(listo) {
    if (grupos) return listo(grupos);
    F.traer('/').then(function (doc) {
      var vistos = {};
      grupos = [];
      F.$$('a[href^="/g"]', doc).forEach(function (a) {
        var n = a.textContent.trim(), c = F.colorDe(a);
        if (!n || !c || vistos[n] || !/^\/g\d+-/.test(a.getAttribute('href'))) return;
        vistos[n] = 1; grupos.push([n, aHex(c)]);
      });
      listo(grupos);
    }).catch(function () { listo(grupos = []); });
  }

  /* Color de acento: el del perfil de quien escribe (se cambia en su perfil), el de un grupo o uno elegido aquí.
   * Con «perfil» la tablilla no lleva --tb-color; con las otras dos lo lleva fijo. */
  function campoAcento(el) {
    var n = 'fja' + Math.random().toString(36).slice(2, 8);
    var actual = (el.getAttribute('style') || '').match(/--tb-color\s*:\s*([^;]+)/);
    var p = d.createElement('div');
    p.className = 'fj-pers__campo fj-pers__acento';
    p.innerHTML = '<span class="fj-pers__titulo">Color de acento</span>' +
      '<label class="fj-pers__op"><input type="radio" name="' + n + '" value="perfil"> Mi color <i class="fj-pers__muestra" data-m="perfil"></i></label>' +
      '<p class="fj-pers__nota" data-nota>Es el campo «Color» de <a href="/profile?mode=editprofile" target="_blank" rel="noopener">tu perfil</a>: cámbialo allí y cambiarán todas tus tablillas.</p>' +
      '<label class="fj-pers__op"><input type="radio" name="' + n + '" value="grupo"> El de un grupo</label>' +
      '<select data-grupos disabled><option>Cargando grupos…</option></select>' +
      '<label class="fj-pers__op"><input type="radio" name="' + n + '" value="otro"> Otro</label>' +
      '<input type="color" data-otro value="' + aHex(actual ? actual[1] : 'var(--tb-color)', el) + '">';
    var radios = F.$$('input[type="radio"]', p), sel = p.querySelector('[data-grupos]'), otro = p.querySelector('[data-otro]');
    var muestra = p.querySelector('[data-m="perfil"]'), nota = p.querySelector('[data-nota]');
    function marcar(v) { radios.forEach(function (r) { r.checked = r.value === v; }); }
    function aplicar() {
      var v = (radios.filter(function (r) { return r.checked; })[0] || {}).value;
      if (v === 'perfil') el.style.removeProperty('--tb-color');
      if (v === 'grupo' && sel.value) el.style.setProperty('--tb-color', sel.value);
      if (v === 'otro') el.style.setProperty('--tb-color', otro.value);
    }
    radios.forEach(function (r) { r.addEventListener('change', aplicar); });
    sel.addEventListener('change', function () { marcar('grupo'); aplicar(); });
    otro.addEventListener('input', function () { marcar('otro'); aplicar(); });
    marcar(actual ? 'otro' : 'perfil');
    colorPropio(function (c) {
      if (c) { muestra.style.background = c; return; }
      muestra.hidden = true;
      nota.innerHTML = 'Aún no tienes color: ponlo en el campo «Color» de <a href="/profile?mode=editprofile" target="_blank" rel="noopener">tu perfil</a> (por ejemplo #c0504d). Mientras, se usa el de tu grupo.';
    });
    coloresDeGrupos(function (lista) {
      sel.disabled = !lista.length;
      sel.innerHTML = lista.length ? lista.map(function (g) { return '<option value="' + g[1] + '" style="color:' + g[1] + '">' + esc(g[0]) + '</option>'; }).join('') : '<option>No hay grupos con color</option>';
      if (actual) {
        var hex = aHex(actual[1], el);
        var g = lista.filter(function (x) { return x[1] === hex; })[0];
        if (g) { sel.value = g[1]; marcar('grupo'); }
      }
    });
    return p;
  }

  // Elementos de texto editables: los que tienen texto propio, sin ser decoración ni el crédito
  function marcarEditables(raiz) {
    F.$$('*', raiz).forEach(function (el) {
      if (el.closest('.fj-tb__credito, [aria-hidden="true"], .fj-ico') || el.closest('[contenteditable]')) return;
      var propio = [].some.call(el.childNodes, function (n) { return n.nodeType === 3 && n.nodeValue.trim(); });
      if (propio || (!el.children.length && /^(B|I|EM|STRONG|SPAN|A|P|H3|H4|LI|DT|DD|TIME|SMALL|BUTTON|BLOCKQUOTE)$/.test(el.tagName))) {
        el.setAttribute('contenteditable', 'true');
        el.setAttribute('spellcheck', 'true');
      }
    });
  }

  function limpiar(raiz) {
    var c = raiz.cloneNode(true);
    F.$$('[contenteditable]', c).concat([c]).forEach(function (e) { e.removeAttribute('contenteditable'); e.removeAttribute('spellcheck'); });
    F.$$('[data-fj-tab], [data-fj-panel]', c).forEach(function (e) {
      ['role', 'aria-selected', 'tabindex', 'hidden', 'aria-controls', 'aria-labelledby'].forEach(function (a) { e.removeAttribute(a); });
      e.classList.remove('is-activa'); if (!e.className) e.removeAttribute('class');
    });
    F.$$('.fj-pers__sel', c).forEach(function (e) { e.classList.remove('fj-pers__sel'); });
    F.$$('[style=""], [class=""]', c).forEach(function (e) { if (e.getAttribute('style') === '') e.removeAttribute('style'); if (e.getAttribute('class') === '') e.removeAttribute('class'); });
    c.removeAttribute('data-fj-pers');
    var abre = c.outerHTML.slice(0, c.outerHTML.indexOf('>') + 1);
    var hijos = [].map.call(c.children, function (h) { return h.outerHTML.replace(/\s*\n\s*/g, ''); });
    return abre + '\n' + hijos.join('\n') + '\n</div>';
  }

  var miColor = null;
  function colorPropio(listo) {
    if (miColor !== null) return listo(miColor);
    var mio = F.$('[data-fj-post] .fj-post__name a[href="/u' + ((window._userdata || {}).user_id) + '"]');
    var post = mio && mio.closest('[data-fj-post]');
    if (post && post.style.getPropertyValue('--fj-autor-color')) return listo(miColor = post.style.getPropertyValue('--fj-autor-color'));
    var id = (window._userdata || {}).user_id, campo = (F.config.ficha || {}).color || 'color';
    if (!id || id < 1) return listo(miColor = '');
    F.traer('/u' + id).then(function (doc) {
      var v = '';
      F.$$('dl, .fj-field', doc).forEach(function (dl) {
        var et = dl.querySelector('dt, .label');
        if (et && F.slug(et.textContent.replace(/:\s*$/, '')) === campo) v = (dl.querySelector('dd, .fj-field__value') || {}).textContent || '';
      });
      v = v.replace(/\s+/g, '');
      listo(miColor = (v && window.CSS && CSS.supports('color', v)) ? v : '');
    }).catch(function () { listo(miColor = ''); });
  }

  function abrir(html, extra) {
    extra = extra || {};
    var capa = d.createElement('div');
    capa.className = 'fj-pers';
    capa.innerHTML = '<div class="fj-pers__ventana" role="dialog" aria-modal="true" aria-label="Personalizar tablilla">' +
      '<div class="fj-pers__lienzo"><p class="fj-pers__ayuda">Escribe directamente sobre la tablilla. Pulsa un texto, un enlace o una fila para ver sus opciones.</p><div class="fj-pers__obra postbody"><div class="content"></div></div></div>' +
      '<aside class="fj-pers__panel"><h3>Personalizar</h3><div class="fj-pers__globales"></div><div class="fj-pers__local"></div>' +
      '<div class="fj-pers__acciones">' + (extra.insertar ? '<button type="button" class="fj-pers__insertar">Insertar en el mensaje</button>' : '') + '<button type="button" class="fj-pers__copiar">Copiar el código</button><button type="button" class="fj-pers__cerrar">Cerrar</button></div></aside></div>';
    d.body.appendChild(capa);
    var cont = capa.querySelector('.content');
    cont.innerHTML = html;
    var tb = cont.querySelector('.fj-tb');
    if (!tb) { capa.remove(); return; }
    tb.setAttribute('data-fj-pers', '');
    if (F.pestanas) F.pestanas(cont);
    marcarEditables(tb);

    var glob = capa.querySelector('.fj-pers__globales');
    var vs = variables(tb);
    if (!vs.some(function (x) { return x[0] === '--tb-color'; })) vs.unshift(['--tb-color', 'var(--tb-color)']);
    vs.forEach(function (x) { glob.appendChild(campoVar(tb, x[0], x[1])); });

    // fuera de un mensaje no hay --fj-autor-color: se toma el campo «Color» del perfil de quien edita
    colorPropio(function (c) { if (c) { cont.style.setProperty('--fj-autor-color', c); refrescarColor(); } });

    function refrescarColor() {
      var otro = glob.querySelector('[data-otro]');
      if (otro && !/--tb-color/.test(tb.getAttribute('style') || '')) otro.value = aHex('var(--tb-color)', tb);
    }
    var local = capa.querySelector('.fj-pers__local');
    function seleccionar(objetivo) {
      F.$$('.fj-pers__sel', tb).forEach(function (e) { e.classList.remove('fj-pers__sel'); });
      local.innerHTML = '';
      var fila = objetivo.closest('li, section, [data-fj-panel] > *');
      if (fila && tb.contains(fila) && fila !== tb) {
        fila.classList.add('fj-pers__sel');
        var caja = d.createElement('div');
        caja.className = 'fj-pers__fila';
        caja.innerHTML = '<h4>' + (fila.tagName === 'SECTION' ? 'Bloque' : 'Fila') + '</h4>';
        variables(fila).forEach(function (x) { caja.appendChild(campoVar(fila, x[0], x[1])); });
        var est = Object.keys(ESTADOS).filter(function (k) { return fila.classList.contains(k); })[0];
        if (est) {
          var sel = d.createElement('div');
          sel.className = 'fj-pers__campo';
          sel.innerHTML = '<label>Estado</label><select>' + Object.keys(ESTADOS).map(function (k) { return '<option value="' + k + '"' + (k === est ? ' selected' : '') + '>' + ESTADOS[k] + '</option>'; }).join('') + '</select>';
          sel.querySelector('select').addEventListener('change', function (e) {
            Object.keys(ESTADOS).forEach(function (k) { fila.classList.remove(k); });
            fila.classList.add(e.target.value);
            var em = fila.querySelector('.fj-tb__estado'); if (em) em.textContent = ESTADOS[e.target.value];
          });
          caja.appendChild(sel);
        }
        var bot = d.createElement('div');
        bot.className = 'fj-pers__botones';
        bot.innerHTML = '<button type="button" data-a="dup">Duplicar</button><button type="button" data-a="sube">Subir</button><button type="button" data-a="baja">Bajar</button><button type="button" data-a="quita">Quitar</button>';
        bot.addEventListener('click', function (e) {
          var a = e.target.getAttribute('data-a'); if (!a) return;
          if (a === 'dup') { var n = fila.cloneNode(true); n.classList.remove('fj-pers__sel'); fila.after(n); }
          if (a === 'sube' && fila.previousElementSibling) fila.previousElementSibling.before(fila);
          if (a === 'baja' && fila.nextElementSibling) fila.nextElementSibling.after(fila);
          if (a === 'quita' && fila.parentNode.children.length > 1) { fila.remove(); local.innerHTML = ''; }
        });
        caja.appendChild(bot);
        local.appendChild(caja);
      }
      var a = objetivo.closest('a');
      if (a && tb.contains(a) && !a.closest('.fj-tb__credito')) {
        var c = d.createElement('div');
        c.className = 'fj-pers__campo';
        c.innerHTML = '<label>Enlace de «' + esc(a.textContent.trim().slice(0, 30)) + '»</label><input type="text" value="' + esc(a.getAttribute('href') || '') + '" placeholder="/t12-… o https://…">';
        c.querySelector('input').addEventListener('input', function (e) { a.setAttribute('href', e.target.value); });
        local.appendChild(c);
      }
      // Icono del sello: uno de Forja (corona, lobo…) o de Lannita Icons (li-crown, li-heraldic li-wolf)
      var caja = objetivo.closest('[aria-hidden="true"]');
      var ico = caja && caja.querySelector('[data-fj-ico], .li');
      if (ico) {
        var ci = d.createElement('div');
        var actual = ico.classList.contains('li') ? [].slice.call(ico.classList).filter(function (c) { return c !== 'li'; }).join(' ') : ico.getAttribute('data-fj-ico');
        ci.className = 'fj-pers__campo';
        ci.innerHTML = '<label>Icono del sello</label><input type="text" value="' + esc(actual) + '" placeholder="corona · li-crown · li-heraldic li-wolf">' +
          '<p class="fj-pers__nota">Los <code>li-…</code> son de <a href="https://icons.lannitacodes.es/" target="_blank" rel="noopener">Lannita Icons</a>: pulsa «Clase» en el icono y pega lo que va después de <code>li </code>.</p>';
        ci.querySelector('input').addEventListener('change', function (e) {
          var v = e.target.value.trim().replace(/^li\s+/, '');
          if (/^li-/.test(v)) { ico.className = 'li ' + v; ico.removeAttribute('data-fj-ico'); }
          else if (v) { ico.className = 'fj-ico'; ico.setAttribute('data-fj-ico', v); }
        });
        local.appendChild(ci);
      }
    }
    tb.addEventListener('click', function (e) {
      if (e.target.closest('a')) e.preventDefault();
      seleccionar(e.target);
    });
    capa.querySelector('.fj-pers__copiar').addEventListener('click', function (e) { F.copiar(limpiar(tb), e.target); });
    if (extra.insertar) capa.querySelector('.fj-pers__insertar').addEventListener('click', function () { var codigo = limpiar(tb); cerrar(); extra.insertar(codigo); });
    var cerrar = function () { capa.remove(); d.removeEventListener('keydown', tecla); };
    var tecla = function (e) { if (e.key === 'Escape') cerrar(); };
    capa.querySelector('.fj-pers__cerrar').addEventListener('click', cerrar);
    capa.addEventListener('mousedown', function (e) { if (e.target === capa) cerrar(); });
    d.addEventListener('keydown', tecla);
  }

  F.$$('dl.codebox').forEach(function (caja) {
    var codigo = caja.querySelector('code, .cont_code'), dt = caja.querySelector('dt');
    if (!codigo || !dt || caja.querySelector('.fj-personalizar') || !/class="fj-tb[\s"]/.test(codigo.innerText)) return;
    var b = d.createElement('button');
    b.type = 'button'; b.className = 'fj-copiar fj-personalizar'; b.textContent = opc.boton || 'Personalizar';
    b.addEventListener('click', function () { abrir(codigo.innerText); });
    dt.appendChild(b);
  });
  F.personalizar = abrir;
});

/* insertar · botón «Tablillas» en la barra del editor (respuesta rápida, publicar y MP). Abre una galería con las
 * tablillas del tema de códigos, cada una con su vista previa: «Insertar» la pega en el mensaje tal cual y
 * «Personalizar» la abre en el editor visual, que devuelve el código ya cambiado al mensaje.
 * De paso quita de la barra los botones que casi nadie usa (fecha, hora, desfile horizontal y vertical) y pone el
 * nuevo botón en su hueco.
 * Config: insertar = { tema: '/t15-', boton: 'Tablillas', quitar: ['date', 'time', 'fascroll', 'faupdown'] } */
FORJA.modulo('insertar', function (F) {
  var opc = F.config.insertar || {};
  if (!opc.tema) return;
  var d = document;
  var QUITAR = opc.quitar || ['date', 'time', 'fascroll', 'faupdown'];
  var ICONO = {"pergamino":"<path d='M5 6a2 2 0 0 1 2-2h11a2 2 0 0 1 0 4H7'/><path d='M7 8v10a2 2 0 0 1-2 2'/><path d='M5 20h11a2 2 0 0 0 2-2V8'/><path d='M10 12h5M10 15h5'/>"};
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (x) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x]; }); };

  // Las tablillas del tema de códigos: cada bloque [code] con una tablilla y el título que lleva delante
  var lista = null;
  function tablillas() {
    if (lista) return Promise.resolve(lista);
    return F.traer(opc.tema, { cacheMinutos: 30 }).then(function (doc) {
      lista = [];
      F.$$('dl.codebox', doc).forEach(function (caja) {
        var c = caja.querySelector('code, .cont_code');
        var html = c && (c.textContent || '').trim();
        if (!html || !/class="fj-tb[\s"]/.test(html)) return;
        var t = '', n = caja;
        while (!t && (n = n.previousElementSibling || (n.parentElement && n.parentElement.previousElementSibling))) {
          if (/^(H[1-6]|STRONG|B)$/.test(n.tagName) || n.querySelector && n.querySelector('h2, h3, h4')) t = n.textContent.trim();
          if (n.matches && n.matches('dl.codebox')) break;
        }
        lista.push({ titulo: t || 'Tablilla ' + (lista.length + 1), html: html });
      });
      return lista;
    });
  }

  // Pegar en el editor (SCEditor de Foroactivo); si no hay editor, en el textarea
  function pegar(contenedor, codigo) {
    var ta = contenedor && contenedor.previousElementSibling;
    if (!ta || ta.tagName !== 'TEXTAREA') ta = d.querySelector('#text_editor_textarea, textarea[name="message"]');
    var $ = window.jQuery, inst = null;
    try { inst = $ && $.fn.sceditor && $(ta).sceditor('instance'); } catch (e) { inst = null; }
    if (inst && inst.insertText) {
      var fuente = typeof inst.sourceMode === 'function' ? inst.sourceMode() : inst.inSourceMode && inst.inSourceMode();
      if (!fuente && inst.toggleSourceMode) inst.toggleSourceMode();
      inst.insertText(codigo + '\n');
      if (!fuente && inst.toggleSourceMode) inst.toggleSourceMode();
      inst.focus && inst.focus();
      return;
    }
    if (ta) {
      var i = ta.selectionStart || ta.value.length;
      ta.value = ta.value.slice(0, i) + codigo + '\n' + ta.value.slice(ta.selectionEnd || i);
      ta.focus();
    }
  }

  function galeria(contenedor) {
    var capa = d.createElement('div');
    capa.className = 'fj-pers fj-elegir';
    capa.innerHTML = '<div class="fj-elegir__ventana" role="dialog" aria-modal="true" aria-label="Tablillas">' +
      '<header class="fj-elegir__cab"><h3>Tablillas</h3><input type="search" placeholder="Buscar…" aria-label="Buscar tablilla">' +
      '<a href="' + esc(opc.tema) + '" target="_blank" rel="noopener">Ver el tema de códigos</a>' +
      '<button type="button" class="fj-elegir__cerrar" aria-label="Cerrar">×</button></header>' +
      '<div class="fj-elegir__rejilla"><p class="fj-elegir__aviso">Cargando las tablillas…</p></div></div>';
    d.body.appendChild(capa);
    var rejilla = capa.querySelector('.fj-elegir__rejilla');
    var cerrar = function () { capa.remove(); d.removeEventListener('keydown', tecla); };
    var tecla = function (e) { if (e.key === 'Escape' && !d.querySelector('.fj-pers:not(.fj-elegir)')) cerrar(); };
    capa.querySelector('.fj-elegir__cerrar').addEventListener('click', cerrar);
    capa.addEventListener('mousedown', function (e) { if (e.target === capa) cerrar(); });
    d.addEventListener('keydown', tecla);

    tablillas().then(function (tbs) {
      if (!tbs.length) { rejilla.innerHTML = '<p class="fj-elegir__aviso">No hay tablillas en el tema de códigos.</p>'; return; }
      rejilla.innerHTML = '';
      tbs.forEach(function (t) {
        var art = d.createElement('article');
        art.className = 'fj-elegir__tarjeta';
        art.setAttribute('data-buscar', t.titulo.toLowerCase());
        art.innerHTML = '<div class="fj-elegir__vista" aria-hidden="true"><div class="fj-elegir__escala postbody"><div class="content">' + t.html + '</div></div></div>' +
          '<h4>' + esc(t.titulo) + '</h4><div class="fj-elegir__botones"><button type="button" data-a="insertar">Insertar</button><button type="button" data-a="personalizar">Personalizar</button></div>';
        if (F.pestanas) F.pestanas(art);
        art.querySelector('[data-a="insertar"]').addEventListener('click', function () { pegar(contenedor, t.html); cerrar(); });
        art.querySelector('[data-a="personalizar"]').addEventListener('click', function () {
          if (!F.personalizar) return pegar(contenedor, t.html);
          F.personalizar(t.html, { insertar: function (codigo) { pegar(contenedor, codigo); cerrar(); } });
        });
        rejilla.appendChild(art);
      });
      var buscar = capa.querySelector('input[type="search"]');
      buscar.addEventListener('input', function () {
        var q = buscar.value.trim().toLowerCase();
        F.$$('.fj-elegir__tarjeta', rejilla).forEach(function (a) { a.hidden = q && a.getAttribute('data-buscar').indexOf(q) < 0; });
      });
      buscar.focus();
    }).catch(function () { rejilla.innerHTML = '<p class="fj-elegir__aviso">No se ha podido cargar el tema de códigos.</p>'; });
  }

  function vestir() {
    F.$$('.sceditor-toolbar').forEach(function (barra) {
      if (barra.querySelector('.fj-insertar')) return;
      var hueco = null;
      QUITAR.forEach(function (n) {
        F.$$('a.sceditor-button-' + n, barra).forEach(function (b) { hueco = hueco || b.parentElement; b.remove(); });
      });
      var a = d.createElement('a');
      a.className = 'sceditor-button fj-insertar fj-con-icono';
      a.href = '#'; a.title = opc.boton || 'Tablillas'; a.setAttribute('unselectable', 'on');
      a.innerHTML = '<div unselectable="on"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONO.pergamino + '</svg></div>';
      a.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); galeria(barra.closest('.sceditor-container')); });
      (hueco || barra.querySelector('.sceditor-group:last-child') || barra).appendChild(a);
      F.$$('.sceditor-group', barra).forEach(function (g) { if (!g.children.length) g.remove(); });
    });
  }

  // Foroactivo crea el editor después de cargar la página (la respuesta rápida, a veces más tarde)
  var intentos = 0;
  (function esperar() {
    vestir();
    if (++intentos < 24) setTimeout(esperar, intentos < 8 ? 250 : 1000);
  })();
});

/* ventanas · abre en una ventana, sin salir del tema, la ficha, la cronología, el baúl… de quien escribe.
 * Pensado para venderse aparte: funciona dentro de Forja (FORJA_CONFIG.ventanas) y también solo, en cualquier foro
 * phpBB3 de Foroactivo, pegando este código y window.FJ_VENTANAS = { … } delante. Trae su propio CSS.
 *
 * config.ventanas = {
 *   campos: [                                   // campos de perfil con un enlace a un tema o mensaje (/t12-…, /t12p34-…)
 *     { campo: 'ficha', texto: 'Ficha' },       // campo = nombre del campo (sin tildes ni mayúsculas da igual)
 *     { campo: 'cronologia', texto: 'Cronología', ico: 'reloj-arena' }  // ico: icono de Forja; icono: emoji o texto (sin Forja)
 *   ],
 *   botones: true,           // crea una fila de botones con texto bajo el perfil del mensaje (sin Forja, siempre)
 *   enlaces: 'a[data-fj-ventana]',  // además, cualquier enlace con este selector abre ventana (también dentro de mensajes)
 *   ancho: '880px',          // ancho máximo de la ventana
 *   textos: { abrir: 'Abrir el tema', cargando: 'Cargando…', error: 'No se ha podido cargar.', cerrar: 'Cerrar' }
 * }
 * Con Forja, los enlaces que crea el módulo ficha (.fj-contact__extra) también abren ventana.
 * Qué enseña: si el enlace apunta a un mensaje (#p34, /t12p34-), ese mensaje; si no, el primero del tema. De ese
 * mensaje, sus tablillas (.fj-tb); si no tiene, todo el texto.
 * Colores con variables propias (--fjv-fondo, --fjv-caja, --fjv-texto, --fjv-suave, --fjv-acento, --fjv-borde,
 * --fjv-radio, --fjv-fuente, --fjv-titulos), que por defecto toman los de la skin de Forja si los hay. */
(function () {
  var d = document, w = window;
  var ICONO = { ficha: '📜', cronologia: '⏳', relaciones: '❦', baul: '🗝', diario: '✒' };
  // Con Forja, iconos de la skin (los nombres de icons/): --fj-ico-<nombre> tiene que estar declarado en la página.
  var ICONO_FORJA = { ficha: 'pergamino', cronologia: 'reloj-arena', relaciones: 'corona', baul: 'cofre', diario: 'pluma' };

  function iniciar(cfg, F) {
    cfg = cfg || {};
    var t = Object.assign({ abrir: 'Abrir el tema', cargando: 'Cargando…', error: 'No se ha podido cargar.', cerrar: 'Cerrar' }, cfg.textos || {});
    var slug = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); };
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (x) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x]; }); };
    var $$ = function (sel, r) { return Array.prototype.slice.call((r || d).querySelectorAll(sel)); };
    var urlValida = function (u) { return /^(https?:\/\/[^\s"'<>]+|\/[^\s"'<>]*)$/i.test(u || '') && (u.charAt(0) === '/' || u.indexOf(location.host) > -1); };
    var campos = (cfg.campos || []).map(function (c) { return typeof c === 'string' ? { campo: c } : c; });

    css(cfg);

    /* --- Botones bajo el perfil de cada mensaje ------------------------------ */
    var conBotones = cfg.botones != null ? cfg.botones : !F;
    if (campos.length && conBotones) {
      $$('.post, [data-fj-post]').forEach(function (post) {
        if (post.querySelector('.fjv-botones')) return;
        var perfil = post.querySelector('.fj-author, .postprofile') || post;
        var fila = d.createElement('div');
        fila.className = 'fjv-botones';
        campos.forEach(function (c) {
          var url = '', etiqueta = c.texto || c.campo;
          $$('.label', perfil).some(function (l) {
            if (slug(l.textContent.replace(/:\s*$/, '')) !== slug(c.campo)) return false;
            var caja = l.closest('.fj-field, dd, li, div') || l.parentNode;
            var a = caja.querySelector('a[href]');
            url = (a ? a.getAttribute('href') : caja.textContent.replace(l.textContent, '')).trim();
            if (F) caja.hidden = true;
            return true;
          });
          if (!urlValida(url)) return;
          var ico = F && (c.ico || ICONO_FORJA[slug(c.campo)])
            ? '<span class="fj-ico" aria-hidden="true" style="--fj-ico:var(--fj-ico-' + esc(c.ico || ICONO_FORJA[slug(c.campo)]) + ')"></span>'
            : '<span aria-hidden="true">' + esc(c.icono || ICONO[slug(c.campo)] || '◆') + '</span>';
          fila.insertAdjacentHTML('beforeend', '<a class="fjv-boton" href="' + esc(url) + '" data-fj-ventana="' + esc(slug(c.campo)) + '" data-fjv-texto="' + esc(etiqueta) + '">' + ico + esc(etiqueta) + '</a>');
        });
        if (fila.children.length) perfil.appendChild(fila);
      });
    }

    /* --- Ventana ------------------------------------------------------------- */
    var selector = [cfg.enlaces || 'a[data-fj-ventana]', '.fjv-boton', F ? '.fj-contact__extra' : ''].filter(Boolean).join(', ');
    var cache = {}, capa = null, volver = null;

    d.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest(selector);
      if (!a || !a.getAttribute('href') || !urlValida(a.getAttribute('href'))) return;
      e.preventDefault();
      // pestañas: todas las ventanas del mismo mensaje
      var post = a.closest('.post, [data-fj-post]');
      var hermanos = post ? $$(selector, post).filter(function (x) { return urlValida(x.getAttribute('href')) && !x.closest('.content'); }) : [];
      if (hermanos.indexOf(a) < 0) hermanos = [a];
      abrir(hermanos, hermanos.indexOf(a), post, a);
    });

    function nombreDe(a) {
      var n = a.getAttribute('data-fjv-texto') || a.getAttribute('title') || a.textContent;
      return (n || 'Ver').replace(/\s+/g, ' ').trim();
    }

    function abrir(enlaces, i, post, origen) {
      cerrar();
      volver = origen;
      var autor = post && post.querySelector('.fj-post__name, .fj-author__name, .postprofile dt strong, .postprofile .username');
      capa = d.createElement('div');
      capa.className = 'fjv';
      capa.innerHTML = '<div class="fjv__ventana" role="dialog" aria-modal="true" aria-labelledby="fjv-titulo" tabindex="-1">' +
        '<header class="fjv__cab"><div class="fjv__quien">' + (autor ? '<span class="fjv__autor">' + esc(autor.textContent.trim()) + '</span>' : '') +
        '<strong class="fjv__titulo" id="fjv-titulo"></strong></div>' +
        '<a class="fjv__abrir" href="#">' + esc(t.abrir) + ' ↗</a>' +
        '<button type="button" class="fjv__cerrar" aria-label="' + esc(t.cerrar) + '">×</button></header>' +
        (enlaces.length > 1 ? '<nav class="fjv__pestanas">' + enlaces.map(function (x, k) { return '<button type="button" data-k="' + k + '">' + esc(nombreDe(x)) + '</button>'; }).join('') + '</nav>' : '') +
        '<div class="fjv__cuerpo"></div></div>';
      if (post) { var col = getComputedStyle(post); ['--fj-group', '--fj-autor-color'].forEach(function (v) { var x = col.getPropertyValue(v); if (x) capa.style.setProperty(v, x.trim()); }); }
      d.body.appendChild(capa);
      d.documentElement.classList.add('fjv-abierta');
      capa.addEventListener('click', function (e) {
        if (e.target === capa || e.target.closest('.fjv__cerrar')) cerrar();
        var p = e.target.closest('.fjv__pestanas button');
        if (p) mostrar(enlaces, +p.getAttribute('data-k'));
      });
      mostrar(enlaces, i);
      capa.querySelector('.fjv__cerrar').focus();
    }

    function mostrar(enlaces, k) {
      if (!capa) return;
      var a = enlaces[k], url = a.getAttribute('href');
      $$('.fjv__pestanas button', capa).forEach(function (b, j) { b.setAttribute('aria-selected', j === k ? 'true' : 'false'); });
      capa.querySelector('.fjv__titulo').textContent = nombreDe(a);
      capa.querySelector('.fjv__abrir').href = url;
      var cuerpo = capa.querySelector('.fjv__cuerpo');
      cuerpo.innerHTML = '<p class="fjv__estado">' + esc(t.cargando) + '</p>';
      cuerpo.scrollTop = 0;
      cargar(url).then(function (nodo) {
        if (!capa || capa.querySelector('.fjv__abrir').getAttribute('href') !== url) return;
        cuerpo.innerHTML = '';
        cuerpo.appendChild(nodo);
        if (F && F.pestanas) F.pestanas(cuerpo); else pestanasSueltas(cuerpo);
      }).catch(function () {
        if (capa) cuerpo.innerHTML = '<p class="fjv__estado">' + esc(t.error) + ' <a href="' + esc(url) + '">' + esc(t.abrir) + '</a></p>';
      });
    }

    function cargar(url) {
      if (!cache[url]) {
        var pagina = url.split('#')[0];
        var traer = F && F.traer ? F.traer(pagina, { cacheMinutos: 5 }) : fetch(pagina, { credentials: 'same-origin' }).then(function (r) {
          if (!r.ok) throw new Error(r.status); return r.text();
        }).then(function (h) { return new DOMParser().parseFromString(h, 'text/html'); });
        cache[url] = traer.then(function (doc) { return extraer(doc, url); });
        cache[url].catch(function () { delete cache[url]; });
      }
      return cache[url].then(function (html) { var c = d.createElement('div'); c.className = 'fjv__obra'; c.innerHTML = html; return c; });
    }

    function extraer(doc, url) {
      var m = url.match(/#p(\d+)|[?&]p=(\d+)|\/t\d+p(\d+)/);
      var post = m && doc.getElementById('p' + (m[1] || m[2] || m[3]));
      if (!post) post = doc.querySelector('[data-fj-post], .post');
      var texto = (post || doc).querySelector('.content, .postbody');
      if (!texto) throw new Error('sin contenido');
      var tablillas = $$('.fj-tb', texto).filter(function (x) { return !x.parentElement.closest('.fj-tb'); });
      var html = tablillas.length ? tablillas.map(function (x) { return x.outerHTML; }).join('') : texto.innerHTML;
      return '<div class="content">' + html.replace(/<script[\s\S]*?<\/script>/gi, '') + '</div>';
    }

    function cerrar() {
      if (!capa) return;
      capa.remove();
      capa = null;
      d.documentElement.classList.remove('fjv-abierta');
      if (volver && volver.focus) volver.focus();
    }

    d.addEventListener('keydown', function (e) {
      if (!capa) return;
      if (e.key === 'Escape') cerrar();
      if (e.key === 'Tab') { // el foco no sale de la ventana
        var f = $$('a[href], button, [tabindex]:not([tabindex="-1"])', capa).filter(function (x) { return x.offsetParent; });
        if (!f.length) return;
        if (e.shiftKey && d.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && d.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });

    if (F) F.ventana = function (url, texto) { var a = d.createElement('a'); a.href = url; a.setAttribute('data-fjv-texto', texto || ''); abrir([a], 0, null, d.activeElement); };
  }

  // Sin Forja: pestañas data-fj-tabs mínimas dentro de la ventana
  function pestanasSueltas(raiz) {
    Array.prototype.forEach.call(raiz.querySelectorAll('[data-fj-tabs]'), function (g) {
      var tabs = g.querySelectorAll('[data-fj-tab]'), panels = g.querySelectorAll('[data-fj-panel]');
      function ir(id) {
        Array.prototype.forEach.call(tabs, function (x) { x.setAttribute('aria-selected', x.getAttribute('data-fj-tab') === id ? 'true' : 'false'); });
        Array.prototype.forEach.call(panels, function (p) { p.hidden = p.getAttribute('data-fj-panel') !== id; });
      }
      if (tabs[0]) ir(tabs[0].getAttribute('data-fj-tab'));
      g.addEventListener('click', function (e) { var x = e.target.closest('[data-fj-tab]'); if (x) { e.preventDefault(); ir(x.getAttribute('data-fj-tab')); } });
    });
  }

  function css(cfg) {
    if (d.getElementById('fjv-css')) return;
    var s = d.createElement('style');
    s.id = 'fjv-css';
    s.textContent = [
      '.fjv{--fjv-fondo:var(--fj-bg,#f4f1ec);--fjv-caja:var(--fj-surface,#fff);--fjv-texto:var(--fj-text,#222);--fjv-suave:var(--fj-text-muted,#666);--fjv-acento:var(--fj-autor-color,var(--fj-group,var(--fj-accent,#8a4b3c)));--fjv-borde:var(--fj-border,#ddd);--fjv-radio:var(--fj-radius-l,10px);--fjv-fuente:var(--fj-font-body,Georgia,serif);--fjv-titulos:var(--fj-font-display,Georgia,serif);',
      'position:fixed;inset:0;z-index:2000;display:grid;place-items:center;padding:3vh 3vw;background:rgb(0 0 0/.62);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);animation:fjv-entra .2s ease-out}',
      '@keyframes fjv-entra{from{opacity:0}}',
      'html.fjv-abierta{overflow:hidden}',
      '.fjv__ventana{display:flex;flex-direction:column;inline-size:min(' + (cfg.ancho || '880px') + ',100%);max-block-size:94vh;overflow:hidden;border:1px solid var(--fjv-borde);border-block-start:3px solid var(--fjv-acento);border-radius:var(--fjv-radio);background:var(--fjv-fondo);color:var(--fjv-texto);font-family:var(--fjv-fuente);box-shadow:0 30px 80px -30px rgb(0 0 0/.9);outline:0}',
      '.fjv__cab,.fjv__pestanas{flex:none}',
      '.fjv__cab{display:flex;align-items:center;gap:1rem;padding:.8rem 1rem .8rem 1.3rem;background:var(--fjv-caja);border-block-end:1px solid var(--fjv-borde)}',
      '.fjv__quien{display:grid;flex:1;min-inline-size:0;line-height:1.2}',
      '.fjv__autor{font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:var(--fjv-acento)}',
      '.fjv__titulo{font:600 1.15rem/1.25 var(--fjv-titulos);color:var(--fjv-texto);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.fjv__abrir{flex:none;font-size:.85rem;color:var(--fjv-suave)!important;text-decoration:none}',
      '.fjv__abrir:hover{color:var(--fjv-acento)!important}',
      '.fjv__cerrar{flex:none;inline-size:2.2rem;block-size:2.2rem;border:1px solid var(--fjv-borde);border-radius:50%;background:transparent;color:var(--fjv-texto);font-size:1.3rem;line-height:1;cursor:pointer}',
      '.fjv__cerrar:hover,.fjv__cerrar:focus-visible{border-color:var(--fjv-acento);color:var(--fjv-acento)}',
      '.fjv__pestanas{display:flex;gap:.3rem;overflow-x:auto;padding:.5rem 1rem 0;background:var(--fjv-caja);border-block-end:1px solid var(--fjv-borde)}',
      '.fjv__pestanas button{flex:none;padding:.45rem .9rem!important;border:0!important;border-radius:0!important;box-shadow:none;background:none!important;color:var(--fjv-suave);font:inherit;font-size:.92rem;cursor:pointer}',
      '.fjv__pestanas button[aria-selected=true]{color:var(--fjv-texto);box-shadow:inset 0 -2px var(--fjv-acento)}',
      '.fjv__cuerpo{flex:1;min-block-size:0;overflow:auto;padding:clamp(.8rem,3vw,1.8rem);overscroll-behavior:contain}',
      '.fjv__cuerpo .content{font-size:inherit;color:inherit}',
      '.fjv__cuerpo .content img{max-inline-size:100%;block-size:auto}',
      '.fjv__estado{margin:2rem 0;text-align:center;font-style:italic;color:var(--fjv-suave)}',
      '.fjv-botones{display:flex;flex-wrap:wrap;justify-content:center;gap:.35rem;margin-block-start:.6rem}',
      '.fjv-boton{display:inline-flex;align-items:center;gap:.4em;padding:.3em .75em;border:1px solid color-mix(in srgb,var(--fj-group,var(--fj-accent,#8a4b3c)) 45%,transparent);border-radius:999px;background:color-mix(in srgb,var(--fj-group,var(--fj-accent,#8a4b3c)) 10%,transparent);color:inherit!important;font-size:.82rem;line-height:1.3;text-decoration:none!important}',
      '.fjv-boton:hover,.fjv-boton:focus-visible{background:color-mix(in srgb,var(--fj-group,var(--fj-accent,#8a4b3c)) 22%,transparent)}',
      '@media (max-width:620px){.fj-author .fjv-botones{grid-column:1/-1}.fjv{padding:0;place-items:stretch}.fjv__ventana{inline-size:100%;max-block-size:none;border-radius:0}.fjv__abrir{display:none}}'
    ].join('\n');
    d.head.appendChild(s);
  }

  if (w.FORJA && w.FORJA.modulo) w.FORJA.modulo('ventanas', function (F) { iniciar(F.config.ventanas, F); });
  else {
    var ir = function () { iniciar(w.FJ_VENTANAS, null); };
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', ir); else ir();
  }
})();

/* perfil · rehace el perfil (/uN y cualquiera de sus pestañas) como una sola página, sin pestañas ni recargas:
 *  - portada: imagen del campo «Cabecera», retrato, grupo, nombre en el color del usuario, rango, estado y cifras
 *    (mensajes y temas enlazan a sus listas);
 *  - accesos: tablillas enlazadas (ficha, cronología, baúl… en ventana con el módulo ventanas), contacto (MP, email,
 *    web, leído de /uNcontact) y, para el dueño, «Editar mis datos»;
 *  - cuerpo: atributos con barra, habilidades, resto de datos, actividad (de /uNstats) y grupos (de /uNgroups);
 *    a un lado, sus últimos temas (de /st/uN).
 * Fuera: amigos, mensajes de los visitantes, premios y la pestaña de contacto.
 * Usa config.ficha (atributos, habilidades, contadores, color), config.ventanas.campos y config.cabeceras.campo.
 * config.perfil = { temas: 5, textos: {…} } */
FORJA.modulo('perfil', function (F) {
  if (F.pagina.tipo !== 'perfil') return;
  var d = document;
  var lay = d.getElementById('profile-advanced-layout');
  if (!lay || lay.hasAttribute('data-fj-perfil')) return;
  lay.setAttribute('data-fj-perfil', '');
  var cfg = F.config.perfil || {}, fc = F.config.ficha || {}, T = cfg.textos || {};
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (x) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x]; }); };
  var id = F.pagina.id, base = '/u' + id;
  var ruta = location.pathname.replace(/^\/u\d+/, '').replace(/\/$/, '');
  // una página de este mismo perfil: la actual si es esa, si no traída (en caché)
  var pagina = function (sufijo) { return ruta === sufijo ? Promise.resolve(d) : F.traer(base + sufijo, { cacheMinutos: 10 }); };

  // --- Lo que trae cualquier pestaña: nombre, grupo, retrato, rango, estado ---------------------
  var nombreEl = d.querySelector('h1.page-title .usr_grp_clr, h1 .usr_grp_clr') || d.querySelector('#profile-advanced-right .usr_grp_clr');
  var nombre = nombreEl ? nombreEl.textContent.trim() : '';
  var grupoN = nombreEl && (nombreEl.className.match(/group-(\d+)/) || [])[1];
  var colorGrupo = nombreEl && F.colorDe(nombreEl);
  var der = d.getElementById('profile-advanced-right');
  var avatar = der && der.querySelector('img');
  var rango = '';
  if (der) [].forEach.call(der.querySelectorAll('.module div'), function (x) {
    var m = x.textContent.match(/Rango\s*:\s*(.+)/); if (m && !rango) rango = m[1].trim();
  });
  var enLinea = der && /en l[ií]nea|online/i.test((der.querySelector('.h3 em') || {}).textContent || '');
  var propio = F.usuario && F.usuario.id === id;

  pagina('').then(montar, function () { montar(d); });

  function montar(fuente) {
    // --- Campos del perfil --------------------------------------------------------------------
    var campos = {}, orden = [];
    F.$$('#profile-advanced-details dl[id^="field_id"]', fuente).forEach(function (dl) {
      var dt = dl.querySelector('dt'), v = dl.querySelector('.field_uneditable') || dl.querySelector('dd');
      if (!dt || !v) return;
      var et = dt.textContent.replace(/\s*:\s*$/, '').trim(), slug = F.slug(et), txt = v.textContent.replace(/ /g, ' ').trim();
      if (!txt || txt === '-') return;
      campos[slug] = { et: et, txt: txt, html: v.innerHTML };
      orden.push(slug);
    });
    var usados = {};
    var tomar = function (slug) { if (!slug || !campos[slug]) return null; usados[slug] = 1; return campos[slug]; };
    var color = tomar(fc.color);
    var acento = color && window.CSS && CSS.supports('color', color.txt.replace(/\s+/g, '')) ? color.txt.replace(/\s+/g, '') : colorGrupo;
    var cab = tomar((F.config.cabeceras || {}).campo || 'cabecera');
    var mensajes = tomar('mensajes'), desde = tomar('fecha-de-inscripcion');

    // --- Portada: cifras ----------------------------------------------------------------------
    var cifra = function (n, et, extra, href) {
      var tag = href ? 'a' : 'div';
      return '<' + tag + ' class="fj-perfil__cifra"' + (href ? ' href="' + href + '"' : '') + (extra || '') + '><b>' + esc(n) + '</b><span>' + esc(et) + '</span></' + tag + '>';
    };
    var cifras = (mensajes ? cifra(mensajes.txt, T.mensajes || 'Mensajes', '', '/spa' + base) : '') +
      cifra('·', T.temas || 'Temas', ' data-fj-perfil-temas', '/st' + base);
    (fc.contadores || []).forEach(function (s) { var c = tomar(s); if (c && s !== 'mensajes') cifras += cifra(c.txt, c.et); });
    if (desde) cifras += cifra(desde.txt, T.desde || 'Desde');

    // --- Accesos: tablillas, contacto, editar ---------------------------------------------------
    var boton = function (href, texto, ico, extra) {
      return '<a class="fj-perfil__boton" href="' + esc(href) + '"' + (extra || '') + ' data-i="' + ico + '">' + esc(texto) + '</a>';
    };
    var icoEnlace = { ficha: 'pergamino', cronologia: 'reloj-arena', baul: 'cofre' };
    var enlaces = fc.enlaces || ((F.config.ventanas || {}).campos || []).map(function (c) { return F.slug(c.campo || c); });
    if (!enlaces.length) enlaces = ['ficha', 'cronologia', 'baul'];
    var acc = '';
    enlaces.forEach(function (s) {
      var c = tomar(s); if (!c) return;
      var href = (c.txt.match(/^(https?:\/\/\S+|\/\S+)/) || [])[1]; if (!href) return;
      acc += boton(href, c.et, icoEnlace[s] || 'enlace', ' data-fj-ventana="' + esc(s) + '" data-fjv-texto="' + esc(c.et) + '"');
    });
    if (propio) acc += boton('/profile?mode=editprofile', T.editar || 'Editar mis datos', 'editar');

    // --- Cuerpo ---------------------------------------------------------------------------------
    var atr = '', max = fc.maximo || 10;
    (fc.atributos || []).forEach(function (s) {
      var c = tomar(s); if (!c) return;
      atr += '<div class="fj-perfil__atr" style="--v:' + Math.min(parseFloat(c.txt) || 0, max) + ';--m:' + max + '"><span>' + esc(c.et) + '</span><b>' + esc(c.txt) + '</b><i></i></div>';
    });
    var hab = tomar(fc.habilidades);
    var habs = hab ? hab.txt.split(/\s*[,;·]\s*/).filter(Boolean).map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') : '';
    var resto = orden.filter(function (s) { return !usados[s]; }).map(function (s) {
      return '<div><dt>' + esc(campos[s].et) + '</dt><dd>' + campos[s].html + '</dd></div>';
    }).join('');
    var caja = function (titulo, cuerpo, extra) { return '<section class="fj-perfil__caja"' + (extra || '') + '><h3>' + esc(titulo) + '</h3>' + cuerpo + '</section>'; };

    var s = d.createElement('section');
    s.className = 'fj-perfil';
    if (acento) s.style.setProperty('--fj-perfil-color', acento);
    if (cab) { var url = (cab.txt.match(/https?:\/\/\S+/) || [])[0]; if (url) s.style.setProperty('--fj-perfil-cab', 'url("' + url.replace(/"/g, '%22') + '")'); }
    s.innerHTML =
      '<header class="fj-perfil__cab">' +
        '<div class="fj-perfil__retrato">' + (avatar ? '<img src="' + esc(avatar.src) + '" alt="">' : '') + (enLinea ? '<span class="fj-perfil__linea" title="' + esc(T.enLinea || 'En línea') + '"></span>' : '') + '</div>' +
        '<div class="fj-perfil__id">' +
          '<p class="fj-perfil__ante" data-fj-perfil-grupo>' + (enLinea ? esc(T.enLinea || 'En línea') : '') + '</p>' +
          '<h2 class="fj-perfil__nombre">' + esc(nombre) + '</h2>' +
          (rango ? '<p class="fj-perfil__rango">' + esc(rango) + '</p>' : '') +
          '<div class="fj-perfil__cifras">' + cifras + '</div>' +
        '</div>' +
      '</header>' +
      '<nav class="fj-perfil__acciones" data-fj-perfil-acciones>' + acc + '</nav>' +
      '<div class="fj-perfil__cuerpo"><div class="fj-perfil__col">' +
        (atr ? caja(T.atributos || 'Atributos', '<div class="fj-perfil__atrs">' + atr + '</div>') : '') +
        (habs ? caja(T.habilidades || hab.et, '<ul class="fj-perfil__habs">' + habs + '</ul>') : '') +
        (resto ? caja(T.datos || 'Datos', '<dl class="fj-perfil__datos">' + resto + '</dl>') : '') +
        caja(T.grupos || 'Grupos', '<p class="fj-perfil__vacio">…</p>', ' data-fj-perfil-grupos hidden') +
      '</div><aside class="fj-perfil__col">' +
        caja(T.ultimos || 'Últimas apariciones', '<ol class="fj-perfil__temas" data-fj-perfil-ultimos><li class="fj-perfil__vacio">…</li></ol>') +
        caja(T.actividad || 'Actividad', '<p class="fj-perfil__vacio">…</p>', ' data-fj-perfil-actividad hidden') +
      '</aside></div>';
    lay.parentNode.insertBefore(s, lay);
    d.documentElement.classList.add('fj-perfil-listo');
    var $ = function (sel) { return s.querySelector(sel); };

    // nombre del grupo y colores de grupos (leyenda de /groups)
    var leyenda = F.traer('/groups', { cacheMinutos: 60 });
    if (grupoN) leyenda.then(function (doc) {
      var a = doc.querySelector('a[href^="/g' + grupoN + '-"]'), p = $('[data-fj-perfil-grupo]');
      if (a && p) p.textContent = a.textContent.trim() + (enLinea ? ' · ' + (T.enLinea || 'En línea') : '');
    }).catch(function () {});

    // contacto: MP, email, web… como botones de la portada (no al propio usuario)
    if (!propio) pagina('contact').then(function (doc) {
      var ico = function (t) { return /mail/i.test(t) ? 'mensajes' : /privad/i.test(t) ? 'pluma' : 'enlace'; };
      var nav = $('[data-fj-perfil-acciones]'), editar = nav.querySelector('[data-i="editar"]');
      F.$$('#cp-main dl', doc).forEach(function (dl) {
        var a = dl.querySelector('dd a[href]'), t = ((dl.querySelector('dt') || {}).textContent || '').replace(/\s*:\s*$/, '').trim();
        if (!a || !t) return;
        nav.insertAdjacentHTML('beforeend', boton(a.getAttribute('href'), /privad/i.test(t) ? (T.mp || 'Escribir') : t, ico(t), a.target ? ' target="_blank" rel="noopener"' : ''));
      });
      if (editar) nav.appendChild(editar);
    }).catch(function () {});

    // actividad (de las estadísticas): ritmo, fechas y enlaces a sus listas; sin amigos, MP, alta ni visitantes
    pagina('stats').then(function (doc) {
      var filas = '', botones = '', vistos = {};
      var corto = function (h) {
        if (/^\/spa\//.test(h)) return [T.verMensajes || 'Todos sus mensajes', 'mensajes'];
        if (/^\/sta\//.test(h)) return [T.verParticipa || 'Temas en los que participa', 'libro'];
        if (/^\/st\//.test(h)) return [T.verTemas || 'Temas que ha abierto', 'libro'];
        return null;
      };
      F.$$('#cp-main fieldset', doc).forEach(function (fs) {
        if (/visitante/i.test((fs.querySelector('legend') || {}).textContent || '')) return;
        F.$$('li', fs).forEach(function (li) {
          var lab = li.querySelector('label'), a = li.querySelector('a');
          var et = lab ? lab.textContent.replace(/\s*:\s*$/, '').trim() : '';
          var val = li.textContent.replace(lab ? lab.textContent : '', '').trim();
          var k = a && corto(a.getAttribute('href') || '');
          if (k && !vistos[k[0]]) { vistos[k[0]] = 1; botones += boton(a.getAttribute('href'), k[0], k[1]); }
          if (!val || /amig|inscrit|privad|cantidad|^mensajes$/i.test(et)) return;
          filas += '<div><dt>' + esc(et) + '</dt><dd>' + esc(val) + '</dd></div>';
        });
      });
      var c = $('[data-fj-perfil-actividad]');
      if (!filas && !botones) return;
      c.innerHTML = '<h3>' + esc(T.actividad || 'Actividad') + '</h3>' + (filas ? '<dl class="fj-perfil__datos fj-perfil__datos--cifras">' + filas + '</dl>' : '') + (botones ? '<div class="fj-perfil__mas">' + botones + '</div>' : '');
      c.hidden = false;
    }).catch(function () {});

    // grupos, como tarjetas con su color
    pagina('groups').then(function (doc) {
      var tarjetas = F.$$('.message-block', doc).map(function (b) {
        var tx = b.querySelectorAll('.message-text > div'), a = b.querySelector('.message-footer a');
        var est = tx[1] ? (tx[1].querySelector('i') || tx[1]).textContent.trim() : '';
        return '<a class="fj-perfil__grupo" href="' + esc(a ? a.getAttribute('href') : '#') + '" data-g="' + ((b.id.match(/g(\d+)/) || [])[1] || '') + '">' +
          '<b>' + esc(((b.querySelector('.message-header strong') || {}).textContent || '').trim()) + '</b>' +
          '<span>' + esc(tx[0] ? tx[0].textContent.trim() : '') + '</span>' + (est ? '<i>' + esc(est) + '</i>' : '') + '</a>';
      }).join('');
      if (!tarjetas) return;
      var c = $('[data-fj-perfil-grupos]');
      c.innerHTML = '<h3>' + esc(T.grupos || 'Grupos') + '</h3><div class="fj-perfil__grupos">' + tarjetas + '</div>';
      c.hidden = false;
      leyenda.then(function (ley) {
        F.$$('.fj-perfil__grupo[data-g]', c).forEach(function (t) {
          var l = ley.querySelector('a[href^="/g' + t.getAttribute('data-g') + '-"]'), col = l && F.colorDe(l);
          if (col) t.style.setProperty('--g', col);
        });
      }).catch(function () {});
    }).catch(function () {});

    // sus temas: cuántos y los últimos
    F.traer('/st' + base, { cacheMinutos: 10 }).then(function (doc) {
      var n = ((doc.querySelector('h1') || {}).textContent || '').match(/\d+/);
      var c = $('[data-fj-perfil-temas] b'); if (c) c.textContent = n ? n[0] : '0';
      var temas = F.$$('a.topictitle', doc).slice(0, cfg.temas || 5);
      $('[data-fj-perfil-ultimos]').innerHTML = temas.length ? temas.map(function (a) {
        var fila = a.closest('li.row, tr, .row'), foro = fila && fila.querySelector('a[href^="/f"]');
        return '<li><a href="' + esc(a.getAttribute('href')) + '">' + esc(a.textContent.trim()) + '</a>' + (foro ? '<span>' + esc(foro.textContent.trim()) + '</span>' : '') + '</li>';
      }).join('') : '<li class="fj-perfil__vacio">' + esc(T.sinTemas || 'Aún no ha escrito en ningún tema.') + '</li>';
    }).catch(function () { var c = $('[data-fj-perfil-temas]'); if (c) c.remove(); });
  }
});

/* busqueda · rehace los resultados de búsqueda (/search, y los atajos de perfil /spa/…, /st/…, /sta/…):
 *  - cabecera con el número de resultados y, si vienen de un perfil, «Mensajes de X» / «Temas de X» y vuelta al perfil;
 *  - mensajes como tarjetas: foro › tema y fecha, el texto recortado con un degradado y «Leer en el tema»;
 *  - temas como filas: título, foro y autor, respuestas y vistas, y el último mensaje.
 * Si la página no tiene resultados (formulario de búsqueda, «no se encontró nada»), no toca nada.
 * config.busqueda = { textos: {…} } */
FORJA.modulo('busqueda', function (F) {
  var d = document, p = location.pathname;
  if (!/^\/(search|spa|st|sta)(\/|$)/.test(p)) return;
  var mc = d.getElementById('main-content') || d.body;
  var posts = F.$$('div.search.post', mc), filas = F.$$('ul.topiclist.search > li.row', mc);
  if (!posts.length && !filas.length) return;
  var T = (F.config.busqueda || {}).textos || {};
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (x) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x]; }); };
  var enlace = function (a, extra) { return a ? '<a href="' + esc(a.getAttribute('href')) + '"' + (extra || '') + '>' + esc(a.textContent.trim()) + '</a>' : ''; };
  var textoFinal = function (el) {
    var t = el ? [].filter.call(el.childNodes, function (n) { return n.nodeType === 3 && n.textContent.trim(); }).map(function (n) { return n.textContent.trim(); }) : [];
    return t.length ? t[t.length - 1] : '';
  };

  var h1 = mc.querySelector('h1.page-title') || mc.querySelector('h1');
  var h1t = h1 ? h1.textContent.trim() : '';
  var total = (h1t.match(/\d+/) || [''])[0];
  var tipo = /^\/spa\//.test(p) ? 'mensajes' : /^\/sta\//.test(p) ? 'participa' : /^\/st\//.test(p) ? 'temas' : '';
  var autor = mc.querySelector('.postprofile .author a[href^="/u"], .span-tab a[href^="/u"]');
  var uid = (p.match(/^\/st?a?\/u(\d+)/) || p.match(/^\/spa\/u(\d+)/) || [])[1];
  var perfil = tipo ? (uid ? '/u' + uid : autor && autor.getAttribute('href')) : '';
  var nombre = tipo ? (autor ? autor.textContent.trim() : h1t.replace(/^.*?\bpara\s+/, '')) : '';
  var titulo = tipo === 'mensajes' ? (T.mensajesDe || 'Mensajes de') + ' ' + nombre
    : tipo === 'temas' ? (T.temasDe || 'Temas de') + ' ' + nombre
    : tipo === 'participa' ? (T.participa || 'Temas en los que participa') + ' ' + nombre : h1t;

  var s = d.createElement('section');
  s.className = 'fj-res';
  var cab = '<header class="fj-res__cab"><p class="fj-res__ante">' + esc(T.busqueda || 'Búsqueda') + (total ? ' · ' + esc(total) + ' ' + esc(total === '1' ? (T.resultado || 'resultado') : (T.resultados || 'resultados')) : '') + '</p>' +
    '<h1 class="fj-res__titulo">' + esc(titulo) + '</h1>' +
    (perfil ? '<a class="fj-res__volver" href="' + esc(perfil) + '">' + esc(T.volver || 'Volver al perfil') + '</a>' : '') + '</header>';
  s.innerHTML = cab + '<div class="fj-res__lista"></div><footer class="fj-res__pie"></footer>';
  var lista = s.querySelector('.fj-res__lista');

  posts.forEach(function (post) {
    var pb = post.querySelector('.postbody'), h2 = pb && pb.querySelector('h2'), a = h2 && h2.querySelector('a');
    var pp = post.querySelector('.postprofile');
    var foro = pp && pp.querySelector('a.postdetails[href^="/f"]'), tema = pp && pp.querySelector('a.postdetails[href^="/t"]');
    var dds = pp ? F.$$('dd', pp) : [], fecha = dds[0] ? dds[0].textContent.trim() : '';
    var quien = !tipo && pp && pp.querySelector('.author a[href^="/u"]');
    var art = d.createElement('article');
    art.className = 'fj-res__msg';
    art.innerHTML = '<p class="fj-res__meta">' + enlace(foro) + (foro && tema ? '<span aria-hidden="true">›</span>' : '') + enlace(tema, ' class="fj-res__tema-nombre"') +
      (quien ? '<span>' + esc(T.por || 'por') + ' ' + enlace(quien) + '</span>' : '') + (fecha ? '<time>' + esc(fecha) + '</time>' : '') + '</p>' +
      '<div class="fj-res__texto"></div>' +
      (a ? '<a class="fj-res__leer" href="' + esc(a.getAttribute('href')) + '">' + esc(T.leer || 'Leer en el tema') + '</a>' : '');
    if (h2) h2.remove();
    if (pb) art.querySelector('.fj-res__texto').appendChild(pb);
    lista.appendChild(art);
    post.remove();
  });

  if (filas.length) {
    var ol = d.createElement('ol');
    ol.className = 'fj-res__temas';
    filas.forEach(function (li) {
      var t = li.querySelector('a.topictitle'), tab = li.querySelector('.span-tab');
      var foro = tab && tab.querySelector('a[href^="/f"]'), quien = tab && tab.querySelector('a[href^="/u"]');
      var res = (li.querySelector('dd.posts') || {}).textContent, vis = (li.querySelector('dd.views') || {}).textContent;
      var lp = li.querySelector('dd.lastpost'), lpQuien = lp && lp.querySelector('a[href^="/u"]'), lpIr = lp && lp.querySelector('a[href*="#"]');
      var lpFecha = lp ? textoFinal(lp.querySelector('span') || lp) : '';
      var fila = d.createElement('li');
      fila.innerHTML = '<div class="fj-res__principal">' + (t ? '<a class="fj-res__t" href="' + esc(t.getAttribute('href')) + '">' + esc(t.textContent.trim()) + '</a>' : '') +
        '<span class="fj-res__donde">' + (foro ? esc(T.en || 'en') + ' ' + enlace(foro) : '') + (quien && !tipo ? ' · ' + esc(T.por || 'por') + ' ' + enlace(quien) : '') + '</span></div>' +
        '<div class="fj-res__num"><b>' + esc((res || '0').trim()) + '</b><span>' + esc(T.respuestas || 'respuestas') + '</span></div>' +
        '<div class="fj-res__num"><b>' + esc((vis || '0').trim()) + '</b><span>' + esc(T.vistas || 'vistas') + '</span></div>' +
        '<div class="fj-res__ultimo">' + (lpQuien ? enlace(lpQuien) : '') + (lpFecha ? '<span>' + esc(lpFecha) + '</span>' : '') +
        (lpIr ? '<a class="fj-res__ir" href="' + esc(lpIr.getAttribute('href')) + '" aria-label="' + esc(T.ultimo || 'Ir al último mensaje') + '">→</a>' : '') + '</div>';
      ol.appendChild(fila);
    });
    lista.appendChild(ol);
    var bloque = filas[0].closest('.forumbg, .forabg');
    if (bloque) bloque.remove(); else F.$$('ul.topiclist', mc).forEach(function (u) { u.remove(); });
  }

  F.$$('.pagination', mc).forEach(function (pg) { if (pg.textContent.trim()) s.querySelector('.fj-res__pie').appendChild(pg); });
  if (h1) { h1.parentNode.insertBefore(s, h1); h1.remove(); } else mc.insertBefore(s, mc.firstChild);
  d.documentElement.classList.add('fj-res-listo');
});

FORJA.listo(FORJA.arrancar);
