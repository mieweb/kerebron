# Browser React Example - Testing Guide

## Playwright End-to-End Tests

This example includes comprehensive Playwright tests for the React editor component.

### How It Works

The tests use the `server-deno-hono` example as the backend, which provides:
- ✅ Static file serving for all browser examples
- ✅ Backend API endpoints (e.g., `/api/rooms`)
- ✅ YJS WebSocket server for collaborative editing
- ✅ LSP (Language Server Protocol) WebSocket endpoints
- ✅ Hot module reloading during development

This gives us a complete testing environment that matches production usage.

### Prerequisites

1. Install Playwright browsers (only needs to be done once):

```bash
deno task playwright:install
```

This will download Chromium (~120MB). You can also install other browsers:

```bash
# Install all browsers
deno run -A npm:playwright@1.49.1 install

# Install specific browsers
deno run -A npm:playwright@1.49.1 install firefox
deno run -A npm:playwright@1.49.1 install webkit
```

### Running Tests

The tests automatically start the `server-deno-hono` server before running.

**Run all tests in headless mode:**
```bash
deno task test
```

**Run tests with the Playwright UI (recommended for development):**
```bash
deno task test:ui
```

**Run tests in headed mode (see the browser):**
```bash
deno task test:headed
```

**Run tests in debug mode (step through tests):**
```bash
deno task test:debug
```

**Run specific test file:**
```bash
deno run -A npm:playwright test tests/editor.spec.ts
```

**Run tests in a specific browser:**
```bash
deno run -A npm:playwright test --project=chromium
deno run -A npm:playwright test --project=firefox
deno run -A npm:playwright test --project=webkit
```

### Test Reports

After running tests, view the HTML report:
```bash
deno run -A npm:playwright show-report
```

### What's Being Tested

The test suite (`tests/editor.spec.ts`) covers:

- ✅ **Page Loading** - Verifies the main page loads with correct UI elements at `/examples-frame/browser-react/`
- ✅ **Room Creation** - Tests creating new collaborative editing rooms
- ✅ **Editor Initialization** - Checks editor toolbar and components load correctly
- ✅ **Text Input** - Validates typing and text entry works
- ✅ **Bold Formatting** - Tests bold text formatting via toolbar button
- ✅ **Italic Formatting** - Tests italic text formatting via toolbar button
- ✅ **Underline Formatting** - Tests underline text formatting
- ✅ **Menu Dropdowns** - Verifies Insert, Type, Table, and More menus exist
- ✅ **Multiple Paragraphs** - Tests paragraph creation with Enter key
- ✅ **Markdown Output** - Confirms markdown is generated correctly
- ✅ **Error Checking** - Monitors for unexpected console errors (backend API now available!)

### Architecture

```
┌─────────────────────────────────────────┐
│  Playwright Test Runner                 │
│  (runs tests in Chromium/Firefox/etc)  │
└────────────────┬────────────────────────┘
                 │
                 ├── Starts server-deno-hono (port 8000)
                 │   ├── Serves browser-react at /examples-frame/browser-react/
                 │   ├── Provides /api/rooms endpoint
                 │   ├── YJS WebSocket for collaboration
                 │   └── LSP WebSocket endpoints
                 │
                 └── Navigates to http://localhost:8000/examples-frame/browser-react/
```

### Configuration

Test configuration is in `playwright.config.ts`:
- Uses `server-deno-hono` to serve the React example (and provides backend/LSP)
- Tests automatically start the server before running
- Tests run in parallel by default
- Screenshots are captured on failure
- Traces are recorded on first retry
- Base URL: `http://localhost:8000`
- Example URL: `/examples-frame/browser-react/`

### Development Tips

1. **Use UI Mode for development**: `deno task test:ui` gives you a visual interface to see tests running, time-travel through steps, and debug failures.

2. **Use headed mode to watch**: `deno task test:headed` shows the browser window so you can see what's happening.

3. **Debug mode for troubleshooting**: `deno task test:debug` lets you step through tests line by line.

4. **Add test.only() to focus on one test**:
```typescript
test.only('my specific test', async ({ page }) => {
  // This test will run alone
});
```

### Continuous Integration

The tests are configured to work in CI environments:
- Retries failed tests 2 times
- Runs in single-worker mode for stability
- Uses different reporters for better CI output

Example GitHub Actions workflow:
```yaml
- name: Install Playwright
  run: deno task playwright:install

- name: Run tests
  run: deno task test
```

## Manual Testing

You can also test manually by running the server:

```bash
cd ../server-deno-hono
deno task start
```

Then visit http://localhost:8000/examples-frame/browser-react/ in your browser.

### Testing with LSP Disabled

To test without Language Server Protocol support:

```bash
cd ../server-deno-hono
deno task start --without-lsp
```
