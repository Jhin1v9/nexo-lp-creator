import { useState } from 'react';

function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const brandName = '{{BRAND_NAME}}' || 'Your Brand';
  const tagline = '{{TAGLINE}}' || 'Transform Your Business';

  const navLinks = [
    { label: '{{NAV_FEATURES:Features}}', href: '#features' },
    { label: '{{NAV_PRICING:Pricing}}', href: '#pricing' },
    { label: '{{NAV_TESTIMONIALS:Testimonials}}', href: '#testimonials' },
  ];

  const features = [
    {
      title: '{{FEATURE_1_TITLE:Lightning Fast}}',
      desc: '{{FEATURE_1_DESC:Optimized for speed so your team can work without interruption.}}',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
      ),
    },
    {
      title: '{{FEATURE_2_TITLE:Enterprise Security}}',
      desc: '{{FEATURE_2_DESC:Bank-grade encryption and compliance standards keep your data safe.}}',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
      ),
    },
    {
      title: '{{FEATURE_3_TITLE:Seamless Integration}}',
      desc: '{{FEATURE_3_DESC:Connect with your favorite tools and streamline your workflow.}}',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>
      ),
    },
    {
      title: '{{FEATURE_4_TITLE:Advanced Analytics}}',
      desc: '{{FEATURE_4_DESC:Gain insights with detailed reports and real-time dashboards.}}',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
      ),
    },
    {
      title: '{{FEATURE_5_TITLE:Team Collaboration}}',
      desc: '{{FEATURE_5_DESC:Work together in real-time with your entire team, anywhere.}}',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
      ),
    },
    {
      title: '{{FEATURE_6_TITLE:24/7 Support}}',
      desc: '{{FEATURE_6_DESC:Our dedicated team is always here to help you succeed.}}',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <a href="#" className="text-xl font-bold text-slate-900">{brandName}</a>
            <div className="hidden md:flex items-center space-x-8">
              {navLinks.map((link) => (
                <a key={link.href} href={link.href} className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
                  {link.label}
                </a>
              ))}
              <a href="#cta" className="text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 px-4 py-2 rounded-lg transition-colors">
                Get Started
              </a>
            </div>
            <button
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
          {mobileMenuOpen && (
            <div className="md:hidden pb-4 space-y-2">
              {navLinks.map((link) => (
                <a key={link.href} href={link.href} className="block px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg">
                  {link.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Hero */}
      <header className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-brand-50 -z-10" />
        <div className="absolute top-20 right-0 w-96 h-96 bg-brand-200/20 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-brand-300/10 rounded-full blur-3xl -z-10" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-slate-900 leading-tight mb-6">
            {{HERO_HEADLINE:Build Something}}<br />
            <span className="text-brand-600">{{HERO_HEADLINE_HIGHLIGHT:Amazing Today}}</span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg sm:text-xl text-slate-600 mb-10">
            {tagline}. Join thousands of satisfied customers who have transformed their workflow with our powerful platform.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="#cta" className="w-full sm:w-auto px-8 py-4 text-lg font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-all hover:shadow-lg hover:shadow-brand-500/25 hover:-translate-y-0.5">
              {{HERO_CTA_PRIMARY:Get Started Free}}
            </a>
            <a href="#features" className="w-full sm:w-auto px-8 py-4 text-lg font-semibold text-slate-700 bg-white border-2 border-slate-200 hover:border-slate-300 rounded-xl transition-all hover:-translate-y-0.5">
              Learn More
            </a>
          </div>
        </div>
      </header>

      {/* Features */}
      <section id="features" className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">{{FEATURES_TITLE:Everything You Need}}</h2>
            <p className="max-w-2xl mx-auto text-lg text-slate-600">{{FEATURES_SUBTITLE:Powerful features designed to help you work smarter, not harder.}}</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <div key={i} className="group p-8 rounded-2xl bg-slate-50 hover:bg-white border border-slate-100 hover:border-slate-200 transition-all hover:shadow-lg hover:-translate-y-1">
                <div className="w-12 h-12 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  {f.icon}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-slate-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="py-20 lg:py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600 to-brand-800 -z-10" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">{{CTA_HEADLINE:Ready to Get Started?}}</h2>
          <p className="text-lg sm:text-xl text-brand-100 mb-10">
            Join thousands of teams already using {brandName} to build amazing things.
          </p>
          <a href="#" className="inline-block px-8 py-4 text-lg font-semibold text-brand-700 bg-white hover:bg-brand-50 rounded-xl transition-all hover:shadow-xl hover:-translate-y-0.5">
            {{CTA_BUTTON_PRIMARY:Start Free Trial}}
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="border-t border-slate-800 pt-8 text-sm text-center">
            <p>&copy; {new Date().getFullYear()} {brandName}. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
