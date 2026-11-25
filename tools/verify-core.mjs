#!/usr/bin/env node
/**
 * Verification harness for `@local/dsh-workspace-categories`.
 *
 * The plugin's whole job is to reorganize a live sidebar, so the checks run the
 * **real** `client.js` against a **real DOM** (jsdom) that reproduces the shapes
 * the installed Harness renders: the `data-slot` / `data-sidebar-*` seams, one
 * `role="tree"` seat holding section elements that each start with their
 * `data-row-key="workspace:<id>"` header row, the section header's action
 * cluster, and a session row per Workspace.
 *
 * What is covered:
 *   - the injected button sits right of the shipped add-workspace control;
 *   - create / rename / recolor / collapse / delete a category;
 *   - file a Workspace by dragging it onto the block, move it back out by
 *     dropping it below the Uncategorized divider;
 *   - reorder categories by dragging a header, and by keyboard;
 *   - persistence across a fresh activation, and single-instance takeover when
 *     a hot reload mounts a second copy;
 *   - structural fallback when the shipped CSS-module class name changes;
 *   - Chinese and English copy.
 *
 * The DOM has no layout, so band geometry is asserted structurally (order,
 * membership, attributes), never in pixels. Run: `node tools/verify-core.mjs`
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const pluginDir = join(here, '..')
const require = createRequire(join(pluginDir, 'package.json'))

/* ------------------------------------------------------------------ *
 * Harness
 * ------------------------------------------------------------------ */

const failures = []
let checks = 0

function check(label, condition, detail) {
  checks += 1
  if (condition) return
  failures.push(detail === undefined ? label : `${label} — ${detail}`)
}

function equal(label, actual, expected) {
  check(label, Object.is(actual, expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

function deepEqual(label, actual, expected) {
  const a = JSON.stringify(actual)
  const b = JSON.stringify(expected)
  check(label, a === b, `expected ${b}, got ${a}`)
}

const flush = () => new Promise(resolve => setTimeout(resolve, 8))

/** Load jsdom from the plugin's devDependencies. */
function loadJsdom() {
  const mod = require('jsdom')
  if (mod !== undefined && mod.JSDOM !== undefined) return mod.JSDOM
  throw new Error('jsdom not found — run `npm install` in the plugin directory first')
}

const JSDOM = loadJsdom()

/**
 * Build the shipped sidebar markup the plugin decorates.
 * @param {object} options
 * @param {string[]} options.workspaces - Workspace ids, in shipped order.
 * @param {string} [options.sectionClass] - class the shipped build uses.
 * @param {boolean} [options.nested] - render the nested Workspace tree shape.
 * @returns {string} the markup.
 */
function sidebarMarkup({ workspaces, sectionClass = 'Kjh-qa_groupSection', nested = false }) {
  const indent = nested ? ' style="--dsh-workspace-indent: 12px"' : ' style="--dsh-workspace-indent: 0px"'
  const sections = workspaces.map(id => `
        <div class="${sectionClass}"${indent}>
          <div data-row-key="workspace:${id}" role="treeitem" aria-expanded="true" class="Kjh-qa_projectRow">
            <span class="JoiKIa_projectText">${id}</span>
          </div>
          <div class="Kjh-qa_sessionRow" data-row-key="session:s-${id}" role="treeitem">s-${id}</div>
        </div>`).join('')
  const ungrouped = `
        <div class="${sectionClass}"${indent}>
          <div class="Kjh-qa_sessionRow" data-row-key="session:s-ungrouped" role="treeitem">ungrouped</div>
        </div>`
  return `<!doctype html><html lang="zh"><head></head><body data-ds-dark-theme>
    <div data-slot="sidebar.workspaces" class="Kjh-qa_root">
      <div class="Kjh-qa_sectionHeader" data-sidebar-workspace-header>
        <span class="Kjh-qa_sectionLabel Kjh-qa_wide">工作区</span>
        <div class="Kjh-qa_searchSlot"><div class="Kjh-qa_search"><button type="button" aria-label="搜索会话"></button></div></div>
        <div class="Kjh-qa_headerActions">
          <div class="Kjh-qa_actionWrap"><button type="button" aria-label="视图选项"></button></div>
          <div class="Kjh-qa_actionWrap"><button type="button" aria-label="添加工作区"></button></div>
        </div>
      </div>
      <div class="Kjh-qa_listArea" data-sidebar-list-area>
        <div role="tree" aria-label="会话" class="Kjh-qa_list">
${sections}${ungrouped}
        </div>
      </div>
    </div>
  </body></html>`
}

/**
 * Boot one page: install the browser globals, register the plugin bundle, and
 * return the handles a test needs.
 * @param {object} options
 * @param {string[]} [options.workspaces]
 * @param {string} [options.sectionClass]
 * @param {boolean} [options.nested]
 * @param {string} [options.locale]
 * @param {string} [options.storage] - pre-seeded localStorage blob.
 */
function boot(options = {}) {
  const workspaces = options.workspaces ?? ['alpha', 'beta', 'gamma']
  const dom = new JSDOM(sidebarMarkup({
    workspaces,
    sectionClass: options.sectionClass,
    nested: options.nested,
  }), {
    url: 'https://dsh.test/',
    pretendToBeVisual: true,
  })
  const { window } = dom

  // Browser globals the bundle reaches for unqualified.
  const saved = new Map()
  const install = (name, value) => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name)
    saved.set(name, descriptor)
    try {
      globalThis[name] = value
    } catch {
      // Node's own globals (navigator) are getter-only: redefine them instead.
      Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
    }
  }
  install('window', window)
  install('document', window.document)
  install('Element', window.Element)
  install('Node', window.Node)
  install('MutationObserver', window.MutationObserver)
  install('localStorage', window.localStorage)
  install('sessionStorage', window.sessionStorage)
  install('location', window.location)
  install('navigator', window.navigator)
  install('requestAnimationFrame', callback => window.setTimeout(() => callback(0), 0))
  install('cancelAnimationFrame', handle => window.clearTimeout(handle))
  install('ResizeObserver', class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  })

  if (options.storage !== undefined) window.localStorage.setItem('dsh.workspace.categories.v1', options.storage)

  // The bundle registers through the page-global module loader facade.
  let registration = null
  window.__ModuleLoader__ = { load(entry) { registration = entry } }

  const source = readFileSync(join(pluginDir, 'client.js'), 'utf8')
  const run = new Function('window', source)
  run(window)
  if (registration === null) throw new Error('client.js did not register a bundle')
  const plugin = registration.factory(specifier => {
    if (specifier === '@deepseek-ai/cordis') {
      // The real base class registers through ctx.reflect.provide; the harness
      // only needs the constructor contract to exercise the service face.
      return {
        Service: class Service {
          constructor(ownerCtx, serviceName) {
            this.ctx = ownerCtx
            this.name = serviceName
            if (typeof ownerCtx.provide === 'function') ownerCtx.provide(serviceName, this)
          }
        },
      }
    }
    throw new Error(`unexpected require: ${specifier}`)
  })

  // Service faces the plugin consumes.
  const listeners = new Set()
  const snapshot = {
    phase: 'ready',
    items: workspaces.map(workspaceId => ({ workspaceId, title: workspaceId })),
  }
  const workspacesFace = {
    list: {
      getSnapshot: () => snapshot,
      subscribe: (fn) => {
        listeners.add(fn)
        return () => listeners.delete(fn)
      },
    },
  }
  const localeListeners = new Set()
  const localeFace = {
    getLocale: () => ({ active: options.locale ?? 'zh', locales: [], revision: 1 }),
    getSnapshot: () => ({ active: options.locale ?? 'zh', locales: [], revision: 1 }),
    subscribe: (fn) => {
      localeListeners.add(fn)
      return () => localeListeners.delete(fn)
    },
    register: () => () => {},
    bind: () => (key) => key,
  }

  const disposers = []
  const ctx = {
    get(name) {
      if (name === 'locale') return localeFace
      if (name === 'workspaces') return workspacesFace
      return undefined
    },
    effect(fn) {
      const dispose = fn()
      if (typeof dispose === 'function') disposers.push(dispose)
      return () => {}
    },
    inject(deps, callback) {
      callback(ctx)
      return { dispose() {} }
    },
    workspaces: workspacesFace,
    provide(name, value) {
      this.services ??= new Map()
      this.services.set(name, value)
      return () => {}
    },
  }

  plugin.apply(ctx)

  const cleanup = () => {
    for (const dispose of disposers.reverse()) {
      try { dispose() } catch { /* already gone */ }
    }
    dom.window.close()
    for (const [name, descriptor] of saved) {
      if (descriptor === undefined) delete globalThis[name]
      else Object.defineProperty(globalThis, name, descriptor)
    }
  }

  return {
    dom,
    window,
    document: window.document,
    plugin,
    ctx,
    workspacesFace,
    /** Switch the app language and notify the plugin like the locale service does. */
    setLocale(id) {
      options.locale = id
      for (const fn of [...localeListeners]) fn()
    },
    /** Replace the Workspace snapshot and notify subscribers. */
    setWorkspaces(ids) {
      snapshot.items = ids.map(workspaceId => ({ workspaceId, title: workspaceId }))
      for (const fn of [...listeners]) fn()
    },
    dispose: () => plugin.apply && disposers.length,
    cleanup,
    /** A category store read straight from localStorage. */
    store() {
      const raw = window.localStorage.getItem('dsh.workspace.categories.v1')
      return raw === null ? null : JSON.parse(raw)
    },
  }
}

/* ------------------------------------------------------------------ *
 * Event helpers
 * ------------------------------------------------------------------ */

function mouseEvent(window, type, options = {}) {
  return new window.MouseEvent(type, { bubbles: true, cancelable: true, ...options })
}

function keyEvent(window, key, options = {}) {
  return new window.KeyboardEvent('keydown', { bubbles: true, cancelable: true, key, ...options })
}

/** A minimal DataTransfer for drag events. */
function transfer() {
  return {
    dropEffect: 'none',
    effectAllowed: 'none',
    data: new Map(),
    setData(type, value) { this.data.set(type, value) },
    getData(type) { return this.data.get(type) ?? '' },
  }
}

function dragEvent(window, type, target, { clientY = 0, dataTransfer = transfer() } = {}) {
  const event = new window.Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clientY', { value: clientY })
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
  target.dispatchEvent(event)
  return event
}

const $ = (root, selector) => root.querySelector(selector)
const $$ = (root, selector) => Array.from(root.querySelectorAll(selector))

const headers = (document) => $$(document, '.dsh-wsc-cat-header')
const addButton = (document) => $(document, '.dsh-wsc-add-button')
const sections = (document) => $$(document, '[data-dsh-wsc-section]')
const band = (document, index) => $$(document, '.dsh-wsc-band')[index]

function headerFor(document, categoryId) {
  return $$(document, '.dsh-wsc-cat-header').find(node => node.getAttribute('data-dsh-wsc-cat') === categoryId)
}

function categoryByName(document, name) {
  return $$(document, '.dsh-wsc-cat-header').find(node => $(node, '.dsh-wsc-name')?.textContent === name)
}

/* ------------------------------------------------------------------ *
 * Scenarios
 * ------------------------------------------------------------------ */

async function scenarioInjectsButton() {
  const page = boot()
  try {
    await flush()
    const button = addButton(page.document)
    check('injects one category button', button !== null)

    const actions = $(page.document, '[class*="headerActions"]')
    const shipped = $$(actions, 'button').filter(node => node !== button)
    equal('keeps the two shipped header controls', shipped.length, 2)
    const addWorkspaceWrapper = shipped[shipped.length - 1].closest('div')
    check(
      'sits immediately right of add-workspace',
      button.previousElementSibling === addWorkspaceWrapper,
      'previous sibling is not the shipped add-workspace wrapper',
    )
    check('has an accessible name', (button.getAttribute('aria-label') ?? '').length > 0)
    check('has an icon', $(button, 'svg') !== null)
  } finally {
    page.cleanup()
  }
}

async function scenarioCreateRenameRecolorCollapse() {
  const page = boot()
  try {
    await flush()
    addButton(page.document).dispatchEvent(mouseEvent(page.window, 'click'))
    await flush()

    let store = page.store()
    equal('creates exactly one category', store.categories.length, 1)
    const id = store.categories[0].id
    equal('renders one header', headers(page.document).length, 1)
    check('renders a tinted band', $(page.document, '.dsh-wsc-band') !== null)
    check('empty category shows its drop area', $(page.document, '.dsh-wsc-cat-empty') !== null)

    const input = $(page.document, '.dsh-wsc-name-input')
    check('opens the name editor for the new category', input !== null)
    input.value = '论文'
    input.dispatchEvent(keyEvent(page.window, 'Enter'))
    await flush()
    store = page.store()
    equal('rename commits on Enter', store.categories[0].name, '论文')
    equal('renaming hands focus back to the header', page.document.activeElement, headerFor(page.document, id))
    equal('header shows the new name', $(headerFor(page.document, id), '.dsh-wsc-name').textContent, '论文')

    // Recolor through the palette surface.
    $(headerFor(page.document, id), '.dsh-wsc-dot-button').dispatchEvent(mouseEvent(page.window, 'click'))
    await flush()
    const swatches = $$(page.document, '.dsh-wsc-swatch')
    equal('offers the seven Finder tag colors', swatches.length, 7)
    swatches[3].dispatchEvent(mouseEvent(page.window, 'click'))
    await flush()
    store = page.store()
    equal('recolor persists', store.categories[0].color, '#69D27E')
    equal('recolor marks the pressed swatch', swatches[3].getAttribute('aria-pressed'), 'true')

    // Escape closes the palette; the header click then owns the collapse.
    page.document.dispatchEvent(keyEvent(page.window, 'Escape'))
    await flush()
    check('Escape closes the palette', $(page.document, '.dsh-wsc-pop') === null)

    // Collapse through the header itself.
    const header = headerFor(page.document, id)
    header.dispatchEvent(mouseEvent(page.window, 'click'))
    await flush()
    store = page.store()
    equal('header click collapses', store.categories[0].collapsed, true)
    equal(
      'the chevron exposes the collapse state',
      $(header, '.dsh-wsc-collapse-button').getAttribute('aria-expanded'),
      'false',
    )
    const empty = $(page.document, '.dsh-wsc-cat-empty')
    check('collapsed empty category drops its drop area', empty === null)

    // Keyboard: Enter on the focused header expands it again.
    header.dispatchEvent(keyEvent(page.window, 'Enter'))
    await flush()
    equal('Enter expands', page.store().categories[0].collapsed, false)
  } finally {
    page.cleanup()
  }
}

async function scenarioFileAndUnfile() {
  const page = boot({ workspaces: ['alpha', 'beta', 'gamma'] })
  try {
    await flush()
    addButton(page.document).dispatchEvent(mouseEvent(page.window, 'click'))
    await flush()
    $(page.document, '.dsh-wsc-name-input')?.dispatchEvent(keyEvent(page.window, 'Enter'))
    await flush()
    const id = page.store().categories[0].id

    // Drag a Workspace onto the category block, exactly as the pointer does.
    const row = $(page.document, '[data-row-key="workspace:alpha"]')
    dragEvent(page.window, 'dragstart', row)
    const target = band(page.document, 0)
    dragEvent(page.window, 'dragover', target, { clientY: 4 })
    dragEvent(page.window, 'drop', target, { clientY: 4 })
    await flush()

    deepEqual('files the dragged Workspace', page.store().categories[0].workspaceIds, ['alpha'])
    equal('stamps its section as a member', $(page.document, '[data-row-key="workspace:alpha"]').parentElement.getAttribute('data-dsh-wsc-member'), id)
    equal(
      'member section is marked for the stylesheet',
      $(page.document, '[data-row-key="workspace:alpha"]').parentElement.getAttribute('data-dsh-wsc-section'),
      'member',
    )

    // Drag it back out below the Uncategorized divider.
    dragEvent(page.window, 'dragstart', $(page.document, '[data-row-key="workspace:alpha"]'))
    const divider = $(page.document, '.dsh-wsc-divider')
    check('renders the Uncategorized divider', divider !== null)
    dragEvent(page.window, 'dragover', divider, { clientY: 40 })
    dragEvent(page.window, 'drop', divider, { clientY: 40 })
    await flush()
    deepEqual('drag below the divider unfiles it', page.store().categories[0].workspaceIds, [])
    equal(
      'section returns to the plain shape',
      $(page.document, '[data-row-key="workspace:alpha"]').parentElement.getAttribute('data-dsh-wsc-section'),
      'plain',
    )

    // Drag it back in, then delete the category: the Workspace stays, uncategorized.
    dragEvent(page.window, 'dragstart', $(page.document, '[data-row-key="workspace:alpha"]'))
    dragEvent(page.window, 'dragover', band(page.document, 0), { clientY: 4 })
    dragEvent(page.window, 'drop', band(page.document, 0), { clientY: 4 })
    await flush()
    deepEqual('files it again', page.store().categories[0].workspaceIds, ['alpha'])

    $(headerFor(page.document, id), '.dsh-wsc-icon-button').dispatchEvent(mouseEvent(page.window, 'click'))
    await flush()
    const danger = $(page.document, '.dsh-wsc-menu-item[data-danger="true"]')
    danger.dispatchEvent(mouseEvent(page.window, 'click'))
    await flush()
    equal('first delete click only arms', page.store().categories.length, 1)
    danger.dispatchEvent(mouseEvent(page.window, 'click'))
    await flush()
    equal('second delete click removes the category', page.store().categories.length, 0)
    check('the Workspace row itself survives', $(page.document, '[data-row-key="workspace:alpha"]') !== null)
    equal('no category header remains', headers(page.document).length, 0)
    equal('deleting the last category hands focus to the create button', page.document.activeElement, addButton(page.document))
  } finally {
    page.cleanup()
  }
}

async function scenarioReorder() {
  const page = boot()
  try {
    await flush()
    for (let index = 0; index < 3; index += 1) {
      addButton(page.document).dispatchEvent(mouseEvent(page.window, 'click'))
      await flush()
      const input = $(page.document, '.dsh-wsc-name-input')
      input.value = ['一', '二', '三'][index]
      input.dispatchEvent(keyEvent(page.window, 'Enter'))
      await flush()
    }
    let store = page.store()
    deepEqual('three categories exist', store.categories.map(category => category.name), ['一', '二', '三'])

    // Drag the third header above the first one.
    const third = categoryByName(page.document, '三')
    const first = categoryByName(page.document, '一')
    dragEvent(page.window, 'dragstart', $(third, '.dsh-wsc-grip'))
    dragEvent(page.window, 'dragover', $(first, '.dsh-wsc-grip'), { clientY: -1 })
    dragEvent(page.window, 'drop', $(first, '.dsh-wsc-grip'), { clientY: -1 })
    await flush()
    store = page.store()
    equal('drag reorders the category', store.categories.map(category => category.name)[0], '三')

    // Keyboard: move the last one up with its grip focused.
    const last = categoryByName(page.document, '二')
    const grip = $(last, '.dsh-wsc-grip')
    equal('grip is a tab stop', grip.getAttribute('tabindex'), '0')
    deepEqual('drag leaves the moved category first', store.categories.map(category => category.name), ['三', '一', '二'])
    grip.dispatchEvent(keyEvent(page.window, 'ArrowUp'))
    await flush()
    store = page.store()
    deepEqual('arrow key moves the category', store.categories.map(category => category.name), ['三', '二', '一'])

    // Alt+ArrowDown on the header moves it back down.
    const header = categoryByName(page.document, '二')
    header.dispatchEvent(keyEvent(page.window, 'ArrowDown', { altKey: true }))
    await flush()
    store = page.store()
    deepEqual('alt+arrow moves the header', store.categories.map(category => category.name), ['三', '一', '二'])
  } finally {
    page.cleanup()
  }
}

async function scenarioPersistence() {
  const first = boot()
  let seeded = null
  try {
    await flush()
    addButton(first.document).dispatchEvent(mouseEvent(first.window, 'click'))
    await flush()
    const input = $(first.document, '.dsh-wsc-name-input')
    input.value = '长期'
    input.dispatchEvent(keyEvent(first.window, 'Enter'))
    await flush()
    dragEvent(first.window, 'dragstart', $(first.document, '[data-row-key="workspace:beta"]'))
    dragEvent(first.window, 'dragover', band(first.document, 0), { clientY: 4 })
    dragEvent(first.window, 'drop', band(first.document, 0), { clientY: 4 })
    await flush()
    seeded = first.window.localStorage.getItem('dsh.workspace.categories.v1')
  } finally {
    first.cleanup()
  }

  const second = boot({ storage: seeded })
  try {
    await flush()
    equal('restores the category across activations', headers(second.document).length, 1)
    equal('restores its name', $(headers(second.document)[0], '.dsh-wsc-name').textContent, '长期')
    deepEqual('restores its membership', second.store().categories[0].workspaceIds, ['beta'])
  } finally {
    second.cleanup()
  }
}

async function scenarioSingleInstance() {
  const page = boot()
  try {
    await flush()
    addButton(page.document).dispatchEvent(mouseEvent(page.window, 'click'))
    await flush()
    equal('one header before the takeover', headers(page.document).length, 1)

    // A hot reload activates a second copy without the first fiber's teardown.
    page.plugin.apply(page.ctx)
    await flush()
    equal('takeover leaves exactly one header', headers(page.document).length, 1)
    equal('takeover leaves exactly one band', $$(page.document, '.dsh-wsc-band').length, 1)
    equal('takeover leaves exactly one injected button', $$(page.document, '.dsh-wsc-add-button').length, 1)
    equal('takeover leaves exactly one style element', $$(page.document, '#dsh-wsc-style').length, 1)
  } finally {
    page.cleanup()
  }
}

async function scenarioStructuralFallback() {
  // The shipped CSS-module hash changed: no `groupSection` anywhere.
  const page = boot({ sectionClass: 'Q9xLm2_section' })
  try {
    await flush()
    check('structural fallback still finds the list', addButton(page.document) !== null)
    addButton(page.document).dispatchEvent(mouseEvent(page.window, 'click'))
    await flush()
    equal('structural fallback still creates a category', page.store().categories.length, 1)
    dragEvent(page.window, 'dragstart', $(page.document, '[data-row-key="workspace:gamma"]'))
    dragEvent(page.window, 'dragover', band(page.document, 0), { clientY: 4 })
    dragEvent(page.window, 'drop', band(page.document, 0), { clientY: 4 })
    await flush()
    deepEqual('structural fallback still files a Workspace', page.store().categories[0].workspaceIds, ['gamma'])
  } finally {
    page.cleanup()
  }
}

async function scenarioNestedTreeAndFlatView() {
  const nested = boot({ nested: true })
  try {
    await flush()
    equal('nested tree hides categories', headers(nested.document).length, 0)
    check('nested tree keeps the per-Workspace block marks', sections(nested.document).length > 0)
  } finally {
    nested.cleanup()
  }

  const flat = boot({ workspaces: [] })
  try {
    await flush()
    // A flat/restricted list has no Workspace section at all.
    equal('a list without sections shows no categories', headers(flat.document).length, 0)
  } finally {
    flat.cleanup()
  }
}

async function scenarioCopy() {
  const zh = boot({ locale: 'zh' })
  try {
    await flush()
    equal('Chinese button copy', addButton(zh.document).getAttribute('aria-label'), '新建工作区类别')
  } finally {
    zh.cleanup()
  }

  const en = boot({ locale: 'en' })
  try {
    await flush()
    equal('English button copy', addButton(en.document).getAttribute('aria-label'), 'New workspace category')
    addButton(en.document).dispatchEvent(mouseEvent(en.window, 'click'))
    await flush()
    equal('English default name', $(en.document, '.dsh-wsc-name-input').value, 'New category')
    equal('English divider copy', $(en.document, '.dsh-wsc-divider-label').textContent, 'Uncategorized')
  } finally {
    en.cleanup()
  }
}

async function scenarioAnnouncements() {
  const page = boot()
  try {
    await flush()
    addButton(page.document).dispatchEvent(mouseEvent(page.window, 'click'))
    await flush()
    const live = $(page.document, '[role="status"][aria-live="polite"]')
    check('creates a polite live region', live !== null)
    equal('announces the new category', live.textContent, '已新建类别')
  } finally {
    page.cleanup()
  }
}

async function scenarioThemeTokens() {
  const source = readFileSync(join(pluginDir, 'client.js'), 'utf8')
  check('ships no raw hex colors in its stylesheet', !/const CSS = `[\s\S]*?`/.test(source) || !/#[0-9a-fA-F]{6}\b/.test(
    source.slice(source.indexOf('const CSS = `'), source.indexOf('\n`\n', source.indexOf('const CSS = `'))),
  ))
  check('uses the shipped menu surface material', source.includes('--dsw-menu-surface-fill'))
  check('uses the shipped radius tokens', source.includes('--dsw-radius-md') && source.includes('--dsw-radius-lg'))
  check('honors reduced motion', source.includes('prefers-reduced-motion'))
  check('honors forced colors', source.includes('forced-colors'))
  check('declares a window-drag exclusion on its surfaces', source.includes('data-window-drag-exclude'))
}

async function scenarioEmptyCategoryFiling() {
  const page = boot()
  try {
    await flush()
    addButton(page.document).dispatchEvent(mouseEvent(page.window, 'click'))
    await flush()
    $(page.document, '.dsh-wsc-name-input')?.dispatchEvent(keyEvent(page.window, 'Enter'))
    await flush()

    const empty = $(page.document, '.dsh-wsc-cat-empty')
    check('empty category offers a drop area', empty !== null)
    dragEvent(page.window, 'dragstart', $(page.document, '[data-row-key="workspace:beta"]'))
    dragEvent(page.window, 'dragover', empty, { clientY: 4 })
    dragEvent(page.window, 'drop', empty, { clientY: 4 })
    await flush()
    deepEqual('filing onto the empty area works', page.store().categories[0].workspaceIds, ['beta'])
    check('the drop area retires once a member exists', $(page.document, '.dsh-wsc-cat-empty') === null)
  } finally {
    page.cleanup()
  }
}

async function scenarioCorruptStore() {
  let warned = 0
  const original = console.warn
  console.warn = (...args) => {
    if (String(args[0]).includes('persisted categories unreadable')) warned += 1
  }
  const browser = boot({ storage: '{not json' })
  console.warn = original
  try {
    await flush()
    equal('a corrupt store renders nothing', headers(browser.document).length, 0)
    check('a corrupt store warns once', warned >= 1)
    addButton(browser.document).dispatchEvent(mouseEvent(browser.window, 'click'))
    await flush()
    equal('a corrupt store heals on the next save', browser.store().categories.length, 1)
  } finally {
    browser.cleanup()
  }

  // Malformed entries and duplicates are dropped, one Workspace stays in one category.
  const seeded = JSON.stringify({
    version: 1,
    categories: [
      { id: 'a', name: 'A', color: '#123456', workspaceIds: ['alpha', 'alpha', 'ghost'] },
      { id: 'a', name: 'duplicate id' },
      { id: 'b', name: '', color: 'nope', workspaceIds: ['alpha', 'beta'] },
      null,
    ],
  })
  const normalized = boot({ storage: seeded })
  try {
    await flush()
    const store = normalized.store()
    equal('drops duplicate and null entries', store.categories.length, 2)
    deepEqual('dedupes a Workspace and prunes the ones the Host no longer lists', store.categories[0].workspaceIds, ['alpha'])
    equal('falls back to the default name', store.categories[1].name.length > 0, true)
    equal('falls back to a palette color', /^#[0-9A-F]{6}$/.test(store.categories[1].color), true)
    deepEqual('keeps a Workspace in its first category only', store.categories[1].workspaceIds, ['beta'])
  } finally {
    normalized.cleanup()
  }
}

async function scenarioLocaleSwitch() {
  const page = boot({ locale: 'zh' })
  try {
    await flush()
    equal('starts in Chinese', addButton(page.document).getAttribute('aria-label'), '新建工作区类别')
    addButton(page.document).dispatchEvent(mouseEvent(page.window, 'click'))
    await flush()
    $(page.document, '.dsh-wsc-name-input')?.dispatchEvent(keyEvent(page.window, 'Enter'))
    await flush()

    page.setLocale('en')
    await flush()
    equal('button copy follows a language switch', addButton(page.document).getAttribute('aria-label'), 'New workspace category')
    equal('divider copy follows a language switch', $(page.document, '.dsh-wsc-divider-label').textContent, 'Uncategorized')
    equal('header title follows a language switch', $(page.document, '.dsh-wsc-name').title, 'Double-click the category name to rename it')

    page.setLocale('zh')
    await flush()
    equal('switching back restores Chinese', $(page.document, '.dsh-wsc-divider-label').textContent, '未分类')
  } finally {
    page.cleanup()
  }
}

async function scenarioMenuKeyboard() {
  const page = boot()
  try {
    await flush()
    addButton(page.document).dispatchEvent(mouseEvent(page.window, 'click'))
    await flush()
    $(page.document, '.dsh-wsc-name-input')?.dispatchEvent(keyEvent(page.window, 'Enter'))
    await flush()

    const header = headers(page.document)[0]
    $(header, '.dsh-wsc-icon-button').dispatchEvent(mouseEvent(page.window, 'click'))
    await flush()
    const surface = $(page.document, '.dsh-wsc-pop-menu')
    const items = $$(surface, '[role="menuitem"]')
    equal('menu exposes two actions', items.length, 2)
    equal('menu takes focus', page.document.activeElement, items[0])

    surface.dispatchEvent(keyEvent(page.window, 'ArrowDown'))
    equal('ArrowDown moves focus', page.document.activeElement, items[1])
    surface.dispatchEvent(keyEvent(page.window, 'Home'))
    equal('Home returns to the first action', page.document.activeElement, items[0])

    page.document.dispatchEvent(keyEvent(page.window, 'Escape'))
    await flush()
    check('Escape closes the menu', $(page.document, '.dsh-wsc-pop') === null)
    equal('Escape returns focus to the trigger', page.document.activeElement, $(header, '.dsh-wsc-icon-button'))

    $(header, '.dsh-wsc-icon-button').dispatchEvent(mouseEvent(page.window, 'click'))
    await flush()
    const danger = $(page.document, '.dsh-wsc-menu-item[data-danger="true"]')
    danger.dispatchEvent(mouseEvent(page.window, 'click'))
    equal('first click arms the delete', danger.getAttribute('data-armed'), 'true')
    page.document.dispatchEvent(keyEvent(page.window, 'Escape'))
    await flush()
    $(header, '.dsh-wsc-icon-button').dispatchEvent(mouseEvent(page.window, 'click'))
    await flush()
    equal('a reopened menu is unarmed again', $(page.document, '.dsh-wsc-menu-item[data-danger="true"]').getAttribute('data-armed'), null)
  } finally {
    page.cleanup()
  }
}

async function scenarioOrderingAndPruning() {
  const page = boot()
  try {
    await flush()
    addButton(page.document).dispatchEvent(mouseEvent(page.window, 'click'))
    await flush()
    $(page.document, '.dsh-wsc-name-input')?.dispatchEvent(keyEvent(page.window, 'Enter'))
    await flush()
    dragEvent(page.window, 'dragstart', $(page.document, '[data-row-key="workspace:alpha"]'))
    dragEvent(page.window, 'dragover', band(page.document, 0), { clientY: 4 })
    dragEvent(page.window, 'drop', band(page.document, 0), { clientY: 4 })
    await flush()

    const list = $(page.document, '[role="tree"]')
    const orderOf = node => Number(node.style.order || 0)
    const headerOrder = orderOf(headers(page.document)[0])
    const ungrouped = $$(page.document, '[data-row-key^="session:s-ungrouped"]')[0].parentElement
    check('the ungrouped bucket has an explicit order', ungrouped.style.order !== '')
    check('categories stay above uncategorized rows', headerOrder < orderOf(ungrouped), `header ${headerOrder} vs bucket ${orderOf(ungrouped)}`)

    // The Host dropping a Workspace prunes it from its category.
    page.setWorkspaces(['beta', 'gamma'])
    await flush()
    deepEqual('membership is pruned when a Workspace disappears', page.store().categories[0].workspaceIds, [])
  } finally {
    page.cleanup()
  }
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */

const scenarios = [
  ['injects the category button', scenarioInjectsButton],
  ['create / rename / recolor / collapse', scenarioCreateRenameRecolorCollapse],
  ['file and unfile Workspaces', scenarioFileAndUnfile],
  ['reorder categories (pointer and keyboard)', scenarioReorder],
  ['persist across activations', scenarioPersistence],
  ['single-instance takeover', scenarioSingleInstance],
  ['structural seam fallback', scenarioStructuralFallback],
  ['nested tree and listless views', scenarioNestedTreeAndFlatView],
  ['localized copy', scenarioCopy],
  ['screen-reader announcements', scenarioAnnouncements],
  ['file onto an empty category', scenarioEmptyCategoryFiling],
  ['tolerate a corrupt store', scenarioCorruptStore],
  ['follow a language switch', scenarioLocaleSwitch],
  ['menu keyboard navigation', scenarioMenuKeyboard],
  ['ordering and pruning', scenarioOrderingAndPruning],
  ['theme tokens and media queries', scenarioThemeTokens],
]

for (const [name, run] of scenarios) {
  try {
    await run()
  } catch (error) {
    failures.push(`${name} threw: ${error && error.stack ? error.stack.split('\n')[0] : String(error)}`)
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} of ${checks} checks failed:\n`)
  for (const failure of failures) console.error(`  ✗ ${failure}`)
  process.exit(1)
}

console.log(`${checks} checks passed across ${scenarios.length} scenarios.`)
