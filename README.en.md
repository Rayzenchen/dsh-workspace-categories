# Workspace categories and blocks (`@local/dsh-workspace-categories`)

English | [中文](README.md)

[![verify](https://github.com/Rayzenchen/dsh-workspace-categories/actions/workflows/verify.yml/badge.svg)](https://github.com/Rayzenchen/dsh-workspace-categories/actions/workflows/verify.yml)

Once a sidebar holds enough Workspaces — and once a Session list is expanded — it gets hard to see which Session belongs to which Workspace, let alone keep "teaching", "writing" and "experiments" apart.

This plugin adds two layers to the sidebar:

1. **A rounded card per Workspace** — its title row and its expanded Session rows sit inside one block, with symmetric vertical padding, so neighbouring Workspaces never blur together;
2. **Themed category blocks that always stay on top** — drag Workspaces into a tinted rounded container, which then holds the Workspace cards; categories can be collapsed, reordered, and given a colour.

<p><img src="icon.svg" width="72" height="72" alt="Workspace categories icon: a sidebar card holding two coloured category blocks with an empty dashed block and a plus below them"></p>

## Install

**Requires** DeepSeek Harness `0.2.3-alpha.2` or newer — the manifest declares an `engines.dsh` range and older releases refuse the install. The plugin is plain JavaScript with no build step, so installing from git needs no `allowBuilds` permission.

From GitHub (`v1.0.0` is a tag; omit it to track `main`):

```sh
dsh plugin --profile <profile> add github:Rayzenchen/dsh-workspace-categories#v1.0.0
```

From a local directory:

```sh
dsh plugin --profile <profile> add /path/to/dsh-workspace-categories
```

In the Desktop app an agent can install the same spec through `plugin_manager`'s `install_bundle`. **Refresh the page** afterwards — everything runs in the browser. Remove it with
`dsh plugin --profile <profile> remove @local/dsh-workspace-categories`.

## Usage

### Create a category

Click the button **immediately right of "add workspace"** in the Workspaces header (stacked cards with a plus). A category appears in place and its name opens for editing: type, `Enter` to keep it, `Esc` to cancel.

You are never asked to pick a category while adding a Workspace — most Workspaces do not need one, and you can file it later by dragging.

### File and unfile

Drag a Workspace row onto **anywhere on the category block**: its title, a member card, the gaps between cards, or the dashed area of an empty category. The target block lights up while dragging, and a category holds any number of Workspaces.

Drag a categorized Workspace down into the **Uncategorized** area (the divider, any uncategorized Workspace card, or the empty space beneath the list) to take it back out.

### Collapse and expand

Click the blank part of a category title, or the chevron on its left. A collapsed category keeps only its title bar; membership is preserved. Dropping a Workspace into a collapsed category expands it, so nothing disappears after a drop.

### Reorder

Categories always sit above Uncategorized and can be reordered freely:

- drag the six-dot grip on the left of a title;
- or drag the coloured block itself;
- the drop side is decided by the **middle of the whole block** — the upper half inserts before the category, and the member-card area inserts after it, so it never looks like one category is nested inside another;
- dropping into the gap between two categories picks the nearest one;
- keyboard: focus a grip and press `↑` / `↓`, or focus a title and press `Alt+↑` / `Alt+↓`.

### Theme colour

Click the **dot before the category name** to open the colour panel: the seven macOS Finder tag colours (red, orange, yellow, green, blue, purple, gray). The change applies immediately and the panel stays open so colours can be compared; `Esc` or a click outside closes it. Swatch radii and surface material match the shipped Workspace row menu.

### Rename and delete

Click the **three dots** at the right of a category to open a floating menu built from the same material, placement and icons as the Workspace row menu:

- `Rename` — double-clicking the category name works too;
- `Delete category` — click twice to confirm; its Workspaces return to Uncategorized, and neither the Workspace nor its Sessions are touched.

### Keyboard and accessibility

- A category title is focusable: `Enter` / `Space` collapses or expands it, `Alt+↑` / `Alt+↓` moves it;
- the six-dot grip is focusable: `↑` / `↓` moves the category;
- the "…" menu supports `↑` / `↓` / `Home` / `End`, `Esc` closes it and returns focus to the trigger, `Tab` closes it;
- the seven swatches accept arrow keys and `Enter`;
- every create, file, unfile, collapse/expand and delete is announced through a polite `aria-live` region;
- `prefers-reduced-motion` disables transitions, and `forced-colors` swaps translucent fills for real outlines.

## Visual layers

| Layer | Appearance |
| --- | --- |
| Category block | The category colour at low alpha, a matching hairline stroke, and a 16px radius; the dark theme uses a stronger alpha than the light one while keeping the same hierarchy. |
| Category title | Transparent, so the block colour shows through; a 2px accent bar, the identity dot, the member count and a bottom hairline. Collapsed, it becomes the only surface of the block. |
| Member Workspace card | `bg-layer-1` mixed with 7% (light) / 13% (dark) of the category colour and a matching stroke; a 12px radius inset by 4px, so the category colour reads around and between cards. |
| Uncategorized Workspace card | A neutral translucent card with a 16px radius, clearly distinct from a category block. |
| Session rows | Unchanged from the shipped rendering — no extra border or fill. |

Text always uses the shipped theme text colours, so contrast never depends on the category colour. Both floating surfaces use the official menu material (`--dsw-menu-surface-fill` plus `--dsw-menu-backdrop-filter`) and the official radius and elevation tokens, so they match the native menus in both themes.

## Data and implementation

- **Where it lives**: category definitions (name, colour, member Workspace ids, collapsed state) are a browser-local UI preference in `localStorage` under `dsh.workspace.categories.v1`, the same family as the shipped sidebar view store. The plugin never writes Workspace or Session data and never talks to the network; turning it off keeps the definitions and turning it back on restores them.
- **Why CSS `order`**: Workspace rows are rendered by React, so the plugin never moves a React-owned node. It turns the list into a vertical flex container, changes only the `order` of each Workspace section, and injects its own block, title and surface nodes. Membership stores Workspace ids alone; the in-category order still follows the shipped Workspace order, so native drag reordering keeps working.
- **How a block wraps its cards**: an absolutely positioned rounded background layer sits inside the list below the cards (`z-index` under them) and is measured from the actual position of the title and the visible member cards. Title and cards draw on top of it, which yields "cards inside a container" without moving React nodes. Layout runs in two phases: every node's order is set first, then the blocks are measured, so a block is never sized from a half-reordered list.
- **No hashed-class dependency**: the section shape is recognised from `data-slot` / `data-sidebar-*` / `data-row-key` / `role="tree"`, with the CSS-modules class only as a fast path; the stylesheet anchors on markers the plugin writes itself (`data-dsh-wsc-section` and friends). A Harness upgrade that renames the generated class does not silently disable the feature.
- **Hot-reload safety**: a new activation asks the previous one to tear itself down (DOM, listeners, observers, timers, styles, subscriptions), then sweeps whatever even older versions left behind; every asynchronous callback checks whether it is already disposed. A normal hot reload never stacks a second set of category frames.
- **Inspection surface**: a read-only Client service `workspaceCategories` exposes `getSnapshot()` with the definitions, collapse state and layout mode.

## Compatibility

- Compatible with [`@local/dsh-workspace-running-indicator`](https://github.com/Rayzenchen/dsh-workspace-running-indicator): the plugin never removes or replaces a Workspace row, so the spinner the indicator inserts before the name is unaffected.
- Category blocks appear in the default **grouped-by-Workspace** view.
- The Workspace tree keeps the top-level per-Workspace highlight blocks but shows no categories; the flat list has no Workspace groups, so the plugin leaves it alone. The category UI hides itself while the sidebar is a rail or a Session search is open, and returns afterwards.

## Known limitations

- Membership lives in this browser's `localStorage` only. Another browser, cleared site data, or a different Web port loses it, and it is not synced across devices.
- Membership is keyed by Workspace id; when a Workspace is deleted its membership is pruned on the next Workspace snapshot. Renaming a Workspace is unaffected.
- The block geometry depends on the current sidebar DOM. If that structure changes substantially the plugin degrades to "no decoration" and logs one notice, rather than erroring or garbling the list.
- Search results and the narrow rail render no Workspace rows, so no category UI appears there.
- Filing is drag-driven. Keyboard covers collapse, reorder, rename and delete, but filing a Workspace into a category still requires a drag.
- Automated visual verification is limited: the suite covers DOM behaviour (16 scenarios, 92 assertions); pixel-level appearance still needs a look in the app.

## Development and verification

```sh
npm install      # jsdom, for the tests only
npm test         # syntax check + 92 assertions
```

`tools/verify-core.mjs` rebuilds the real sidebar shape with jsdom, loads the **real** `client.js`, and covers: the injected button's position, create/rename/recolor/collapse/delete, filing and un-filing, pointer and keyboard reordering, persistence across activations, hot-reload takeover, structural fallback after a class rename, language switching, screen-reader announcements, corrupt-store tolerance, and pruning when a Workspace disappears. CI runs the same checks on every push.

## Version history

### 1.0.0

First stable release:

- Independent rounded blocks per Workspace; categories are tinted rounded containers with separate light and dark tuning, and member cards carry a subtle tint of their category.
- Categories always on top, collapsible, reorderable (grip / whole block / keyboard), colour-customisable with the Finder tag palette.
- The create button sits next to "add workspace"; the whole block accepts drops; a category holds any number of Workspaces; dropping into Uncategorized takes one back out.
- The "…" menu matches the Workspace row menu in material, placement and official icons (rename / delete category, with a confirmation step).
- Copy follows the app language, the UI is keyboard reachable, announcements reach screen readers, and reduced motion plus forced colours are respected.
- Section detection no longer depends on CSS-modules hashes; hot reloads take over a single instance instead of needing a restart.
- Ships a jsdom assertion suite and CI.

## License

[MIT](LICENSE) © 2026 Rayzenchen
