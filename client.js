/**
 * Client half of `@local/dsh-workspace-categories` (1.0.0).
 *
 * What it does
 * ------------
 * Over the shipped sidebar Workspace browser:
 *
 * 1. Every Workspace block is a rounded card with symmetric breathing room, so
 *    an expanded Session list never runs into the next Workspace.
 * 2. Categories: a themed, collapsible band that pins a chosen set of
 *    Workspaces to the top of the list. A category renders as one rounded,
 *    tinted block (a layer behind its header and its member cards), and each
 *    member is a neutral card nested inside that block. A button inserted right
 *    of the shipped "add workspace" control creates a category; dragging a
 *    Workspace anywhere onto the band files it; dragging the grip (or the band
 *    itself) reorders categories; the Uncategorized divider takes a dragged
 *    Workspace back out.
 * 3. Two floating surfaces per category, both built from the shipped menu
 *    tokens: the identity dot opens a color-only palette (the seven macOS
 *    Finder tag colors), and the three-dot button opens a "Rename / Delete
 *    category" menu that copies the shipped Workspace row menu's surface,
 *    material, row metrics, official icons and placement.
 * 4. Accessibility: the title and the grip are tab stops (collapse, move), the
 *    menu and the palette navigate with the arrow keys, and every mutation is
 *    announced through a polite live region. Reduced motion and forced colors
 *    are honored.
 *
 * Where the decoration attaches
 * -----------------------------
 * The sidebar declares no slot for a Workspace group header or for its list
 * body, so — exactly as the folded-workspace running indicator does — this half
 * anchors on the shipped DOM through its stable seams:
 * `[data-slot="sidebar.workspaces"]`, `[data-sidebar-workspace-header]`,
 * `[data-sidebar-list-area]`, the `role="tree"` list inside the tree body, and
 * each group's `[data-row-key^="workspace:"]` header. A section is recognized
 * structurally (its own header row is its direct child, or it is the ungrouped
 * bucket of Session rows) with the CSS-modules class only as a fast path, and
 * the stylesheet anchors on markers this half writes itself — so a Harness
 * build that renames the generated class does not silently disable the feature. It
 * never reads another plugin's nodes or stylesheet, and the spinner that the
 * folded-workspace running indicator inserts into a Workspace row keeps
 * working: this half only paints surfaces, orders the list with CSS `order`,
 * and inserts its own category nodes.
 *
 * Only the grouped-by-Workspace view has section elements to reorder. The
 * Workspace tree and the flat list keep the per-Workspace block cards (the tree
 * keeps them too) but show no category bands, and a listless rail or a search
 * result list is left untouched.
 *
 * Why CSS `order` instead of moving React's rows
 * ----------------------------------------------
 * Moving or re-parenting nodes React owns breaks its commit. Changing only the
 * `order` of the list's direct children — after turning the list into a column
 * flex container — is a presentation change React never observes. Category
 * membership therefore stores a Workspace id set only; the order inside one
 * category follows the shipped (Host-persisted) Workspace order, so a Workspace
 * dragged within its category keeps working through the browser's own drag.
 *
 * Themed in both appearances
 * --------------------------
 * Category identity colors are the user's choice. Raw tints are written per
 * node; a second alpha set selected by `body[data-ds-dark-theme]` keeps dark
 * and light at the same perceived depth. Floating surfaces use the shipped
 * `--dsw-menu-surface-fill` / `--dsw-menu-backdrop-filter` tokens, so their
 * material matches every other menu in the app.
 *
 * Persistence
 * -----------
 * Category definitions (name, color, member Workspaces, collapsed state) are a
 * browser UI preference, like the shipped Workspace browser's own view store:
 * they live in `localStorage` under `dsh.workspace.categories.v1`. This plugin
 * stores no Host data and mutates no Workspace.
 *
 * Ownership
 * ---------
 * The DOM writes are owned by this half: the style element, the button, the
 * category nodes, the floating surfaces, the observers, the drag listeners and
 * the subscriptions are all created through `ctx.effect` and removed when the
 * plugin unloads. Every asynchronous callback (frame, observer, timer, drag)
 * checks a disposal flag, and a new activation first disposes the previous one
 * through a page-global handle, so a client hot reload converges to exactly one
 * set of category frames instead of stacking them.
 */

window.__ModuleLoader__.load({
  id: '@local/dsh-workspace-categories',
  factory(require) {
    /* ------------------------------------------------------------------ *
     * Constants
     * ------------------------------------------------------------------ */

    /** The Workspace browsing region's slot outlet — the shipped sidebar seam. */
    const REGION_SELECTOR = '[data-slot="sidebar.workspaces"]'
    /** The region's section header, marked by the shipped browser itself. */
    const HEADER_SELECTOR = '[data-sidebar-workspace-header]'
    /** The region's scrolling list seat, marked by the shipped browser itself. */
    const LIST_AREA_SELECTOR = '[data-sidebar-list-area]'
    /** Every Workspace group's header row, keyed by its Workspace id. */
    const WORKSPACE_ROW_SELECTOR = '[data-row-key^="workspace:"]'
    const ROW_KEY_ATTRIBUTE = 'data-row-key'
    const ROW_KEY_PREFIX = 'workspace:'
    /** Where a browser-local category preference is kept (same family as the shipped view store). */
    const STORAGE_KEY = 'dsh.workspace.categories.v1'
    const STORE_VERSION = 1
    /** Style element id; one owned element per plugin fiber. */
    const STYLE_ID = 'dsh-wsc-style'
    /** Marks the list element this half manages. */
    const LIST_CLASS = 'dsh-wsc-list'
    /** Attribute marker that raises the card rules above the shipped group margins. */
    const LIST_ATTRIBUTE = 'data-dsh-wsc-list'
    /** The flex ordering mode for the grouped (non-nested) view. */
    const FLEX_CLASS = 'dsh-wsc-flex'
    /** The shipped section header's action cluster, widened for the extra icon. */
    const ACTIONS_CLASS = 'dsh-wsc-header-actions'
    /** Local class prefix for every node and marker this half owns. */
    const PREFIX = 'dsh-wsc-'
    const CAT_ATTRIBUTE = 'data-dsh-wsc-cat'
    const MEMBER_ATTRIBUTE = 'data-dsh-wsc-member'
    /** Marks every Workspace section this half styles, so CSS needs no hashed class. */
    const SECTION_ATTRIBUTE = 'data-dsh-wsc-section'
    const DROP_ATTRIBUTE = 'data-dsh-wsc-drop'
    const INSERT_ATTRIBUTE = 'data-dsh-wsc-insert'
    const DRAGGING_ATTRIBUTE = 'data-dsh-wsc-dragging'
    const COLLAPSED_ATTRIBUTE = 'data-dsh-wsc-collapsed'
    /** Marks the DOM this activation owns, so a hot-reload teardown cannot strip
     * the styles of the instance that replaced it. */
    const OWNER_ATTRIBUTE = 'data-dsh-wsc-owner'
    /** Document-body flags that reveal the drop affordances during a drag. */
    const BODY_DRAG_WORKSPACE = 'dsh-wsc-dragging-workspace'
    const BODY_DRAG_CATEGORY = 'dsh-wsc-dragging-category'
    /** Private drag type for a category header; a foreign drag never carries it. */
    const CATEGORY_MIME = 'application/x-dsh-wsc-category'
    const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
    /** Category theme colors offered by the palette; a custom color is still allowed. */
    /** macOS Finder tag colors, in Finder's own picker order. */
    const PALETTE = Object.freeze([
      '#FF6366', '#FEA65D', '#FFD552', '#69D27E',
      '#48A1FF', '#D55BE4', '#A5A5A9',
    ])
    const NAME_MAX_LENGTH = 40
    const LOCALE_NAMESPACE = 'workspace-categories'
    /** Palette swatches per row; the arrow-key grid uses the same count as the CSS. */
    const PALETTE_COLUMNS = 7

    /** Floating surface placement, mirroring the shipped menu's 4px / 12px rhythm. */
    const POPOVER_GAP = 4
    const POPOVER_EDGE = 12

    /** Bilingual UI copy; the locale service is used when present, this table otherwise. */
    const DICTIONARIES = {
      zh: {
        'addCategory': '新建工作区类别',
        'addCategoryHint': '点击创建类别，然后把工作区拖到类别色块上',
        'categoryMenu': '类别操作',
        'colorPanel': '类别主题色',
        'grip': '拖动调整类别顺序',
        'gripHint': '拖动排序；聚焦后按 ↑ ↓ 也能移动',
        'movedUp': '类别已上移',
        'movedDown': '类别已下移',
        'movedEdge': '已经到边界了',
        'filedInto': '已归入「{name}」',
        'unfiled': '已移出类别',
        'createdCategory': '已新建类别',
        'deletedCategory': '已删除类别「{name}」',
        'renameHint': '双击类别名称可改名',
        'collapsedNow': '已收起「{name}」',
        'expandedNow': '已展开「{name}」',
        'collapse': '收起类别',
        'expand': '展开类别',
        'uncategorized': '未分类',
        'emptyCategory': '把工作区拖到这里',
        'emptyCategoryDrop': '放到这里',
        'dividerDrop': '拖到这里移出类别',
        'editorColor': '主题色',
        'defaultCategoryName': '新类别',
        'menuRename': '重命名',
        'menuDelete': '删除类别',
        'menuDeleteConfirm': '确认删除类别？',
        'categoryAria': '类别「{name}」，{n} 个工作区',
        'countTitle': '{n} 个工作区',
      },
      en: {
        'addCategory': 'New workspace category',
        'addCategoryHint': 'Create a category, then drag Workspaces onto its block',
        'categoryMenu': 'Category actions',
        'colorPanel': 'Category theme color',
        'grip': 'Drag to reorder categories',
        'gripHint': 'Drag to reorder; focus it and press ↑ ↓ to move',
        'movedUp': 'Category moved up',
        'movedDown': 'Category moved down',
        'movedEdge': 'Already at the edge',
        'filedInto': 'Filed under “{name}”',
        'unfiled': 'Removed from its category',
        'createdCategory': 'Category created',
        'deletedCategory': 'Category “{name}” deleted',
        'renameHint': 'Double-click the category name to rename it',
        'collapsedNow': '“{name}” collapsed',
        'expandedNow': '“{name}” expanded',
        'collapse': 'Collapse category',
        'expand': 'Expand category',
        'uncategorized': 'Uncategorized',
        'emptyCategory': 'Drop a workspace here',
        'emptyCategoryDrop': 'Drop here',
        'dividerDrop': 'Drop here to remove from its category',
        'editorColor': 'Theme color',
        'defaultCategoryName': 'New category',
        'menuRename': 'Rename',
        'menuDelete': 'Delete category',
        'menuDeleteConfirm': 'Confirm delete?',
        'categoryAria': 'Category “{name}”, {n} workspaces',
        'countTitle': '{n} workspaces',
      },
    }

    /* ------------------------------------------------------------------ *
     * Styles
     * ------------------------------------------------------------------ */

    const CSS = `
/* The expanded action cluster normally holds exactly two 28px controls; the
 * category button is the third, so the cluster reserves its extra 32px. */
.${ACTIONS_CLASS}[class*="headerActions"] {
  max-width: 96px;
}
/* The cluster collapses while the search field is expanded: keep that
 * shipped behavior even when this stylesheet lands after the shipped one. */
.${ACTIONS_CLASS}[class*="headerActionsHidden"] {
  max-width: 0;
}

/* ---- Section header button ------------------------------------------- */
.${PREFIX}add-button {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: var(--dsw-radius-sm);
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  transition: background-color 120ms var(--ds-ease-in-out, ease), color 120ms var(--ds-ease-in-out, ease);
}
.${PREFIX}add-button[hidden] {
  display: none;
}
@media (hover: hover) {
  .${PREFIX}add-button:hover {
    background: var(--dsw-alias-interactive-bg-hover);
    color: var(--dsw-alias-label-primary);
  }
}

/* ---- The list becomes an orderable column ---------------------------- */
.${LIST_CLASS}[${LIST_ATTRIBUTE}] {
  position: relative;
}
.${LIST_CLASS}[${LIST_ATTRIBUTE}].${FLEX_CLASS} {
  display: flex;
  flex-direction: column;
}
.${LIST_CLASS}[${LIST_ATTRIBUTE}].${FLEX_CLASS} > * {
  flex: 0 0 auto;
}

/* ---- Category paint: one identity, two appearances -------------------- */
/* Raw tints are written per node by script; this block selects the light or
 * dark alpha set once for every painted surface. */
.${PREFIX}cat-header,
.${PREFIX}cat-empty,
.${PREFIX}band,
.${LIST_CLASS}[${LIST_ATTRIBUTE}] > [${MEMBER_ATTRIBUTE}] {
  --dsh-wsc-t: var(--dsh-wsc-tint);
  --dsh-wsc-t2: var(--dsh-wsc-tint-strong);
  --dsh-wsc-l: var(--dsh-wsc-line);
  --dsh-wsc-l2: var(--dsh-wsc-line-strong);
  --dsh-wsc-h: var(--dsh-wsc-halo);
  --dsh-wsc-c: var(--dsh-wsc-chip);
}
body[data-ds-dark-theme] .${PREFIX}cat-header,
body[data-ds-dark-theme] .${PREFIX}cat-empty,
body[data-ds-dark-theme] .${PREFIX}band,
body[data-ds-dark-theme] .${LIST_CLASS}[${LIST_ATTRIBUTE}] > [${MEMBER_ATTRIBUTE}] {
  --dsh-wsc-t: var(--dsh-wsc-tint-dark);
  --dsh-wsc-t2: var(--dsh-wsc-tint-strong-dark);
  --dsh-wsc-l: var(--dsh-wsc-line-dark);
  --dsh-wsc-l2: var(--dsh-wsc-line-strong-dark);
  --dsh-wsc-h: var(--dsh-wsc-halo-dark);
  --dsh-wsc-c: var(--dsh-wsc-chip-dark);
}

/* ---- Workspace blocks ------------------------------------------------- */
/* Uncategorized Workspaces: a neutral raised card on the sidebar fill. */
.${LIST_CLASS}[${LIST_ATTRIBUTE}] > [${SECTION_ATTRIBUTE}] {
  position: relative;
  z-index: 1;
  margin-top: 6px;
  padding: 3px 4px;
  border-radius: var(--dsw-radius-lg, 16px);
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 3.5%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dsw-alias-label-primary) 6.5%, transparent);
}
body[data-ds-dark-theme] .${LIST_CLASS}[${LIST_ATTRIBUTE}] > [${SECTION_ATTRIBUTE}] {
  background: color-mix(in srgb, var(--dsw-alias-label-primary) 5%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dsw-alias-label-primary) 9%, transparent);
}
/* Categorized Workspaces: a neutral card nested inside the tinted band, so the
 * band color reads as the frame around and between the member cards. */
.${LIST_CLASS}[${LIST_ATTRIBUTE}] > [${SECTION_ATTRIBUTE}][${MEMBER_ATTRIBUTE}] {
  margin: 4px 4px 0;
  border-radius: var(--dsw-radius-md, 12px);
  background: color-mix(in srgb, var(--dsh-wsc-color) 7%, var(--dsw-alias-bg-layer-1));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dsh-wsc-color) 22%, transparent);
}
body[data-ds-dark-theme] .${LIST_CLASS}[${LIST_ATTRIBUTE}] > [${SECTION_ATTRIBUTE}][${MEMBER_ATTRIBUTE}] {
  background: color-mix(in srgb, var(--dsh-wsc-color) 13%, var(--dsw-alias-bg-layer-1));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dsh-wsc-color) 28%, transparent);
}
.${LIST_CLASS}[${LIST_ATTRIBUTE}] > [${SECTION_ATTRIBUTE}][${MEMBER_ATTRIBUTE}].${PREFIX}member-last {
  margin-bottom: 4px;
}
/* A collapsed category hides its member blocks but keeps them mounted. */
.${LIST_CLASS}[${LIST_ATTRIBUTE}] > [${SECTION_ATTRIBUTE}][${MEMBER_ATTRIBUTE}][${COLLAPSED_ATTRIBUTE}] {
  display: none;
}

/* ---- Category band (the rounded tinted container layer) --------------- */
.${PREFIX}band {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 0;
  border-radius: var(--dsw-radius-lg, 16px);
  background: var(--dsh-wsc-t);
  box-shadow: inset 0 0 0 1px var(--dsh-wsc-l);
  pointer-events: auto;
  cursor: grab;
  transition: background-color 140ms var(--ds-ease-in-out, ease);
}
.${PREFIX}band:active {
  cursor: grabbing;
}
.${PREFIX}band[${DROP_ATTRIBUTE}="true"] {
  background: var(--dsh-wsc-t2);
  box-shadow:
    inset 0 0 0 1px var(--dsh-wsc-l2),
    0 0 0 2px var(--dsh-wsc-h);
}
body.${BODY_DRAG_WORKSPACE} .${PREFIX}band:not([${DROP_ATTRIBUTE}="true"]) {
  box-shadow:
    inset 0 0 0 1px var(--dsh-wsc-l2),
    inset 0 0 0 2px var(--dsh-wsc-h);
}

/* ---- Category header -------------------------------------------------- */
.${PREFIX}cat-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 30px;
  margin-top: 10px;
  padding: 0 3px 0 2px;
  border-radius: var(--dsw-radius-lg, 16px) var(--dsw-radius-lg, 16px) 0 0;
  background: transparent;
  box-shadow: inset 0 -1px 0 var(--dsh-wsc-l);
  color: var(--dsw-alias-label-primary);
  user-select: none;
  transition: background-color 140ms var(--ds-ease-in-out, ease);
}
.${PREFIX}cat-header[${COLLAPSED_ATTRIBUTE}] {
  border-radius: var(--dsw-radius-lg, 16px);
  box-shadow: none;
}
/* Left accent: the category's identity survives the low-alpha tint. */
.${PREFIX}cat-header::after {
  content: '';
  position: absolute;
  top: 7px;
  bottom: 7px;
  left: 0;
  width: 2px;
  border-radius: 2px;
  background: var(--dsh-wsc-color);
  pointer-events: none;
}
.${PREFIX}cat-header[${DRAGGING_ATTRIBUTE}] {
  opacity: 0.55;
}
.${PREFIX}cat-header[${DROP_ATTRIBUTE}="true"] {
  background: var(--dsh-wsc-t2);
  box-shadow:
    inset 0 0 0 1px var(--dsh-wsc-l2),
    0 0 0 2px var(--dsh-wsc-h);
}
/* Drop feedback on a member card while a Workspace is dragged over it. */
.${LIST_CLASS}[${LIST_ATTRIBUTE}] > [${SECTION_ATTRIBUTE}][${MEMBER_ATTRIBUTE}][${DROP_ATTRIBUTE}="true"] {
  box-shadow:
    inset 0 0 0 1px var(--dsh-wsc-l2),
    0 0 0 2px var(--dsh-wsc-h);
}
.${PREFIX}grip {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 20px;
  border-radius: 4px;
  color: var(--dsw-alias-label-tertiary);
  cursor: grab;
  opacity: 0.6;
  transition: opacity 120ms var(--ds-ease-in-out, ease), background-color 120ms var(--ds-ease-in-out, ease);
}
.${PREFIX}grip:hover {
  opacity: 1;
  background: color-mix(in srgb, var(--dsh-wsc-color) 14%, transparent);
}
.${PREFIX}grip:active {
  cursor: grabbing;
}
.${PREFIX}collapse-button {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: var(--dsw-radius-xs, 4px);
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  cursor: pointer;
  transition: background-color 120ms var(--ds-ease-in-out, ease), color 120ms var(--ds-ease-in-out, ease);
}
.${PREFIX}collapse-button:hover {
  background: color-mix(in srgb, var(--dsh-wsc-color) 14%, transparent);
  color: var(--dsw-alias-label-primary);
}
.${PREFIX}collapse-button svg {
  transition: transform 150ms var(--ds-ease-in-out, ease);
}
.${PREFIX}collapse-button[aria-expanded="true"] svg {
  transform: rotate(90deg);
}
.${PREFIX}dot-button {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 5px;
  background: transparent;
  cursor: pointer;
  transition: background-color 120ms var(--ds-ease-in-out, ease);
}
.${PREFIX}dot-button:hover {
  background: color-mix(in srgb, var(--dsh-wsc-color) 14%, transparent);
}
.${PREFIX}dot {
  flex: none;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--dsh-wsc-color);
  box-shadow: 0 0 0 3px var(--dsh-wsc-h);
}
.${PREFIX}name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
  letter-spacing: 0.01em;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--dsw-alias-label-primary);
}
.${PREFIX}name-input {
  box-sizing: border-box;
  width: 100%;
  height: 20px;
  min-width: 0;
  padding: 0;
  border: none;
  border-bottom: 1px solid var(--dsh-wsc-color, var(--dsw-alias-brand-primary));
  border-radius: 0;
  outline: none;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
}
.${PREFIX}count {
  flex: none;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  box-sizing: border-box;
  border-radius: 999px;
  background: var(--dsh-wsc-c);
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
  text-align: center;
}
.${PREFIX}icon-button {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: var(--dsw-radius-sm);
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  cursor: pointer;
  transition: background-color 120ms var(--ds-ease-in-out, ease), color 120ms var(--ds-ease-in-out, ease);
}
@media (hover: hover) {
  .${PREFIX}icon-button:hover {
    background: var(--dsw-alias-interactive-bg-hover);
    color: var(--dsw-alias-label-primary);
  }
}
/* Insertion caret while reordering categories. */
/* Category reorder marker: the band's top edge means "insert before", its
 * bottom edge means "insert after". Drawn on the block itself so dropping on
 * the lower member cards never reads as nesting inside that category. */
.${PREFIX}band[${INSERT_ATTRIBUTE}="before"] {
  box-shadow:
    inset 0 0 0 1px var(--dsh-wsc-l),
    inset 0 2px 0 0 var(--dsw-alias-brand-primary),
    0 0 0 2px color-mix(in srgb, var(--dsw-alias-brand-primary) 22%, transparent);
}
.${PREFIX}band[${INSERT_ATTRIBUTE}="after"] {
  box-shadow:
    inset 0 0 0 1px var(--dsh-wsc-l),
    inset 0 -2px 0 0 var(--dsw-alias-brand-primary),
    0 0 0 2px color-mix(in srgb, var(--dsw-alias-brand-primary) 22%, transparent);
}
body.${BODY_DRAG_CATEGORY} .${PREFIX}cat-header:not([${INSERT_ATTRIBUTE}]) {
  outline: 1px dashed var(--dsh-wsc-l2);
  outline-offset: 1px;
}

/* ---- Empty category drop area ---------------------------------------- */
.${PREFIX}cat-empty {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 30px;
  margin: 4px 4px 4px;
  border-radius: var(--dsw-radius-md, 12px);
  border: 1px dashed var(--dsh-wsc-l);
  background: color-mix(in srgb, var(--dsh-wsc-color) 6%, transparent);
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  transition:
    background-color 140ms var(--ds-ease-in-out, ease),
    border-color 140ms var(--ds-ease-in-out, ease),
    color 140ms var(--ds-ease-in-out, ease);
}
body.${BODY_DRAG_WORKSPACE} .${PREFIX}cat-empty {
  border-style: solid;
  border-color: var(--dsh-wsc-l2);
  color: var(--dsw-alias-label-secondary);
}
.${PREFIX}cat-empty[${DROP_ATTRIBUTE}="true"] {
  border-style: solid;
  border-color: var(--dsh-wsc-l2);
  background: var(--dsh-wsc-t2);
  color: var(--dsw-alias-label-primary);
}

/* ---- Uncategorized divider ------------------------------------------- */
.${PREFIX}divider {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 18px;
  margin: 16px 4px 2px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  letter-spacing: 0.02em;
  user-select: none;
}
.${PREFIX}divider-line {
  flex: 1;
  height: 1px;
  border-radius: 1px;
  background: var(--dsw-alias-border-l1);
  transition: background-color 140ms var(--ds-ease-in-out, ease);
}
.${PREFIX}divider-label {
  flex: none;
  max-width: 80%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.${PREFIX}divider[${DROP_ATTRIBUTE}="true"] {
  color: var(--dsw-alias-brand-primary);
}
.${PREFIX}divider[${DROP_ATTRIBUTE}="true"] .${PREFIX}divider-line {
  background: var(--dsw-alias-brand-primary);
}
body.${BODY_DRAG_WORKSPACE} .${PREFIX}divider {
  color: var(--dsw-alias-label-secondary);
}
body.${BODY_DRAG_WORKSPACE} .${PREFIX}divider-line {
  background: var(--dsw-alias-border-l2);
}
/* While a categorized Workspace is dragged, the whole uncategorized area is a
 * destination that takes it back out; the dropped card gets a brand ring. */
.${LIST_CLASS}[${LIST_ATTRIBUTE}] > [${SECTION_ATTRIBUTE}]:not([${MEMBER_ATTRIBUTE}])[${DROP_ATTRIBUTE}="true"] {
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 9%, transparent);
  box-shadow:
    inset 0 0 0 1px var(--dsw-alias-brand-primary),
    0 0 0 2px color-mix(in srgb, var(--dsw-alias-brand-primary) 22%, transparent);
}

/* Announcer for screen readers; carries no visual weight. */
.${PREFIX}sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

/* ---- Floating surfaces (shipped menu material) ------------------------ */
/* The card carries the shipped radius, elevation ring and translucent
 * material tokens, so a category menu and a shipped row menu read as one
 * family in both appearances. */
.${PREFIX}pop {
  position: fixed;
  z-index: 1100;
  box-sizing: border-box;
  border-radius: var(--dsw-radius-lg, 16px);
  isolation: isolate;
  box-shadow: var(--dsw-elevation-prominent, 0 3px 8px rgba(0, 0, 0, 0.08));
  --dsw-elevation-stroke-color: var(--dsw-alias-border-l1);
  animation: ${PREFIX}pop-in 120ms ease-out;
}
.${PREFIX}pop::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  background: var(--dsw-menu-surface-fill, var(--dsw-alias-bg-overlay));
  backdrop-filter: var(--dsw-menu-backdrop-filter, blur(24px) saturate(140%));
  -webkit-backdrop-filter: var(--dsw-menu-backdrop-filter, blur(24px) saturate(140%));
  pointer-events: none;
}
@keyframes ${PREFIX}pop-in {
  from { opacity: 0; transform: translateY(-2px) scale(0.985); }
}
.${PREFIX}pop-menu {
  padding: 4px;
  min-width: 144px;
  width: max-content;
  max-width: min(260px, calc(100vw - 24px));
}
/* Action rows copy the shipped menu item metrics exactly. */
.${PREFIX}menu-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 34px;
  box-sizing: border-box;
  padding: 6px 8px;
  border: none;
  border-radius: var(--dsw-radius-md, 12px);
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-primary);
  text-align: left;
}
@media (hover: hover) {
  .${PREFIX}menu-item:hover {
    background: var(--dsw-alias-interactive-bg-hover);
  }
}
.${PREFIX}menu-item:focus-visible {
  background: var(--dsw-alias-interactive-bg-hover);
  outline: none;
}
.${PREFIX}menu-icon {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  color: var(--dsw-alias-menu-icon, var(--dsw-alias-label-secondary));
}
.${PREFIX}menu-icon svg {
  width: 14px;
  height: 14px;
}
.${PREFIX}menu-item[data-danger="true"] {
  color: var(--dsw-alias-state-error-primary);
}
.${PREFIX}menu-item[data-danger="true"] .${PREFIX}menu-icon {
  color: inherit;
}
@media (hover: hover) {
  .${PREFIX}menu-item[data-danger="true"]:hover {
    background: var(--dsw-alias-interactive-bg-hover-danger, var(--dsw-alias-interactive-bg-hover));
  }
}
.${PREFIX}menu-item[data-armed="true"] {
  background: var(--dsw-alias-interactive-bg-hover-danger, var(--dsw-alias-interactive-bg-hover));
}
.${PREFIX}menu-sep {
  height: 0.5px;
  margin: 3px 8px;
  background: var(--dsw-alias-border-l2);
}
/* Color-only palette surface. */
.${PREFIX}pop-color {
  padding: 10px;
  width: 244px;
}
.${PREFIX}panel-label {
  display: block;
  margin-bottom: 8px;
  font-size: 11px;
  line-height: 16px;
  color: var(--dsw-alias-label-tertiary);
}
.${PREFIX}swatches {
  display: grid;
  grid-template-columns: repeat(${PALETTE_COLUMNS}, 1fr);
  gap: 6px;
}
.${PREFIX}swatch {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  padding: 0;
  border: none;
  border-radius: var(--dsw-radius-md, 12px);
  background: currentColor;
  cursor: pointer;
  color: inherit;
  transition: transform 100ms var(--ds-ease-in-out, ease);
}
.${PREFIX}swatch:hover {
  transform: scale(1.06);
}
.${PREFIX}swatch[aria-pressed="true"] {
  box-shadow:
    0 0 0 2px var(--dsw-alias-bg-base),
    0 0 0 4px var(--dsw-alias-label-primary);
}
/* ---- Focus rings ------------------------------------------------------ */
.${PREFIX}add-button:focus-visible,
.${PREFIX}cat-header:focus-visible,
.${PREFIX}icon-button:focus-visible,
.${PREFIX}collapse-button:focus-visible,
.${PREFIX}dot-button:focus-visible,
.${PREFIX}grip:focus-visible,
.${PREFIX}name-input:focus-visible,
.${PREFIX}swatch:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-brand-primary));
  outline-offset: 1px;
}

/* Windows high contrast / forced colors: tints disappear, so the block reads
 * through a real outline instead of a translucent fill. */
@media (forced-colors: active) {
  .${PREFIX}band {
    background: transparent;
    border: 1px solid CanvasText;
    forced-color-adjust: none;
  }
  .${LIST_CLASS}[${LIST_ATTRIBUTE}] > [${SECTION_ATTRIBUTE}] {
    background: Canvas;
    border: 1px solid CanvasText;
  }
  .${PREFIX}cat-header[${INSERT_ATTRIBUTE}] {
    outline: 2px solid Highlight;
  }
  .${PREFIX}swatch[aria-pressed="true"] {
    outline: 2px solid Highlight;
    outline-offset: 2px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .${PREFIX}add-button,
  .${PREFIX}band,
  .${PREFIX}cat-header,
  .${PREFIX}cat-empty,
  .${PREFIX}collapse-button,
  .${PREFIX}collapse-button svg,
  .${PREFIX}divider-line,
  .${PREFIX}dot-button,
  .${PREFIX}grip,
  .${PREFIX}icon-button,
  .${PREFIX}swatch {
    transition: none;
  }
  .${PREFIX}pop {
    animation: none;
  }
  .${PREFIX}swatch:hover {
    transform: none;
  }
}
`

    /* ------------------------------------------------------------------ *
     * Small DOM utilities
     * ------------------------------------------------------------------ */

    /**
     * Whether one element carries a CSS-module class of the given local name.
     * Built bundles hash and prefix local names (`JoiKIa_projectText`,
     * `Kjh-qa_groupSection`), so a generated name is matched by its local
     * suffix instead of a full attribute value.
     * @param element - element to inspect.
     * @param name - the stylesheet's local class name.
     * @returns true when any class token names that local class.
     */
    function localClass(element, name) {
      if (element === null || element === undefined) return false
      const classList = element.classList
      if (classList === undefined) return false
      for (const token of classList) {
        if (token === name) return true
        if (token.endsWith(name)) return true
        if (token.includes('_' + name + '_')) return true
      }
      return false
    }

    /**
     * Create one element with a class name.
     * @param tag - element tag.
     * @param className - class name, or undefined for none.
     * @returns the element.
     */
    function element(tag, className) {
      const node = document.createElement(tag)
      if (className !== undefined) node.className = className
      return node
    }

    /**
     * Create one `type="button"` element with a class name and a localized
     * accessible name.
     * @param className - class name.
     * @param label - accessible name.
     * @returns the button.
     */
    function makeButton(className, label) {
      const node = document.createElement('button')
      node.type = 'button'
      if (className !== undefined) node.className = className
      if (label !== undefined) {
        node.setAttribute('aria-label', label)
        node.title = label
      }
      return node
    }

    /**
     * Create an SVG root for a small icon.
     * @param width - rendered width in pixels.
     * @param height - rendered height in pixels.
     * @param viewBox - view box text.
     * @param stroke - whether shapes use the icon stroke.
     * @returns the svg element.
     */
    function svgIcon(width, height, viewBox, stroke) {
      const svg = document.createElementNS(SVG_NAMESPACE, 'svg')
      svg.setAttribute('viewBox', viewBox)
      svg.setAttribute('width', String(width))
      svg.setAttribute('height', String(height))
      svg.setAttribute('aria-hidden', 'true')
      if (stroke) {
        svg.setAttribute('fill', 'none')
        svg.setAttribute('stroke', 'currentColor')
        svg.setAttribute('stroke-width', '1.4')
        svg.setAttribute('stroke-linecap', 'round')
        svg.setAttribute('stroke-linejoin', 'round')
      } else {
        svg.setAttribute('fill', 'currentColor')
      }
      return svg
    }

    /**
     * Append one SVG path.
     * @param svg - the icon root.
     * @param d - path data.
     * @returns the path.
     */
    function svgPath(svg, d) {
      const path = document.createElementNS(SVG_NAMESPACE, 'path')
      path.setAttribute('d', d)
      svg.appendChild(path)
      return path
    }

    /**
     * Append one SVG element with attributes.
     * @param svg - the icon root.
     * @param tag - SVG tag.
     * @param attributes - attribute map.
     * @returns the created element.
     */
    function svgShape(svg, tag, attributes) {
      const shape = document.createElementNS(SVG_NAMESPACE, tag)
      for (const [key, value] of Object.entries(attributes)) shape.setAttribute(key, value)
      svg.appendChild(shape)
      return shape
    }

    /** @returns the "new category" icon (a category card with a plus). */
    function categoryIcon() {
      const svg = svgIcon(16, 16, '0 0 16 16', true)
      svgShape(svg, 'rect', { x: '2.2', y: '5.6', width: '11.6', height: '8.2', rx: '2.4' })
      svgPath(svg, 'M4.7 8.4h6.6M4.7 10.8h4.2')
      svgPath(svg, 'M11.9 1.6v3.2M10.3 3.2h3.2')
      return svg
    }

    /** @returns the drag-grip icon (two columns of dots). */
    function gripIcon() {
      const svg = svgIcon(10, 14, '0 0 10 14', false)
      for (const cx of ['3', '7']) {
        for (const cy of ['3', '7', '11']) {
          svgShape(svg, 'circle', { cx, cy, r: '1.1' })
        }
      }
      return svg
    }

    /** @returns the collapse chevron (rotates when the category is expanded). */
    function chevronIcon() {
      const svg = svgIcon(10, 10, '0 0 10 10', false)
      svgPath(svg, 'M3 1.6 7.2 5 3 8.4z')
      return svg
    }

    /** @returns the "more" icon (three dots). */
    function moreIcon() {
      const svg = svgIcon(16, 16, '0 0 16 16', false)
      for (const cx of ['3.2', '8', '12.8']) svgShape(svg, 'circle', { cx, cy: '8', r: '1.3' })
      return svg
    }

    /**
     * Official icon root: 16-unit artwork rendered at 14px with the shipped
     * regular icon stroke width, exactly like the context menus' slot icons.
     * @returns the svg element.
     */
    function menuIconRoot() {
      const svg = document.createElementNS(SVG_NAMESPACE, 'svg')
      svg.setAttribute('viewBox', '0 0 16 16')
      svg.setAttribute('width', '14')
      svg.setAttribute('height', '14')
      svg.setAttribute('fill', 'none')
      svg.setAttribute('stroke-width', '1')
      svg.setAttribute('aria-hidden', 'true')
      return svg
    }

    /** @returns the shipped "rename" icon (edit-outline, regular). */
    function editIcon() {
      const svg = menuIconRoot()
      const frame = document.createElementNS(SVG_NAMESPACE, 'path')
      frame.setAttribute('d', 'M8.85596 2.69971H4.19971C3.37141 2.69971 2.69992 3.37146 2.69971 4.19971V11.8003C2.69992 12.6285 3.37141 13.3003 4.19971 13.3003H11.8003C12.6283 13.2999 13.3001 12.6283 13.3003 11.8003V7.89893H14.3003V11.8003C14.3001 13.1806 13.1806 14.2999 11.8003 14.3003H4.19971C2.81913 14.3003 1.69992 13.1808 1.69971 11.8003V4.19971C1.69992 2.81918 2.81913 1.69971 4.19971 1.69971H8.85596V2.69971Z')
      frame.setAttribute('fill', 'currentColor')
      const pen = document.createElementNS(SVG_NAMESPACE, 'path')
      pen.setAttribute('d', 'M7.7849 8.23878L13.888 2.13574')
      pen.setAttribute('stroke', 'currentColor')
      svg.appendChild(frame)
      svg.appendChild(pen)
      return svg
    }

    /** @returns the shipped "delete" icon (trash-outline, regular). */
    function trashIcon() {
      const svg = menuIconRoot()
      for (const d of [
        'M1.28149 3.88831H14.7187',
        'M5.41602 3.88833V2.47962C5.41602 2.29282 5.52492 2.11366 5.71876 1.98157C5.9126 1.84948 6.17551 1.77527 6.44964 1.77527H9.55053C9.82466 1.77527 10.0876 1.84948 10.2814 1.98157C10.4753 2.11366 10.5842 2.29282 10.5842 2.47962V3.88833',
        'M2.57349 3.88831L3.19366 13.2943C3.21937 13.5502 3.33952 13.7872 3.53065 13.9593C3.72178 14.1313 3.97016 14.2259 4.22729 14.2246H11.7728C12.0299 14.2259 12.2783 14.1313 12.4694 13.9593C12.6605 13.7872 12.7807 13.5502 12.8064 13.2943L13.4266 3.88831',
        'M6.44946 6.98926V11.1238',
        'M9.55054 6.98926V11.1238',
      ]) {
        const path = document.createElementNS(SVG_NAMESPACE, 'path')
        path.setAttribute('d', d)
        path.setAttribute('stroke', 'currentColor')
        svg.appendChild(path)
      }
      return svg
    }

    /** Page-global key of the live activation, used to take over on hot reload. */
    const INSTANCE_KEY = Symbol.for('dsh.workspace-categories.instance')
    /** Session flag that stops the orphaned-frame recovery from reloading in a loop. */
    const RELOAD_GUARD_KEY = 'dsh.workspace-categories.reload-guard'
    /** Selector of every node this plugin paints into the page. */
    const PLUGIN_NODE_SELECTOR = [
      '.' + PREFIX + 'cat-header',
      '.' + PREFIX + 'band',
      '.' + PREFIX + 'cat-empty',
      '.' + PREFIX + 'divider',
      '.' + PREFIX + 'add-button',
      '.' + PREFIX + 'pop',
    ].join(',')

    /**
     * Remove the DOM and page-level markers an earlier activation left behind.
     *
     * A client hot reload can mount a new module instance without the previous
     * fiber's teardown running (that is what produced duplicated category
     * frames), and versions before this one did not register themselves. The
     * new instance therefore sweeps first and only then renders, so a reload
     * converges to one frame set instead of stacking.
     */
    function sweepStaleDom() {
      if (typeof document === 'undefined') return
      try {
        const removeAll = (selector) => {
          for (const node of document.querySelectorAll(selector)) node.remove()
        }
        removeAll([
          '.' + PREFIX + 'cat-header',
          '.' + PREFIX + 'band',
          '.' + PREFIX + 'cat-empty',
          '.' + PREFIX + 'divider',
          '.' + PREFIX + 'add-button',
          '.' + PREFIX + 'pop',
        ].join(','))
        removeAll('style#' + STYLE_ID)
        removeAll('.' + PREFIX + 'sr-only')
        for (const node of document.querySelectorAll('.' + ACTIONS_CLASS)) node.classList.remove(ACTIONS_CLASS)
        for (const node of document.querySelectorAll('.' + LIST_CLASS)) {
          node.classList.remove(LIST_CLASS, FLEX_CLASS)
          node.removeAttribute(LIST_ATTRIBUTE)
        }
        if (document.body !== null) document.body.classList.remove(BODY_DRAG_WORKSPACE, BODY_DRAG_CATEGORY)
        for (const node of document.querySelectorAll('[' + OWNER_ATTRIBUTE + ']')) {
          const owner = node.getAttribute(OWNER_ATTRIBUTE) ?? ''
          if (owner.startsWith(PREFIX)) node.style.removeProperty('order')
          node.removeAttribute(OWNER_ATTRIBUTE)
        }
        for (const node of document.querySelectorAll([
          '[' + MEMBER_ATTRIBUTE + ']',
          '[' + COLLAPSED_ATTRIBUTE + ']',
          '[' + DROP_ATTRIBUTE + ']',
          '[' + INSERT_ATTRIBUTE + ']',
          '.' + PREFIX + 'member-last',
        ].join(','))) {
          node.removeAttribute(MEMBER_ATTRIBUTE)
          node.removeAttribute(COLLAPSED_ATTRIBUTE)
          node.removeAttribute(DROP_ATTRIBUTE)
          node.removeAttribute(INSERT_ATTRIBUTE)
          node.classList.remove(PREFIX + 'member-last')
        }
      } catch (error) {
        console.warn('workspace-categories: stale DOM sweep failed:', error)
      }
    }

    /* ------------------------------------------------------------------ *
     * Store: browser-local category definitions
     * ------------------------------------------------------------------ */

    /**
     * Normalize one stored color to `#rrggbb` upper case, or undefined.
     * @param value - raw color value.
     * @returns normalized color, or undefined when unreadable.
     */
    function normalizeColor(value) {
      if (typeof value !== 'string') return undefined
      const raw = value.trim()
      if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toUpperCase()
      if (/^#[0-9a-f]{3}$/i.test(raw)) {
        return ('#' + raw.slice(1).split('').map(character => character + character).join('')).toUpperCase()
      }
      return undefined
    }

    /**
     * Normalize one category name.
     * @param value - raw name.
     * @param fallback - name used when the value is empty.
     * @returns the display name.
     */
    function normalizeName(value, fallback) {
      if (typeof value !== 'string') return fallback
      const name = value.trim()
      return name === '' ? fallback : name.slice(0, NAME_MAX_LENGTH)
    }

    /**
     * Validate and copy one raw store blob.
     * @param raw - parsed JSON value, if any.
     * @param fallbackName - localized default for unnamed categories.
     * @returns the normalized store.
     */
    function normalizeStore(raw, fallbackName) {
      const categories = []
      const seenIds = new Set()
      const seenWorkspaces = new Set()
      if (raw === null || typeof raw !== 'object') return { categories, version: STORE_VERSION }
      const entries = Array.isArray(raw.categories) ? raw.categories : []
      for (const entry of entries) {
        if (entry === null || typeof entry !== 'object') continue
        const id = typeof entry.id === 'string' && entry.id !== '' ? entry.id : undefined
        if (id === undefined || seenIds.has(id)) continue
        seenIds.add(id)
        const name = normalizeName(entry.name, fallbackName)
        const color = normalizeColor(entry.color) ?? PALETTE[categories.length % PALETTE.length]
        const workspaceIds = []
        const rawIds = Array.isArray(entry.workspaceIds) ? entry.workspaceIds : []
        for (const workspaceId of rawIds) {
          if (typeof workspaceId !== 'string' || workspaceId === '') continue
          if (seenWorkspaces.has(workspaceId)) continue
          seenWorkspaces.add(workspaceId)
          workspaceIds.push(workspaceId)
        }
        categories.push({ id, name, color, workspaceIds, collapsed: entry.collapsed === true })
      }
      return { categories, version: STORE_VERSION }
    }

    /* ------------------------------------------------------------------ *
     * Plugin
     * ------------------------------------------------------------------ */

    /** Optional Cordis Service base for the read-only inspection face. */
    let ServiceBase = null
    try {
      const cordis = require('@deepseek-ai/cordis')
      if (cordis !== null && typeof cordis.Service === 'function') ServiceBase = cordis.Service
    } catch (error) {
      console.warn('workspace-categories: Cordis service face unavailable:', error)
    }

    return {
      inject: ['workspaces'],
      apply(ctx) {
        /* A hot reload can activate this module before the old fiber is torn
         * down. Ask the previous activation to clean up, then clear whatever
         * even older versions left behind; only then render. */
        const pageWindow = typeof window === 'undefined' ? undefined : window
        const previous = pageWindow === undefined ? undefined : pageWindow[INSTANCE_KEY]
        if (previous !== undefined && previous !== null && typeof previous.dispose === 'function') {
          try {
            previous.dispose('replaced')
          } catch (error) {
            console.warn('workspace-categories: previous activation failed to dispose:', error)
          }
        }
        /* Frames still present after taking the previous activation over belong
         * to an even older instance whose teardown never ran (versions before
         * the take-over handle existed). Their observers can recreate frames,
         * so removing the nodes is not enough: reload the page once to reset the
         * client cleanly, guarded against reload loops. */
        const staleFrames = typeof document === 'undefined'
          ? 0
          : document.querySelectorAll(PLUGIN_NODE_SELECTOR).length
        if (staleFrames > 0) {
          try {
            if (sessionStorage.getItem(RELOAD_GUARD_KEY) !== '1') {
              sessionStorage.setItem(RELOAD_GUARD_KEY, '1')
              console.warn('[workspace-categories] found orphaned category frames from an earlier hot reload; reloading the page once to reset the plugin cleanly')
              if (typeof location !== 'undefined' && typeof location.reload === 'function') location.reload()
            }
          } catch (error) {
            console.warn('workspace-categories: automatic reload for orphaned frames failed:', error)
          }
        } else {
          try {
            sessionStorage.removeItem(RELOAD_GUARD_KEY)
          } catch {
            /* storage may be unavailable; the guard is best effort */
          }
        }
        sweepStaleDom()

        /* ---------------- state ---------------- */

        /** Token identifying the DOM this activation owns. */
        const instanceToken = PREFIX + Math.random().toString(36).slice(2)
        /** The in-memory store; replaced by the persisted snapshot when readable. */
        const state = { categories: [] }
        /** Receivers of the read-only service snapshot. */
        const serviceListeners = new Set()
        /** Category header nodes currently in the page, by category id. */
        const headerNodes = new Map()
        /** Category band (background container) nodes, by category id. */
        const bandNodes = new Map()
        /** Category empty drop-area nodes, by category id. */
        const emptyNodes = new Map()
        /** The Uncategorized divider node, when the category UI is rendered. */
        let dividerNode = null
        /** The one open floating surface, if any. */
        let popover = null
        /** The injected section-header button. */
        let addButton = null
        /** The shipped action cluster the button currently lives in. */
        let actionsElement = null
        /** The list element currently managed (the shipped tree list). */
        let listElement = null
        /** The browsing region currently observed. */
        let region = null
        /** 'grouped' | 'tree' | 'none' — the list shape this half can address. */
        let layoutMode = 'none'
        /** True when the render tree uses the nested Workspace tree. */
        let nestedTree = false
        /** Current drag, if any: { kind: 'workspace', workspaceId } or { kind: 'category', categoryId }. */
        let dragState = null
        /** Signature of the currently painted drop target, to skip redundant writes. */
        let dropSignature = null
        /** Inline category-name editing session inside a header, if any. */
        let editing = null
        /** Pending reconciliation frame. */
        let frame = 0
        /** Whether the document-level drag listeners are installed. */
        let dragListening = false
        /** ResizeObserver keeping band geometry current when the list reflows. */
        let listResizeObserver = null
        /** The element the resize observer is currently watching. */
        let observedList = null
        /** True once this activation is torn down; every async callback checks it. */
        let disposed = false
        /** Owned `<style>` element. */
        let styleElement = null
        /** Owned document MutationObserver. */
        let domObserver = null
        /** Owned Workspace-list subscription. */
        let unsubscribeWorkspaces = null
        /** Owned locale subscription. */
        let unsubscribeLocale = null
        /** The locale injection fiber, so it can be released on takeover. */
        let localeScopeFiber = null
        /** This activation's take-over handle published on the page window. */
        let instanceApi = null
        /** Owned window resize listener remover. */
        let removeViewportListener = null
        /** Visually hidden polite live region for screen-reader feedback. */
        let announcerNode = null
        /** Pending announcement frame. */
        let announceFrame = 0
        /** Whether the unwritable-store warning was already printed. */
        let persistWarned = false

        /* ---------------- localization ---------------- */

        /**
         * Replace `{name}` placeholders in one dictionary string.
         * @param template - dictionary string.
         * @param params - placeholder values.
         * @returns the rendered string.
         */
        function interpolate(template, params) {
          if (params === undefined || params === null) return template
          let result = template
          for (const [key, value] of Object.entries(params)) result = result.replaceAll('{' + key + '}', String(value))
          return result
        }

        /** The Client locale service; it may arrive after this plugin mounts. */
        let localeService = typeof ctx.get === 'function' ? ctx.get('locale') : undefined

        /**
         * Resolve the app's active locale id from the Client locale service,
         * falling back to the document language when the service is absent.
         * @returns a lowercase locale id.
         */
        function activeLocaleId() {
          try {
            const snapshot = typeof localeService?.getLocale === 'function'
              ? localeService.getLocale()
              : typeof localeService?.getSnapshot === 'function'
                ? localeService.getSnapshot()
                : undefined
            if (snapshot !== undefined && snapshot !== null
              && typeof snapshot.active === 'string' && snapshot.active !== '') {
              return snapshot.active.toLowerCase()
            }
          } catch (error) {
            console.warn('workspace-categories: locale snapshot unreadable:', error)
          }
          const fallback = navigator.language || document.documentElement.getAttribute('lang') || 'en'
          return String(fallback).toLowerCase()
        }

        /**
         * Build the translator from the plugin's own dictionaries, selected by
         * the app's active locale: Chinese for any `zh*` id, English otherwise.
         * The lookup walks zh -> en so no key can ever render as its raw token.
         * @returns the current translator.
         */
        function createTranslator() {
          const id = activeLocaleId()
          const primary = id.startsWith('zh') ? DICTIONARIES.zh : DICTIONARIES.en
          return (key, params) => interpolate(primary[key] ?? DICTIONARIES.en[key] ?? key, params)
        }

        let translate = createTranslator()

        /**
         * Translate one UI string with the current locale.
         * @param key - dictionary key.
         * @param params - placeholder values.
         * @returns the rendered string.
         */
        function t(key, params) {
          return translate(key, params)
        }

        /**
         * Rebuild the translator for the app's current language and repaint the
         * copy that is already on screen. Called when the locale service appears
         * (Desktop resolves the stored preference asynchronously) and on every
         * later language switch.
         */
        function refreshLocaleCopy() {
          if (disposed) return
          translate = createTranslator()
          closePopover()
          schedule()
        }

        /* ---------------- persistence ---------------- */

        /**
         * Read the persisted category store, tolerating an absent or corrupt blob.
         * @returns the parsed store.
         */
        function readStore() {
          const fallbackName = t('defaultCategoryName')
          try {
            const raw = window.localStorage.getItem(STORAGE_KEY)
            if (raw === null) return { categories: [], version: STORE_VERSION }
            return normalizeStore(JSON.parse(raw), fallbackName)
          } catch (error) {
            console.warn('workspace-categories: persisted categories unreadable:', error)
            return { categories: [], version: STORE_VERSION }
          }
        }

        /** Persist the current definition set and notify the service listeners. */
        function save() {
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
              version: STORE_VERSION,
              categories: state.categories,
            }))
          } catch (error) {
            if (!persistWarned) {
              persistWarned = true
              console.warn('workspace-categories: saving categories failed; this session keeps the categories in memory only:', error)
            }
          }
          notifyService()
        }

        /** @returns a deep copy of the definitions for the read-only service. */
        function publicSnapshot() {
          return {
            version: STORE_VERSION,
            layout: layoutMode,
            categories: state.categories.map(category => ({
              id: category.id,
              name: category.name,
              color: category.color,
              collapsed: category.collapsed === true,
              workspaceIds: [...category.workspaceIds],
            })),
          }
        }

        /** Publish the current definitions to the read-only service listeners. */
        function notifyService() {
          if (serviceListeners.size === 0) return
          const snapshot = publicSnapshot()
          for (const listener of [...serviceListeners]) {
            try {
              listener(snapshot)
            } catch (error) {
              console.warn('workspace-categories: service listener failed:', error)
            }
          }
        }

        /**
         * Install the thin read-only Client service used by inspection and by
         * other plugins: `workspaceCategories.getSnapshot()`.
         */
        function installService() {
          if (disposed || ServiceBase === null) return
          try {
            class WorkspaceCategoriesService extends ServiceBase {
              /**
               * @param ownerCtx - Client root Context.
               */
              constructor(ownerCtx) {
                super(ownerCtx, 'workspaceCategories')
              }

              /** @returns the current category definitions and layout mode. */
              getSnapshot() {
                return publicSnapshot()
              }

              /**
               * Subscribe to definition changes.
               * @param listener - receiver of the next snapshots.
               * @returns the unsubscribe function.
               */
              subscribe(listener) {
                if (typeof listener !== 'function') return () => {}
                serviceListeners.add(listener)
                return () => { serviceListeners.delete(listener) }
              }
            }
            new WorkspaceCategoriesService(ctx)
          } catch (error) {
            console.warn('workspace-categories: read-only service registration failed:', error)
          }
        }

        /* ---------------- feedback ---------------- */

        /** Create the polite live region this activation announces through. */
        function ensureAnnouncer() {
          if (announcerNode !== null || disposed || typeof document === 'undefined') return
          const node = element('div', PREFIX + 'sr-only')
          node.setAttribute('role', 'status')
          node.setAttribute('aria-live', 'polite')
          node.setAttribute('aria-atomic', 'true')
          document.body.appendChild(node)
          announcerNode = node
        }

        /**
         * Read one short message to screen readers. Repeats still announce,
         * because the region is cleared before the next message lands.
         * @param message - the message, already localized.
         */
        function announce(message) {
          if (disposed || message === '') return
          ensureAnnouncer()
          if (announcerNode === null) return
          announcerNode.textContent = ''
          if (announceFrame !== 0) cancelAnimationFrame(announceFrame)
          announceFrame = requestAnimationFrame(() => {
            announceFrame = 0
            if (disposed || announcerNode === null) return
            announcerNode.textContent = message
          })
        }

        /**
         * Scroll one category into view when it landed outside the seat.
         * @param categoryId - the category to reveal.
         */
        function revealCategory(categoryId) {
          const header = headerNodes.get(categoryId)
          if (header === undefined) return
          if (typeof header.scrollIntoView !== 'function') return
          try {
            header.scrollIntoView({ block: 'nearest' })
          } catch {
            /* older engines: no options object */
          }
        }

        /* ---------------- state mutations ---------------- */

        /** @returns a fresh stable category id. */
        function nextCategoryId() {
          return 'cat-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
        }

        /** @returns the next palette color for a new category. */
        function nextCategoryColor() {
          return PALETTE[state.categories.length % PALETTE.length]
        }

        /**
         * Make one category name unique among the current definitions.
         * @param base - preferred name.
         * @returns the unique display name.
         */
        function uniqueCategoryName(base) {
          const used = new Set(state.categories.map(category => category.name))
          if (!used.has(base)) return base
          for (let index = 2; index < 100; index++) {
            const candidate = base + ' ' + String(index)
            if (!used.has(candidate)) return candidate
          }
          return base
        }

        /**
         * Find one category by id.
         * @param categoryId - id to resolve.
         * @returns the category, or undefined.
         */
        function categoryOf(categoryId) {
          return state.categories.find(category => category.id === categoryId)
        }

        /**
         * Find the category that owns one Workspace.
         * @param workspaceId - Workspace to resolve.
         * @returns the owning category, or undefined.
         */
        function categoryOfWorkspace(workspaceId) {
          return state.categories.find(category => category.workspaceIds.includes(workspaceId))
        }

        /**
         * Add one category and start its inline name edit.
         * @returns the new category.
         */
        function createCategory() {
          const category = {
            id: nextCategoryId(),
            name: uniqueCategoryName(t('defaultCategoryName')),
            color: nextCategoryColor(),
            workspaceIds: [],
            collapsed: false,
          }
          state.categories.push(category)
          save()
          reconcileNow()
          revealCategory(category.id)
          startInlineRename(category.id)
          announce(t('createdCategory'))
          return category
        }

        /**
         * Rename one category.
         * @param categoryId - target category.
         * @param name - new display name.
         */
        function renameCategory(categoryId, name) {
          const category = categoryOf(categoryId)
          if (category === undefined) return
          const next = normalizeName(name, category.name)
          if (next === category.name) return
          category.name = next
          save()
          reconcileNow()
        }

        /**
         * Change one category's theme color.
         * @param categoryId - target category.
         * @param color - `#rrggbb` color.
         */
        function setCategoryColor(categoryId, color) {
          const category = categoryOf(categoryId)
          const next = normalizeColor(color)
          if (category === undefined || next === undefined || category.color === next) return
          category.color = next
          save()
          reconcileNow()
          refreshColorSurfaces()
        }

        /**
         * Collapse or expand one category band.
         * @param categoryId - target category.
         * @param collapsed - whether its member cards should hide.
         */
        function setCategoryCollapsed(categoryId, collapsed) {
          const category = categoryOf(categoryId)
          if (category === undefined || category.collapsed === collapsed) return
          category.collapsed = collapsed
          closePopover()
          save()
          reconcileNow()
          announce(collapsed ? t('collapsedNow', { name: category.name }) : t('expandedNow', { name: category.name }))
        }

        /**
         * Delete one category; its Workspaces return to the uncategorized tail.
         * @param categoryId - target category.
         */
        function deleteCategory(categoryId) {
          const index = state.categories.findIndex(category => category.id === categoryId)
          if (index < 0) return
          const name = state.categories[index].name
          state.categories.splice(index, 1)
          const remaining = state.categories[index] ?? state.categories[index - 1]
          closePopover()
          if (editing !== null && editing.categoryId === categoryId) finishInlineRename(false)
          save()
          reconcileNow()
          /* Removing the focused subtree would drop focus to the document; hand
           * it to the neighbour, or to the button that creates a new one. */
          const next = remaining === undefined ? undefined : headerNodes.get(remaining.id)
          if (next !== undefined) next.focus({ preventScroll: true })
          else if (addButton !== null) addButton.focus({ preventScroll: true })
          announce(t('deletedCategory', { name }))
        }

        /**
         * File one Workspace under one category, removing it from every other.
         * @param categoryId - destination category.
         * @param workspaceId - Workspace to file.
         */
        function assignWorkspace(categoryId, workspaceId) {
          if (workspaceId === '' || categoryOf(categoryId) === undefined) return
          let changed = false
          for (const category of state.categories) {
            const index = category.workspaceIds.indexOf(workspaceId)
            if (category.id === categoryId) {
              if (index < 0) {
                category.workspaceIds.push(workspaceId)
                changed = true
              }
            } else if (index >= 0) {
              category.workspaceIds.splice(index, 1)
              changed = true
            }
          }
          if (!changed) return
          const destination = categoryOf(categoryId)
          if (destination !== undefined) destination.collapsed = false
          save()
          reconcileNow()
          revealCategory(categoryId)
          const filed = categoryOf(categoryId)
          if (filed !== undefined) announce(t('filedInto', { name: filed.name }))
        }

        /**
         * Remove one Workspace from every category.
         * @param workspaceId - Workspace to expose in the uncategorized tail.
         */
        function unassignWorkspace(workspaceId) {
          let changed = false
          for (const category of state.categories) {
            const index = category.workspaceIds.indexOf(workspaceId)
            if (index < 0) continue
            category.workspaceIds.splice(index, 1)
            changed = true
          }
          if (!changed) return
          save()
          reconcileNow()
          announce(t('unfiled'))
        }

        /**
         * Remove category membership of Workspaces the Host no longer lists.
         * Runs only once the authoritative Workspace snapshot is ready, so a
         * loading profile never clears saved membership.
         */
        function pruneWorkspaces() {
          const snapshot = safeSnapshot(() => ctx.workspaces.list.getSnapshot())
          if (snapshot === undefined || snapshot === null || snapshot.phase !== 'ready') return
          const items = Array.isArray(snapshot.items) ? snapshot.items : []
          if (items.length === 0) return
          const known = new Set()
          for (const item of items) {
            if (item !== null && typeof item === 'object' && typeof item.workspaceId === 'string') known.add(item.workspaceId)
          }
          let changed = false
          for (const category of state.categories) {
            const next = category.workspaceIds.filter(workspaceId => known.has(workspaceId))
            if (next.length === category.workspaceIds.length) continue
            category.workspaceIds = next
            changed = true
          }
          if (changed) save()
        }

        /**
         * Read one observable snapshot without letting a transient service
         * fault break the decoration.
         * @param read - snapshot reader.
         * @returns the snapshot, or undefined when it cannot be read.
         */
        function safeSnapshot(read) {
          try {
            return read()
          } catch (error) {
            console.warn('workspace-categories: reading Client state failed:', error)
            return undefined
          }
        }

        /* ---------------- region and list discovery ---------------- */

        /**
         * Find the tree list this half can address: a `role="tree"` list whose
         * direct children include shipped Workspace group sections. The search
         * results tree and the flat session list fail that test, so the
         * category UI never touches them.
         * @param currentRegion - the browsing region.
         * @returns the tree list element, or null.
         */
        /**
         * Whether one direct child of a tree list is a Workspace section.
         *
         * The shipped section carries a CSS-module class whose hash changes
         * between builds, so the class is only a fast path: the durable shape is
         * "the section's own header row is its direct child". Using both keeps
         * the plugin working across a Harness upgrade that renames the class.
         * @param node - candidate element.
         * @returns true for a Workspace section.
         */
        function isSectionNode(node) {
          if (node === null || node === undefined) return false
          if (!(node instanceof Element)) return false
          if (localClass(node, 'groupSection')) return true
          if (node.querySelector(':scope > ' + WORKSPACE_ROW_SELECTOR) !== null) return true
          /* The ungrouped bucket has session rows but no Workspace header row.
           * A flat list's children are session rows themselves, and search
           * results carry no row key, so neither can be mistaken for a bucket. */
          if (node.getAttribute(ROW_KEY_ATTRIBUTE) !== null) return false
          return node.querySelector(':scope > [data-row-key^="session:"]') !== null
        }

        function findSessionList(currentRegion) {
          const area = currentRegion.querySelector(LIST_AREA_SELECTOR)
          if (area === null) return null
          for (const candidate of area.querySelectorAll('[role="tree"]')) {
            for (const child of candidate.children) {
              if (isSectionNode(child)) return candidate
            }
          }
          return null
        }

        /**
         * Whether the rendered tree nests child Workspaces under parents.
         * Categories cannot lift a nested child out of its parent's subtree
         * without moving React's nodes, so the tree view gets the block cards
         * but no category bands.
         * @param list - the tree list.
         * @returns true for the nested Workspace tree.
         */
        function isNestedTree(list) {
          for (const section of list.children) {
            if (!isSectionNode(section)) continue
            /* The shipped tree indents descendants through this custom property;
             * a nested section also holds more than one Workspace header row. */
            const indent = section.style.getPropertyValue('--dsh-workspace-indent').trim()
            if (indent !== '' && indent !== '0px' && indent !== '0') return true
            if (section.querySelectorAll(WORKSPACE_ROW_SELECTOR).length > 1) return true
          }
          return false
        }

        /**
         * Read the per-Workspace section elements and their Workspace ids.
         * The ungrouped bucket keeps the empty string as its id.
         * @param list - the tree list.
         * @returns the sections in DOM (shipped Workspace) order.
         */
        function readSections(list) {
          const rows = []
          for (const child of list.children) {
            if (!isSectionNode(child)) continue
            const header = child.querySelector(WORKSPACE_ROW_SELECTOR)
            const key = header === null ? '' : (header.getAttribute(ROW_KEY_ATTRIBUTE) ?? '')
            const id = key.startsWith(ROW_KEY_PREFIX) ? key.slice(ROW_KEY_PREFIX.length) : ''
            rows.push({ element: child, id })
          }
          return rows
        }

        /**
         * Find the shipped section header's action cluster.
         * @param header - the region's section header.
         * @returns the action cluster element, or null.
         */
        function findActions(header) {
          for (const child of header.children) {
            if (localClass(child, 'headerActions')) return child
          }
          for (const child of header.querySelectorAll('div')) {
            if (localClass(child, 'headerActions')) return child
          }
          return null
        }

        /**
         * Whether the region is currently in its collapsed rail form, where the
         * list is not rendered and a category button would have nothing to act on.
         * @param header - the region's section header.
         * @returns true for the rail layout.
         */
        function inRail(header) {
          for (let current = header; current !== null; current = current.parentElement) {
            if (localClass(current, 'rail')) return true
            if (current === region) break
          }
          /* A renamed CSS module would hide the rail class; the rail is also
           * simply the narrow form of the region. */
          if (region !== null) {
            const width = region.getBoundingClientRect().width
            if (width > 0 && width < 160) return true
          }
          return false
        }

        /* ---------------- injected section-header button ---------------- */

        /** @returns the button that creates a category. */
        function createAddButton() {
          const node = makeButton(PREFIX + 'add-button', t('addCategory'))
          node.title = t('addCategory') + ' — ' + t('addCategoryHint')
          node.appendChild(categoryIcon())
          node.addEventListener('click', (event) => {
            event.preventDefault()
            event.stopPropagation()
            createCategory()
          })
          return node
        }

        /**
         * The outermost control wrapper of the shipped add-workspace control:
         * the last foreign button inside the action cluster, lifted to the
         * cluster's direct child so the new button can sit right of it.
         * @param actions - the action cluster.
         * @returns the wrapper element, or null when the cluster is empty.
         */
        function lastActionWrapper(actions) {
          let last = null
          for (const candidate of actions.querySelectorAll('button')) {
            if (candidate === addButton) continue
            last = candidate
          }
          if (last === null) return null
          let wrapper = last
          while (wrapper.parentElement !== null && wrapper.parentElement !== actions) wrapper = wrapper.parentElement
          return wrapper.parentElement === actions ? wrapper : null
        }

        /**
         * Insert or re-place the category button right of the add-workspace
         * control, widening the cluster the first time.
         * @param actions - the action cluster.
         */
        function placeAddButton(actions) {
          const anchor = lastActionWrapper(actions)
          if (anchor === null) {
            if (addButton.parentElement !== actions) actions.appendChild(addButton)
            return
          }
          if (addButton.parentElement !== actions || addButton.previousElementSibling !== anchor) {
            actions.insertBefore(addButton, anchor.nextSibling)
          }
        }

        /**
         * Reconcile the section-header button against the current layout.
         * @param header - the region's section header, or null when unmounted.
         * @param supported - whether the current list shape supports categories.
         */
        function reconcileAddButton(header, supported) {
          if (header === null) {
            removeAddButton()
            return
          }
          const actions = findActions(header)
          if (actions === null) {
            removeAddButton()
            return
          }
          if (actionsElement !== actions) {
            removeAddButton()
            actionsElement = actions
          }
          actions.classList.add(ACTIONS_CLASS)
          const visible = supported && !inRail(header)
          if (addButton === null) {
            if (!visible) return
            addButton = createAddButton()
          }
          addButton.hidden = !visible
          if (visible) {
            const label = t('addCategory')
            if (addButton.getAttribute('aria-label') !== label) {
              addButton.setAttribute('aria-label', label)
              addButton.title = label + ' — ' + t('addCategoryHint')
            }
            placeAddButton(actions)
          }
        }

        /** Detach the injected button. */
        function removeAddButton() {
          if (addButton !== null) {
            addButton.remove()
            addButton = null
          }
          if (actionsElement !== null) {
            actionsElement.classList.remove(ACTIONS_CLASS)
            actionsElement = null
          }
        }

        /* ---------------- category paint ---------------- */

        /**
         * Derive the CSS custom properties that paint one category identity.
         * The `-dark` set is selected by `body[data-ds-dark-theme]` in the
         * stylesheet, so one paint write covers both appearances.
         * @param color - `#rrggbb` color.
         * @returns custom-property name to value.
         */
        function colorProperties(color) {
          const value = normalizeColor(color) ?? PALETTE[0]
          const red = Number.parseInt(value.slice(1, 3), 16)
          const green = Number.parseInt(value.slice(3, 5), 16)
          const blue = Number.parseInt(value.slice(5, 7), 16)
          const alpha = amount => `rgba(${red}, ${green}, ${blue}, ${amount})`
          return {
            '--dsh-wsc-color': value,
            '--dsh-wsc-tint': alpha(0.07),
            '--dsh-wsc-tint-strong': alpha(0.16),
            '--dsh-wsc-line': alpha(0.26),
            '--dsh-wsc-line-strong': alpha(0.46),
            '--dsh-wsc-halo': alpha(0.22),
            '--dsh-wsc-chip': alpha(0.16),
            '--dsh-wsc-tint-dark': alpha(0.13),
            '--dsh-wsc-tint-strong-dark': alpha(0.24),
            '--dsh-wsc-line-dark': alpha(0.32),
            '--dsh-wsc-line-strong-dark': alpha(0.56),
            '--dsh-wsc-halo-dark': alpha(0.28),
            '--dsh-wsc-chip-dark': alpha(0.22),
          }
        }

        /**
         * Apply one category's paint properties to a node.
         * @param node - header, band, drop area, or member card.
         * @param color - `#rrggbb` color.
         */
        function paint(node, color) {
          for (const [name, value] of Object.entries(colorProperties(color))) node.style.setProperty(name, value)
        }

        /**
         * Remove every paint property from one node.
         * @param node - the node to clean.
         */
        function unpaint(node) {
          for (const name of Object.keys(colorProperties(PALETTE[0]))) node.style.removeProperty(name)
        }

        /**
         * Set one flex `order` value only when it changes.
         * @param node - flex item.
         * @param ordinal - order value.
         */
        function setOrder(node, ordinal) {
          const value = String(ordinal)
          if (node.style.order !== value) node.style.order = value
        }

        /**
         * Clear the category identity of one Workspace section, keeping its flex
         * order (the tail loop assigns that separately).
         * @param node - the Workspace section.
         */
        function clearMemberStyle(node) {
          node.removeAttribute(MEMBER_ATTRIBUTE)
          node.removeAttribute(DROP_ATTRIBUTE)
          node.removeAttribute(COLLAPSED_ATTRIBUTE)
          node.classList.remove(PREFIX + 'member-last')
          unpaint(node)
        }

        /**
         * Mark one Workspace section with the shape the stylesheet addresses.
         * @param node - the section element.
         * @param kind - 'member' (inside a category) or 'plain' (uncategorized).
         */
        function markSection(node, kind) {
          node.setAttribute(SECTION_ATTRIBUTE, kind)
        }

        /**
         * Clear every presentation marker this half puts on one Workspace section.
         * @param node - the Workspace section.
         */
        function resetSection(node) {
          if (node.getAttribute(OWNER_ATTRIBUTE) !== instanceToken) return
          clearMemberStyle(node)
          node.style.removeProperty('order')
          node.removeAttribute(SECTION_ATTRIBUTE)
          node.removeAttribute(OWNER_ATTRIBUTE)
        }

        /* ---------------- header nodes ---------------- */

        /**
         * Build the category header: grip, collapse chevron, identity dot,
         * editable name, member count, and the actions menu trigger.
         * @param category - the category definition.
         * @returns the header element.
         */
        function buildHeader(category) {
          const header = element('div', PREFIX + 'cat-header')
          header.setAttribute(CAT_ATTRIBUTE, category.id)
          header.setAttribute('role', 'group')
          /* Focusable so the collapse state and the order are reachable without
           * a pointer; the inner controls keep their own tab stops. */
          header.tabIndex = 0
          header.addEventListener('keydown', (event) => {
            if (event.target !== header) return
            if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
              event.preventDefault()
              setCategoryCollapsed(category.id, category.collapsed !== true)
              return
            }
            if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
              event.preventDefault()
              moveCategoryBy(category.id, event.key === 'ArrowUp' ? -1 : 1)
            }
          })
          paint(header, category.color)

          const grip = element('span', PREFIX + 'grip')
          grip.setAttribute('role', 'button')
          grip.setAttribute('tabindex', '0')
          grip.setAttribute('aria-label', t('grip'))
          grip.title = t('grip') + ' — ' + t('gripHint')
          grip.draggable = true
          grip.appendChild(gripIcon())
          grip.addEventListener('keydown', (event) => {
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
            event.preventDefault()
            event.stopPropagation()
            moveCategoryBy(category.id, event.key === 'ArrowUp' ? -1 : 1)
          })
          grip.addEventListener('dragstart', (event) => {
            if (event.dataTransfer !== null) {
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData(CATEGORY_MIME, category.id)
              event.dataTransfer.setData('text/plain', CATEGORY_MIME + ':' + category.id)
            }
            beginDrag({ kind: 'category', categoryId: category.id }, header)
          })
          grip.addEventListener('dragend', () => { endDrag() })

          const collapse = makeButton(PREFIX + 'collapse-button', t('collapse'))
          collapse.setAttribute('aria-expanded', String(category.collapsed !== true))
          collapse.appendChild(chevronIcon())
          collapse.addEventListener('click', (event) => {
            event.preventDefault()
            event.stopPropagation()
            setCategoryCollapsed(category.id, category.collapsed !== true)
          })

          const dotButton = makeButton(PREFIX + 'dot-button', t('editorColor'))
          dotButton.setAttribute('aria-expanded', 'false')
          dotButton.setAttribute('aria-haspopup', 'dialog')
          dotButton.appendChild(element('span', PREFIX + 'dot'))
          dotButton.addEventListener('click', (event) => {
            event.preventDefault()
            event.stopPropagation()
            togglePopover('color', category.id, dotButton)
          })

          const name = element('span', PREFIX + 'name')
          name.textContent = category.name
          name.title = t('renameHint')
          name.addEventListener('dblclick', (event) => {
            event.preventDefault()
            event.stopPropagation()
            startInlineRename(category.id)
          })

          const count = element('span', PREFIX + 'count')
          count.textContent = '0'

          const menu = makeButton(PREFIX + 'icon-button', t('categoryMenu'))
          menu.setAttribute('aria-expanded', 'false')
          menu.setAttribute('aria-haspopup', 'menu')
          menu.appendChild(moreIcon())
          menu.addEventListener('click', (event) => {
            event.preventDefault()
            event.stopPropagation()
            togglePopover('menu', category.id, menu)
          })

          header.appendChild(grip)
          header.appendChild(collapse)
          header.appendChild(dotButton)
          header.appendChild(name)
          header.appendChild(count)
          header.appendChild(menu)

          header.addEventListener('click', (event) => {
            if (dragState !== null) return
            const target = event.target
            if (!(target instanceof Element)) return
            if (target.closest('button, input, [draggable="true"]') !== null) return
            /* A click on the band dismisses its own surface; with no surface it
             * toggles the band, like a shipped Workspace row folds its Sessions. */
            if (popover !== null && popover.categoryId === category.id) {
              closePopover()
              return
            }
            /* The name is the rename gesture's target (double click); leave it out
             * of the collapse toggle so a rename never flashes the band. */
            if (target.closest('.' + PREFIX + 'name') !== null) return
            setCategoryCollapsed(category.id, category.collapsed !== true)
          })
          header.addEventListener('dragover', (event) => { onHeaderDragOver(event, header) })
          header.addEventListener('dragleave', (event) => { onDropTargetLeave(event, header) })
          header.addEventListener('drop', (event) => { onHeaderDrop(event, header) })
          return header
        }

        /**
         * Return the category header for one definition, creating and appending
         * it when needed.
         * @param list - the tree list.
         * @param category - the category definition.
         * @returns the header element.
         */
        function ensureHeader(list, category) {
          let header = headerNodes.get(category.id)
          if (header === undefined) {
            header = buildHeader(category)
            headerNodes.set(category.id, header)
          }
          if (header.parentElement !== list) list.appendChild(header)
          return header
        }

        /**
         * Return the tinted container layer of one category band, creating and
         * appending it when needed. The band sits behind the header and the
         * member cards, so their own surfaces read as layers inside one block.
         * @param list - the tree list.
         * @param category - the category definition.
         * @returns the band element.
         */
        function ensureBand(list, category) {
          let band = bandNodes.get(category.id)
          if (band === undefined) {
            band = element('div', PREFIX + 'band')
            band.setAttribute(CAT_ATTRIBUTE, category.id)
            band.setAttribute('aria-hidden', 'true')
            band.setAttribute('draggable', 'true')
            bandNodes.set(category.id, band)
          }
          if (band.parentElement !== list) list.appendChild(band)
          return band
        }

        /**
         * Update one category header's paint, copy, and control states.
         * @param header - the header element.
         * @param category - the category definition.
         * @param memberCount - rendered member Workspaces.
         */
        function updateHeader(header, category, memberCount) {
          paint(header, category.color)
          const dot = header.querySelector('.' + PREFIX + 'dot')
          if (dot !== null) dot.style.background = category.color
          const name = header.querySelector('.' + PREFIX + 'name')
          if (name !== null) {
            if (name.title !== t('renameHint')) name.title = t('renameHint')
            if (!(editing !== null && editing.categoryId === category.id) && name.textContent !== category.name) {
              name.textContent = category.name
            }
          }
          const count = header.querySelector('.' + PREFIX + 'count')
          if (count !== null) {
            const text = String(memberCount)
            if (count.textContent !== text) count.textContent = text
            count.title = t('countTitle', { n: memberCount })
          }
          header.setAttribute('aria-label', t('categoryAria', { name: category.name, n: memberCount }))
          const grip = header.querySelector('.' + PREFIX + 'grip')
          if (grip !== null) {
            const label = t('grip')
            const hint = label + ' — ' + t('gripHint')
            if (grip.getAttribute('aria-label') !== label) {
              grip.setAttribute('aria-label', label)
              grip.title = hint
            }
          }
          const collapsed = category.collapsed === true
          if (collapsed) header.setAttribute(COLLAPSED_ATTRIBUTE, '')
          else header.removeAttribute(COLLAPSED_ATTRIBUTE)
          const collapse = header.querySelector('.' + PREFIX + 'collapse-button')
          if (collapse !== null) {
            collapse.setAttribute('aria-expanded', String(!collapsed))
            const label = collapsed ? t('expand') : t('collapse')
            if (collapse.getAttribute('aria-label') !== label) {
              collapse.setAttribute('aria-label', label)
              collapse.title = label
            }
          }
          const colorOpen = popover !== null && popover.kind === 'color' && popover.categoryId === category.id
          const menuOpen = popover !== null && popover.kind === 'menu' && popover.categoryId === category.id
          const dotButton = header.querySelector('.' + PREFIX + 'dot-button')
          if (dotButton !== null) {
            dotButton.setAttribute('aria-expanded', String(colorOpen))
            dotButton.setAttribute('aria-label', t('editorColor'))
            dotButton.title = t('editorColor')
          }
          const menuButton = header.querySelector('.' + PREFIX + 'icon-button')
          if (menuButton !== null) {
            menuButton.setAttribute('aria-expanded', String(menuOpen))
            menuButton.setAttribute('aria-label', t('categoryMenu'))
            menuButton.title = t('categoryMenu')
          }
        }

        /**
         * Return the empty drop area for one category, creating and appending
         * it when needed.
         * @param list - the tree list.
         * @param category - the category definition.
         * @returns the drop area element.
         */
        function ensureEmptyArea(list, category) {
          let node = emptyNodes.get(category.id)
          if (node === undefined) {
            node = element('div', PREFIX + 'cat-empty')
            node.setAttribute(CAT_ATTRIBUTE, category.id)
            node.setAttribute('role', 'presentation')
            node.setAttribute('draggable', 'true')
            node.textContent = t('emptyCategory')
            emptyNodes.set(category.id, node)
          }
          if (node.parentElement !== list) list.appendChild(node)
          return node
        }

        /**
         * Return the Uncategorized divider, creating and appending it when needed.
         * @param list - the tree list.
         * @returns the divider element.
         */
        function ensureDivider(list) {
          if (dividerNode === null) {
            dividerNode = element('div', PREFIX + 'divider')
            dividerNode.setAttribute('role', 'presentation')
            dividerNode.appendChild(element('span', PREFIX + 'divider-line'))
            const label = element('span', PREFIX + 'divider-label')
            label.textContent = t('uncategorized')
            dividerNode.appendChild(label)
            dividerNode.appendChild(element('span', PREFIX + 'divider-line'))
          }
          if (dividerNode.parentElement !== list) list.appendChild(dividerNode)
          return dividerNode
        }

        /** Remove every category node from the page. */
        function clearCategoryNodes() {
          for (const node of bandNodes.values()) node.remove()
          bandNodes.clear()
          for (const node of headerNodes.values()) node.remove()
          headerNodes.clear()
          for (const node of emptyNodes.values()) node.remove()
          emptyNodes.clear()
          if (dividerNode !== null) {
            dividerNode.remove()
            dividerNode = null
          }
        }

        /* ---------------- floating surfaces ---------------- */

        /**
         * Position one floating surface against its anchor, using the shipped
         * menu rhythm (4px below, 12px viewport edge) and flipping above when
         * the lower half has no room.
         * @param surface - the fixed-position element.
         * @param anchor - the control it belongs to.
         */
        function placeSurface(surface, anchor) {
          const rect = anchor.getBoundingClientRect()
          const width = surface.offsetWidth
          const height = surface.offsetHeight
          let left = rect.left
          let top = rect.bottom + POPOVER_GAP
          if (left + width > window.innerWidth - POPOVER_EDGE) left = window.innerWidth - width - POPOVER_EDGE
          if (left < POPOVER_EDGE) left = POPOVER_EDGE
          if (top + height > window.innerHeight - POPOVER_EDGE) top = rect.top - height - POPOVER_GAP
          if (top < POPOVER_EDGE) top = POPOVER_EDGE
          surface.style.left = String(Math.round(left)) + 'px'
          surface.style.top = String(Math.round(top)) + 'px'
        }

        /**
         * Wrap content into the shipped translucent menu surface.
         * @param variant - 'menu' or 'color'.
         * @param label - accessible name.
         * @returns the fixed-position surface with a material layer.
         */
        function createSurface(variant, label) {
          const surface = element('div', PREFIX + 'pop ' + PREFIX + 'pop-' + variant)
          surface.setAttribute('role', variant === 'menu' ? 'menu' : 'dialog')
          surface.setAttribute('aria-label', label)
          surface.addEventListener('pointerdown', (event) => { event.stopPropagation() })
          surface.addEventListener('mousedown', (event) => { event.stopPropagation() })
          surface.addEventListener('contextmenu', (event) => { event.preventDefault() })
          return surface
        }

        /**
         * Close the open floating surface and return focus to its trigger.
         */
        function closePopover() {
          if (popover === null) return
          const current = popover
          popover = null
          current.dismiss()
          current.surface.remove()
          if (current.anchor.isConnected) {
            current.anchor.setAttribute('aria-expanded', 'false')
          }
          syncChrome()
        }

        /**
         * Open the category actions menu: rename, separator, delete.
         * @param categoryId - the category the menu acts on.
         * @param anchor - the three-dot trigger.
         */
        function openMenuPopover(categoryId, anchor) {
          const category = categoryOf(categoryId)
          if (category === undefined) return
          const surface = createSurface('menu', t('categoryMenu'))
          let armed = false
          const addItem = (icon, label, danger, run) => {
            const item = document.createElement('button')
            item.type = 'button'
            item.className = PREFIX + 'menu-item'
            item.setAttribute('role', 'menuitem')
            if (danger === true) item.setAttribute('data-danger', 'true')
            const iconWrap = element('span', PREFIX + 'menu-icon')
            iconWrap.appendChild(icon)
            const text = element('span')
            text.textContent = label
            item.appendChild(iconWrap)
            item.appendChild(text)
            item.addEventListener('click', () => { run(item, text) })
            surface.appendChild(item)
            return { item, text }
          }
          addItem(editIcon(), t('menuRename'), false, () => {
            closePopover()
            startInlineRename(category.id)
            schedule()
          })
          const separator = element('div', PREFIX + 'menu-sep')
          separator.setAttribute('role', 'separator')
          surface.appendChild(separator)
          addItem(trashIcon(), t('menuDelete'), true, (item, text) => {
            if (!armed) {
              armed = true
              item.setAttribute('data-armed', 'true')
              text.textContent = t('menuDeleteConfirm')
              return
            }
            deleteCategory(category.id)
          })
          const items = () => Array.from(surface.querySelectorAll('[role="menuitem"]'))
          surface.addEventListener('keydown', (event) => {
            const list = items()
            if (list.length === 0) return
            const current = list.indexOf(document.activeElement)
            let next = null
            if (event.key === 'ArrowDown') next = (current + 1 + list.length) % list.length
            else if (event.key === 'ArrowUp') next = (current - 1 + list.length) % list.length
            else if (event.key === 'Home') next = 0
            else if (event.key === 'End') next = list.length - 1
            else if (event.key === 'Tab') {
              event.preventDefault()
              closePopover()
              if (typeof anchor.focus === 'function') anchor.focus()
              return
            }
            if (next === null) return
            event.preventDefault()
            list[next].focus()
          })
          presentSurface(surface, 'menu', categoryId, anchor, surface.querySelector('[role="menuitem"]'))
        }

        /**
         * Open the color-only palette: the macOS Finder tag colors, matching the
         * shipped menu's surface and row geometry.
         * @param categoryId - the category to recolor.
         * @param anchor - the identity-dot trigger.
         */
        function openColorPopover(categoryId, anchor) {
          const category = categoryOf(categoryId)
          if (category === undefined) return
          const surface = createSurface('color', t('colorPanel'))
          const grid = element('div', PREFIX + 'swatches')
          const currentColor = () => categoryOf(categoryId)?.color ?? category.color
          const sync = () => {
            for (const swatch of Array.from(grid.children)) {
              swatch.setAttribute('aria-pressed', String(swatch.dataset.color === currentColor()))
            }
          }
          for (const color of PALETTE) {
            const swatch = makeButton(PREFIX + 'swatch', color)
            swatch.dataset.color = color
            swatch.style.background = color
            swatch.addEventListener('click', () => {
              setCategoryColor(categoryId, color)
              sync()
            })
            grid.appendChild(swatch)
          }
          sync()
          const label = element('span', PREFIX + 'panel-label')
          label.textContent = t('editorColor')
          surface.appendChild(label)
          surface.appendChild(grid)
          surface.addEventListener('keydown', (event) => {
            const list = Array.from(grid.children)
            if (list.length === 0) return
            const current = list.indexOf(document.activeElement)
            const column = PALETTE_COLUMNS
            let next = null
            if (event.key === 'ArrowRight') next = (current + 1 + list.length) % list.length
            else if (event.key === 'ArrowLeft') next = (current - 1 + list.length) % list.length
            else if (event.key === 'ArrowDown') next = Math.min(current + column, list.length - 1)
            else if (event.key === 'ArrowUp') next = Math.max(current - column, 0)
            else if (event.key === 'Home') next = 0
            else if (event.key === 'End') next = list.length - 1
            else if (event.key === 'Tab') {
              event.preventDefault()
              closePopover()
              if (typeof anchor.focus === 'function') anchor.focus()
              return
            }
            if (next === null) return
            event.preventDefault()
            const target = list[next]
            if (target !== undefined) target.focus()
          })
          presentSurface(surface, 'color', categoryId, anchor, grid.firstElementChild)
          colorSyncers.add(sync)
        }

        /** Live palette synchronizers of the open color surface. */
        const colorSyncers = new Set()

        /** Re-sync a palette after a color change made elsewhere. */
        function refreshColorSurfaces() {
          for (const sync of [...colorSyncers]) {
            try {
              sync()
            } catch {
              colorSyncers.delete(sync)
            }
          }
        }

        /**
         * Attach one built surface to the page, anchor it, and arm dismissal.
         * @param surface - the surface element.
         * @param kind - 'menu' or 'color'.
         * @param categoryId - the category it edits.
         * @param anchor - the trigger control.
         * @param focus - element that should take focus, if any.
         */
        function presentSurface(surface, kind, categoryId, anchor, focus) {
          closePopover()
          // macOS Desktop (0.2.2-rc.1+) only auto-excludes controls inside
          // `data-window-drag` rows; a body portal must declare its own region.
          surface.setAttribute('data-window-drag-exclude', '')
          document.body.appendChild(surface)
          placeSurface(surface, anchor)
          const onPointerDown = (event) => {
            const target = event.target
            if (!(target instanceof Node)) return
            if (surface.contains(target)) return
            if (anchor.contains(target)) return
            const header = headerNodes.get(categoryId)
            if (header !== undefined && header.contains(target)) return
            closePopover()
          }
          const onKeyDown = (event) => {
            if (event.key !== 'Escape') return
            event.preventDefault()
            event.stopPropagation()
            closePopover()
            if (typeof anchor.focus === 'function') anchor.focus()
          }
          const onViewportChange = () => {
            if (!anchor.isConnected) {
              closePopover()
              return
            }
            placeSurface(surface, anchor)
          }
          document.addEventListener('pointerdown', onPointerDown, true)
          document.addEventListener('keydown', onKeyDown, true)
          document.addEventListener('scroll', onViewportChange, true)
          window.addEventListener('resize', onViewportChange)
          popover = {
            kind,
            categoryId,
            surface,
            anchor,
            dismiss() {
              colorSyncers.clear()
              document.removeEventListener('pointerdown', onPointerDown, true)
              document.removeEventListener('keydown', onKeyDown, true)
              document.removeEventListener('scroll', onViewportChange, true)
              window.removeEventListener('resize', onViewportChange)
            },
          }
          anchor.setAttribute('aria-expanded', 'true')
          syncChrome()
          if (focus !== null && focus !== undefined) {
            requestAnimationFrame(() => {
              if (popover === null || popover.surface !== surface || !focus.isConnected) return
              focus.focus({ preventScroll: true })
            })
          }
        }

        /**
         * Toggle one floating surface for one category.
         * @param kind - 'menu' or 'color'.
         * @param categoryId - target category.
         * @param anchor - the trigger control.
         */
        function togglePopover(kind, categoryId, anchor) {
          if (popover !== null && popover.kind === kind && popover.categoryId === categoryId) {
            closePopover()
            return
          }
          if (kind === 'menu') openMenuPopover(categoryId, anchor)
          else openColorPopover(categoryId, anchor)
        }

        /* ---------------- inline header rename ---------------- */

        /**
         * Edit one category name in place inside its header.
         * @param categoryId - target category.
         */
        function startInlineRename(categoryId) {
          const category = categoryOf(categoryId)
          const header = headerNodes.get(categoryId)
          if (category === undefined || header === undefined) return
          if (editing !== null) finishInlineRename(true)
          const name = header.querySelector('.' + PREFIX + 'name')
          if (name === null) return
          const input = element('input', PREFIX + 'name-input')
          input.type = 'text'
          input.maxLength = NAME_MAX_LENGTH
          input.value = category.name
          editing = { categoryId, input, name, header }
          name.textContent = ''
          name.appendChild(input)
          input.addEventListener('keydown', (event) => {
            event.stopPropagation()
            if (event.key === 'Enter') {
              event.preventDefault()
              finishInlineRename(true)
            } else if (event.key === 'Escape') {
              event.preventDefault()
              finishInlineRename(false)
            }
          })
          input.addEventListener('blur', () => { finishInlineRename(true) })
          input.setAttribute('draggable', 'false')
          input.addEventListener('pointerdown', (event) => { event.stopPropagation() })
          input.addEventListener('dblclick', (event) => { event.stopPropagation() })
          input.focus()
          input.select()
        }

        /**
         * Close the inline header rename editor.
         * @param commit - whether to keep the draft name.
         */
        function finishInlineRename(commit) {
          if (editing === null) return
          const session = editing
          editing = null
          const category = categoryOf(session.categoryId)
          const draft = commit ? normalizeName(session.input.value, '') : ''
          session.input.remove()
          if (session.header.isConnected && typeof session.header.focus === 'function') {
            session.header.focus({ preventScroll: true })
          }
          const restored = category === undefined ? '' : category.name
          session.name.textContent = commit && draft !== '' ? draft : restored
          if (commit && category !== undefined && draft !== '' && draft !== category.name) renameCategory(category.id, draft)
          else schedule()
        }

        /* ---------------- drag state ---------------- */

        /**
         * Begin one drag; document-level class flags reveal the drop targets.
         * @param next - the drag identity.
         * @param source - the dragged node, when the drag starts from this half.
         */
        function beginDrag(next, source) {
          if (disposed) return
          closePopover()
          dragState = next
          dropSignature = null
          clearDropMarkers()
          document.body.classList.toggle(BODY_DRAG_WORKSPACE, next.kind === 'workspace')
          document.body.classList.toggle(BODY_DRAG_CATEGORY, next.kind === 'category')
          if (source !== undefined) source.setAttribute(DRAGGING_ATTRIBUTE, '')
          syncDragLabels()
        }

        /** End the current drag and clear every transient marker. */
        function endDrag() {
          const hadDrag = dragState !== null
          dragState = null
          dropSignature = null
          document.body.classList.remove(BODY_DRAG_WORKSPACE, BODY_DRAG_CATEGORY)
          clearDropMarkers()
          for (const header of headerNodes.values()) header.removeAttribute(DRAGGING_ATTRIBUTE)
          if (hadDrag) syncDragLabels()
        }

        /** Remove the insert and drop markers from every target. */
        function clearDropMarkers() {
          for (const header of headerNodes.values()) {
            header.removeAttribute(DROP_ATTRIBUTE)
            header.removeAttribute(INSERT_ATTRIBUTE)
          }
          for (const node of bandNodes.values()) {
            node.removeAttribute(DROP_ATTRIBUTE)
            node.removeAttribute(INSERT_ATTRIBUTE)
          }
          for (const node of emptyNodes.values()) node.removeAttribute(DROP_ATTRIBUTE)
          if (dividerNode !== null) dividerNode.removeAttribute(DROP_ATTRIBUTE)
          if (listElement !== null) {
            for (const child of listElement.children) child.removeAttribute(DROP_ATTRIBUTE)
          }
        }

        /** Refresh the copy that changes while a drag is in flight. */
        /**
         * Whether the drag can be taken out of a category, i.e. it is a
         * Workspace that currently belongs to one.
         * @returns true when the Uncategorized zone removes something.
         */
        function dragCanLeaveCategory() {
          return dragState !== null && dragState.kind === 'workspace'
            && categoryOfWorkspace(dragState.workspaceId) !== undefined
        }

        function syncDragLabels() {
          const workspaceDrag = dragState !== null && dragState.kind === 'workspace'
          for (const node of emptyNodes.values()) {
            const text = workspaceDrag ? t('emptyCategoryDrop') : t('emptyCategory')
            if (node.textContent !== text) node.textContent = text
          }
          if (dividerNode !== null) {
            const label = dividerNode.querySelector('.' + PREFIX + 'divider-label')
            if (label !== null) {
              const text = dragCanLeaveCategory() ? t('dividerDrop') : t('uncategorized')
              if (label.textContent !== text) label.textContent = text
            }
          }
        }

        /**
         * Vertical half of a category's whole block — header, painted band and
         * member cards — so dropping on the lower cards inserts after the
         * category, never "inside" it.
         * @param categoryId - the target category.
         * @param clientY - pointer viewport position.
         * @returns 'before' or 'after'.
         */
        function categoryBlockHalf(categoryId, clientY) {
          const header = headerNodes.get(categoryId)
          if (header === undefined) return 'after'
          const top = header.getBoundingClientRect().top
          let bottom = header.getBoundingClientRect().bottom
          const band = bandNodes.get(categoryId)
          if (band !== undefined) {
            const rect = band.getBoundingClientRect()
            if (rect.height > 0) bottom = Math.max(bottom, rect.bottom)
          }
          return clientY < top + (bottom - top) / 2 ? 'before' : 'after'
        }

        /**
         * Whether one node is a surface this half injected into the list.
         * @param node - candidate node.
         * @returns true for an owned list child.
         */
        function isOwnNode(node) {
          if (!(node instanceof Element)) return false
          if (node.getAttribute(CAT_ATTRIBUTE) !== null) return true
          return localClass(node, PREFIX + 'cat-header')
            || localClass(node, PREFIX + 'band')
            || localClass(node, PREFIX + 'cat-empty')
            || localClass(node, PREFIX + 'divider')
        }

        /** Remove the insertion marker from every category. */
        function clearInsertMarkers() {
          for (const header of headerNodes.values()) header.removeAttribute(INSERT_ATTRIBUTE)
          for (const band of bandNodes.values()) band.removeAttribute(INSERT_ATTRIBUTE)
        }

        /**
         * Draw the insertion marker on one category's painted band: its top edge
         * means "insert before", its bottom edge means "insert after".
         * @param categoryId - the target category.
         * @param half - insertion side.
         */
        function setInsertMarker(categoryId, half) {
          clearInsertMarkers()
          const band = bandNodes.get(categoryId)
          if (band !== undefined) band.setAttribute(INSERT_ATTRIBUTE, half)
          const header = headerNodes.get(categoryId)
          if (header !== undefined) header.setAttribute(INSERT_ATTRIBUTE, half)
        }

        /**
         * Nearest category insertion point for a pointer that lands in a gap
         * between two bands, so a category drag is never silently dropped.
         * @param clientY - pointer viewport position.
         * @returns the nearest category and insertion side, or null.
         */
        function categoryAtPoint(clientY) {
          if (listElement === null) return null
          let best = null
          let bestDelta = Infinity
          for (const category of state.categories) {
            const header = headerNodes.get(category.id)
            if (header === undefined) continue
            const headerRect = header.getBoundingClientRect()
            if (headerRect.height === 0) continue
            let bottom = headerRect.bottom
            const band = bandNodes.get(category.id)
            if (band !== undefined) {
              const bandRect = band.getBoundingClientRect()
              if (bandRect.height > 0) bottom = Math.max(bottom, bandRect.bottom)
            }
            const middle = headerRect.top + (bottom - headerRect.top) / 2
            const delta = Math.abs(clientY - middle)
            if (delta < bestDelta) {
              bestDelta = delta
              best = { categoryId: category.id, half: clientY < middle ? 'before' : 'after' }
            }
          }
          return best
        }

        /**
         * Whether one element is contained by another (and is not the container).
         * @param ancestor - candidate ancestor.
         * @param node - candidate descendant.
         * @returns true when contained.
         */
        function contains(ancestor, node) {
          return node !== null && node !== ancestor && ancestor.contains(node)
        }

        /* ---------------- category drop-target classification ---------------- */

        /**
         * Classify one DOM node as a Workspace drop destination.
         * @param node - the event target.
         * @returns a category band, the Uncategorized divider, or null.
         */
        function classifyDropTarget(node) {
          if (node === null) return null
          const categoryNode = node.closest('[' + CAT_ATTRIBUTE + ']')
          if (categoryNode !== null) {
            const categoryId = categoryNode.getAttribute(CAT_ATTRIBUTE)
            if (categoryId !== null && categoryId !== '') return { kind: 'category', categoryId }
          }
          if (node.closest('.' + PREFIX + 'divider') !== null) return { kind: 'uncategorized' }
          const section = node.closest('[' + SECTION_ATTRIBUTE + ']') ?? node.closest('[class*="groupSection"]')
          if (section !== null) {
            const memberId = section.getAttribute(MEMBER_ATTRIBUTE)
            if (memberId !== null && memberId !== '') return { kind: 'category', categoryId: memberId }
          }
          return null
        }

        /**
         * Resolve the category band (or divider) geometrically, for pointer
         * positions that land in the gaps between a band's painted surfaces.
         * @param clientY - pointer viewport position.
         * @returns a category band, the Uncategorized divider, or null.
         */
        function bandAtPoint(clientY) {
          if (listElement === null) return null
          let lastCategoryBottom = -Infinity
          for (const category of state.categories) {
            const nodes = []
            const header = headerNodes.get(category.id)
            if (header !== undefined) nodes.push(header)
            const empty = emptyNodes.get(category.id)
            if (empty !== undefined) nodes.push(empty)
            for (const child of listElement.children) {
              if (child.getAttribute(MEMBER_ATTRIBUTE) === category.id) nodes.push(child)
            }
            let top = Infinity
            let bottom = -Infinity
            for (const node of nodes) {
              const rect = node.getBoundingClientRect()
              if (rect.height === 0) continue
              top = Math.min(top, rect.top)
              bottom = Math.max(bottom, rect.bottom)
            }
            if (top === Infinity) continue
            lastCategoryBottom = Math.max(lastCategoryBottom, bottom)
            if (clientY >= top - 5 && clientY <= bottom + 5) {
              return { kind: 'category', categoryId: category.id }
            }
          }
          /* Everything below the last category band is the uncategorized zone:
           * its divider, its Workspace cards, and the space under them. */
          if (lastCategoryBottom !== -Infinity && clientY > lastCategoryBottom + 4) {
            return { kind: 'uncategorized' }
          }
          return null
        }

        /**
         * Resolve the Workspace drop destination at one drag event.
         * @param event - the drag event.
         * @returns the destination, or null.
         */
        function destinationAt(event) {
          const target = event.target
          if (!(target instanceof Element)) return null
          if (listElement === null || !listElement.contains(target)) return null
          const direct = classifyDropTarget(target)
          if (direct !== null) return direct
          return bandAtPoint(event.clientY)
        }

        /**
         * Resolve the uncategorized destination: while a categorized Workspace
         * is dragged, everything at or below the Uncategorized divider (the
         * divider, any uncategorized Workspace card, the empty space under the
         * list) takes it back out of its category.
         * @param event - the drag event.
         * @returns the uncategorized destination, or null.
         */
        function uncategorizedAt(event) {
          if (dragState === null || dragState.kind !== 'workspace') return null
          if (dividerNode === null || listElement === null) return null
          const source = categoryOfWorkspace(dragState.workspaceId)
          if (source === undefined) return null
          const target = event.target
          if (!(target instanceof Element) || !listElement.contains(target)) return null
          const threshold = dividerNode.getBoundingClientRect().top - 4
          return event.clientY >= threshold ? { kind: 'uncategorized' } : null
        }

        /**
         * Whether one drag may drop on one resolved destination.
         * @param destination - the resolved destination.
         * @param workspaceId - the dragged Workspace.
         * @returns true when the drop would change something.
         */
        function destinationAccepts(destination, workspaceId) {
          const source = categoryOfWorkspace(workspaceId)
          if (destination.kind === 'uncategorized') return source !== undefined
          return source === undefined || source.id !== destination.categoryId
        }

        /**
         * Paint one resolved drop destination, skipping redundant writes.
         * @param destination - the destination, or null to clear.
         */
        function markDropTarget(destination) {
          const signature = destination === null ? '' : destination.kind + ':' + (destination.categoryId ?? '')
          if (signature === dropSignature) return
          dropSignature = signature
          for (const header of headerNodes.values()) header.removeAttribute(DROP_ATTRIBUTE)
          for (const node of bandNodes.values()) node.removeAttribute(DROP_ATTRIBUTE)
          for (const node of emptyNodes.values()) node.removeAttribute(DROP_ATTRIBUTE)
          if (dividerNode !== null) dividerNode.removeAttribute(DROP_ATTRIBUTE)
          if (listElement !== null) {
            for (const child of listElement.children) child.removeAttribute(DROP_ATTRIBUTE)
          }
          if (destination === null) return
          if (destination.kind === 'uncategorized') {
            if (dividerNode !== null) dividerNode.setAttribute(DROP_ATTRIBUTE, 'true')
            if (listElement !== null) {
              for (const child of listElement.children) {
                if (child.getAttribute(SECTION_ATTRIBUTE) === 'plain') {
                  child.setAttribute(DROP_ATTRIBUTE, 'true')
                }
              }
            }
            return
          }
          const band = bandNodes.get(destination.categoryId)
          if (band !== undefined) band.setAttribute(DROP_ATTRIBUTE, 'true')
          const header = headerNodes.get(destination.categoryId)
          if (header !== undefined) header.setAttribute(DROP_ATTRIBUTE, 'true')
          const empty = emptyNodes.get(destination.categoryId)
          if (empty !== undefined) empty.setAttribute(DROP_ATTRIBUTE, 'true')
          if (listElement !== null) {
            for (const child of listElement.children) {
              if (child.getAttribute(MEMBER_ATTRIBUTE) === destination.categoryId) child.setAttribute(DROP_ATTRIBUTE, 'true')
            }
          }
        }

        /* ---------------- drag handlers ---------------- */

        /**
         * Dragover handling for a category header: category reordering only.
         * Workspace filing is handled by the document-level capture listener so
         * a drop works anywhere on the band.
         * @param event - the drag event.
         * @param node - the drop target.
         */
        function onHeaderDragOver(event, node) {
          if (dragState === null || dragState.kind !== 'category') return
          const categoryId = node.getAttribute(CAT_ATTRIBUTE)
          if (categoryId === null || categoryId === dragState.categoryId) return
          event.preventDefault()
          event.stopPropagation()
          if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'move'
          setInsertMarker(categoryId, categoryBlockHalf(categoryId, event.clientY))
        }

        /**
         * Clear one target's markers when the pointer leaves it.
         * @param event - the drag event.
         * @param node - the drop target.
         */
        function onDropTargetLeave(event, node) {
          if (event.relatedTarget !== null && contains(node, event.relatedTarget)) return
          node.removeAttribute(DROP_ATTRIBUTE)
          node.removeAttribute(INSERT_ATTRIBUTE)
          const categoryId = node.getAttribute(CAT_ATTRIBUTE)
          if (categoryId !== null) {
            const band = bandNodes.get(categoryId)
            if (band !== undefined) band.removeAttribute(INSERT_ATTRIBUTE)
          }
        }

        /**
         * Drop handling for a category header: category reordering.
         * @param event - the drag event.
         * @param node - the drop target.
         */
        function onHeaderDrop(event, node) {
          if (dragState === null || dragState.kind !== 'category') return
          const categoryId = node.getAttribute(CAT_ATTRIBUTE)
          if (categoryId === null) return
          event.preventDefault()
          event.stopPropagation()
          const sourceId = dragState.categoryId
          const half = categoryBlockHalf(categoryId, event.clientY)
          endDrag()
          reorderCategory(sourceId, categoryId, half)
        }

        /**
         * Move one category by a number of steps. The keyboard path into the
         * same order the drag path writes.
         * @param categoryId - the category to move.
         * @param delta - negative to move up, positive to move down.
         */
        function moveCategoryBy(categoryId, delta) {
          const from = state.categories.findIndex(category => category.id === categoryId)
          if (from < 0) return
          const to = from + delta
          if (to < 0 || to >= state.categories.length) {
            announce(t('movedEdge'))
            return
          }
          const [category] = state.categories.splice(from, 1)
          state.categories.splice(to, 0, category)
          save()
          reconcileNow()
          announce(delta < 0 ? t('movedUp') : t('movedDown'))
          const header = headerNodes.get(categoryId)
          if (header !== undefined) {
            const grip = header.querySelector('.' + PREFIX + 'grip')
            if (grip !== null && typeof grip.focus === 'function') grip.focus({ preventScroll: true })
          }
        }

        /**
         * Move one category relative to another.
         * @param sourceId - dragged category.
         * @param targetId - category the pointer is over.
         * @param half - insertion side.
         */
        function reorderCategory(sourceId, targetId, half) {
          if (sourceId === targetId) return
          const from = state.categories.findIndex(category => category.id === sourceId)
          if (from < 0) return
          const [category] = state.categories.splice(from, 1)
          let to = state.categories.findIndex(candidate => candidate.id === targetId)
          if (to < 0) {
            state.categories.splice(from, 0, category)
            return
          }
          if (half === 'after') to += 1
          state.categories.splice(to, 0, category)
          save()
          reconcileNow()
          /* One extra frame catches late reflow (scrollbar, webfont) so the
           * measured bands always describe the final layout. */
          schedule()
        }

        /**
         * Document-level `dragstart`: remember Workspace and category drags so
         * the injected drop targets can tell an allowed drag from any other.
         * @param event - the drag event.
         */
        function onDocumentDragStart(event) {
          if (disposed) return
          const target = event.target
          if (!(target instanceof Element)) return
          if (region === null || !region.contains(target)) return
          const grip = target.closest('.' + PREFIX + 'grip')
          if (grip !== null) {
            const header = grip.closest('[' + CAT_ATTRIBUTE + ']')
            const categoryId = header === null ? null : header.getAttribute(CAT_ATTRIBUTE)
            if (categoryId !== null && categoryId !== '') beginDrag({ kind: 'category', categoryId }, header ?? undefined)
            return
          }
          const categoryNode = target.closest('[' + CAT_ATTRIBUTE + ']')
          if (categoryNode !== null) {
            const categoryId = categoryNode.getAttribute(CAT_ATTRIBUTE)
            if (categoryId !== null && categoryId !== '') {
              if (event.dataTransfer !== null) {
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData(CATEGORY_MIME, categoryId)
                event.dataTransfer.setData('text/plain', CATEGORY_MIME + ':' + categoryId)
              }
              beginDrag({ kind: 'category', categoryId }, headerNodes.get(categoryId))
              return
            }
          }
          const row = target.closest(WORKSPACE_ROW_SELECTOR)
          if (row === null) return
          const key = row.getAttribute(ROW_KEY_ATTRIBUTE) ?? ''
          const workspaceId = key.startsWith(ROW_KEY_PREFIX) ? key.slice(ROW_KEY_PREFIX.length) : ''
          if (workspaceId === '') return
          beginDrag({ kind: 'workspace', workspaceId })
        }

        /**
         * Document-level capture `dragover`: classify the destination while a
         * drag is in flight. Workspace drags are intercepted only when they land
         * on a category band; category drags only when they land on another
         * category. Everything else falls through to the shipped reordering.
         * @param event - the drag event.
         */
        function onDocumentDragOver(event) {
          if (disposed) return
          if (dragState === null) return
          if (listElement === null || !listElement.isConnected) return
          const destination = destinationAt(event) ?? uncategorizedAt(event)
          if (dragState.kind === 'category') {
            const target = event.target
            if (!(target instanceof Element) || !listElement.contains(target)) {
              clearInsertMarkers()
              return
            }
            let insertion = null
            if (destination !== null && destination.kind === 'category') {
              insertion = { categoryId: destination.categoryId, half: categoryBlockHalf(destination.categoryId, event.clientY) }
            } else {
              insertion = categoryAtPoint(event.clientY)
            }
            if (insertion === null || insertion.categoryId === dragState.categoryId
              || !headerNodes.has(insertion.categoryId)) {
              clearInsertMarkers()
              return
            }
            event.preventDefault()
            event.stopPropagation()
            if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'move'
            setInsertMarker(insertion.categoryId, insertion.half)
            return
          }
          if (destination === null) {
            markDropTarget(null)
            return
          }
          if (!destinationAccepts(destination, dragState.workspaceId)) {
            markDropTarget(null)
            return
          }
          event.preventDefault()
          event.stopPropagation()
          if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'move'
          markDropTarget(destination)
        }

        /**
         * Document-level capture `drop`: commit the category assignment or the
         * category reorder the pointer landed on.
         * @param event - the drop event.
         */
        function onDocumentDrop(event) {
          if (disposed) return
          if (dragState === null) return
          const destination = destinationAt(event) ?? uncategorizedAt(event)
          if (dragState.kind === 'category') {
            const target = event.target
            if (listElement === null || !(target instanceof Element) || !listElement.contains(target)) return
            let insertion = null
            if (destination !== null && destination.kind === 'category') {
              insertion = { categoryId: destination.categoryId, half: categoryBlockHalf(destination.categoryId, event.clientY) }
            } else {
              insertion = categoryAtPoint(event.clientY)
            }
            if (insertion === null || insertion.categoryId === dragState.categoryId) return
            if (!headerNodes.has(insertion.categoryId)) return
            event.preventDefault()
            event.stopPropagation()
            const sourceId = dragState.categoryId
            endDrag()
            reorderCategory(sourceId, insertion.categoryId, insertion.half)
            return
          }
          if (destination === null) return
          const workspaceId = dragState.workspaceId
          if (!destinationAccepts(destination, workspaceId)) return
          event.preventDefault()
          event.stopPropagation()
          markDropTarget(null)
          endDrag()
          if (destination.kind === 'uncategorized') unassignWorkspace(workspaceId)
          else assignWorkspace(destination.categoryId, workspaceId)
        }

        /**
         * Tear this activation down. Idempotent and exception-isolated: a client
         * hot reload can replace the module without Cordis tearing the old fiber
         * down, and one failing step must not leave half of the page decorated.
         * @param reason - short label used in diagnostics.
         */
        function disposeInstance(reason) {
          if (disposed) return
          disposed = true
          const attempt = (step) => {
            try {
              step()
            } catch (error) {
              console.warn('workspace-categories: cleanup step failed (' + reason + '):', error)
            }
          }
          attempt(() => { if (frame !== 0) { cancelAnimationFrame(frame); frame = 0 } })
          attempt(() => { if (seamTimer !== 0) { clearTimeout(seamTimer); seamTimer = 0 } })
          attempt(() => { if (domObserver !== null) { domObserver.disconnect(); domObserver = null } })
          attempt(() => removeDragListeners())
          attempt(() => endDrag())
          attempt(() => {
            observeListSize(null)
            if (listResizeObserver !== null) {
              listResizeObserver.disconnect()
              listResizeObserver = null
            }
          })
          attempt(() => closePopover())
          attempt(() => detachAll())
          attempt(() => { if (styleElement !== null) { styleElement.remove(); styleElement = null } })
          attempt(() => { if (unsubscribeWorkspaces !== null) { unsubscribeWorkspaces(); unsubscribeWorkspaces = null } })
          attempt(() => { if (removeViewportListener !== null) { removeViewportListener(); removeViewportListener = null } })
          attempt(() => { if (unsubscribeLocale !== null) { unsubscribeLocale(); unsubscribeLocale = null } })
          attempt(() => {
            const fiber = localeScopeFiber
            localeScopeFiber = null
            if (fiber !== null && typeof fiber.dispose === 'function') {
              const result = fiber.dispose()
              if (result !== undefined && result !== null && typeof result.catch === 'function') result.catch(() => {})
            }
          })
          attempt(() => {
            if (pageWindow !== undefined && pageWindow[INSTANCE_KEY] === instanceApi) {
              delete pageWindow[INSTANCE_KEY]
            }
          })
        }

        instanceApi = { dispose: disposeInstance }
        if (pageWindow !== undefined) pageWindow[INSTANCE_KEY] = instanceApi

        /** Install the document-level drag listeners once. */
        function installDragListeners() {
          if (disposed || dragListening) return
          dragListening = true
          document.addEventListener('dragstart', onDocumentDragStart, true)
          document.addEventListener('dragover', onDocumentDragOver, true)
          document.addEventListener('drop', onDocumentDrop, true)
          document.addEventListener('dragend', endDrag)
          document.addEventListener('drop', endDrag)
          window.addEventListener('blur', endDrag)
        }

        /** Remove the document-level drag listeners. */
        function removeDragListeners() {
          if (!dragListening) return
          dragListening = false
          document.removeEventListener('dragstart', onDocumentDragStart, true)
          document.removeEventListener('dragover', onDocumentDragOver, true)
          document.removeEventListener('drop', onDocumentDrop, true)
          document.removeEventListener('dragend', endDrag)
          document.removeEventListener('drop', endDrag)
          window.removeEventListener('blur', endDrag)
        }

        /* ---------------- layout ---------------- */

        /**
         * Position one category band behind its header and visible members.
         * Geometry is read from border boxes relative to the list, so scrolling
         * the list seat never moves it.
         * @param band - the band element.
         * @param header - the category header.
         * @param members - the rendered member sections (collapsed ones excluded).
         * @param empty - the empty drop area, when rendered.
         */
        function placeBand(band, header, members, empty) {
          if (listElement === null) return
          const listRect = listElement.getBoundingClientRect()
          const headerRect = header.getBoundingClientRect()
          if (headerRect.height === 0) return
          let bottom = headerRect.bottom
          let hasContent = false
          for (const member of members) {
            const rect = member.element.getBoundingClientRect()
            if (rect.height === 0) continue
            bottom = Math.max(bottom, rect.bottom)
            hasContent = true
          }
          if (empty !== undefined && empty !== null) {
            const rect = empty.getBoundingClientRect()
            if (rect.height > 0) {
              bottom = Math.max(bottom, rect.bottom)
              hasContent = true
            }
          }
          const top = Math.max(0, headerRect.top - listRect.top)
          const trailingInset = hasContent ? 4 : 0
          const height = Math.max(0, bottom - headerRect.top) + trailingInset
          band.style.top = String(Math.round(top)) + 'px'
          band.style.height = String(Math.round(height)) + 'px'
        }

        /**
         * Apply the category bands, the layered member cards, and the collapse
         * state to the grouped list.
         * @param list - the tree list.
         * @param sections - the read sections.
         */
        function applyCategoryLayout(list, sections) {
          const memberOf = new Map()
          for (const category of state.categories) {
            for (const workspaceId of category.workspaceIds) {
              if (!memberOf.has(workspaceId)) memberOf.set(workspaceId, category)
            }
          }

          /* Pre-pass: identity, collapse state, and last-member insets must be
           * in place before any band geometry is measured. */
          const membersOf = new Map()
          const counts = new Map()
          for (const row of sections) {
            row.element.setAttribute(OWNER_ATTRIBUTE, instanceToken)
            if (row.id === '' || row.id === undefined) {
              clearMemberStyle(row.element)
              markSection(row.element, 'plain')
              continue
            }
            const category = memberOf.get(row.id)
            if (category === undefined) {
              clearMemberStyle(row.element)
              markSection(row.element, 'plain')
              continue
            }
            markSection(row.element, 'member')
            row.element.setAttribute(MEMBER_ATTRIBUTE, category.id)
            if (category.collapsed === true) row.element.setAttribute(COLLAPSED_ATTRIBUTE, '')
            else row.element.removeAttribute(COLLAPSED_ATTRIBUTE)
            paint(row.element, category.color)
            const bucket = membersOf.get(category.id)
            if (bucket === undefined) membersOf.set(category.id, [row])
            else bucket.push(row)
            counts.set(category.id, (counts.get(category.id) ?? 0) + 1)
          }
          /* Toggle the inset class only when it actually changes: the observer
           * watches `class`, so remove-then-add on every pass would re-arm the
           * observer forever and turn reconciliation into a frame-rate loop. */
          for (const category of state.categories) {
            const bucket = membersOf.get(category.id)
            if (bucket === undefined || bucket.length === 0) continue
            const last = category.collapsed === true ? null : bucket[bucket.length - 1]
            for (const row of bucket) row.element.classList.toggle(PREFIX + 'member-last', row === last)
          }

          /* Retire the nodes of removed categories before anything is measured,
           * so a stale header cannot shift the layout of the bands below it. */
          const liveCategoryIds = new Set(state.categories.map(category => category.id))
          for (const [categoryId, header] of [...headerNodes]) {
            if (liveCategoryIds.has(categoryId)) continue
            if (editing !== null && editing.categoryId === categoryId) {
              editing.input.remove()
              editing = null
            }
            header.remove()
            headerNodes.delete(categoryId)
          }
          for (const [categoryId, band] of [...bandNodes]) {
            if (liveCategoryIds.has(categoryId)) continue
            band.remove()
            bandNodes.delete(categoryId)
          }
          for (const [categoryId, empty] of [...emptyNodes]) {
            if (liveCategoryIds.has(categoryId)) continue
            empty.remove()
            emptyNodes.delete(categoryId)
          }

          /* Drop any stale frame that is not one of this activation's nodes: a
           * leaked earlier instance (or a failed teardown) can leave orphaned
           * headers/bands behind even after the start-up sweep. */
          const ownNodes = new Set([...headerNodes.values(), ...bandNodes.values(), ...emptyNodes.values()])
          if (dividerNode !== null) ownNodes.add(dividerNode)
          for (const child of [...list.children]) {
            if (!(child instanceof Element)) continue
            const pluginNode = localClass(child, PREFIX + 'cat-header') || localClass(child, PREFIX + 'band')
              || localClass(child, PREFIX + 'cat-empty') || localClass(child, PREFIX + 'divider')
            if (pluginNode && !ownNodes.has(child)) child.remove()
          }

          /* Phase 1: identity, copy, and flow order for every node. No geometry
           * is read here, so all categories are ordered before the first band is
           * measured; otherwise a band can be sized against a half-reordered
           * list and end up wrapping a neighbouring category. */
          const placements = []
          let ordinal = 10
          for (const category of state.categories) {
            const header = ensureHeader(list, category)
            const band = ensureBand(list, category)
            updateHeader(header, category, counts.get(category.id) ?? 0)
            paint(band, category.color)
            setOrder(header, ordinal)
            ordinal += 10
            const collapsed = category.collapsed === true
            const members = membersOf.get(category.id) ?? []
            const visibleMembers = collapsed ? [] : members
            let empty = emptyNodes.get(category.id)
            if (!collapsed && visibleMembers.length === 0) {
              empty = ensureEmptyArea(list, category)
              paint(empty, category.color)
              setOrder(empty, ordinal)
              ordinal += 10
            } else if (empty !== undefined) {
              empty.remove()
              emptyNodes.delete(category.id)
              empty = undefined
            }
            for (const member of visibleMembers) {
              setOrder(member.element, ordinal)
              ordinal += 10
            }
            placements.push({ band, header, members: visibleMembers, empty, collapsed })
          }

          if (state.categories.length > 0) {
            const divider = ensureDivider(list)
            setOrder(divider, ordinal)
            ordinal += 10
          } else if (dividerNode !== null) {
            dividerNode.remove()
            dividerNode = null
          }

          const ordered = new Set()
          for (const row of sections) {
            ordered.add(row.element)
            if (row.id !== '' && memberOf.has(row.id)) continue
            setOrder(row.element, ordinal)
            ordinal += 10
          }
          /* A child the section reader could not classify (for example after a
           * markup change) must still be ordered below the categories instead
           * of keeping flex's default `order: 0`. */
          for (const child of list.children) {
            if (ordered.has(child)) continue
            if (isOwnNode(child)) continue
            setOrder(child, ordinal)
            ordinal += 10
          }

          /* Phase 2: measure the settled layout once per band. */
          for (const placement of placements) {
            placeBand(
              placement.band,
              placement.header,
              placement.collapsed === true ? [] : placement.members,
              placement.empty,
            )
          }

          syncDragLabels()
        }

        /**
         * Remove the category bands from the nested tree view while keeping the
         * per-Workspace block cards.
         * @param list - the tree list.
         * @param sections - the read sections.
         */
        function clearCategoryLayout(list, sections) {
          closePopover()
          clearCategoryNodes()
          for (const row of sections) {
            /* The tree view has no bands, but it keeps the per-Workspace block
             * cards, so the sections still have to be claimed and marked. */
            row.element.setAttribute(OWNER_ATTRIBUTE, instanceToken)
            clearMemberStyle(row.element)
            row.element.style.removeProperty('order')
            markSection(row.element, 'plain')
          }
        }

        /* ---------------- reconciliation ---------------- */

        /**
         * Reconcile the page against the current store and layout. Idempotent:
         * it only writes what differs, so the MutationObserver's follow-up pass
         * settles immediately.
         */
        function reconcile() {
          if (disposed) return
          const currentRegion = document.querySelector(REGION_SELECTOR)
          region = currentRegion
          if (currentRegion === null || !currentRegion.isConnected) {
            detachAll()
            return
          }
          const header = currentRegion.querySelector(HEADER_SELECTOR)
          const list = header === null ? null : findSessionList(currentRegion)
          if (list === null) {
            // The region and its header are there but the list seam is not: either
            // the sidebar is still mounting, or its markup changed shape. Decide
            // after a grace period — a boot-time false alarm would be worse than
            // the silence this warning exists to break.
            if (header !== null) scheduleSeamCheck()
            detachList()
            reconcileAddButton(header, false)
            return
          }
          if (seamTimer !== 0) {
            clearTimeout(seamTimer)
            seamTimer = 0
          }
          listElement = list
          list.setAttribute(OWNER_ATTRIBUTE, instanceToken)
          observeListSize(list)
          nestedTree = isNestedTree(list)
          layoutMode = nestedTree ? 'tree' : 'grouped'
          list.classList.add(LIST_CLASS)
          list.setAttribute(LIST_ATTRIBUTE, nestedTree ? 'tree' : 'grouped')
          list.classList.toggle(FLEX_CLASS, !nestedTree)
          const sections = readSections(list)
          if (nestedTree) clearCategoryLayout(list, sections)
          else applyCategoryLayout(list, sections)
          reconcileAddButton(header, !nestedTree)
          if (popover !== null) {
            if (!popover.anchor.isConnected || categoryOf(popover.categoryId) === undefined) closePopover()
          }
          syncChrome()
        }

        /**
         * Observe the current list for size changes. Reflows that no mutation
         * reports (font size changes, animation settle) still move the bands.
         * @param list - the tree list, or null to stop observing.
         */
        function observeListSize(list) {
          if (observedList === list) return
          if (listResizeObserver === null) {
            if (typeof ResizeObserver !== 'function') return
            listResizeObserver = new ResizeObserver(() => schedule())
          }
          listResizeObserver.disconnect()
          observedList = list
          if (list !== null) listResizeObserver.observe(list)
        }

        /** Reconcile immediately, cancelling a pending frame. */
        function reconcileNow() {
          if (disposed) return
          if (frame !== 0) {
            cancelAnimationFrame(frame)
            frame = 0
          }
          reconcile()
        }

        /** Schedule one reconciliation on the next frame. */
        function schedule() {
          if (disposed) return
          if (frame !== 0) return
          frame = requestAnimationFrame(() => {
            frame = 0
            reconcile()
          })
        }

        /** Warn once when the shipped sidebar no longer exposes the list seam. */
        let seamWarned = false
        let seamTimer = 0
        function scheduleSeamCheck() {
          if (seamWarned || seamTimer !== 0) return
          seamTimer = setTimeout(() => {
            seamTimer = 0
            if (disposed || seamWarned) return
            const current = document.querySelector(REGION_SELECTOR)
            if (current === null || !current.isConnected) return
            const area = current.querySelector(LIST_AREA_SELECTOR)
            if (area === null) return
            // An empty or still-loading sidebar has no Workspace rows: not a change.
            if (area.querySelector('[data-row-key^="workspace:"]') === null) return
            if (findSessionList(current) !== null) return
            seamWarned = true
            console.warn('[workspace-categories] the sidebar list seam changed (data-sidebar-list-area / role="tree" / groupSection), so the category UI is disabled; this plugin needs an update for this DSH version')
          }, 3000)
        }

        /** Detach the managed list state, leaving the shipped DOM untouched. */
        function detachList() {
          closePopover()
          observeListSize(null)
          if (listElement !== null) {
            const sections = readSections(listElement)
            for (const row of sections) resetSection(row.element)
            if (listElement.getAttribute(OWNER_ATTRIBUTE) === instanceToken) {
              listElement.classList.remove(LIST_CLASS, FLEX_CLASS)
              listElement.removeAttribute(LIST_ATTRIBUTE)
              listElement.removeAttribute(OWNER_ATTRIBUTE)
            }
            listElement = null
          }
          for (const node of bandNodes.values()) node.remove()
          bandNodes.clear()
          for (const [categoryId, header] of [...headerNodes]) {
            header.remove()
            headerNodes.delete(categoryId)
          }
          if (editing !== null) editing = null
          for (const [categoryId, node] of [...emptyNodes]) {
            node.remove()
            emptyNodes.delete(categoryId)
          }
          if (dividerNode !== null) {
            dividerNode.remove()
            dividerNode = null
          }
          if (announcerNode !== null) {
            announcerNode.remove()
            announcerNode = null
          }
          if (announceFrame !== 0) {
            cancelAnimationFrame(announceFrame)
            announceFrame = 0
          }
          layoutMode = 'none'
          nestedTree = false
        }

        /** Detach everything this half owns. */
        function detachAll() {
          detachList()
          removeAddButton()
          region = null
        }

        /** Refresh copy that does not depend on a repaint. */
        function syncChrome() {
          if (addButton !== null) {
            const label = t('addCategory')
            if (addButton.getAttribute('aria-label') !== label) {
              addButton.setAttribute('aria-label', label)
              addButton.title = label + ' — ' + t('addCategoryHint')
            }
          }
          for (const node of emptyNodes.values()) {
            if (node.getAttribute(DROP_ATTRIBUTE) === 'true') continue
            const text = dragState !== null && dragState.kind === 'workspace' ? t('emptyCategoryDrop') : t('emptyCategory')
            if (node.textContent !== text) node.textContent = text
          }
          if (dividerNode !== null) {
            const label = dividerNode.querySelector('.' + PREFIX + 'divider-label')
            if (label !== null) {
              const text = dragCanLeaveCategory() ? t('dividerDrop') : t('uncategorized')
              if (label.textContent !== text) label.textContent = text
            }
          }
        }

        /* ---------------- lifecycle ---------------- */

        /* Owned style element. */
        ctx.effect(() => {
          for (const stale of document.querySelectorAll('style#' + STYLE_ID)) stale.remove()
          const style = document.createElement('style')
          style.id = STYLE_ID
          style.textContent = CSS
          document.head.appendChild(style)
          styleElement = style
          return () => {
            if (styleElement === style) styleElement = null
            style.remove()
          }
        }, 'workspace-categories: styles')

        /* Restore the persisted definitions before the first render. */
        const stored = readStore()
        state.categories = stored.categories
        installService()
        installDragListeners()

        /* The locale service can arrive after this plugin mounts: in Desktop the
         * stored language preference is adopted asynchronously. Wait for the
         * service through an injection scope, then register the dictionary and
         * follow every later language change so the whole UI (including text
         * already on screen) stays in the app's language. */
        const setupLocale = (owner) => {
          if (disposed) return
          const scope = owner ?? ctx
          localeService = typeof scope.get === 'function' ? scope.get('locale') : scope.locale
          refreshLocaleCopy()
          if (localeService === undefined || localeService === null) return
          if (typeof localeService.subscribe === 'function') {
            scope.effect(() => {
              unsubscribeLocale = localeService.subscribe(() => { refreshLocaleCopy() })
              return () => {
                if (unsubscribeLocale !== null) {
                  const unsubscribe = unsubscribeLocale
                  unsubscribeLocale = null
                  try { unsubscribe() } catch { /* already gone */ }
                }
              }
            }, 'workspace-categories: locale')
          }
          if (typeof localeService.register === 'function') {
            scope.effect(() => {
              const disposers = []
              for (const [locale, dict] of Object.entries(DICTIONARIES)) {
                try {
                  disposers.push(localeService.register(LOCALE_NAMESPACE, locale, dict))
                } catch (error) {
                  console.warn('workspace-categories: dictionary registration skipped:', error)
                }
              }
              return () => {
                for (const dispose of disposers.reverse()) {
                  try {
                    dispose()
                  } catch {
                    /* a stale registration is already gone */
                  }
                }
              }
            }, 'workspace-categories: dictionaries')
          }
        }
        if (typeof ctx.inject === 'function') localeScopeFiber = ctx.inject(['locale'], setupLocale)
        else setupLocale(ctx)

        /* The authoritative Workspace list prunes membership of deleted Workspaces. */
        ctx.effect(() => {
          unsubscribeWorkspaces = ctx.workspaces.list.subscribe(() => {
            if (disposed) return
            pruneWorkspaces()
            schedule()
          })
          return () => {
            if (unsubscribeWorkspaces !== null) {
              const unsubscribe = unsubscribeWorkspaces
              unsubscribeWorkspaces = null
              try { unsubscribe() } catch { /* already gone */ }
            }
          }
        }, 'workspace-categories: workspace list')

        /* Band geometry follows the sidebar size as well as the row content. */
        ctx.effect(() => {
          const onResize = () => schedule()
          window.addEventListener('resize', onResize)
          removeViewportListener = () => { window.removeEventListener('resize', onResize) }
          return () => {
            if (removeViewportListener !== null) {
              removeViewportListener()
              removeViewportListener = null
            }
          }
        }, 'workspace-categories: viewport')

        /* The sidebar owns the rows: every insert, fold, search, or view change
           inside the region is a DOM mutation worth one reconciliation. The
           observer watches the document so a region that appears, is replaced,
           or comes back after a sidebar collapse is picked up too. */
        ctx.effect(() => {
          const observer = new MutationObserver((records) => {
            if (disposed) return
            const current = document.querySelector(REGION_SELECTOR)
            if (current === null) {
              if (region !== null) {
                region = null
                schedule()
              }
              return
            }
            if (current !== region) {
              region = current
              schedule()
              return
            }
            for (const record of records) {
              if (record.target === current || current.contains(record.target)) {
                schedule()
                return
              }
            }
          })
          // `class` matters: React rewrites row/list className on re-render and on
          // drag state changes, which drops the plugin's marker classes until the
          // next child-list mutation. Reconcile is idempotent, so its own class
          // writes settle after one pass.
          observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
          domObserver = observer
          return () => {
            if (domObserver === observer) domObserver = null
            observer.disconnect()
            if (seamTimer !== 0) {
              clearTimeout(seamTimer)
              seamTimer = 0
            }
          }
        }, 'workspace-categories: sidebar DOM')

        /* Prune once with the initial snapshot, then paint what is already there. */
        pruneWorkspaces()
        reconcileNow()

        /* Teardown: the same takeover-safe disposal a new activation uses. */
        ctx.effect(() => () => { disposeInstance('unload') }, 'workspace-categories: teardown')
      },
    }
  },
})
