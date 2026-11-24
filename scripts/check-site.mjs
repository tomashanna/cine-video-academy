#!/usr/bin/env node
// check-site.mjs — verificador sin dependencias para sitios estáticos (Node >= 18).
//
// Qué revisa en cada *.html del repo:
//   - referencias locales (href/src/poster/srcset, url() en CSS inline y en hojas locales)
//     → el archivo existe; los #fragmentos apuntan a un id existente.
//   - enlaces externos con target="_blank" o http(s) → rel="noopener noreferrer".
//   - a11y básica: <html lang>, <title>, alt en <img>, sin saltos de nivel en encabezados.
//   - CSP: si vercel.json declara hashes 'sha256-…' en script-src, deben coincidir
//     exactamente con los <script> inline ejecutables del sitio.
//   - con --base-url URL: además pide (HEAD) cada página y cada asset local por HTTP y exige 200.
//
// Uso:  node scripts/check-site.mjs [--base-url http://127.0.0.1:8000]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const baseUrl = (() => { const i = args.indexOf('--base-url'); return i >= 0 ? args[i + 1].replace(/\/?$/, '/') : null; })();
const IGNORE_DIRS = new Set(['.git', 'node_modules', '.github', '.vercel']);

const errors = [];
const warnings = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const htmlFiles = walk(ROOT).filter((f) => f.endsWith('.html')).sort();
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');

// Quita comentarios, el CUERPO de <script>/<style> y los payloads base64 (pesados y sin interés).
function stripForScan(s) {
  return s
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(<script\b[^>]*>)[\s\S]*?(<\/script>)/gi, '$1$2')
    .replace(/(<style\b[^>]*>)[\s\S]*?(<\/style>)/gi, '$1$2')
    .replace(/data:[a-z0-9.+/-]+;base64,[A-Za-z0-9+/=\s]+/gi, 'data:');
}
function attr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? (m[2] ?? m[3] ?? m[4] ?? '') : null;
}
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const isExternal = (u) => /^(https?:)?\/\//i.test(u);
const isSkippable = (u) => /^(mailto:|tel:|data:|javascript:|blob:)/i.test(u) || u === '';

const idCache = new Map();
function idsOf(file) {
  if (!idCache.has(file)) {
    const s = stripForScan(fs.readFileSync(file, 'utf8'));
    idCache.set(file, new Set([...s.matchAll(/\s(?:id|name)\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1])));
  }
  return idCache.get(file);
}

const localAssets = new Set(); // rutas relativas a la raíz, para la verificación HTTP

function checkLocalRef(file, raw, where) {
  const u = decode(raw.trim());
  if (isSkippable(u) || isExternal(u)) return;
  const [pathPart, frag] = u.split('#');
  const clean = decodeURIComponent(pathPart.split('?')[0]);
  let target = file;
  if (clean) {
    target = clean.startsWith('/') ? path.join(ROOT, clean) : path.resolve(path.dirname(file), clean);
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
    else if (!fs.existsSync(target) && fs.existsSync(target + '.html')) target += '.html'; // cleanUrls
    if (!fs.existsSync(target)) return err(rel(file), `referencia rota (${where}): ${raw}`);
    localAssets.add(rel(target));
  }
  if (frag && target.endsWith('.html') && !idsOf(target).has(decodeURIComponent(frag))) {
    err(rel(file), `ancla inexistente (${where}): ${raw}`);
  }
}

function checkCssUrls(file, css, where) {
  for (const m of css.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)) checkLocalRef(file, m[2], where);
}

// ---- CSP declarada en vercel.json (si existe) ----
let cspScriptHashes = null;
if (fs.existsSync(path.join(ROOT, 'vercel.json'))) {
  const vj = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  for (const h of vj.headers ?? []) for (const kv of h.headers ?? []) {
    if (kv.key.toLowerCase() !== 'content-security-policy') continue;
    const scriptSrc = kv.value.split(';').map((d) => d.trim()).find((d) => d.startsWith('script-src'));
    const hashes = scriptSrc ? [...scriptSrc.matchAll(/'(sha256-[A-Za-z0-9+/=]+)'/g)].map((m) => m[1]) : [];
    if (hashes.length) cspScriptHashes = new Set(hashes);
  }
}
const seenScriptHashes = new Set();

for (const file of htmlFiles) {
  const f = rel(file);
  const src = fs.readFileSync(file, 'utf8');
  const s = stripForScan(src);

  // a11y / documento
  if (!/^\s*<!doctype html>/i.test(src)) err(f, 'falta <!DOCTYPE html>');
  const htmlTag = s.match(/<html\b[^>]*>/i);
  if (!htmlTag || !attr(htmlTag[0], 'lang')) err(f, '<html> sin atributo lang');
  if (!/<title>[^<]+<\/title>/i.test(s)) err(f, 'falta <title>');
  if (!/<meta\s+name=["']description["']/i.test(s)) warnings.push(`${f}: sin meta description`);

  // encabezados: no saltar niveles al bajar (h2 → h4)
  let prev = 0;
  for (const m of s.matchAll(/<h([1-6])\b/gi)) {
    const lvl = Number(m[1]);
    if (prev && lvl > prev + 1) err(f, `salto de encabezado h${prev} → h${lvl}`);
    prev = lvl;
  }

  // inline scripts ejecutables → hash (para validar la CSP)
  for (const m of src.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const type = attr(`<x ${m[1]}>`, 'type');
    if (attr(`<x ${m[1]}>`, 'src') !== null) continue;
    if (type && !/^(text|application)\/(javascript|ecmascript)$|^module$/i.test(type)) continue;
    seenScriptHashes.add('sha256-' + crypto.createHash('sha256').update(m[2], 'utf8').digest('base64'));
  }

  for (const m of s.matchAll(/<([a-z][a-z0-9-]*)\b[^>]*>/gi)) {
    const tag = m[0];
    const name = m[1].toLowerCase();
    for (const a of ['href', 'src', 'poster']) {
      const v = attr(tag, a);
      if (v !== null && !(name === 'link' && /preconnect|dns-prefetch/i.test(attr(tag, 'rel') ?? ''))) checkLocalRef(file, v, `${name}[${a}]`);
    }
    const srcset = attr(tag, 'srcset');
    if (srcset) for (const part of srcset.split(',')) checkLocalRef(file, part.trim().split(/\s+/)[0], `${name}[srcset]`);
    const style = attr(tag, 'style');
    if (style) checkCssUrls(file, decode(style), `${name}[style]`);

    if (name === 'img' && attr(tag, 'alt') === null) err(f, `<img> sin alt: ${tag.slice(0, 80)}`);
    if (name === 'a') {
      const href = attr(tag, 'href') ?? '';
      const relv = (attr(tag, 'rel') ?? '').toLowerCase().split(/\s+/);
      if (isExternal(href)
          && !(relv.includes('noopener') && relv.includes('noreferrer'))) {
        err(f, `enlace externo sin rel="noopener noreferrer": ${href}`);
      }
    }
  }
  // CSS inline en <style>
  for (const m of src.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    checkCssUrls(file, m[1].replace(/data:[^)'"]+/g, ''), 'style');
  }
}

// hojas de estilo locales
for (const css of walk(ROOT).filter((x) => x.endsWith('.css'))) checkCssUrls(css, fs.readFileSync(css, 'utf8'), 'css');

if (cspScriptHashes) {
  for (const h of seenScriptHashes) if (!cspScriptHashes.has(h)) errors.push(`vercel.json: CSP script-src no incluye el hash de un <script> inline: '${h}' (¿se editó un script? actualiza el hash)`);
  for (const h of cspScriptHashes) if (!seenScriptHashes.has(h)) warnings.push(`vercel.json: hash CSP sin uso: '${h}'`);
}

// ---- verificación por HTTP ----
if (baseUrl) {
  const targets = [...new Set([...htmlFiles.map(rel), ...localAssets])].sort();
  for (const t of targets) {
    try {
      // HEAD: no descarga los medios pesados (audio/vídeo), solo confirma que existen.
      const res = await fetch(baseUrl + t.split('/').map(encodeURIComponent).join('/'), { method: 'HEAD' });
      if (res.status !== 200) err(t, `HTTP ${res.status}`);
    } catch (e) {
      err(t, `HTTP error: ${e.message}`);
    }
  }
  console.log(`HTTP: ${targets.length} URLs verificadas contra ${baseUrl}`);
}

for (const w of warnings) console.log('⚠ ' + w);
for (const e of errors) console.log('✖ ' + e);
console.log(`\n${htmlFiles.length} páginas, ${localAssets.size} recursos locales referenciados · ${errors.length} errores, ${warnings.length} avisos`);
process.exit(errors.length ? 1 : 0);
