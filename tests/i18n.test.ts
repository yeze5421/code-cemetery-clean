import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { englishMessages, normalizeLocale, translate } from '../src/i18n/translate';
import { LOCALE_STORAGE_KEY, readLocale, saveLocale } from '../src/i18n/preference';
import { browserRegistry, sourceMetadata } from '../src/bootstrap';

test('locale normalization, fallback and interpolation preserve dynamic values', () => {
  assert.equal(normalizeLocale('en-US,en;q=0.9'), 'en');
  assert.equal(normalizeLocale('zh-CN'), 'zh-CN');
  assert.equal(normalizeLocale('fr'), 'zh-CN');
  assert.equal(
    translate('en', '发现 {count} 个项目，墓园已更新', { count: 12 }),
    'Found 12 projects. Your cemetery is up to date.',
  );
  assert.equal(
    translate('zh-CN', '发现 {count} 个项目，墓园已更新', { count: 12 }),
    '发现 12 个项目，墓园已更新',
  );
  assert.equal(translate('en', 'Custom plugin text'), 'Custom plugin text');
});

test('all UI translation calls and built-in plugin metadata have English translations', () => {
  for (const file of [
    'src/App.tsx',
    'src/features/dialogs.tsx',
    'src/features/desktop-access.tsx',
    'src/components/Modal.tsx',
    'src/i18n/LanguageSwitcher.tsx',
  ]) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        node.expression.getText(source) === 't' &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        const key = node.arguments[0].text;
        if (/[\u3400-\u9fff]/.test(key)) assert.ok(englishMessages[key], `${file}: missing ${key}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  for (const plugin of [...sourceMetadata, ...browserRegistry.list()]) {
    for (const value of [plugin.name, plugin.description]) {
      if (/[\u3400-\u9fff]/.test(value))
        assert.ok(englishMessages[value], `Missing metadata: ${value}`);
    }
  }
});

test('translations retain placeholders and contain no untranslated Chinese', () => {
  const tokens = (text: string) => [...text.matchAll(/\{\w+\}/g)].map((m) => m[0]).sort();
  for (const [source, english] of Object.entries(englishMessages)) {
    assert.deepEqual(tokens(english), tokens(source), source);
    assert.equal(/[\u3400-\u9fff]/.test(english), false, source);
  }
});

test('locale preference survives reads and degrades gracefully when storage is unavailable', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map<string, string>();
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => values.get(k) ?? null,
        setItem: (k: string, v: string) => values.set(k, v),
      },
    });
    assert.equal(readLocale(), 'zh-CN');
    saveLocale('en');
    assert.equal(values.get(LOCALE_STORAGE_KEY), 'en');
    assert.equal(readLocale(), 'en');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('Storage blocked');
      },
    });
    assert.equal(readLocale(), 'zh-CN');
    assert.doesNotThrow(() => saveLocale('en'));
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
