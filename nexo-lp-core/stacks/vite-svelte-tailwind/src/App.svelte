<script>
  let mobileMenuOpen = false;
  const brandName = '{{BRAND_NAME}}';
  const tagline = '{{TAGLINE}}';

  const navLinks = [
    { label: '{{NAV_FEATURES:Features}}', href: '#features' },
    { label: '{{NAV_PRICING:Pricing}}', href: '#pricing' },
  ];

  const features = [
    { title: '{{FEATURE_1_TITLE:Lightning Fast}}', desc: '{{FEATURE_1_DESC:Optimized for speed so your team can work without interruption.}}' },
    { title: '{{FEATURE_2_TITLE:Enterprise Security}}', desc: '{{FEATURE_2_DESC:Bank-grade encryption and compliance standards keep your data safe.}}' },
    { title: '{{FEATURE_3_TITLE:Seamless Integration}}', desc: '{{FEATURE_3_DESC:Connect with your favorite tools and streamline your workflow.}}' },
  ];
</script>

<div class="min-h-screen">
  <!-- Navigation -->
  <nav class="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <a href="#" class="text-xl font-bold text-slate-900">{brandName}</a>
        <div class="hidden md:flex items-center space-x-8">
          {#each navLinks as link}
            <a href={link.href} class="text-sm text-slate-600 hover:text-slate-900 transition-colors">{link.label}</a>
          {/each}
          <a href="#cta" class="text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 px-4 py-2 rounded-lg transition-colors">Get Started</a>
        </div>
        <button class="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100" on:click={() => mobileMenuOpen = !mobileMenuOpen} aria-label="Toggle menu">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {#if mobileMenuOpen}
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            {:else}
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            {/if}
          </svg>
        </button>
      </div>
      {#if mobileMenuOpen}
        <div class="md:hidden pb-4 space-y-2">
          {#each navLinks as link}
            <a href={link.href} class="block px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg">{link.label}</a>
          {/each}
        </div>
      {/if}
    </div>
  </nav>

  <!-- Hero -->
  <header class="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden">
    <div class="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-brand-50 -z-10"></div>
    <div class="absolute top-20 right-0 w-96 h-96 bg-brand-200/20 rounded-full blur-3xl -z-10"></div>
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <h1 class="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-slate-900 leading-tight mb-6">
        {{HERO_HEADLINE:Build Something}}<br>
        <span class="text-brand-600">{{HERO_HEADLINE_HIGHLIGHT:Amazing Today}}</span>
      </h1>
      <p class="max-w-2xl mx-auto text-lg sm:text-xl text-slate-600 mb-10">{tagline}</p>
      <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
        <a href="#cta" class="w-full sm:w-auto px-8 py-4 text-lg font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-all hover:shadow-lg hover:-translate-y-0.5">
          {{HERO_CTA_PRIMARY:Get Started Free}}
        </a>
        <a href="#features" class="w-full sm:w-auto px-8 py-4 text-lg font-semibold text-slate-700 bg-white border-2 border-slate-200 hover:border-slate-300 rounded-xl transition-all hover:-translate-y-0.5">
          Learn More
        </a>
      </div>
    </div>
  </header>

  <!-- Features -->
  <section id="features" class="py-20 lg:py-28 bg-white">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-16">
        <h2 class="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">{{FEATURES_TITLE:Everything You Need}}</h2>
      </div>
      <div class="grid md:grid-cols-3 gap-8">
        {#each features as f, i}
          <div class="group p-8 rounded-2xl bg-slate-50 hover:bg-white border border-slate-100 hover:border-slate-200 transition-all hover:shadow-lg hover:-translate-y-1">
            <h3 class="text-lg font-semibold text-slate-900 mb-2">{f.title}</h3>
            <p class="text-slate-600">{f.desc}</p>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- CTA -->
  <section id="cta" class="py-20 lg:py-28 relative overflow-hidden">
    <div class="absolute inset-0 bg-gradient-to-br from-brand-600 to-brand-800 -z-10"></div>
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <h2 class="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">{{CTA_HEADLINE:Ready to Get Started?}}</h2>
      <a href="#" class="inline-block px-8 py-4 text-lg font-semibold text-brand-700 bg-white hover:bg-brand-50 rounded-xl transition-all hover:shadow-xl hover:-translate-y-0.5">
        {{CTA_BUTTON_PRIMARY:Start Free Trial}}
      </a>
    </div>
  </section>

  <!-- Footer -->
  <footer class="bg-slate-900 text-slate-400 py-12">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      <p>&copy; {new Date().getFullYear()} {brandName}. All rights reserved.</p>
    </div>
  </footer>
</div>