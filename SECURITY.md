# Seguridad

Este es un sitio estático: sin backend, sin formularios, sin cuentas y sin scripts de
terceros. El único dato que guarda es el progreso del alumno, en el `localStorage` de su
propio navegador.

## Reportar una vulnerabilidad

Si encuentras un problema de seguridad (por ejemplo, una cabecera mal configurada, un
XSS o información sensible publicada por error), **no abras un issue público**: usa
*Security → Report a vulnerability* en este repositorio (aviso privado) o contacta a
Tomás Hanna por GitHub ([@tomashanna](https://github.com/tomashanna)).

Intentaré responder dentro de 7 días.

## Medidas actuales

- Cabeceras de seguridad (CSP, HSTS, `X-Frame-Options`, etc.) definidas en `vercel.json`.
- Escaneo de secretos con gitleaks en cada push/PR.
- Dependabot para las GitHub Actions.
