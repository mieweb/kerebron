import { assertEquals } from '@std/assert';
import { JupyterKernel } from '../src/jupyter/JupyterKernel.ts';
import { listKernelSpecs } from '../src/jupyter/kernel.ts';

Deno.test({
  name: 'listKernelSpecs finds deno and python3',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const specs = await listKernelSpecs();
    const names = specs.map((s) => s.name);
    assertEquals(names.includes('deno'), true);
    assertEquals(names.includes('python3'), true);
  },
});

Deno.test({
  name: 'graph',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    try {
      await using kernel = await JupyterKernel.start({ name: 'deno' });

      const { default: code1 } = await import('./csv.js', {
        with: { type: 'text' },
      });
      const cell1 = await kernel.execute(code1);
      console.log(cell1);

      const { default: code2 } = await import('./graph.js', {
        with: { type: 'text' },
      });
      const cell2 = await kernel.execute(code2);
      console.log(cell2);
    } catch (err) {
      console.error(err);
      throw err;
    }
  },
});

Deno.test({
  name: 'deno kernel persists vars and can be passed around',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await using kernel = await JupyterKernel.start({ name: 'deno' });
    assertEquals(kernel.name, 'deno');

    const cell1 = await kernel.execute(
      'const answer = 40 + 2; console.log("set answer"); answer',
    );

    console.log('c1', cell1);

    assertEquals(cell1.status, 'ok');
    assertEquals(cell1.text.includes('set answer'), true);
    assertEquals(cell1.resultText.includes('42'), true);

    async function laterStep(k: JupyterKernel): Promise<void> {
      const cell2 = await k.execute(
        'console.log("use answer", answer); answer * 2',
      );
      assertEquals(cell2.status, 'ok');
      assertEquals(cell2.text.includes('use answer 42'), true);
      assertEquals(cell2.resultText.includes('84'), true);
    }
    await laterStep(kernel);

    // Typed set/get (not display strings).
    await kernel.set('greeting', 'hello');
    await kernel.set('count', 7);
    await kernel.set('point', { x: 1, y: 2 });
    assertEquals(await kernel.get<string>('greeting'), 'hello');
    assertEquals(await kernel.get<number>('count'), 7);
    assertEquals(await kernel.get('point'), { x: 1, y: 2 });

    // listVars: Deno tracks set() names; bare `const answer` may be missing.
    const names = await kernel.listVars();
    assertEquals(names.includes('greeting'), true);
    assertEquals(names.includes('count'), true);
    assertEquals(names.includes('point'), true);
  },
});

Deno.test({
  name: 'python3 kernel persists vars across cells',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    await using kernel = await JupyterKernel.start({ name: 'python3' });
    assertEquals(kernel.name, 'python3');
    assertEquals(kernel.language.toLowerCase().includes('python'), true);

    const cell1 = await kernel.execute(
      'answer = 40 + 2\nprint("set answer")\nanswer',
    );
    assertEquals(cell1.status, 'ok');
    assertEquals(cell1.text.includes('set answer'), true);
    assertEquals(cell1.resultText.includes('42'), true);

    async function laterStep(k: JupyterKernel): Promise<void> {
      const cell2 = await k.execute(
        'print("use answer", answer)\nanswer * 2',
      );
      assertEquals(cell2.status, 'ok');
      assertEquals(cell2.text.includes('use answer 42'), true);
      assertEquals(cell2.resultText.includes('84'), true);
    }
    await laterStep(kernel);

    await kernel.set('greeting', 'hello');
    await kernel.set('count', 7);
    assertEquals(await kernel.get<string>('greeting'), 'hello');
    assertEquals(await kernel.get<number>('count'), 7);
    assertEquals(await kernel.get<number>('answer'), 42);

    // Python listVars sees real globals (including cell-defined answer).
    const names = await kernel.listVars();
    assertEquals(names.includes('answer'), true);
    assertEquals(names.includes('greeting'), true);
    assertEquals(names.includes('count'), true);
    assertEquals(names.includes('get_ipython'), false);
  },
});
