/*! Forja 0.2.0 · librería para skins de Foroactivo · módulos: preferencias, estado, grupos, listas, campos, numeros, pestanas, desplegables, usuario, tablon, tooltips, copiar, borrador, anclas */
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
    tamanos: [0.88, 1, 1.12, 1.25],
    staff: [],                // [{ id, nombre, rol, color, avatar }]
    selectorAvatarPerfil: '#profile-advanced-right .module img, #profile-advanced-right img, .profile-avatar img, dl.left-box dt img',
    tooltips: '[data-fj-tip]',
    depurar: false
  };

  var F = {
    version: '0.2.0',
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
});

/* listas · foros y temas del índice y de los subforos.
 * - Estado de lectura: convierte el icono de Foroactivo (FORUM_FOLDER_IMG / TOPIC_FOLDER_IMG)
 *   en clases is-nuevo, is-cerrado, is-fijo, is-anuncio.
 * - Datos por foro desde su descripción (panel > Foros), sin tocar plantillas:
 *     <span data-fj-img="https://…"></span>     imagen del foro → --fj-forum-img
 *     <span data-fj-color="#9c3232"></span>     color propio      → --fj-forum-color
 *     <span data-fj-icono="espada"></span>      icono de Forja    → data-fj-icono en el foro
 *     <span data-fj-enlace="/h1-guia"></span>   «falso subforo»: el foro lleva a esa dirección
 *   (los iconos que se usen así hay que añadirlos a "iconos_extra" en skin.json) */
FORJA.modulo('listas', function (F) {
  function estado(el, img) {
    if (!img) return;
    var s = (img.getAttribute('src') || '').toLowerCase();
    if (/unread|new|nuevo/.test(s)) el.classList.add('is-nuevo');
    if (/lock|locked|closed/.test(s)) el.classList.add('is-cerrado');
    if (/sticky/.test(s)) el.classList.add('is-fijo');
    if (/announce/.test(s)) el.classList.add('is-anuncio');
  }

  F.$$('[data-fj-forum]').forEach(function (foro) {
    estado(foro, foro.querySelector('.fj-forum__state'));
    var desc = foro.querySelector('.fj-forum__desc');
    if (!desc) return;
    var img = desc.querySelector('[data-fj-img]');
    if (img) {
      F.vars(foro, { '--fj-forum-img': 'url("' + img.getAttribute('data-fj-img').replace(/"/g, '%22') + '")' });
      foro.classList.add('tiene-imagen');
    }
    var col = desc.querySelector('[data-fj-color]');
    if (col) F.vars(foro, { '--fj-forum-color': col.getAttribute('data-fj-color') });
    var ico = desc.querySelector('[data-fj-icono]');
    if (ico) foro.setAttribute('data-fj-icono', ico.getAttribute('data-fj-icono'));
    // Hueco para icono o inicial (variantes como foro/medallon)
    var hueco = foro.querySelector('.fj-forum__icono');
    if (hueco) {
      if (ico) { hueco.classList.add('fj-ico'); hueco.setAttribute('data-fj-ico', ico.getAttribute('data-fj-icono')); }
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
  });

  F.$$('[data-fj-topic]').forEach(function (tema) {
    estado(tema, tema.querySelector('.fj-topic__state'));
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
 *   → <p><span class="fj-num">26.115</span> Nuestros miembros han publicado… mensajes</p> */
FORJA.modulo('numeros', function (F) {
  F.$$('[data-fj-numero]').forEach(function (el) {
    if (el.querySelector('.fj-num')) return;
    var recorrer = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var nodo;
    while ((nodo = recorrer.nextNode())) {
      var m = nodo.nodeValue.match(/\d[\d.,]*/);
      if (!m) continue;
      var n = parseInt(m[0].replace(/[.,]/g, ''), 10);
      var span = document.createElement('span');
      span.className = 'fj-num';
      span.textContent = isNaN(n) ? m[0] : n.toLocaleString('es-ES');
      nodo.nodeValue = nodo.nodeValue.replace(m[0], '').replace(/\s{2,}/g, ' ');
      el.insertBefore(span, el.firstChild);
      break;
    }
  });
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

/* usuario · tarjeta del usuario conectado en cualquier [data-fj-user-card].
 * Conectado: avatar, nombre con su color y enlaces a perfil y mensajes.
 * Invitado: enlaces a conectarse y registrarse. */
FORJA.modulo('usuario', function (F) {
  var u = F.usuario;
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
 *   tablón cambia (con la caché de config.cacheMinutos). */
FORJA.modulo('tablon', function (F) {
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  F.$$('[data-fj-staff]').forEach(function (caja) {
    var lista = F.config.staff || [];
    if (!lista.length) return;
    caja.innerHTML = '';
    caja.style.setProperty('--fj-staff-count', lista.length);
    lista.forEach(function (s) {
      var a = document.createElement('a');
      a.className = 'fj-staff__card';
      a.href = '/u' + s.id;
      if (s.color) a.style.setProperty('--fj-staff-color', s.color);
      a.innerHTML = '<img alt="" loading="lazy" src="' + esc(s.avatar || '') + '"' + (s.avatar ? '' : ' hidden') + '>' +
        '<span class="fj-staff__name">' + esc(s.nombre || '…') + '</span>' +
        (s.rol ? '<span class="fj-staff__role">' + esc(s.rol) + '</span>' : '');
      caja.appendChild(a);
      if (s.avatar && s.nombre && s.color) return;
      F.traer('/u' + s.id).then(function (doc) {
        var img = doc.querySelector(F.config.selectorAvatarPerfil);
        var im = a.querySelector('img');
        if (!s.avatar && img) { im.src = img.getAttribute('src'); im.hidden = false; }
        if (!s.nombre) {
          var t = doc.querySelector('h1 span[style], h1') || doc.querySelector('title');
          var nombre = t ? t.textContent.replace(/^.*?-\s*/, '').trim() : '';
          a.querySelector('.fj-staff__name').textContent = nombre;
          if (!s.color) { var col = F.colorDe(doc.querySelector('h1')); if (col) a.style.setProperty('--fj-staff-color', col); }
        }
      }).catch(function (e) { F.log('staff', e); });
    });
  });

  F.$$('[data-fj-feed]').forEach(function (caja) {
    var url = caja.getAttribute('data-fj-feed');
    if (!url || url === '#') return;
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

FORJA.listo(FORJA.arrancar);
