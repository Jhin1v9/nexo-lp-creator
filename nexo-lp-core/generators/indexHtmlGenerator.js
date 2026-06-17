/**
 * indexHtmlGenerator.js — NEXO Landing Page Creator v3.0
 * Generates a complete base index.html with HTML5 structure, Tailwind CDN,
 * Google Fonts, meta tags, OG tags, and content placeholder.
 */

/**
 * Generate a complete index.html file.
 * @param {Object} options - Configuration options
 * @returns {string} Complete HTML document
 */
function generateIndexHtml(options = {}) {
  const {
    title = '{{BRAND_NAME:Your Brand}} — {{TAGLINE:Transform Your Business}}',
    description = '{{META_DESCRIPTION:Discover how {{BRAND_NAME}} can help you achieve more with less effort. Start your journey today.}}',
    brandName = '{{BRAND_NAME:Your Brand}}',
    tagline = '{{TAGLINE:Transform Your Business}}',
    language = 'en',
    googleFont = 'Inter',
    googleFontWeights = '300;400;500;600;700;800;900',
    themeColor = '#0f172a',
    ogImage = '{{OG_IMAGE:https://via.placeholder.com/1200x630}}',
    canonicalUrl = '{{CANONICAL_URL:https://example.com}}',
    twitterHandle = '{{TWITTER_HANDLE:@yourhandle}}',
    googleAnalyticsId = '{{GA_ID:}}',
    customHead = '',
    bodyContent = null, // If null, generates default sections with placeholders
  } = options;

  const googleFontParam = googleFont.replace(/\s+/g, '+');
  const body = bodyContent || generateDefaultBody({ brandName, tagline });

  return `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">

  <!-- ─── Primary Meta ─── -->
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta name="theme-color" content="${themeColor}">
  <link rel="canonical" href="${canonicalUrl}">

  <!-- ─── Open Graph / Facebook ─── -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:site_name" content="${brandName}">
  <meta property="og:locale" content="${language === 'en' ? 'en_US' : language}">

  <!-- ─── Twitter Card ─── -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${canonicalUrl}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${ogImage}">
  <meta name="twitter:site" content="${twitterHandle}">

  <!-- ─── Robots ─── -->
  <meta name="robots" content="index, follow, max-image-preview:large">

  <!-- ─── Favicon ─── -->
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>N</text></svg>">

  <!-- ─── Fonts ─── -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=${googleFontParam}:wght@${googleFontWeights}&display=swap" rel="stylesheet">

  <!-- ─── Tailwind CSS (CDN) ─── -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['${googleFont}', 'system-ui', '-apple-system', 'sans-serif'],
          },
          colors: {
            brand: {
              50:  '#f0f9ff',
              100: '#e0f2fe',
              200: '#bae6fd',
              300: '#7dd3fc',
              400: '#38bdf8',
              500: '#0ea5e9',
              600: '#0284c7',
              700: '#0369a1',
              800: '#075985',
              900: '#0c4a6e',
              950: '#082f49',
            },
          },
        },
      },
    };
  </script>

  <!-- ─── Custom Styles ─── -->
  <style>
    /* Smooth scrolling */
    html { scroll-behavior: smooth; }
    /* Focus styles */
    *:focus-visible { outline: 2px solid #0ea5e9; outline-offset: 2px; }
    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
      html { scroll-behavior: auto; }
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
    /* Custom scrollbar */
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: #f1f5f9; }
    ::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #64748b; }
  </style>

  <!-- ─── Structured Data ─── -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "${brandName}",
    "description": "${description}",
    "url": "${canonicalUrl}",
    "publisher": {
      "@type": "Organization",
      "name": "${brandName}",
      "logo": {
        "@type": "ImageObject",
        "url": "${ogImage}"
      }
    }
  }
  </script>

  ${googleAnalyticsId ? `<!-- ─── Google Analytics ─── -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    gtag('js', new Date());
    gtag('config', '${googleAnalyticsId}');
  </script>` : ''}

  ${customHead}
</head>
<body class="font-sans antialiased text-slate-800 bg-white">
${body}
</body>
</html>`;
}

/**
 * Generate default body sections with placeholders.
 */
function generateDefaultBody({ brandName, tagline }) {
  return `
  <!-- ─── Navigation ─── -->
  <nav class="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <a href="#" class="text-xl font-bold text-slate-900">${brandName}</a>
        <div class="hidden md:flex items-center space-x-8">
          <a href="#features" class="text-sm text-slate-600 hover:text-slate-900 transition-colors">{{NAV_FEATURES:Features}}</a>
          <a href="#pricing" class="text-sm text-slate-600 hover:text-slate-900 transition-colors">{{NAV_PRICING:Pricing}}</a>
          <a href="#testimonials" class="text-sm text-slate-600 hover:text-slate-900 transition-colors">{{NAV_TESTIMONIALS:Testimonials}}</a>
          <a href="#contact" class="text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 px-4 py-2 rounded-lg transition-colors">{{NAV_CTA:Get Started}}</a>
        </div>
      </div>
    </div>
  </nav>

  <!-- ─── Hero Section ─── -->
  <header class="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden">
    <div class="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-brand-50 -z-10"></div>
    <div class="absolute top-20 right-0 w-96 h-96 bg-brand-200/20 rounded-full blur-3xl -z-10"></div>
    <div class="absolute bottom-0 left-0 w-72 h-72 bg-brand-300/10 rounded-full blur-3xl -z-10"></div>
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <h1 class="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-slate-900 leading-tight mb-6">
        {{HERO_HEADLINE:Build Something}}<br>
        <span class="text-brand-600">{{HERO_HEADLINE_HIGHLIGHT:Amazing Today}}</span>
      </h1>
      <p class="max-w-2xl mx-auto text-lg sm:text-xl text-slate-600 mb-10">
        {{HERO_SUBHEADLINE:${tagline}. Join thousands of satisfied customers who have transformed their workflow with our powerful platform.}}
      </p>
      <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
        <a href="#cta" class="w-full sm:w-auto px-8 py-4 text-lg font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-all hover:shadow-lg hover:shadow-brand-500/25 hover:-translate-y-0.5">
          {{HERO_CTA_PRIMARY:Get Started Free}}
        </a>
        <a href="#features" class="w-full sm:w-auto px-8 py-4 text-lg font-semibold text-slate-700 bg-white border-2 border-slate-200 hover:border-slate-300 rounded-xl transition-all hover:-translate-y-0.5">
          {{HERO_CTA_SECONDARY:Learn More}}
        </a>
      </div>
      <div class="mt-12 flex items-center justify-center gap-6 text-sm text-slate-500">
        <span class="flex items-center gap-1">
          <svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
          {{TRUST_BADGE_1:No Credit Card Required}}
        </span>
        <span class="flex items-center gap-1">
          <svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
          {{TRUST_BADGE_2:14-Day Free Trial}}
        </span>
        <span class="flex items-center gap-1">
          <svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
          {{TRUST_BADGE_3:Cancel Anytime}}
        </span>
      </div>
    </div>
  </header>

  <!-- ─── Features Section ─── -->
  <section id="features" class="py-20 lg:py-28 bg-white">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-16">
        <h2 class="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">{{FEATURES_TITLE:Everything You Need}}</h2>
        <p class="max-w-2xl mx-auto text-lg text-slate-600">{{FEATURES_SUBTITLE:Powerful features designed to help you work smarter, not harder.}}</p>
      </div>
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        <!-- Feature 1 -->
        <div class="group p-8 rounded-2xl bg-slate-50 hover:bg-white border border-slate-100 hover:border-slate-200 transition-all hover:shadow-lg hover:-translate-y-1">
          <div class="w-12 h-12 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          </div>
          <h3 class="text-lg font-semibold text-slate-900 mb-2">{{FEATURE_1_TITLE:Lightning Fast}}</h3>
          <p class="text-slate-600">{{FEATURE_1_DESC:Optimized for speed so your team can work without interruption.}}</p>
        </div>
        <!-- Feature 2 -->
        <div class="group p-8 rounded-2xl bg-slate-50 hover:bg-white border border-slate-100 hover:border-slate-200 transition-all hover:shadow-lg hover:-translate-y-1">
          <div class="w-12 h-12 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
          </div>
          <h3 class="text-lg font-semibold text-slate-900 mb-2">{{FEATURE_2_TITLE:Enterprise Security}}</h3>
          <p class="text-slate-600">{{FEATURE_2_DESC:Bank-grade encryption and compliance standards keep your data safe.}}</p>
        </div>
        <!-- Feature 3 -->
        <div class="group p-8 rounded-2xl bg-slate-50 hover:bg-white border border-slate-100 hover:border-slate-200 transition-all hover:shadow-lg hover:-translate-y-1">
          <div class="w-12 h-12 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/></svg>
          </div>
          <h3 class="text-lg font-semibold text-slate-900 mb-2">{{FEATURE_3_TITLE:Seamless Integration}}</h3>
          <p class="text-slate-600">{{FEATURE_3_DESC:Connect with your favorite tools and streamline your workflow.}}</p>
        </div>
        <!-- Feature 4 -->
        <div class="group p-8 rounded-2xl bg-slate-50 hover:bg-white border border-slate-100 hover:border-slate-200 transition-all hover:shadow-lg hover:-translate-y-1">
          <div class="w-12 h-12 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          </div>
          <h3 class="text-lg font-semibold text-slate-900 mb-2">{{FEATURE_4_TITLE:Advanced Analytics}}</h3>
          <p class="text-slate-600">{{FEATURE_4_DESC:Gain insights with detailed reports and real-time dashboards.}}</p>
        </div>
        <!-- Feature 5 -->
        <div class="group p-8 rounded-2xl bg-slate-50 hover:bg-white border border-slate-100 hover:border-slate-200 transition-all hover:shadow-lg hover:-translate-y-1">
          <div class="w-12 h-12 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
          </div>
          <h3 class="text-lg font-semibold text-slate-900 mb-2">{{FEATURE_5_TITLE:Team Collaboration}}</h3>
          <p class="text-slate-600">{{FEATURE_5_DESC:Work together in real-time with your entire team, anywhere.}}</p>
        </div>
        <!-- Feature 6 -->
        <div class="group p-8 rounded-2xl bg-slate-50 hover:bg-white border border-slate-100 hover:border-slate-200 transition-all hover:shadow-lg hover:-translate-y-1">
          <div class="w-12 h-12 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
          </div>
          <h3 class="text-lg font-semibold text-slate-900 mb-2">{{FEATURE_6_TITLE:24/7 Support}}</h3>
          <p class="text-slate-600">{{FEATURE_6_DESC:Our dedicated team is always here to help you succeed.}}</p>
        </div>
      </div>
    </div>
  </section>

  <!-- ─── CTA Section ─── -->
  <section id="cta" class="py-20 lg:py-28 relative overflow-hidden">
    <div class="absolute inset-0 bg-gradient-to-br from-brand-600 to-brand-800 -z-10"></div>
    <div class="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] -z-10"></div>
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <h2 class="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">{{CTA_HEADLINE:Ready to Get Started?}}</h2>
      <p class="text-lg sm:text-xl text-brand-100 mb-10">{{CTA_SUBHEADLINE:Join thousands of teams already using ${brandName} to build amazing things.}}</p>
      <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
        <a href="#" class="w-full sm:w-auto px-8 py-4 text-lg font-semibold text-brand-700 bg-white hover:bg-brand-50 rounded-xl transition-all hover:shadow-xl hover:-translate-y-0.5">
          {{CTA_BUTTON_PRIMARY:Start Free Trial}}
        </a>
        <a href="#" class="w-full sm:w-auto px-8 py-4 text-lg font-semibold text-white border-2 border-white/30 hover:border-white/60 rounded-xl transition-all">
          {{CTA_BUTTON_SECONDARY:Schedule a Demo}}
        </a>
      </div>
      <p class="mt-6 text-sm text-brand-200">{{CTA_GUARANTEE:30-day money-back guarantee. No questions asked.}}</p>
    </div>
  </section>

  <!-- ─── Footer ─── -->
  <footer class="bg-slate-900 text-slate-400 py-12">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="grid md:grid-cols-4 gap-8 mb-8">
        <div>
          <h3 class="text-lg font-bold text-white mb-4">${brandName}</h3>
          <p class="text-sm">{{FOOTER_ABOUT:Empowering teams to build better products, faster.}}</p>
        </div>
        <div>
          <h4 class="text-sm font-semibold text-white mb-4">{{FOOTER_COL_1_TITLE:Product}}</h4>
          <ul class="space-y-2 text-sm">
            <li><a href="#" class="hover:text-white transition-colors">{{FOOTER_LINK_1:Features}}</a></li>
            <li><a href="#" class="hover:text-white transition-colors">{{FOOTER_LINK_2:Pricing}}</a></li>
            <li><a href="#" class="hover:text-white transition-colors">{{FOOTER_LINK_3:Integrations}}</a></li>
          </ul>
        </div>
        <div>
          <h4 class="text-sm font-semibold text-white mb-4">{{FOOTER_COL_2_TITLE:Company}}</h4>
          <ul class="space-y-2 text-sm">
            <li><a href="#" class="hover:text-white transition-colors">{{FOOTER_LINK_4:About}}</a></li>
            <li><a href="#" class="hover:text-white transition-colors">{{FOOTER_LINK_5:Blog}}</a></li>
            <li><a href="#" class="hover:text-white transition-colors">{{FOOTER_LINK_6:Careers}}</a></li>
          </ul>
        </div>
        <div>
          <h4 class="text-sm font-semibold text-white mb-4">{{FOOTER_COL_3_TITLE:Support}}</h4>
          <ul class="space-y-2 text-sm">
            <li><a href="#" class="hover:text-white transition-colors">{{FOOTER_LINK_7:Help Center}}</a></li>
            <li><a href="#" class="hover:text-white transition-colors">{{FOOTER_LINK_8:Contact}}</a></li>
            <li><a href="#" class="hover:text-white transition-colors">{{FOOTER_LINK_9:Privacy}}</a></li>
          </ul>
        </div>
      </div>
      <div class="border-t border-slate-800 pt-8 text-sm text-center">
        <p>{{FOOTER_COPYRIGHT:© {{CURRENT_YEAR}} ${brandName}. All rights reserved.}}</p>
      </div>
    </div>
  </footer>
`;
}

/**
 * Generate just the HTML head section (for use with other generators).
 */
function generateHeadOnly(options = {}) {
  const html = generateIndexHtml(options);
  const headMatch = html.match(/<head>([\s\S]*?)<\/head>/);
  return headMatch ? headMatch[1].trim() : '';
}

module.exports = {
  generateIndexHtml,
  generateHeadOnly,
};
