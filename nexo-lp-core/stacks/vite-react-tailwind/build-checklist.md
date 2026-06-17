# Build Checklist — Vite + React + Tailwind CSS

## Pre-Build Checklist
- [ ] All `{{PLACEHOLDER}}` values replaced with actual content
- [ ] Dependencies installed (`npm install`)
- [ ] No unused imports or variables
- [ ] No `console.log` statements in production code

## Build Command
```bash
npm run build
```

## Build Verification
- [ ] `dist/` directory created
- [ ] `dist/index.html` exists and is valid
- [ ] `dist/assets/` contains JS and CSS bundles
- [ ] No build errors or warnings
- [ ] Build output size is reasonable (< 500KB gzipped)

## Pre-Deploy Checklist
- [ ] `npm run preview` renders correctly
- [ ] All images load properly
- [ ] All links work
- [ ] Responsive on mobile, tablet, desktop
- [ ] Meta tags and OG tags present in built HTML

## Deployment
Set build command: `npm run build`
Set output directory: `dist`
