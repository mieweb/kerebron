# Kerebron extension for collaboration using automerge

## Current state (WIP)

WARNING: this extension is currently broken.

Reasons:

- Current peritext algorithm does not support nested block elements
  https://www.inkandswitch.com/peritext
- Issue on github https://github.com/inkandswitch/peritext/issues/27 As of 2025
  this thread was not updated in nest 2 years.
- Proposal for peritext2 has not been implemented yet
  https://martinkl.notion.site/Block-elements-in-rich-text-CRDT-for-Peritext-2-a3b69f886dbc4ad1abe81cea0b3e6623

I tried naive hacks but got stuck on tables support. The reason is a format of
marks in document. Compare below 2 tables:

1. Table with 2 rows, 1 cell each

```html
<table>
  <tr>
    <th>1</th>
  </tr>
  <tr>
    <td>2</td>
  </tr>
</table>
```

Pseudocode of marks JSON structure:

```json
[
  { "type": "th", "parents": ["table", "tr"] },
  { "text": "1" },
  { "type": "td", "parents": ["table", "tr"] },
  { "text": "2" }
]
```

2. Table with 1 row, 2 cells

```html
<table>
  <tr>
    <th>1</th>
    <td>2</td>
  </tr>
</table>
```

Pseudocode of marks JSON structure:

```json
[
  { "type": "th", "parents": ["table", "tr"] },
  { "text": "1" },
  { "type": "td", "parents": ["table", "tr"] },
  { "text": "2" }
]
```

Currently, both tables produce same output which resulted in folding all tables
into 1 row.

## Description

Fork of https://github.com/automerge/automerge-prosemirror

Some internals of `automerge-prosemirror` are not exposed.

- https://automerge.org/blog/2024/04/06/richtext/
- https://github.com/automerge/automerge-prosemirror

https://automerge.org/ https://automerge.org/blog/2023/11/06/automerge-repo/
https://automerge.org/docs/quickstart/

https://automerge.org/automerge/api-docs/js/
https://github.com/automerge/automerge-repo/tree/main/packages/automerge-repo/src
