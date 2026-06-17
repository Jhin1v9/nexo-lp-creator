# Build Checklist — Static HTML + Tailwind CSS

## Pre-Deploy Checklist

### Content
- [ ] All {{PLACEHOLDER}} values replaced with actual content
- [ ] Brand name and logo are correct
- [ ] All links point to correct URLs (no `href="#"`)
- [ ] Contact information is accurate
- [ ] Copyright year is current

### HTML / Structure
- [ ] Valid HTML5 doctype
- [ ] Single `<h1>` per page
- [ ] Heading hierarchy is logical (no skipped levels)
- [ ] All images have `alt` text
- [ ] All images have `width` and `height` attributes
- [ ] Lazy loading on below-fold images (`loading="lazy"`)

### Meta / SEO
- [ ] Title tag present and 50-60 characters
- [ ] Meta description present and 150-160 characters
- [ ] Open Graph tags (og:title, og:description, og:image, og:url)
- [ ] Twitter Card tags present
- [ ] Canonical URL set
- [ ] Favicon linked

### Performance
- [ ] Tailwind CDN using specific version (not `@latest` in production)
- [ ] Images optimized and compressed
- [ ] Google Fonts using `display=swap`
- [ ] No render-blocking resources

### Accessibility
- [ ] Color contrast meets WCAG 2.1 AA
- [ ] Focus styles visible
- [ ] Form inputs have labels
- [ ] Language attribute set on `<html>`

### Deployment
- [ ] Files uploaded to correct directory
- [ ] index.html is at root
- [ ] Custom domain configured (if applicable)
- [ ] HTTPS enforced
- [ ] 404 page configured (optional)
