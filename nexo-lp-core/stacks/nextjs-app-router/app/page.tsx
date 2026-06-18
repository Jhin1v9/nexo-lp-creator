import React from 'react'
import Link from 'next/link';

const brandName = '{{BRAND_NAME}}';
const tagline = '{{TAGLINE}}';

const navLinks = [
  { label: '{{NAV_FEATURES:Features}}', href: '#features' },
  { label: '{{NAV_PRICING:Pricing}}', href: '#pricing' },
  { label: '{{NAV_TESTIMONIALS:Testimonials}}', href: '#testimonials' },
];

const features = [
  { title: '{{FEATURE_1_TITLE:Lightning Fast}}', desc: '{{FEATURE_1_DESC:Optimized for speed so your team can work without interruption.}}' },
  { title: '{{FEATURE_2_TITLE:Enterprise Security}}', desc: '{{FEATURE_2_DESC:Bank-grade encryption and compliance standards keep your data safe.}}' },
  { title: '{{FEATURE_3_TITLE:Seamless Integration}}', desc: '{{FEATURE_3_DESC:Connect with your favorite tools and streamline your workflow.}}' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="text-xl font-bold text-slate-900">{brandName}</Link>
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
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-brand-50 -z-10" />
        <div className="absolute top-20 right-0 w-96 h-96 bg-brand-200/20 rounded-full blur-3xl -z-10" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-slate-900 leading-tight mb-6">
            {{HERO_HEADLINE:Build Something}}<br />
            <span className="text-brand-600">{{HERO_HEADLINE_HIGHLIGHT:Amazing Today}}</span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg sm:text-xl text-slate-600 mb-10">{tagline}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="#cta" className="w-full sm:w-auto px-8 py-4 text-lg font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-all hover:shadow-lg hover:-translate-y-0.5">
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
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((f, i) => (
              <div key={i} className="group p-8 rounded-2xl bg-slate-50 hover:bg-white border border-slate-100 hover:border-slate-200 transition-all hover:shadow-lg hover:-translate-y-1">
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
          <a href="#" className="inline-block px-8 py-4 text-lg font-semibold text-brand-700 bg-white hover:bg-brand-50 rounded-xl transition-all hover:shadow-xl hover:-translate-y-0.5">
            {{CTA_BUTTON_PRIMARY:Start Free Trial}}
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p>&copy; {new Date().getFullYear()} {brandName}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}