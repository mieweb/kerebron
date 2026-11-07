import {
  type Browser,
  type BrowserType,
  chromium,
  firefox,
  webkit,
} from 'playwright';

const browsers: Record<string, BrowserType> = {
  chromium,
  firefox,
  webkit,
};

function getBrowserType(): BrowserType {
  const name = Deno.env.get('BROWSER') ?? 'chromium';

  const browserType = browsers[name];

  if (!browserType) {
    throw new Error(
      `Unsupported browser "${name}". ` +
        `Use: ${Object.keys(browsers).join(', ')}`,
    );
  }

  return browserType;
}

Deno.test('homepage', async () => {
  const browser = await getBrowserType().launch({
    headless: false, // Deno.env.get("HEADLESS") !== "false",
  });

  try {
    const page = await browser.newPage();

    await page.goto('http://localhost:8000');

    if (!await page.title()) {
      throw new Error('Expected a page title');
    }

    // if (Deno.env.get("KEEP_BROWSER") === "true") {
    console.log('\nBrowser is open. Press Enter to close it.');

    await new Promise<void>((resolve) => {
      Deno.stdin.read(new Uint8Array(1)).then(() => resolve());
    });
    // }
  } finally {
    await browser.close();
  }
});
