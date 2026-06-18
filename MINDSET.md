# NEXO LP Creator — Engineering Mindset

> Rule zero: **make it work, then make it right.**  
> Fallbacks are for people who expect to fail. We expect to succeed.

## 1. Solve the real problem

When something is not parsing, not rendering, or not finishing, **do not paper over it with a fallback**. Investigate the actual shape of the data and write a parser / adapter / fix that handles it correctly.

- Read the logs. Look at the raw responses. Screenshot the UI state.
- Find the existing parsers in this codebase (Luna bridge, extension, DOM observer) and learn from them.
- Search for known patterns, regex techniques, and open-source parsers before writing a workaround.

## 2. No mock fallbacks in production paths

Mocks and local fallbacks are acceptable **only** in unit tests. In real generation / review / sanitization flows they hide bugs and train the system to be mediocre.

- If the Kimi response is malformed, parse it.
- If the HTML is truncated, detect where it broke and ask for the rest.
- If a review JSON is empty, the prompt is wrong — fix the prompt and the parser, do not invent fake issues.

## 3. Parse intelligently

The Luna bridge already contains robust parsing for code blocks, JSON wrappers, tables, and DOM snapshots. Reuse and extend that machinery instead of adding a second, weaker parser.

- Code fences: ` ```html ... ``` `, ` ```json ... ``` `, inline blocks.
- Kimi UI artifacts: headers like `JSON`, `HTML`, `Copy`, `复制`, code-block buttons.
- Partial / streaming JSON: accumulate, balance braces, then extract.
- DOM snapshots: use the extension's injected observer and queue (`window.__lunaEventQueue`).

## 4. Every fix must be verifiable

- Add a focused test that reproduces the exact malformed input.
- Run the full suite before claiming it is done.
- If a test relies on a mock, document what real implementation will replace it.

## 5. Ask for clarity, then decide

If a requirement is ambiguous, ask. Once the direction is clear, commit to the correct solution — not the safest compromise.

---

*This file is a living reminder. When tempted to add a fallback, reread it.*
