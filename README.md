# 🎬 Academia de Cine & Video con IA

Recurso de formación: cinematografía + producción de video con IA, de cero a experto.
15 módulos (00–14) en pestañas **A · Fundamento / B · Con IA / C · Taller / D · Evaluación**,
con láminas explicativas, prompts reproducibles, talleres de generación con auto-corrección,
quizzes y glosario. El progreso se guarda en el navegador (`localStorage`), sin cuentas ni servidor.

> **Vista previa:** estética de "sala de grading" — modo oscuro grafito con acentos ámbar
> tungsteno y teal (con modo claro automático), barra lateral con los módulos por *tier* y
> el progreso, y cada módulo con sus cuatro pestañas.
> _(Agregar aquí una captura: `docs/preview.png`.)_

## Estructura

```
index.html              Toda la academia: estilos, contenido, datos (JSON) y lógica inline
assets/img/*.jpg        Las 61 láminas (nombradas por módulo: m1-shutter-180.jpg, …)
favicon.svg             Ícono
vercel.json             Cabeceras de seguridad (CSP con hashes)
scripts/check-site.mjs  Verificador de enlaces/recursos locales, a11y básica y hashes CSP
.github/                CI (validación, enlaces, gitleaks) y Dependabot
```

Las láminas antes iban embebidas en base64 dentro de `index.html` (9,2 MB, imposible de
revisar en un diff). Se extrajeron byte a byte a `assets/img/` (el HTML quedó en ~0,6 MB),
con `width`/`height` para evitar saltos de layout y `loading="lazy"` para no descargarlas
hasta que se ven. Se verificó con capturas de cada sección y pestaña que el render es idéntico.

## Desarrollo local

Requisitos: Python 3 (para servir) y Node.js ≥ 18 (solo para las verificaciones).

```bash
npm run serve        # = python3 -m http.server 8000 → http://localhost:8000
```

No hay build ni dependencias que instalar.

## Verificaciones

```bash
npm run check        # html-validate (versión fijada) + enlaces/recursos locales + a11y + hashes CSP
node scripts/check-site.mjs --base-url http://localhost:8000/   # además verifica por HTTP que todo responde 200
lychee --config lychee.toml './**/*.html'                       # enlaces externos (opcional, requiere lychee)
```

En GitHub Actions (`.github/workflows/checks.yml`) corren en cada push/PR:

- **html-validate** (`.htmlvalidate.json`; solo se desactivan `no-inline-style` y `long-title`, patrones intencionales).
- **Enlaces y recursos locales**, en disco y sirviendo el sitio por HTTP.
- **lychee** para enlaces externos — informativo, no bloquea.
- **gitleaks** sobre todo el historial.

Dependabot mantiene actualizadas las GitHub Actions.

## Despliegue (Vercel)

1. https://vercel.com/new → **Import Git Repository** → `cine-video-academy`.
2. Framework Preset: **Other**. Build Command y Output Directory: vacíos.
3. **Deploy**.

Cualquier host de estáticos (GitHub Pages, Netlify, Cloudflare Pages) sirve igual, aunque
las cabeceras de `vercel.json` habría que trasladarlas a la configuración de ese host.

### Sobre la CSP (importante al editar)

`vercel.json` define una Content-Security-Policy estricta: sin recursos externos y
`script-src` limitado a los **hashes SHA-256 de los dos `<script>` inline**. Si editas
cualquiera de esos scripts, el navegador lo bloqueará en producción hasta actualizar el hash.
`npm run check` lo detecta y muestra el hash nuevo que hay que poner en `vercel.json`
(el bloque `<script type="application/json">` con los datos no se ejecuta y no necesita hash).

Los estilos usan `'unsafe-inline'` porque la página trae su CSS en un `<style>` y algunos
atributos `style`; sin scripts de terceros el riesgo es bajo. Si se agregan fuentes, imágenes
o embeds de otro dominio, hay que ampliar la directiva correspondiente.

## Licencia

- **Código** (HTML, CSS, JavaScript, scripts y configuración): [MIT](LICENSE).
- **Contenido** (textos, láminas, prompts, talleres, quizzes y glosario):
  [CC BY-NC-SA 4.0](LICENSE-CONTENT.md) — puedes compartirlo y adaptarlo con atribución,
  sin fines comerciales y bajo la misma licencia.

## Créditos

- Contenido y diseño: Tomás Hanna.
- Las fuentes citadas en cada módulo (manuales, estándares y documentación de herramientas)
  pertenecen a sus autores; las marcas mencionadas son de sus respectivos titulares.
- Tipografías del sistema (sin fuentes externas).
