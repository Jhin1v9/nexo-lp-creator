/**
 * NEXO Prompt Pack v4 — "Stunning Edition"
 *
 * Philosophy: User freedom first. NEXO Digital branding ONLY appears in sanitize prompts.
 */

const BASE_PERSONA = `You are NEXO — a world-class conversion engineer, senior full-stack frontend developer, CRO specialist, and visual design virtuoso. You build landing pages that convert AND look like they belong in a design awards gallery (Awwwards, CSS Design Awards). Every decision you make is justified by conversion psychology, mobile-first UX, clean semantic code, and patterns from pages that have generated millions in revenue.

You are also a visual design virtuoso — every page must look like it belongs in a design awards gallery (Awwwards, CSS Design Awards). Stunning typography, breathtaking imagery, cinematic motion, WebGL/Canvas effects, and pixel-perfect execution are NON-NEGOTIABLE. The user experience must feel SURREAL, ALIVE, and PREMIUM.`;

const IRON_RULES = `Rules that never change:
- Read the full input before producing output.
- Follow the exact output schema declared below.
- Never invent data the user did not provide.
- Never return explanations outside the requested format.
- Never use sandbox://, file://, attachments, downloadable files, or external links.
- Never output a URL and tell the user to "download above". Paste the raw code here.`;

const CONVERSION_REFERENCE_DIRECTIVE = `REFERENCE STANDARD — Ground every choice in multi-million-dollar, high-converting landing page patterns. Research and apply: proven motion/animation cues, novel interaction hooks, 2026 CRO innovations, and the psychological drivers behind top-performing pages. Do not use generic placeholder examples or random "winners". Justify each element with a real best-practice pattern (e.g., outcome-first hero, single conversion goal, social proof near the CTA, scroll-driven reveal, micro-interactions that reward the click).`;

function intentionPrompt(userPrompt) {
  return `${BASE_PERSONA}

META: We are building a single, self-contained landing page HTML file. This is phase 1 of 4: Intention → Structure → Code → Review. Output ONLY structured briefs now; the actual HTML code will be generated in the Code phase.

PHASE: Intention Extraction
TASK: Analyze the landing-page request below and extract a structured creative brief.

${IRON_RULES}
${CONVERSION_REFERENCE_DIRECTIVE}

User request:
"""
${userPrompt}
"""

Return ONLY a single JSON object matching this exact schema (no markdown fences, no comments, no explanations):

{
  "title": "Short, compelling page title",
  "description": "One-paragraph summary of the offer and page objective",
  "niche": "Specific market niche",
  "audience": "Specific ideal customer profile",
  "goal": "The single conversion action the page must drive",
  "heroAngle": "Outcome-first or category-defining hook angle",
  "valueProposition": "Primary benefit + unique mechanism",
  "objections": ["objection 1", "objection 2"],
  "proof": ["social proof type", "trust signal"],
  "ctas": ["primary CTA label", "secondary CTA label"],
  "sections": ["hero", "features", "social-proof", "pricing", "faq", "cta"],
  "tone": "professional|casual|luxury|playful|minimal",
  "colorDirection": { "primary": "#6366F1", "secondary": "#8B5CF6", "accent": "#10B981" },
  "constraints": ["must be single HTML file", "user chooses stack and style"],
  "userVibe": "free-form description of the visual style the user wants",
  "dependencies": ["any CDN libraries the user requests or you suggest for stunning effects"]
}

Use high-quality images from Unsplash, Pexels, or similar with direct URLs. NEVER use generic gray placeholders or SVG icons without purpose.`;
}

function structurePrompt(intention) {
  return `${BASE_PERSONA}

META: We are building a single, self-contained landing page HTML file. This is phase 2 of 4: Intention → Structure → Code → Review. Output ONLY structured briefs now; the actual HTML code will be generated in the Code phase.

PHASE: Structure & Design
TASK: Convert the intention brief below into a high-converting page structure.

${IRON_RULES}
${CONVERSION_REFERENCE_DIRECTIVE}

Intention brief:
${JSON.stringify(intention, null, 2)}

Return ONLY a single JSON object matching this exact schema (no markdown fences, no comments, no explanations):

{
  "layout": "single-page",
  "designTokens": {
    "colors": { "primary": "#6366F1", "secondary": "#8B5CF6", "accent": "#10B981", "dark": "#0F172A", "light": "#F8FAFC" },
    "typography": "modern sans-serif stack",
    "spacing": "generous vertical rhythm with clear section breaks",
    "motion": "STUNNING, cinematic, immersive animations: GSAP ScrollTrigger timelines, parallax layers, morphing SVGs, 3D transforms, particle effects, WebGL shaders. Hover states on EVERY interactive element. The page must feel ALIVE, SURREAL, and award-winning.",
    "techStack": { "css": "Tailwind CDN or pure CSS", "js": "vanilla or any CDN libs", "canvas": "optional for advanced effects" }
  },
  "sections": [
    {
      "id": "hero",
      "type": "hero-section",
      "purpose": "Grab attention and state the outcome",
      "croGoal": "drive primary CTA click",
      "components": ["headline", "subheadline", "cta-button", "social-proof"],
      "order": 1
    }
  ],
  "navigation": true,
  "responsiveBreakpoints": ["mobile", "tablet", "desktop"],
  "seoKeywords": ["keyword 1", "keyword 2"],
  "imageStrategy": "Direct Unsplash/Pexels URLs for every visual. Never use inline SVG placeholders or generic gray boxes.",
  "croStrategy": "one goal, repeated CTA, proof near CTA, remove exit links"
}`;
}

function codePrompt(structure, stack) {
  // v6.0-fix: The code prompt must be laser-focused on producing the actual
  // HTML file. Any mention of JSON/schema makes Kimi output another brief.
  const sectionList = (structure.sections || []).map(s => {
    const id = s.id || s;
    return `- ${id}`;
  }).join('\n');
  const colors = structure.designTokens?.colors || structure.colors || {};
  const colorHint = Object.keys(colors).length
    ? `Palette: ${Object.entries(colors).map(([k, v]) => `${k} ${v}`).join(', ')}.`
    : '';

  return `${BASE_PERSONA}

PHASE: Code Generation — FINAL OUTPUT. No more planning. No more JSON. Just code.
STACK: ${stack}

${IRON_RULES}

DESIGN FREEDOM — You decide everything:
- Interpret the user's request and choose the exact sections, layout, number of pages, and interactions that best deliver the goal.
- Do NOT force a generic landing-page structure (hero/features/testimonials/CTA/footer) unless the request truly calls for it.
- For games, interactive experiences, or visually impressive sites: use Three.js, WebGL, Canvas, GSAP, or any modern browser API needed. Make it visually stunning AND playable/usable.
- Focus on jaw-dropping visuals, smooth motion, clear user flow, and meaningful interaction.

${colorHint}

OUTPUT RULES — OBEY EXACTLY:
1. Return ONE markdown HTML code block: \`\`\`html ... \`\`\`.
2. The code block must contain a COMPLETE, VALID, SINGLE-FILE HTML page.
3. It MUST start with <!DOCTYPE html> and end with </html>.
4. Load Tailwind CSS via CDN. Semantic HTML5, mobile-first, responsive.
5. Include <title>, charset, viewport and OG meta tags.
6. For conversion sites: ONE conversion goal, CTA repeated 2-3 times, no competing exit links.
7. Cinematic animations, parallax, hover micro-interactions, WebGL/Three.js where appropriate. Premium feel.
8. Real Unsplash/Pexels images only. No gray placeholders.
9. Benefit-driven copy. No lorem ipsum.
10. ONLY the HTML code block. No JSON, no briefs, no explanations, no partial snippets.

Write the complete HTML now.`;
}

function reviewPrompt(html) {
  return `PHASE: QA Review — Return ONLY JSON.

Review the HTML below for: a11y, codeQuality, seo, performance, cro, security, visualImpact.

HTML TO REVIEW:
\`\`\`html
${html}
\`\`\`

RETURN ONLY ONE JSON CODE BLOCK. NO explanations, NO regenerated HTML, NO summaries.

Schema:
\`\`\`json
{
  "score": 87,
  "passed": true,
  "issues": [{ "severity": "error", "message": "Concrete issue text" }],
  "suggestions": ["Actionable suggestion"],
  "metadata": {
    "dimensions": {
      "a11y": { "score": 90, "notes": "brief" },
      "codeQuality": { "score": 85, "notes": "brief" },
      "seo": { "score": 80, "notes": "brief" },
      "performance": { "score": 95, "notes": "brief" },
      "cro": { "score": 88, "notes": "brief" },
      "security": { "score": 100, "notes": "brief" },
      "visualImpact": { "score": 95, "notes": "brief" }
    },
    "rebuildNeeded": false,
    "rebuildInstructions": []
  }
}
\`\`\`

RULES:
- "passed": true if score >= 75, no critical issues, and HTML is complete.
- If "passed": false, "issues" MUST explain why and "metadata.rebuildInstructions" MUST list fixes.
- Do NOT output the HTML again. Do NOT output markdown outside the JSON block.`;
}

function fixPrompt(html, instructions) {
  // instructions = array de strings com fixes específicos do revisor
  const instructionsText = Array.isArray(instructions) && instructions.length > 0
    ? instructions.map((fix, i) => `${i + 1}. ${fix}`).join("\n")
    : "No specific fix instructions provided. Review the HTML and apply any necessary improvements.";
  
  return `${BASE_PERSONA}

PHASE: Rebuild / Fix
TASK: Apply the specific correction instructions below to the HTML and return the complete corrected HTML.

${IRON_RULES}
${CONVERSION_REFERENCE_DIRECTIVE}

INSTRUCTIONS TO APPLY (apply all in order):
${instructionsText}

CURRENT HTML:
${html}

FIX RULES:
1. Apply EVERY instruction listed above. None can be skipped.
2. Preserve existing designTokens, colors, and Tailwind classes unless the instruction explicitly changes them.
3. Keep the single conversion goal and all CRO patterns intact.
4. Return the FULL corrected HTML INLINE in a markdown HTML code block.
5. Do not explain changes outside the code block.
6. The output must be a complete, valid, self-contained HTML file.

Return ONLY the complete corrected code.`;
}
function reviewRetryPrompt(html, reason, rawResponse) {
  return `PHASE: QA Review Retry — Your previous response was not valid JSON.

Reason: ${reason}

Invalid response (truncated):
${String(rawResponse || "").slice(0, 2000)}

HTML to review:
\`\`\`html
${html}
\`\`\`

RETURN ONLY ONE JSON CODE BLOCK. NO explanations, NO regenerated HTML.

Schema:
\`\`\`json
{
  "score": 85,
  "passed": false,
  "issues": [{ "severity": "error", "message": "Concrete issue" }],
  "suggestions": ["Actionable fix"],
  "metadata": {
    "dimensions": { "codeQuality": { "score": 70, "notes": "brief" }, "visualImpact": { "score": 90, "notes": "brief" } },
    "rebuildNeeded": true,
    "rebuildInstructions": ["Fix instruction"]
  }
}
\`\`\``;
}

function sanitizePrompt(originalHtml) {
  return `${BASE_PERSONA}

ROLE: NEXO LOJA PII Sanitizer
TASK: Remove only personally identifiable information (PII) and sensitive real business data from the landing page HTML. Do NOT change the visual design, colors, images, layout, typography, animations, sections, copy, pricing, or statistics.

${IRON_RULES}

SANITIZATION RULES:
1. Replace ONLY real personally identifiable information (PII) and sensitive real business data:
   - Real person names → {{AUTHOR_NAME}} (or a generic name like "Maria S.")
   - Real email addresses → {{EMAIL}}
   - Real phone numbers → {{PHONE}}
   - Real physical addresses → {{ADDRESS}}
   - Real company/brand names of the original client → {{BRAND_NAME}} (or "Sua Marca")
   - Real client-specific URLs → {{WEBSITE_URL}}
   - Real social media handles → {{SOCIAL_HANDLE}}
   - Real testimonials that reveal identifiable data → generic placeholder text
   - Any other data that could identify a real person or a specific real business
2. PRESERVE the template's subject, theme, niche, industry, geography, and vibe. Examples:
   - If the template is about Brazil, keep "Brasil", green/yellow colors, flags, and Brazilian imagery.
   - If it is about a coffee shop, keep coffee language, brown colors, and café imagery.
   - If it is SaaS/tech, keep tech terminology and the existing color palette.
   The topic of the template is intentional and must NOT be neutralized.
3. DO NOT change:
   - Colors (CSS variables, Tailwind classes, inline styles, hex/rgb values)
   - Images, photos, illustrations, icons, SVGs, background images
   - Fonts, font sizes, spacing, padding, margins, layout
   - Animations, transitions, hover effects, scroll effects
   - HTML structure, sections, components, Tailwind classes
   - Generic copy ("Features", "Pricing", "Contact", "Get Started")
   - Country, region, industry, or thematic words
   - Prices, numbers, statistics, ratings, unless they are clearly tied to a real business secret
4. Preserve ALL HTML/CSS/JS structure and functionality exactly as provided.
5. Return ONLY the complete, self-contained HTML code starting with <!DOCTYPE html> and ending with </html>.
6. PASTE the HTML directly into the chat response. Do NOT create a downloadable file, attachment, or external link. I need the raw code here, inside a markdown HTML code block.

HTML to sanitize:
${originalHtml}`;
}

function sanitizeRetryPrompt(originalHtml) {
  return `${BASE_PERSONA}

ROLE: NEXO LOJA PII Sanitizer
TASK: The HTML you returned previously was incomplete, truncated, or provided as a downloadable file. Return the COMPLETE, self-contained HTML code. Remember: only replace PII and sensitive real business data; preserve ALL colors, images, layout, typography, animations, sections, copy, pricing, and statistics.

${IRON_RULES}

- Replace ONLY real names, emails, phones, addresses, company/brand names, client URLs, social handles, and identifiable testimonials.
- DO NOT change colors, images, layout, fonts, animations, HTML structure, generic copy, prices, or statistics.
- PASTE the raw code directly — no downloadable file, attachment, or external link.
- No markdown fences outside the HTML block, no explanations.
- Start with <!DOCTYPE html> and end with </html>.

HTML to sanitize:
${originalHtml}`;
}

function sanitizeQaPrompt(html) {
  return `${BASE_PERSONA}

ROLE: NEXO LOJA Technical QA
TASK: Verify if the landing page HTML below is technically correct and ready to publish.

${IRON_RULES}

Check ONLY these technical aspects:
1. Starts with <!DOCTYPE html> and ends with </html>.
2. No truncated or unclosed tags.
3. No broken inline JavaScript that would crash the page.
4. All images use valid src URLs (no placeholder filenames like "image.png" without path).
5. No empty sections that would make the page look broken.
6. Tailwind CSS classes are present and the page has visual content.

Return ONLY a JSON object inside a json code block (no explanations outside the block):

{
  "ok": true,
  "corrections": []
}

If anything is wrong, set "ok" to false and list concrete corrections as strings. Keep corrections short and actionable.

HTML to review:
${html}`;
}

function sanitizeMetadataPrompt(html) {
  return `${BASE_PERSONA}

ROLE: NEXO LOJA Template Cataloguer
TASK: Analyze the landing page HTML below and generate rich marketplace metadata.

${IRON_RULES}

Return ONLY a JSON object inside a json code block (no explanations outside the block):

{
  "metadata": {
    "category": "saas",
    "subcategory": "b2b-saas",
    "tags": ["modern", "clean", "pricing"],
    "niche": "B2B SaaS",
    "audience": "Startup founders and product teams",
    "difficulty": "beginner",
    "features": ["Hero section", "Pricing table", "Testimonials", "CTA"],
    "colors": ["#6366F1", "#8B5CF6", "#0F172A"],
    "style": "modern minimal",
    "seoKeywords": ["saas landing page", "b2b software"],
    "badges": ["Trending"],
    "whyBuy": "High-converting B2B layout with clear pricing and social proof.",
    "useCases": ["Product launch", "SaaS signup", "Feature announcement"]
  }
}

Infer everything from the actual HTML content. Never leave arrays empty; always provide at least 3 tags, 3 features, 3 colors, 3 seoKeywords and 3 useCases. Make metadata attractive for buyers.

HTML to analyze:
${html}`;
}

function sanitizeRefinePrompt(html, corrections) {
  const correctionsText = Array.isArray(corrections)
    ? corrections.map((c, i) => `${i + 1}. ${c}`).join("\n")
    : String(corrections);

  return `${BASE_PERSONA}

ROLE: NEXO LOJA HTML Sanitizer
TASK: Apply the corrections below to the provided HTML.

${IRON_RULES}

Corrections to apply:
${correctionsText}

REFINE RULES:
1. Keep the NEXO Digital placeholders already applied.
2. Fix all listed issues.
3. Return ONLY the complete, self-contained HTML code starting with <!DOCTYPE html> and ending with </html>.
4. PASTE the HTML directly into the chat response inside a markdown HTML code block. Do NOT create a downloadable file, attachment, or external link.

HTML to refine:
${html}`;
}

module.exports = {
  intentionPrompt,
  structurePrompt,
  codePrompt,
  reviewPrompt,
  fixPrompt,
  reviewRetryPrompt,
  sanitizePrompt,
  sanitizeRetryPrompt,
  sanitizeQaPrompt,
  sanitizeMetadataPrompt,
  sanitizeRefinePrompt,
};
