# Powerfin Accountants Website

A static, multi-page website for Powerfin Accountants, an accounting and financial services firm serving Pretoria and Johannesburg, Gauteng.

## Tech Stack

- **Frontend:** Semantic HTML5, Vanilla CSS
- **Interactivity:** Vanilla JavaScript
- **Build Tool:** Vite
- **Deployment:** Static hosting (Netlify, Vercel, or similar)

## Pages

- Home
- About Us
- Services
- Resources / Insights
- Contact Us
- Privacy Policy
- Terms of Service

## Getting Started

```bash
# Install dependencies
npm install

# Optimise public imagery (WebP + compressed originals + SVG)
npm run optimize:images

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

Pages use clean URLs (no `.html`): `/about/`, `/services/`, `/contact/`, etc. The Vite config rewrites these in development and emits `page/index.html` folders on build (with legacy `.html` redirect stubs for old bookmarks).

Hero photos and team headshots are served as **WebP**. Compressed JPEG fallbacks remain for Open Graph / social previews. Logos and favicons stay as optimised PNG (smaller than WebP for these assets). Re-run `npm run optimize:images` after adding or replacing files under `public/images/`.

## Customisation Checklist

Before launching, replace the following placeholder content:

- [ ] Firm logo and brand colour codes
- [ ] Professional headshot of Venessa and team
- [ ] Physical addresses in Pretoria and Johannesburg
- [ ] Official phone number and email address
- [ ] SARS / SAICA / SAIPA registration numbers (footer)
- [ ] Google Maps embed on Contact page
- [ ] Real form endpoint (Netlify Forms, Formspree, etc.)
- [ ] Domain name in `robots.txt`, `sitemap.xml` and schema markup

## Form Handling

The contact form currently validates inputs client-side and simulates submission. Connect it to a serverless function or secure form endpoint before going live.

## Compliance

The site includes a POPIA-focused Privacy Policy and Terms of Service, and highlights data protection as a trust signal throughout.
