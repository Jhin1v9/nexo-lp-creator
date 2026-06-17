export function projectNameFromPrompt(prompt, fallback = 'Untitled Project') {
  if (!prompt || typeof prompt !== 'string') return fallback;
  const cleaned = prompt.trim().replace(/[\n\r]+/g, ' ');
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return fallback;
  const title = words.slice(0, 5).join(' ');
  return title.length > 40 ? title.slice(0, 40) + '…' : title;
}
