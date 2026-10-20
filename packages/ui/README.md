# UI Package

UI components for Kerebron editor: autocomplete and hover suggestions.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Extension Layer                          │
│  ExtensionAutocomplete      ExtensionHover                      │
│  ┌────────────────┐         ┌────────────────┐                  │
│  │ addSource cmd  │         │ addSource cmd  │                  │
│  └────────┬───────┘         └────────┬───────┘                  │
└───────────┼──────────────────────────┼──────────────────────────┘
            │                          │
            ▼                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Plugin Layer                             │
│  AutocompletePlugin         HoverPlugin                         │
│  ┌────────────────┐         ┌────────────────┐                  │
│  │ state:         │         │ state:         │                  │
│  │ - sources      │         │ - sources      │                  │
│  │ - request      │         │ - request      │                  │
│  │ - response     │         │ - response     │                  │
│  └────────┬───────┘         └────────┬───────┘                  │
└───────────┼──────────────────────────┼──────────────────────────┘
            │                          │
            ▼                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                       State Layer                               │
│  AutoCompleteState          HoverState                          │
│  ┌────────────────┐         ┌────────────────┐                  │
│  │ matchSource()  │         │ matchSource()  │                  │
│  │ onKeyDown()    │         │ onMouseMove()  │                  │
│  │ onEdit()       │         │ onKeyboardNav()│                  │
│  │ handleCommands()│        │ handleCommands()│                 │
│  └────────┬───────┘         └────────┬───────┘                  │
└───────────┼──────────────────────────┼──────────────────────────┘
            │                          │
            ▼                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Matcher Layer                              │
│  createDefaultMatcher()    createRegexMatcher()                 │
│  createPosMatcher()                                             │
│  ┌────────────────┐         ┌────────────────┐                  │
│  │ regex-based    │         │ pos-based      │                  │
│  │ text matching  │         │ pos-based      │                  │
│  └────────────────┘         └────────────────┘                  │
└─────────────────────────────────────────────────────────────────┘
```

## Dataflow

### Trigger → Match → Request → Response

#### Autocomplete Flow

```
User types/presses key
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. Trigger (AutoCompleteState)                                  │
│    - mode: 'auto' (typing) | 'manual' (key press)              │
│    - pos: cursor position                                       │
│    - key: optional trigger key (e.g., '@')                     │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Match (AutocompleteMatcher)                                  │
│    source.match(trigger) → AutocompletMatch | undefined        │
│    - Scans text around cursor                                   │
│    - Returns range + matched text                               │
│    - Uses: createDefaultMatcher (regex), createRegexMatcher,    │
│            createPosMatcher (pos-only)                          │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Request (processRequest)                                     │
│    - range: matched text positions                              │
│    - trigger: original trigger info                             │
│    - createPopup(): create KerebronPopup instance               │
│    - Returns: Promise<AutocompleteResponse>                     │
│      { range, meta?: I }                                        │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Response (stored in state)                                   │
│    - id: unique request ID                                      │
│    - range: same as request                                     │
│    - meta: data from processRequest                             │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Popup (via KerebronPopup)                                    │
│    - Anchored to matched range                                  │
│    - Displays items from meta                                   │
└─────────────────────────────────────────────────────────────────┘
```

#### Hover Flow

```
Mouse moves over document
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. Trigger (HoverState)                                         │
│    - mode: 'mouse' (hover) | 'keyboard' (nav)                  │
│    - pos: document position                                     │
│    - node: optional ProseMirror node                            │
│    - uri: optional document URI                                 │
│    - dataset: optional element dataset                          │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Match (HoverMatcher)                                         │
│    source.match(trigger) → HoverMatch | undefined              │
│    - Scans node/position for hover targets                     │
│    - Returns range + optional text/uri                          │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Request (processRequest)                                     │
│    - range: matched range                                       │
│    - trigger: hover trigger info                                │
│    - createPopup(): create KerebronPopup instance               │
│    - Returns: Promise<HoverResponse>                            │
│      { range, meta?: I }                                        │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Response (stored in state)                                   │
│    - id: unique request ID                                      │
│    - range: same as request                                     │
│    - meta: data from processRequest                             │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Popup (via KerebronPopup)                                    │
│    - Anchored to matched range                                  │
│    - Displays hover content from meta                           │
└─────────────────────────────────────────────────────────────────┘
```

## Key Types

### Autocomplete

| Type | Purpose |
|------|---------|
| `AutocompleteTrigger` | When match is triggered: `mode`, `pos`, `textOffset`, `key?` |
| `AutocompletMatch` | Result of match: `source`, `trigger`, `range`, `text` |
| `AutocompleteResponse` | Result of request: `range`, `meta` |
| `AutocompleteMatcher` | `fn(trigger) → match \| undefined` |
| `AutocompleteSource` | Config: `match`, `triggerKeys?`, `processRequest`, `onSelect` |

### Hover

| Type | Purpose |
|------|---------|
| `HoverTrigger` | When hover triggered: `mode`, `pos`, `textOffset`, `node?`, `uri?`, `dataset?` |
| `HoverMatch` | Result of match: `source`, `range`, `trigger`, `text?`, `uri?` |
| `HoverResponse` | Result of request: `range`, `meta?` |
| `HoverMatcher` | `fn(trigger) → match \| undefined` |
| `HoverSource` | Config: `match`, `processRequest` |

## Matcher Types

### createDefaultMatcher
- Regex-based text matching
- Configurable trigger char (default `@`)
- Supports: spaces, prefixes, start-of-line
- Use for: mention-like suggestions

### createRegexMatcher
- Multiple regex patterns
- Finds best match by length
- Use for: complex pattern matching

### createPosMatcher
- Position-only matching
- No text scanning
- Use for: node-based triggers

## Simplification Analysis

### Current Complexity

| Concept | Autocomplete | Hover | Can Simplify? |
|---------|-------------|-------|---------------|
| **Trigger** | `mode`, `pos`, `textOffset`, `key?` | `mode`, `pos`, `textOffset`, `node`, `uri?`, `dataset?` | ✅ Unify `mode` values: `auto`/`manual`/`mouse`/`keyboard` |
| **Match** | `source`, `trigger`, `range`, `text` | `source`, `trigger`, `range`, `text?`, `uri?` | ✅ Merge into single `Match` type with optional fields |
| **Meta** | `meta` in response | `meta?` in response | ✅ Consistent `meta` field |

### Proposed Simplifications

#### 1. Unified Trigger Interface
```typescript
// Current: separate AutocompleteTrigger, HoverTrigger
// Proposed: single Trigger with all possible fields
interface Trigger {
  mode: 'auto' | 'manual' | 'mouse' | 'keyboard';
  pos: number;
  textOffset: number;
  key?: string;              // autocomplete
  node?: PmNode;             // hover
  uri?: string;              // hover
  dataset?: Record<string, any>;  // hover
}
```

#### 2. Unified Match Interface
```typescript
// Current: separate AutocompletMatch, HoverMatch
// Proposed: single Match with optional fields
interface Match {
  source: Source;
  trigger: Trigger;
  range: TextRange;
  text?: string;      // autocomplete
  uri?: string;       // hover
}
```

#### 3. Consistent Response Interface
```typescript
// Current: AutocompleteResponse, HoverResponse (same structure)
// Proposed: single Response
interface Response<I = any> {
  range: TextRange;
  meta?: I;
}
```

#### 4. Unified Matcher Signature
```typescript
// Current: separate AutocompleteMatcher, HoverMatcher
// Proposed: single Matcher
type Matcher<I = any> = (
  this: Source<I>,
  trigger: Trigger,
) => Match | undefined;
```

### Benefits of Simplification

1. **Reduced duplication**: Single trigger/match/response types
2. **Easier maintenance**: Changes apply to both autocomplete and hover
3. **Better type safety**: Shared contracts prevent mismatches
4. **Simpler API**: One set of interfaces to learn

### Migration Path

1. Create unified types in `ui/src/types.ts`
2. Update `AutocompleteSource`/`HoverSource` to use unified types
3. Update matchers to use unified types
4. Update state classes to use unified types
5. Deprecate old types with aliases

## Usage Example

```typescript
import { ExtensionAutocomplete } from '@kerebron/ui/autocomplete';
import { createDefaultMatcher } from '@kerebron/ui/autocomplete';

const autocomplete = new ExtensionAutocomplete();

autocomplete.addSource({
  triggerKeys: ['@'],
  match: createDefaultMatcher({ char: '@' }),
  processRequest: async (range, trigger, createPopup) => {
    const popup = createPopup();
    // Fetch suggestions
    const items = await fetchSuggestions(range.text);
    
    popup.render({
      items,
    });
    
    return { range, meta: { items } };
  },

});
```

## Files

```
packages/ui/
├── src/
│   ├── autocomplete/
│   │   ├── types.ts                    # Type definitions
│   │   ├── ExtensionAutocomplete.ts    # Extension wrapper
│   │   ├── AutocompletePlugin.ts       # ProseMirror plugin
│   │   ├── AutoCompleteState.ts        # State management
│   │   ├── createDefaultMatcher.ts     # @-style matching
│   │   ├── createRegexMatcher.ts       # Regex pattern matching
│   │   ├── createPosMatcher.ts         # Position-only matching
│   │   └── mod.ts                      # Exports
│   └── hover/
│       ├── types.ts                    # Type definitions
│       ├── ExtensionHover.ts           # Extension wrapper
│       ├── HoverPlugin.ts              # ProseMirror plugin
│       ├── HoverState.ts               # State management
│       ├── utils.ts                    # DOM utilities
│       └── mod.ts                      # Exports
└── README.md                           # This file
```
