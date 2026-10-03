import { assertEquals } from '@kerebron/test-utils';

import { quietly } from './render.ts';
import {
  type Baseline,
  BASELINE_URL,
  expectedHtml,
  kerebronHtml,
  specs,
} from './spec.ts';

Deno.test('CommonMark/GFM spec examples that passed still pass', async () => {
  const passing: Baseline = {};
  await quietly(async () => {
    for (const spec of specs) {
      passing[spec.name] = [];
      for (const ex of spec.examples) {
        if ((await kerebronHtml(ex)) === expectedHtml(ex)) {
          passing[spec.name].push(ex.example);
        }
      }
    }
  });

  if (Deno.env.get('UPDATE_SPEC_BASELINE')) {
    Deno.writeTextFileSync(
      BASELINE_URL,
      JSON.stringify(passing, null, 2) + '\n',
    );
    return;
  }

  const baseline: Baseline = JSON.parse(Deno.readTextFileSync(BASELINE_URL));
  const diff = (from: Baseline, to: Baseline) =>
    specs.flatMap((spec) =>
      (from[spec.name] ?? [])
        .filter((n) => !(to[spec.name] ?? []).includes(n))
        .map((n) => `${spec.url}${n}`)
    );

  const fixed = diff(passing, baseline);
  if (fixed.length) {
    console.log(
      `${fixed.length} more spec examples pass; record them with ` +
        'UPDATE_SPEC_BASELINE=1 deno task test:spec',
    );
  }
  assertEquals(diff(baseline, passing), [], 'Spec examples regressed');
});
