# 🎬 Academia de Cine & Video con IA

Recurso de formación interno: cinematografía + producción con IA, de cero a experto.
15 módulos en pestañas A·Fundamento / B·Con IA / C·Taller / D·Evaluación, con láminas
explicativas, prompts reproducibles, talleres de generación con auto-corrección, quizzes
y glosario. Progreso guardado por navegador (localStorage).

## Sitio estático — sin build

Es un único `index.html` autocontenido (todo embebido, incluidas las imágenes en base64).
No hay proceso de build ni dependencias.

## Deploy en Vercel (import)

1. https://vercel.com/new → **Import Git Repository** → elegí `cine-video-academy`.
2. Framework Preset: **Other**. Build Command: (vacío). Output Directory: (raíz / vacío).
3. **Deploy**. Queda en `https://<nombre>.vercel.app`.

Cualquier host de estáticos (GitHub Pages, Netlify, Cloudflare Pages) sirve igual.
