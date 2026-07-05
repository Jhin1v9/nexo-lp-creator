const {
  buildUniqueSlug,
  resolveAssetUrl,
  resolveDemoUrl,
  adaptLPCTemplateToAppProduct,
} = require('../../services/lpStoreBridgeService');

describe('lpStoreBridgeService', () => {
  afterEach(() => {
    delete process.env.PREVIEW_BASE_URL;
  });

  test('buildUniqueSlug is stable and unique per id', () => {
    const s1 = buildUniqueSlug('My Template', 'tpl-1');
    const s2 = buildUniqueSlug('My Template', 'tpl-2');
    const s3 = buildUniqueSlug('My Template', 'tpl-1');
    expect(s1).toBe(s3);
    expect(s1).not.toBe(s2);
    expect(s1).toMatch(/^my-template-template-[a-f0-9]{8}$/);
  });

  test('resolveAssetUrl absolutizes relative urls', () => {
    process.env.PREVIEW_BASE_URL = 'https://example.com';
    expect(resolveAssetUrl('/preview/x.png')).toBe('https://example.com/preview/x.png');
    expect(resolveAssetUrl('preview/x.png')).toBe('https://example.com/preview/x.png');
    expect(resolveAssetUrl('https://cdn.com/x.png')).toBe('https://cdn.com/x.png');
    expect(resolveAssetUrl(null)).toBeUndefined();
    delete process.env.PREVIEW_BASE_URL;
  });

  test('resolveDemoUrl uses public preview path when token exists', () => {
    process.env.PREVIEW_BASE_URL = 'https://example.com';
    const url = resolveDemoUrl({ public_preview_token: 'pub-abc' }, 'my-slug');
    expect(url).toBe('https://example.com/preview/public/pub-abc.html');
    delete process.env.PREVIEW_BASE_URL;
  });

  test('resolveDemoUrl falls back to demo slug', () => {
    process.env.PREVIEW_BASE_URL = 'https://example.com';
    const url = resolveDemoUrl({}, 'my-slug');
    expect(url).toBe('https://example.com/demo/my-slug');
    delete process.env.PREVIEW_BASE_URL;
  });

  test('adaptLPCTemplateToAppProduct sets available status when direct', () => {
    const app = adaptLPCTemplateToAppProduct(
      {
        id: 'tpl-1',
        name: 'Test',
        description: 'Desc',
        category: 'landing',
        stack: 'static-html-tailwind',
        status: 'sanitizing',
        source: 'generated',
        html: '<h1>hi</h1>',
        original_html: '<h1>hi</h1>',
        price_stars: 5,
      },
      { direct: true }
    );
    expect(app.status).toBe('available');
    expect(app.slug).toMatch(/^test-template-[a-f0-9]{8}$/);
  });

  test('adaptLPCTemplateToAppProduct preserves virtual prices', () => {
    const app = adaptLPCTemplateToAppProduct({
      id: 'tpl-2',
      name: 'Test',
      description: 'Desc',
      category: 'landing',
      stack: 'static-html-tailwind',
      status: 'available',
      source: 'generated',
      html: '<h1>hi</h1>',
      original_html: '<h1>hi</h1>',
      price_stars: 10,
      price_suns: 2,
      price_moons: 1,
    });
    expect(app.virtualPrice).toEqual({ stars: 10, suns: 2, moons: 1 });
    expect(app.pricing).toBe('fixed');
  });
});
