/**
 * Host half of `@local/dsh-workspace-categories`.
 *
 * The feature is a browser-surface decoration around the sidebar Workspace
 * list: the package's `./client` export reads the Client Workspace state and
 * reorganizes the rendered Workspace blocks in the page. This Host row owns
 * that Client half through its activation and registers nothing on the Host
 * side.
 */

/** Stable Cordis plugin name, matching the bundle patch row id. */
export const name = 'dsh-workspace-categories'

/** Register nothing: the Host has no part in this decoration. */
export function apply() {}
