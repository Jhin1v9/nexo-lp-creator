# NEXO Landing Page Creator - Technical Skills Reference

> This document is read by Kimi before generating any landing page code. It defines supported stacks, cross-cutting rules, component patterns, anti-patterns, and post-build verification procedures. All rules are mandatory unless explicitly marked [OPTIONAL].

---

## 1. Supported Tech Stacks

### 1.1 `static-html-tailwind` (DEFAULT)
- Single `index.html` file, self-contained
- Tailwind CSS via CDN: `https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4`
- Font Awesome 6 (CDN) or Heroicons (SVG inline) for icons
- Google Fonts (CDN) for custom typography
- Vanilla JavaScript (`<script>` tags at end of `<body>`)
- No build step required; deployable to any static host

### 1.2 `vite-react`
- Vite + React 18+ + TypeScript
- Tailwind CSS v4 via PostCSS
- Component-based architecture (`.tsx` files)
- `public/` folder for static assets
- Build command: `npm run build`
- Output: `dist/` folder

### 1.3 `vite-vue`
- Vite + Vue 3 + TypeScript
- Tailwind CSS v4 via PostCSS
- Single File Components (`.vue` files)
- Composition API preferred
- Build command: `npm run build`
- Output: `dist/` folder

### 1.4 `vite-svelte`
- Vite + Svelte 5 + TypeScript
- Tailwind CSS v4 via PostCSS
- `.svelte` component files
- Build command: `npm run build`
- Output: `dist/` folder

### 1.5 `nextjs-app`
- Next.js 15+ (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- Server Components by default; `'use client'` for interactive components
- `app/` directory structure
- Build command: `npm run build`
- Output: `.next/` folder (or `out/` with `output: 'export'`)

### 1.6 `nextjs-pages`
- Next.js 15+ (Pages Router) + React 19 + TypeScript
- Tailwind CSS v4
- `pages/` directory structure
- Build command: `npm run build`
- Output: `.next/` folder

### Stack Selection Rules
1. **Default to `static-html-tailwind`** unless the user explicitly requests a framework or the design requires SSR/SSG.
2. Use `vite-react` when the design has complex state management, multiple interactive components, or the user requests React.
3. Use `nextjs-app` when SSR, SEO-critical dynamic content, or App Router features are needed.
4. Use `nextjs-pages` only when the user explicitly requests the Pages Router.
5. Use `vite-vue` or `vite-svelte` only when the user explicitly requests Vue or Svelte.

---

## 2. Cross-Cutting Rules (ALL Stacks)

### 2.1 Mobile-First Responsive Design
- All layouts MUST be mobile-first: base styles for mobile, `md:` and `lg:` breakpoints for larger screens.
- Breakpoint convention: `sm:640px`, `md:768px`, `lg:1024px`, `xl:1280px`, `2xl:1536px`.
- Test mental model: "How does this look on a 375px iPhone SE?"

### 2.2 Single H1 Rule
- Each page MUST contain exactly ONE `<h1>` element.
- The `<h1>` MUST be in the Hero section and contain the primary value proposition.
- Heading hierarchy must be logical: `h1 > h2 > h3 > h4`. Never skip levels.

### 2.3 Image Alt Text
- Every `<img>` MUST have a descriptive `alt` attribute.
- Decorative images: `alt=""` (empty string).
- Informative images: descriptive text of what the image conveys.
- No `alt` attribute is a CRITICAL violation.

### 2.4 Meta Tags
- Every page MUST include in `<head>`:
  ```html
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="...">
  <title>...</title>
  ```
- Description: 120-160 characters, includes primary keyword.
- Title: 50-60 characters, format: `Primary Keyword | Brand`

### 2.5 Open Graph (OG) Tags
- `og:title` — match `<title>`
- `og:description` — match `meta description`
- `og:type` — `website` (default) or `article`
- `og:url` — canonical URL
- `og:image` — 1200x630px recommended
- `og:site_name` — brand name

### 2.6 Twitter Card Tags
- `twitter:card` — `summary_large_image`
- `twitter:title` — match OG title
- `twitter:description` — match OG description
- `twitter:image` — match OG image

### 2.7 Lazy Loading
- All images below the fold MUST use `loading="lazy"`.
- Hero/above-the-fold images: `loading="eager"` (or omit, as eager is default).
- Background images in CSS: use `IntersectionObserver` for lazy loading.
- Videos: `preload="none"` with poster image.

### 2.8 Semantic HTML5
- Use semantic elements: `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<aside>`, `<footer>`.
- Avoid generic `<div>` soup when semantic alternatives exist.
- Landmark roles: `role="banner"`, `role="navigation"`, `role="main"`, `role="contentinfo"` where appropriate.

### 2.9 WCAG AA Accessibility
- Color contrast ratio: minimum 4.5:1 for normal text, 3:1 for large text (18px+ or 14px+ bold).
- All interactive elements MUST be keyboard accessible (`tabindex`, `:focus-visible` styles).
- Form inputs MUST have associated `<label>` elements.
- ARIA labels where necessary: `aria-label`, `aria-labelledby`, `aria-describedby`.
- No `outline: none` without replacement focus style.

### 2.10 Performance
- Minimize render-blocking resources. Inline critical CSS.
- Defer non-critical scripts: `<script defer>` or place at end of `<body>`.
- Use `font-display: swap` for web fonts.
- Prefer SVG icons over icon fonts where possible.

### 2.11 SEO
- Canonical URL: `<link rel="canonical" href="...">`
- Robots meta: `<meta name="robots" content="index, follow">` (default)
- Schema.org JSON-LD structured data for: Organization, WebSite, Product, FAQPage, Review (as applicable).
- Semantic heading structure (see 2.2).
- Internal linking with descriptive anchor text.

---

## 3. Component Patterns

### 3.1 Hero Section
**Purpose:** First impression, value proposition, primary CTA.
**Required elements:**
- Single `<h1>` with primary value proposition
- Subheadline (1-2 sentences)
- Primary CTA button (high contrast)
- Optional: secondary CTA (text link or outlined button)
- Optional: hero image/illustration/video
- Optional: social proof line (e.g., "Trusted by 10,000+ users")

**Layout patterns:**
- `centered`: Text centered, full-width background
- `split`: 2-column (text left, visual right) on desktop, stacked on mobile
- `fullscreen`: Full viewport height with centered content
- `overlay`: Background image/video with text overlay

**Tailwind pattern:**
```html
<section class="relative min-h-[80vh] flex items-center bg-gradient-to-br from-slate-900 to-slate-800">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8">
    <div class="max-w-3xl mx-auto text-center">
      <h1 class="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
        Primary Value Proposition
      </h1>
      <p class="text-lg md:text-xl text-slate-300 mb-8">
        Subheadline explaining the benefit
      </p>
      <div class="flex flex-col sm:flex-row gap-4 justify-center">
        <button class="px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition">
          Primary CTA
        </button>
        <button class="px-8 py-4 border border-white/30 text-white rounded-lg font-semibold hover:bg-white/10 transition">
          Secondary CTA
        </button>
      </div>
    </div>
  </div>
</section>
```

### 3.2 Features Section
**Purpose:** Showcase product/service features/benefits.
**Required elements:**
- Section heading (`<h2>`)
- Optional: section subheading
- Feature cards (3-6 items, grid layout)
- Each card: icon, title (`<h3>`), description

**Layout patterns:**
- `3-col-grid`: 3 columns on desktop, 1 on mobile
- `2-col-grid`: 2 columns on desktop, 1 on mobile
- `alternating`: Image + text alternating sides
- `icon-list`: Vertical list with icons

**Tailwind pattern:**
```html
<section class="py-16 md:py-24 bg-white">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8">
    <h2 class="text-3xl md:text-4xl font-bold text-center text-slate-900 mb-4">
      Key Features
    </h2>
    <p class="text-lg text-slate-600 text-center max-w-2xl mx-auto mb-12">
      Why customers choose us
    </p>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      <!-- Feature Card -->
      <div class="p-6 rounded-xl bg-slate-50 hover:shadow-lg transition">
        <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
          <svg class="w-6 h-6 text-blue-600" ...></svg>
        </div>
        <h3 class="text-xl font-semibold text-slate-900 mb-2">Feature Title</h3>
        <p class="text-slate-600">Feature description goes here.</p>
      </div>
    </div>
  </div>
</section>
```

### 3.3 Testimonials Section
**Purpose:** Social proof from customers/users.
**Required elements:**
- Section heading (`<h2>`)
- Testimonial cards (3+ items)
- Each card: quote, author name, author title/company, optional avatar
- Optional: star rating

**Layout patterns:**
- `carousel`: Horizontal scrollable/swipable
- `grid`: 3-column grid
- `featured`: One large testimonial + 2 smaller

**Tailwind pattern:**
```html
<section class="py-16 md:py-24 bg-slate-50">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8">
    <h2 class="text-3xl md:text-4xl font-bold text-center text-slate-900 mb-12">
      What Our Customers Say
    </h2>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      <blockquote class="p-6 bg-white rounded-xl shadow-sm">
        <p class="text-slate-700 mb-4">"Quote text goes here..."</p>
        <footer class="flex items-center gap-3">
          <img src="avatar.jpg" alt="Name" class="w-10 h-10 rounded-full" loading="lazy">
          <div>
            <cite class="font-semibold text-slate-900 not-italic">Author Name</cite>
            <p class="text-sm text-slate-500">Title, Company</p>
          </div>
        </footer>
      </blockquote>
    </div>
  </div>
</section>
```

### 3.4 Pricing Section
**Purpose:** Present pricing tiers with clear value differentiation.
**Required elements:**
- Section heading (`<h2>`)
- Pricing cards (2-4 tiers)
- Each card: tier name, price, billing period, feature list, CTA button
- Highlighted/recommended tier (visual emphasis)
- Toggle: monthly/annual (optional)

**Layout patterns:**
- `3-tier`: Free / Pro / Enterprise
- `2-tier`: Basic / Premium
- `horizontal`: Side-by-side comparison table

**Tailwind pattern:**
```html
<section class="py-16 md:py-24 bg-white">
  <div class="container mx-auto px-4 sm:px-6 lg:px-8">
    <h2 class="text-3xl md:text-4xl font-bold text-center text-slate-900 mb-12">Pricing</h2>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
      <!-- Featured tier gets ring + scale -->
      <div class="relative p-6 rounded-2xl bg-slate-900 text-white ring-2 ring-blue-500 scale-105">
        <div class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-500 text-xs font-bold rounded-full">MOST POPULAR</div>
        <h3 class="text-xl font-semibold mb-2">Pro</h3>
        <div class="text-4xl font-bold mb-1">$29<span class="text-lg font-normal">/mo</span></div>
        <ul class="space-y-2 mb-6 text-slate-300">
          <li class="flex items-center gap-2"><svg class="w-5 h-5 text-green-400">...</svg> Feature</li>
        </ul>
        <button class="w-full py-3 bg-blue-600 rounded-lg font-semibold hover:bg-blue-700 transition">Get Started</button>
      </div>
    </div>
  </div>
</section>
```

### 3.5 CTA (Call-to-Action) Section
**Purpose:** Conversion-focused section to drive action.
**Required elements:**
- Compelling headline (`<h2>`)
- Supporting text (1-2 sentences)
- Single prominent CTA button
- Optional: urgency element (limited time, scarcity)

**Layout patterns:**
- `banner`: Full-width colored background, centered text
- `split`: Text left, visual right
- `sticky-bar`: Fixed to bottom of viewport

### 3.6 Footer Section
**Purpose:** Navigation, legal, contact info, social links.
**Required elements:**
- Logo/brand name
- Navigation links (organized in columns)
- Social media links (with `aria-label`)
- Copyright notice with current year
- Legal links: Privacy Policy, Terms of Service

**Layout patterns:**
- `multi-column`: 4-5 columns (Brand, Product, Company, Resources, Legal)
- `simple`: Single row with links + copyright

---

## 4. Anti-Patterns (FORBIDDEN)

### 4.1 CSS
- **NO custom CSS files** — use Tailwind utility classes exclusively.
- **NO inline `style="..."` attributes** — always use Tailwind classes.
- **NO `!important` in Tailwind** — use Tailwind's `!` prefix only when absolutely necessary.
- **NO arbitrary values** like `w-[123px]` unless the design truly requires it. Prefer standard utilities: `w-full`, `w-1/2`, `max-w-md`, etc.
- **NO hardcoded colors** — use Tailwind's color palette or defined design tokens.

### 4.2 HTML
- **NO duplicate IDs** — all `id` attributes must be unique page-wide.
- **NO broken heading hierarchy** — `h1 > h2 > h3 > h4`, never skip.
- **NO multiple H1s** — exactly one `<h1>` per page.
- **NO unclosed tags** — all tags must be properly closed.
- **NO deprecated HTML** — no `<center>`, `<font>`, `<marquee>`, etc.
- **NO tables for layout** — use CSS Grid or Flexbox.

### 4.3 JavaScript
- **NO inline event handlers** — `onclick="..."` is forbidden. Use `addEventListener`.
- **NO `eval()`** — never use `eval()` or `Function()` constructor.
- **NO `innerHTML` with user input** — sanitize all dynamic content.
- **NO jQuery** — use vanilla JS or framework-native patterns.
- **NO global namespace pollution** — wrap in IIFE or use modules.

### 4.4 Accessibility
- **NO `outline: none`** without a visible `:focus-visible` replacement.
- **NO missing `alt` attributes** on images.
- **NO color-only indicators** — pair color with icons/text.
- **NO inaccessible forms** — all inputs must have labels.

### 4.5 SEO
- **NO missing meta description**.
- **NO duplicate content** in H1 and title.
- **NO broken links** — all `href` must resolve.

---

## 5. Post-Build Verification Rules

After generating code, verify ALL of the following before declaring complete:

### 5.1 HTML Validation
- [ ] All tags properly opened and closed
- [ ] No duplicate `id` attributes
- [ ] Exactly one `<h1>` element
- [ ] Logical heading hierarchy (`h1 > h2 > h3`)
- [ ] All images have `alt` attributes
- [ ] All links have `href` attributes
- [ ] All buttons are accessible (keyboard, focus)

### 5.2 Tailwind Quality
- [ ] No inline `style="..."` attributes
- [ ] No custom CSS files (unless framework requires)
- [ ] Uses responsive prefixes (`md:`, `lg:`) appropriately
- [ ] No arbitrary values without justification
- [ ] Consistent spacing scale

### 5.3 Accessibility
- [ ] WCAG AA color contrast (4.5:1 normal, 3:1 large text)
- [ ] Focus visible styles on interactive elements
- [ ] Form labels present
- [ ] ARIA labels where needed
- [ ] Skip-to-content link [OPTIONAL]

### 5.4 SEO
- [ ] `<title>` present (50-60 chars)
- [ ] Meta description present (120-160 chars)
- [ ] OG tags present
- [ ] Twitter Card tags present
- [ ] Canonical URL present
- [ ] Schema.org JSON-LD present [OPTIONAL]

### 5.5 Performance
- [ ] Images below fold use `loading="lazy"`
- [ ] Scripts at end of `<body>` or use `defer`
- [ ] No render-blocking resources
- [ ] Font loading strategy (`font-display: swap`)

### 5.6 CRO (Conversion Rate Optimization)
- [ ] Primary CTA above the fold
- [ ] CTA button is high contrast and prominent
- [ ] Clear value proposition in H1
- [ ] Social proof visible (testimonials, trust badges)
- [ ] No distracting elements near CTA

---

## 6. CDN References (static-html-tailwind)

```html
<!-- Tailwind CSS v4 Browser -->
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>

<!-- Font Awesome 6 -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">

<!-- Google Fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

## 7. Color Token Convention

When defining design tokens, use this structure:

```json
{
  "colors": {
    "primary": "#3B82F6",
    "primaryDark": "#2563EB",
    "secondary": "#10B981",
    "accent": "#F59E0B",
    "background": "#FFFFFF",
    "surface": "#F8FAFC",
    "text": "#0F172A",
    "textMuted": "#64748B",
    "border": "#E2E8F0"
  }
}
```

Map to Tailwind classes using arbitrary values or extend the theme (for built stacks).

---

*Document version: 3.0.0 | Last updated: 2025-01 | NEXO Landing Page Creator*
