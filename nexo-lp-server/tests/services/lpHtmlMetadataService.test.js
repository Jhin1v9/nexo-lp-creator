const { injectMetadata, escapeHtml } = require('../../services/lpHtmlMetadataService');

describe('lpHtmlMetadataService', () => {
  test('replaces existing title and og:title', () => {
    const html = '<!DOCTYPE html><html><head><title>Old</title><meta property="og:title" content="Old OG"></head><body></body></html>';
    const result = injectMetadata(html, { title: 'New Title', description: 'New desc' });
    expect(result).toContain('<title>New Title</title>');
    expect(result).toContain('<meta property="og:title" content="New Title">');
    expect(result).toContain('<meta name="description" content="New desc">');
    expect(result).toContain('<meta property="og:description" content="New desc">');
    expect(result).not.toContain('<title>Old</title>');
  });

  test('escapes special characters in title and description', () => {
    const result = injectMetadata('<html><head></head><body></body></html>', {
      title: 'A & B <C> "D"',
      description: "E 'F' & G",
    });
    expect(result).toContain('<title>A &amp; B &lt;C&gt; &quot;D&quot;</title>');
    expect(result).toContain('<meta name="description" content="E &#039;F&#039; &amp; G">');
  });

  test('does nothing when brief is empty', () => {
    const html = '<html><head><title>Keep</title></head><body></body></html>';
    expect(injectMetadata(html, {})).toBe(html);
  });
});
