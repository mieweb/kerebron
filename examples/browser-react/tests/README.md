# Playwright Tests for React Editor

This directory contains end-to-end tests for the Kerebron React editor component using Playwright.

## Architecture

These tests run against the **server-deno-hono** example, which provides:
- Static file serving for all browser examples
- Backend API (`/api/rooms`, etc.)
- YJS WebSocket server for collaboration
- LSP WebSocket endpoints for language servers

The React app is served at: `http://localhost:8000/examples-frame/browser-react/`

## Setup

First, install Playwright browsers:

```bash
deno task playwright:install
```

## Running Tests

The server-deno-hono will automatically start before tests run.

Run all tests:
```bash
deno task test
```

Run tests with UI:
```bash
deno task test:ui
```

Run tests in headed mode (see the browser):
```bash
deno task test:headed
```

Run tests in debug mode:
```bash
deno task test:debug
```

## Test Coverage

The test suite covers:

- ✅ Page loading and initial UI
- ✅ Room creation functionality  
- ✅ Editor initialization and toolbar
- ✅ Text input and editing
- ✅ Bold formatting
- ✅ Italic formatting
- ✅ Underline formatting
- ✅ Menu dropdown presence
- ✅ Multiple paragraph handling
- ✅ Markdown output updates
- ✅ Console error checking (with backend API available)

## Writing New Tests

Add new test files in this directory with the `.spec.ts` extension. Playwright will automatically discover and run them.

Example:
```typescript
import { test, expect } from '@playwright/test';

test('my new test', async ({ page }) => {
  await page.goto('/');
  // Your test code here
});
```
