import { defineConfig } from 'vite'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { mkdir, readFile, rename, writeFile, access } from 'fs/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Project Pages URL: https://<user>.github.io/powerfin/
// For a custom domain at the site root, change base to '/'
const base = '/powerfin/'
const cleanPages = ['about', 'services', 'resources', 'contact', 'privacy', 'terms']

function stripTrailingSlash(path) {
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1)
  return path
}

function cleanUrlsPlugin() {
  const baseNoSlash = stripTrailingSlash(base)

  return {
    name: 'clean-urls',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (!req.url) return next()

        const qIndex = req.url.indexOf('?')
        const pathname = qIndex === -1 ? req.url : req.url.slice(0, qIndex)
        const search = qIndex === -1 ? '' : req.url.slice(qIndex)
        const normalized = stripTrailingSlash(pathname)

        for (const page of cleanPages) {
          const candidates = [`${baseNoSlash}/${page}`, `/${page}`]
          if (candidates.includes(normalized)) {
            req.url = `${baseNoSlash}/${page}.html${search}`
            break
          }
        }
        next()
      })
    },
    async closeBundle() {
      const dist = resolve(__dirname, 'dist')

      for (const page of cleanPages) {
        const from = join(dist, `${page}.html`)
        try {
          await access(from)
        } catch {
          continue
        }

        const dir = join(dist, page)
        const to = join(dir, 'index.html')
        await mkdir(dir, { recursive: true })
        await rename(from, to)

        const redirectTarget = `${baseNoSlash}/${page}/`
        const stub = `<!DOCTYPE html>
<html lang="en-ZA">
<head>
  <meta charset="utf-8">
  <title>Redirecting…</title>
  <meta http-equiv="refresh" content="0;url=${redirectTarget}">
  <link rel="canonical" href="https://www.powerfin.co.za/${page}/">
  <script>location.replace('${redirectTarget}'+location.search+location.hash)</script>
</head>
<body>
  <p>Redirecting to <a href="${redirectTarget}">${redirectTarget}</a>…</p>
</body>
</html>
`
        await writeFile(from, stub, 'utf8')

        let html = await readFile(to, 'utf8')
        html = html.replaceAll('="./assets/', '="../assets/')
        html = html.replaceAll('="/assets/', `="${baseNoSlash}/assets/`)
        await writeFile(to, html, 'utf8')
      }
    },
  }
}

function resolveHeroAsset(html, filename = '') {
  const file = filename.replace(/\\/g, '/')
  if (html.includes('class="hero"') || /(?:^|\/)index\.html$/i.test(file)) {
    return { href: `${base}images/heroes/hero_home.webp` }
  }
  if (html.includes('hero-services-bg') || file.includes('services')) {
    return { href: `${base}images/heroes/hero_services.webp` }
  }
  if (html.includes('hero-resources-bg') || file.includes('resources')) {
    return { href: `${base}images/heroes/hero_resources.webp` }
  }
  if (html.includes('hero-contact-bg') || file.includes('contact')) {
    return { href: `${base}images/heroes/hero_contact.webp` }
  }
  if (html.includes('hero-about-bg') || file.includes('about')) {
    return { href: `${base}images/heroes/hero_about.webp` }
  }
  if (html.includes('hero-privacy-bg') || file.includes('privacy') || file.includes('terms')) {
    return { href: `${base}images/heroes/hero_privacy.webp` }
  }
  return { href: `${base}images/heroes/hero_about.webp` }
}

/** Above-the-fold critical CSS + LCP hints (injected into every page) */
function criticalCssPlugin() {
  const logoUrl = `${base}images/powerfin_full_landscape_logo.png`

  const criticalCss = `
  <style id="critical-css">
    :root{--color-primary:#144E96;--color-primary-dark:#081B34;--color-accent:#38BDF8;--color-text:#0D1821;--color-bg:#fff;--header-height:80px;--header-height-mobile:72px;--font-heading:Montserrat,"Segoe UI",system-ui,sans-serif;--font-body:Inter,"Segoe UI",system-ui,sans-serif;--radius-md:10px;--max-width:1240px}
    *,*::before,*::after{box-sizing:border-box}
    html{scroll-padding-top:var(--header-height);overflow-x:clip}
    body{margin:0;font-family:var(--font-body);color:var(--color-text);background:var(--color-bg);-webkit-font-smoothing:antialiased}
    img{max-width:100%;height:auto;display:block}
    a{color:inherit}
    .container{width:100%;max-width:var(--max-width);margin:0 auto;padding:0 28px;box-sizing:border-box}
    .skip-link{position:absolute;top:-48px;left:12px;z-index:1200;background:var(--color-primary-dark);color:#fff;padding:10px 16px;font-weight:700;border-radius:6px;text-decoration:none}
    .skip-link:focus{top:12px}
    .site-header{position:sticky;top:0;z-index:1000;background:#fff;min-height:80px;border-bottom:1px solid rgba(203,213,225,.65)}
    .site-header .container{display:flex;align-items:center;justify-content:space-between;height:80px}
    .logo{display:flex;align-items:center;flex-shrink:0;line-height:0;text-decoration:none}
    .logo-img{height:56px;width:191px;max-width:191px;aspect-ratio:960/281;object-fit:contain}
    .nav-menu{display:flex;list-style:none;gap:32px;margin:0;padding:0;align-items:center}
    .nav-menu a{font:500 .95rem var(--font-body);color:var(--color-text);text-decoration:none;white-space:nowrap;padding:6px 0}
    .nav-menu a.active{color:var(--color-primary);font-weight:600}
    .nav-cta{display:flex;align-items:center;flex-shrink:0}
    .btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;padding:15px 32px;font:600 1.05rem var(--font-body);line-height:1;border-radius:var(--radius-md);border:2px solid transparent;text-decoration:none;cursor:pointer}
    .btn-primary,.nav-cta .btn{min-height:48px;padding:12px 22px;font-size:.95rem;background:var(--color-primary);color:#fff;border-color:var(--color-primary);white-space:nowrap}
    .nav-toggle{display:none;width:44px;height:44px;flex-shrink:0;padding:0;border:0;background:none}
    .nav-menu-cta{display:none}
    .scroll-progress{position:fixed;top:0;left:0;right:0;height:3px;z-index:1100;pointer-events:none;background:rgba(8,27,52,.08)}
    .scroll-progress-bar{width:100%;height:100%;transform:scaleX(0);transform-origin:left center;background:linear-gradient(90deg,#0B2A54,#144E96 42%,#38BDF8)}
    .hero{--hero-overlay:linear-gradient(135deg,rgba(8,27,52,.88) 0%,rgba(14,40,78,.85) 60%,rgba(6,21,40,.92) 100%);position:relative;isolation:isolate;overflow:hidden;display:flex;align-items:center;min-height:calc(100svh - var(--header-height));height:calc(100svh - var(--header-height));padding:clamp(20px,3.5vh,48px) 0;box-sizing:border-box;background-color:var(--color-primary-dark);color:#fff;border-bottom:1px solid rgba(255,255,255,.08)}
    .hero::before{content:"";position:absolute;inset:0;z-index:1;background:var(--hero-overlay);pointer-events:none}
    .hero::after{content:"";position:absolute;inset:-12%;z-index:0;background:var(--hero-photo) center/cover no-repeat;pointer-events:none}
    .hero .container{position:relative;z-index:2}
    .hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:48px;align-items:center}
    .hero-content h1{font:800 clamp(2.1rem,4.5vw,3.4rem)/1.15 var(--font-heading);letter-spacing:-.02em;margin:0 0 1rem;color:#fff}
    .hero-lead,.hero-content>p{color:rgba(226,232,240,.92);margin:0 0 1rem}
    .hero-buttons{display:flex;flex-wrap:wrap;gap:12px;margin-top:1.25rem}
    .btn-light{background:#fff;color:var(--color-primary-dark);border-color:#fff}
    .btn-hero-secondary{background:transparent;color:#fff;border-color:rgba(255,255,255,.45)}
    .page-header{--hero-overlay:linear-gradient(135deg,rgba(8,27,52,.88),rgba(20,78,150,.84));position:relative;isolation:isolate;overflow:hidden;min-height:240px;padding:96px 0 88px;box-sizing:border-box;text-align:center;background-color:var(--color-primary-dark);color:#fff}
    .page-header::before{content:"";position:absolute;inset:0;z-index:1;background:var(--hero-overlay);pointer-events:none}
    .page-header::after{content:"";position:absolute;inset:0;z-index:0;background:var(--hero-photo) center/cover no-repeat;pointer-events:none}
    .page-header .container{position:relative;z-index:2}
    .page-header h1{font:800 clamp(2rem,4vw,3rem)/1.2 var(--font-heading);margin:0 0 .75rem;color:#fff}
    .page-header p{margin:0 auto;max-width:40rem;color:rgba(226,232,240,.9)}
    .breadcrumb{padding:14px 0;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:.9rem}
    @media (max-width:768px){
      html{scroll-padding-top:var(--header-height-mobile)}
      body{padding-top:var(--header-height-mobile)}
      .site-header{position:fixed;top:0;left:0;right:0;width:100%;min-height:72px}
      .site-header .container{height:72px;padding:0 20px}
      .logo-img{height:50px;width:171px;max-width:190px}
      .nav-menu,.nav-cta{display:none}
      .nav-toggle{display:flex;flex-direction:column;justify-content:center;gap:5px}
      .nav-toggle span{display:block;width:24px;height:2px;background:var(--color-primary)}
      .hero{min-height:0;height:auto;padding:48px 0}
      .hero-grid{grid-template-columns:1fr;gap:28px}
      .page-header{min-height:180px;padding:72px 0 56px}
      .container{padding:0 20px}
    }
  </style>`

  return {
    name: 'critical-css',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        let out = html.replace(/&display=swap/g, '&display=optional')

        // Async Google Fonts (non-blocking)
        out = out.replace(
          /<link href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)" rel="stylesheet">/g,
          `<link rel="preload" as="style" href="$1" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="$1"></noscript>`,
        )

        const hero = resolveHeroAsset(out, ctx.filename || '')
        const resourceHints = `
  <link rel="preload" as="image" href="${logoUrl}" fetchpriority="high" type="image/png">
  <link rel="preload" as="image" href="${hero.href}" fetchpriority="high" type="image/webp">
  <link rel="dns-prefetch" href="https://fonts.googleapis.com">
  <link rel="dns-prefetch" href="https://fonts.gstatic.com">`

        const contactHints = out.includes('google.com/maps')
          ? `
  <link rel="dns-prefetch" href="https://maps.googleapis.com">
  <link rel="dns-prefetch" href="https://maps.gstatic.com">`
          : ''

        const photoVars = `
  <style id="hero-photos">
    .hero{--hero-photo:url("${base}images/heroes/hero_home.webp")}
    .page-header{--hero-photo:url("${base}images/heroes/hero_about.webp")}
    .page-header.hero-about-bg{--hero-photo:url("${base}images/heroes/hero_about.webp")}
    .page-header.hero-services-bg{--hero-photo:url("${base}images/heroes/hero_services.webp")}
    .page-header.hero-resources-bg{--hero-photo:url("${base}images/heroes/hero_resources.webp")}
    .page-header.hero-contact-bg{--hero-photo:url("${base}images/heroes/hero_contact.webp")}
    .page-header.hero-privacy-bg{--hero-photo:url("${base}images/heroes/hero_privacy.webp")}
    .section-parallax--governance{--parallax-photo:url("${base}images/heroes/hero_services.webp")}
    .section-parallax--reach{--parallax-photo:url("${base}images/heroes/hero_about.webp")}
    .section-parallax--office{--parallax-photo:url("${base}images/heroes/hero_contact.webp")}
  </style>`

        let firstLogo = true
        out = out.replace(
          /<img\s+src="([^"]*powerfin_full_landscape_logo\.png)"([^>]*)>/g,
          (_m, src, rest) => {
            const altMatch = rest.match(/\salt="([^"]*)"/)
            const titleMatch = rest.match(/\stitle="([^"]*)"/)
            const roleMatch = rest.match(/\srole="([^"]*)"/)
            const alt = altMatch ? altMatch[1] : ''
            const titleAttr = ` title="${titleMatch ? titleMatch[1] : 'PowerFin Accountants logo'}"`
            const roleAttr = roleMatch
              ? ` role="${roleMatch[1]}"`
              : (alt === '' ? ' role="presentation"' : '')
            if (firstLogo) {
              firstLogo = false
              return `<img src="${src}" alt="${alt}"${titleAttr} class="logo-img"${roleAttr} width="191" height="56" decoding="async" fetchpriority="high">`
            }
            return `<img src="${src}" alt="${alt}"${titleAttr} class="logo-img logo-img--footer"${roleAttr} width="171" height="50" decoding="async" loading="lazy" fetchpriority="low">`
          },
        )

        // Lazy-load below-fold images that lack loading attr (keep fetchpriority=high alone)
        out = out.replace(/<img\b([^>]*)>/gi, (full, attrs) => {
          if (/\bloading=/.test(attrs)) return full
          if (/\bfetchpriority\s*=\s*["']high["']/.test(attrs)) return full
          if (/logo-img/.test(attrs) && !/logo-img--footer/.test(attrs)) return full
          const withLazy = /\bdecoding=/.test(attrs)
            ? attrs.replace(/\s*$/, ' loading="lazy"')
            : `${attrs} loading="lazy" decoding="async"`
          return `<img${withLazy}>`
        })

        if (!out.includes('id="critical-css"') && !out.includes('id="critical-cls"')) {
          out = out.replace(
            '</head>',
            `${criticalCss}\n${photoVars}\n${resourceHints}${contactHints}\n</head>`,
          )
        }

        return out
      },
    },
  }
}

/** Defer full stylesheet so critical CSS paints first */
function deferCssPlugin() {
  return {
    name: 'defer-css',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html.replace(
          /<link\s+rel="stylesheet"(\s+crossorigin(?:="[^"]*")?)?\s+href="([^"]+\.css)"(?:\s+crossorigin(?:="[^"]*")?)?\s*\/?>/g,
          (_m, _cross, href) =>
            `<link rel="preload" as="style" href="${href}" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="${href}"></noscript>`,
        )
      },
    },
  }
}

function htmlBaseRewritePlugin() {
  return {
    name: 'html-base-rewrite',
    transformIndexHtml(html) {
      return html.replace(
        /(href|src|action)="(\/(?!\/)[^"]*)"/g,
        (full, attr, path) => {
          if (path === base.slice(0, -1) || path.startsWith(base)) return full
          return `${attr}="${base}${path.slice(1)}"`
        },
      )
    },
  }
}

export default defineConfig({
  base,
  plugins: [
    htmlBaseRewritePlugin(),
    criticalCssPlugin(),
    deferCssPlugin(),
    cleanUrlsPlugin(),
  ],
  build: {
    cssCodeSplit: true,
    cssMinify: true,
    minify: 'esbuild',
    assetsInlineLimit: 2048,
    modulePreload: {
      polyfill: true,
    },
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        about: resolve(__dirname, 'about.html'),
        services: resolve(__dirname, 'services.html'),
        resources: resolve(__dirname, 'resources.html'),
        contact: resolve(__dirname, 'contact.html'),
        privacy: resolve(__dirname, 'privacy.html'),
        terms: resolve(__dirname, 'terms.html'),
      },
    },
  },
  server: {
    headers: {
      'Cache-Control': 'no-store',
    },
  },
})
