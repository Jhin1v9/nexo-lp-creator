# Static HTML + Tailwind CSS — NEXO Stack

Zero-build static landing page powered by Tailwind CSS via CDN.

## Quick Start

No build step required. Just open `index.html` in your browser or serve with any static server.

```bash
# Preview locally
npx serve .

# Or with Python
python3 -m http.server 3000

# Or with Node
npx http-server . -p 3000
```

## Project Structure

```
.
├── index.html          # Main landing page
├── tailwind.config.js  # Tailwind config (for reference / CLI usage)
├── package.json        # Dev dependencies (optional)
├── build-checklist.md  # Pre-deploy checklist
└── README.md           # This file
```

## Deployment

Upload `index.html` to any static host:

- **Vercel**: `vercel --prod`
- **Netlify**: Drag & drop folder
- **GitHub Pages**: Enable in repo settings
- **Cloudflare Pages**: Connect Git repo
- **AWS S3**: Upload with public-read ACL

## Customization

Edit `index.html` directly. Replace all `{{PLACEHOLDER}}` values with your content.

### Changing Colors

Colors are defined in the Tailwind config script inside `index.html`. Update the `brand` color scale to match your brand.

### Changing Fonts

Update the Google Fonts link in the `<head>` and the `fontFamily` config in the Tailwind script.

## Notes

- Tailwind is loaded via CDN for instant setup. For production with custom config, consider using the Tailwind CLI.
- No JavaScript framework required — this is pure HTML + CSS.
