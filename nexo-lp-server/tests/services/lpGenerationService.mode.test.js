const { composeGenerationPrompt } = require('../../services/lpGenerationService');

describe('composeGenerationPrompt', () => {
  test('composes full prompt from selected mode base prompt and global base prompt', () => {
    const prompt = composeGenerationPrompt('A coffee shop page', { generationMode: 'Multi-page' }, {
      'generation.mode': 'landing',
      'generation.modes': [
        { label: 'Landing', basePrompt: 'Create a focused landing page.' },
        { label: 'Multi-page', basePrompt: 'Create a full multi-page website.' },
      ],
      'generation.base_prompt': 'Use brand colors.',
    });

    expect(prompt).toContain('Create a full multi-page website.');
    expect(prompt).toContain('A coffee shop page');
    expect(prompt).toContain('Use brand colors.');
    expect(prompt.indexOf('Create a full multi-page website.')).toBeLessThan(prompt.indexOf('A coffee shop page'));
    expect(prompt.indexOf('A coffee shop page')).toBeLessThan(prompt.indexOf('Use brand colors.'));
  });

  test('falls back to generation.mode setting when generationMode option is omitted', () => {
    const prompt = composeGenerationPrompt('A SaaS page', {}, {
      'generation.mode': 'landing',
      'generation.modes': [{ label: 'Landing', basePrompt: 'Landing mode prompt.' }],
      'generation.base_prompt': '',
    });

    expect(prompt).toContain('Landing mode prompt.');
    expect(prompt).toContain('A SaaS page');
  });

  test('uses raw prompt when no matching mode exists', () => {
    const prompt = composeGenerationPrompt('A portfolio page', {}, {
      'generation.mode': 'custom',
      'generation.modes': [],
      'generation.base_prompt': '',
    });

    expect(prompt).toBe('A portfolio page');
  });

  test('keeps raw prompt when no mode settings are configured', () => {
    const prompt = composeGenerationPrompt('A simple page', {}, {});
    expect(prompt).toBe('A simple page');
  });
});
