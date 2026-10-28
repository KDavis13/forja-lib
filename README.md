# Forja · librería pública

Archivos que cargan los foros hechos con Forja desde jsDelivr. Se generan en el repositorio privado
`forja` con `node tools/publicar-lib.mjs`; no se editan aquí.

| Archivo | Para qué | jsDelivr (v0.2.0) |
| --- | --- | --- |
| `lib/dist/forja.min.js` | Librería JS `window.FORJA` para Foroactivo | https://cdn.jsdelivr.net/gh/KDavis13/forja-lib@v0.2.0/lib/dist/forja.min.js |
| `lib/dist/forja.js` | La misma, legible | https://cdn.jsdelivr.net/gh/KDavis13/forja-lib@v0.2.0/lib/dist/forja.js |
| `icons/dist/forja-iconos.css` | Iconos como variables CSS (`.fj-ico[data-fj-ico]`) | https://cdn.jsdelivr.net/gh/KDavis13/forja-lib@v0.2.0/icons/dist/forja-iconos.css |
| `icons/dist/galeria.html` | Muestrario de iconos | — |
| `recursos/dist/forja-recursos.css` | Texturas y ornamentos | https://cdn.jsdelivr.net/gh/KDavis13/forja-lib@v0.2.0/recursos/dist/forja-recursos.css |

## Uso en Foroactivo

Módulos > HTML & Javascript > Gestión de los códigos Javascript, «En todas las páginas»:

```js
window.FORJA_CONFIG = { skin: 'mi-skin', staff: [{ id: 1, rol: 'Administración' }] };
(function (d) { var s = d.createElement('script'); s.src = 'https://cdn.jsdelivr.net/gh/KDavis13/forja-lib@v0.2.0/lib/dist/forja.min.js'; d.head.appendChild(s); })(document);
```

Fija siempre una versión (`@v0.2.0`): `@main` cambia con cada envío.
