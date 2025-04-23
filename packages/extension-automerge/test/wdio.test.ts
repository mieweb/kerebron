import { expect } from 'jsr:@std/expect';
import { remote } from 'npm:webdriverio@9.12.1';

Deno.test('wdio', async () => {
  const browser = await remote({
    capabilities: {
      browserName: 'chrome',
      browserVersion: 'stable',
      'goog:chromeOptions': {
        args: Deno.env.get('CI') ? ['headless', 'disable-gpu'] : [],
      },
    },
    outputDir: './output',
  });

  await browser.url('https://webdriver.io');
  const apiLink = browser.$('=API');
  await apiLink.click();

  const header = browser.$('<h1>');
  expect(await header.getText()).toEqual('Introduction');
  await browser.saveScreenshot('./output/screenshot.png');

  await browser.deleteSession();
});
