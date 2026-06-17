# Post-Build Checklist

Verify the build output meets quality standards before deployment.

## Build Output
- [ ] Output directory exists and is not empty
- [ ] index.html present at output root
- [ ] CSS/JS assets generated and linked correctly
- [ ] No build errors or critical warnings
- [ ] Build completes within expected time

## File Integrity
- [ ] No empty files in output
- [ ] No syntax errors in generated HTML
- [ ] No syntax errors in generated CSS
- [ ] No syntax errors in generated JS
- [ ] All referenced assets exist (images, fonts, icons)

## Content Verification
- [ ] All placeholders resolved
- [ ] Page renders correctly in browser
- [ ] All sections visible and properly styled
- [ ] Navigation links work (smooth scroll or page nav)
- [ ] CTA buttons are clickable
- [ ] Forms submit correctly (if applicable)

## Responsive Testing
- [ ] Mobile (320px - 480px) layout correct
- [ ] Tablet (768px - 1024px) layout correct
- [ ] Desktop (1200px+) layout correct
- [ ] No horizontal scroll on any device
- [ ] Text readable at all breakpoints

## Performance Checks
- [ ] Page loads in under 3 seconds
- [ ] Images lazy-loaded below fold
- [ ] No render-blocking resources
- [ ] Fonts load with swap strategy

## SEO Validation
- [ ] Title and meta description in built HTML
- [ ] OG tags present in source
- [ ] JSON-LD structured data valid
- [ ] Canonical URL correct

## Security
- [ ] No inline event handlers
- [ ] No eval() usage
- [ ] No HTTP references (all HTTPS)
- [ ] CSP-friendly code
