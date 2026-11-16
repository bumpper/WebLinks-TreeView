/* Shared bookmark import helpers for WebLinks.
 * Parses Netscape HTML exports (Edge, Chrome, Firefox, Brave, Opera, Safari)
 * and Firefox JSON backups into a compact, safe tree structure:
 *   folder -> { n: name, c: [children] }
 *   link   -> { n: name, u: url }
 */
(function (global) {
    'use strict';

    var TREE_KEY = 'uploadedBookmarksTree';
    var SOURCE_KEY = 'uploadedBookmarksName';
    var LEGACY_RAW_KEY = 'uploadedBookmarks';
    var LEGACY_TYPE_KEY = 'uploadedBookmarksType';
    var UPDATED_KEY = 'bookmarksUpdated';
    var FOLDER_TYPE = 'text/x-moz-place-container';

    function cleanText(value) {
        return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    }

    function directChild(el, tagName) {
        for (var i = 0; i < el.children.length; i++) {
            if (el.children[i].tagName === tagName) return el.children[i];
        }
        return null;
    }

    /* Browsers move the folder's child <DL> inside the <DT>, but some
     * exporters (e.g. Safari) leave it as a sibling. Handle both layouts. */
    function parseNetscapeHTML(raw) {
        var doc = new DOMParser().parseFromString(raw, 'text/html');

        function parseContainer(container) {
            var out = [];
            var children = Array.prototype.slice.call(container.children);
            var pendingFolder = null;

            for (var i = 0; i < children.length; i++) {
                var el = children[i];
                var tag = el.tagName;

                if (tag === 'DL') {
                    if (pendingFolder) {
                        pendingFolder.c = parseContainer(el);
                    } else {
                        out.push.apply(out, parseContainer(el));
                    }
                    pendingFolder = null;
                    continue;
                }

                if (tag !== 'DT') {
                    if (tag === 'BODY' || tag === 'HTML') {
                        out.push.apply(out, parseContainer(el));
                    }
                    continue;
                }

                var heading = directChild(el, 'H3');
                if (heading) {
                    var folder = {
                        n: cleanText(heading.textContent) || 'Untitled folder',
                        c: []
                    };
                    out.push(folder);
                    var nestedList = directChild(el, 'DL');
                    if (nestedList) {
                        folder.c = parseContainer(nestedList);
                    } else {
                        pendingFolder = folder;
                    }
                    continue;
                }

                var link = directChild(el, 'A');
                if (link) {
                    var href = (link.getAttribute('href') || '').trim();
                    out.push({
                        n: cleanText(link.textContent) || href || 'Untitled link',
                        u: href
                    });
                    pendingFolder = null;
                }
            }
            return out;
        }

        var root = doc.body || doc.documentElement;
        return root ? parseContainer(root) : [];
    }

    function parseFirefoxJSON(raw) {
        var data;
        try {
            data = JSON.parse(raw);
        } catch (err) {
            return [];
        }

        function convert(item) {
            if (!item || typeof item !== 'object') return null;
            if (item.type === 'text/x-moz-place-separator') return { sep: true };
            var title = cleanText(item.title);
            if (Array.isArray(item.children) || item.type === FOLDER_TYPE) {
                var kids = [];
                var list = item.children || [];
                for (var i = 0; i < list.length; i++) {
                    var child = convert(list[i]);
                    if (child) kids.push(child);
                }
                return { n: title || 'Untitled folder', c: kids };
            }
            if (item.uri) {
                return { n: title || item.uri, u: item.uri };
            }
            return null;
        }

        var ROOT_LABELS = {
            bookmarksMenuFolder: 'Bookmarks Menu',
            toolbarFolder: 'Bookmarks Toolbar',
            unfiledBookmarksFolder: 'Other Bookmarks',
            mobileFolder: 'Mobile Bookmarks'
        };

        var out = [];
        if (Array.isArray(data)) {
            out = data.map(convert).filter(Boolean);
        } else if (data && data.roots && typeof data.roots === 'object') {
            var order = [
                ['toolbar', 'Bookmarks Toolbar'],
                ['menu', 'Bookmarks Menu'],
                ['unfiled', 'Other Bookmarks'],
                ['mobile', 'Mobile Bookmarks']
            ];
            for (var i = 0; i < order.length; i++) {
                var root = data.roots[order[i][0]];
                if (!root) continue;
                var kids = convert(root);
                if (kids && kids.c && kids.c.length) {
                    kids.n = order[i][1];
                    out.push(kids);
                }
            }
        } else if (data && Array.isArray(data.children)) {
            out = data.children.map(function (item) {
                var converted = convert(item);
                if (!converted) return null;
                var label = ROOT_LABELS[item.root];
                if (!label) {
                    var guid = String(item.guid || '');
                    if (guid.indexOf('menu') === 0) label = 'Bookmarks Menu';
                    else if (guid.indexOf('toolbar') === 0) label = 'Bookmarks Toolbar';
                    else if (guid.indexOf('unfiled') === 0) label = 'Other Bookmarks';
                    else if (guid.indexOf('mobile') === 0) label = 'Mobile Bookmarks';
                }
                if (label && Array.isArray(converted.c)) converted.n = label;
                return converted;
            }).filter(Boolean);
        }
        return out;
    }

    function looksLikeJSON(raw) {
        return /^\s*[\[{]/.test(String(raw || ''));
    }

    /* WebLinks' own exported bookmarks.html stores its tree as JSON in
     * <script type="application/json" id="bookmark-data">, already in this
     * app's { n, u, c, t, sep } shape, so it can be used without conversion. */
    function parseAppExportHTML(raw) {
        var match = String(raw || '').match(/<script[^>]*\bid\s*=\s*["']bookmark-data["'][^>]*>([\s\S]*?)<\/script>/i);
        if (!match) return null;
        var tree;
        try {
            tree = JSON.parse(match[1]);
        } catch (err) {
            return null;
        }
        return Array.isArray(tree) ? tree : null;
    }

    function parseFileText(raw, fileName) {
        var name = String(fileName || '');
        var ext = name.indexOf('.') >= 0 ? name.split('.').pop().toLowerCase() : '';
        var tree;
        if (ext === 'json' || (ext !== 'html' && ext !== 'htm' && looksLikeJSON(raw))) {
            tree = parseFirefoxJSON(raw);
        } else {
            tree = parseAppExportHTML(raw) || parseNetscapeHTML(raw);
        }
        var stats = countTree(tree);
        return { tree: tree, folders: stats.folders, links: stats.links };
    }

    function countTree(tree) {
        var folders = 0;
        var links = 0;
        var stack = (tree || []).slice();
        while (stack.length) {
            var node = stack.pop();
            if (node.sep) continue;
            if (Array.isArray(node.c)) {
                folders++;
                for (var i = 0; i < node.c.length; i++) stack.push(node.c[i]);
            } else {
                links++;
            }
        }
        return { folders: folders, links: links };
    }

    /* Persist only the parsed tree. Storing the raw 1-4 MB export can hit
     * the localStorage quota; the compact tree is far smaller. */
    function saveTree(tree, sourceName) {
        try {
            try {
                localStorage.removeItem(LEGACY_RAW_KEY);
                localStorage.removeItem(LEGACY_TYPE_KEY);
            } catch (err) { /* ignore */ }
            localStorage.setItem(TREE_KEY, JSON.stringify(tree));
            if (sourceName) localStorage.setItem(SOURCE_KEY, String(sourceName));
            localStorage.setItem(UPDATED_KEY, String(Date.now()));
            return { ok: true };
        } catch (err) {
            return { ok: false, error: (err && err.message) || String(err) };
        }
    }

    function getSourceName() {
        try {
            return localStorage.getItem(SOURCE_KEY) || '';
        } catch (err) {
            return '';
        }
    }

    function clearTree() {
        try {
            localStorage.removeItem(TREE_KEY);
            localStorage.removeItem(SOURCE_KEY);
            localStorage.removeItem(UPDATED_KEY);
            localStorage.removeItem(LEGACY_RAW_KEY);
            localStorage.removeItem(LEGACY_TYPE_KEY);
        } catch (err) { /* ignore */ }
    }

    function loadTree() {
        try {
            var stored = localStorage.getItem(TREE_KEY);
            if (stored) {
                var parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch (err) { /* fall through to legacy import */ }

        try {
            var raw = localStorage.getItem(LEGACY_RAW_KEY);
            if (raw) {
                var type = localStorage.getItem(LEGACY_TYPE_KEY) || '';
                var migrated = parseFileText(raw, type === 'json' ? 'legacy.json' : 'legacy.html').tree;
                saveTree(migrated, 'Imported bookmarks');
                return migrated;
            }
        } catch (err) { /* ignore */ }

        return [];
    }

    function buildStandaloneHTML(tree, exportId, builtAt) {
        var dataJson = JSON.stringify(Array.isArray(tree) ? tree : []).replace(/</g, '\\u003c');
        exportId = exportId || 'x' + Date.now().toString(36);
        builtAt = Number(builtAt) || Date.now();
        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bookmarks</title>
<style>
:root {
    --bg: #ffffff; --fg: #1f1f1f; --muted: #616161; --line: #e0e0e0;
    --guide: #dedede; --hover: #f2f6fb; --sel: #cce8ff; --hdr: #f7f7f7;
    --btn-hover: #e8e8e8; --chev: #555555; --accent: #0078d4; --scroll: #c7c7c7;
    --warn: #c42b1c;
}
@media (prefers-color-scheme: dark) {
    :root {
        --bg: #1f1f1f; --fg: #e8e8e8; --muted: #a5a5a5; --line: #3a3a3a;
        --guide: #3d3d3d; --hover: #2b2b2b; --sel: #264f78; --hdr: #252526;
        --btn-hover: #373737; --chev: #c2c2c2; --accent: #4aa3e0; --scroll: #565656;
        --warn: #f1707b;
    }
}
* { box-sizing: border-box; }
html, body { height: 100%; }
body {
    margin: 0; height: 100vh; display: flex; flex-direction: column; overflow: hidden;
    background: var(--bg); color: var(--fg);
    font: 13px/1.35 "Segoe UI", Tahoma, Arial, sans-serif;
}
.pane-header {
    flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between;
    gap: 6px; padding: 3px 6px 3px 10px; background: var(--hdr);
    border-bottom: 1px solid var(--line); user-select: none;
}
.pane-title {
    display: flex; align-items: center; gap: 6px; min-width: 0;
    font-size: 13px; font-weight: 600;
}
a.pane-title {
    margin-left: -4px; padding: 2px 4px; border-radius: 4px;
    color: inherit; text-decoration: none; cursor: pointer;
}
a.pane-title:hover { background: var(--btn-hover); }
a.pane-title:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.pane-title .star { flex: 0 0 auto; width: 16px; height: 16px; color: #f2b01e; }
.pane-title span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pane-tools { display: flex; flex: 0 0 auto; gap: 1px; }
.tool {
    display: inline-flex; align-items: center; justify-content: center; width: 24px;
    height: 24px; padding: 0; border: 1px solid transparent; border-radius: 4px;
    background: transparent; color: var(--fg); cursor: pointer;
}
.tool:hover { background: var(--btn-hover); border-color: var(--line); }
#btn-clear:hover { color: #c42b1c; }
#btn-upload:hover { color: #0078d4; }
#btn-download:hover { color: #1e8e3e; }
#btn-sync:hover { color: #b8860b; }
#btn-popout-all:hover,
#btn-popout-all[aria-pressed="true"] { color: #4a90d9; }
#btn-expand:hover,
#btn-collapse:hover { color: #d97706; }
@media (prefers-color-scheme: dark) {
    #btn-clear:hover { color: #ff8b8b; }
    #btn-upload:hover { color: #6cb6ff; }
    #btn-download:hover { color: #6ed17f; }
    #btn-sync:hover { color: #ffd75e; }
    #btn-popout-all:hover,
    #btn-popout-all[aria-pressed="true"] { color: #6cb6ff; }
    #btn-expand:hover,
    #btn-collapse:hover { color: #ffab5e; }
}
.tool:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.tool svg { width: 15px; height: 15px; }
.tree-wrap { position: relative; flex: 1 1 auto; overflow: auto; padding: 4px 0 8px; outline: none; }
.tree-wrap:focus-visible { box-shadow: inset 0 0 0 2px var(--accent); }
ul.tree {
    display: inline-block; vertical-align: top; width: max-content; min-width: 100%;
    margin: 0; padding: 0; list-style: none;
}
ul.children {
    display: none; margin: 0 0 0 7px; padding: 0 0 0 10px;
    border-left: 1px solid var(--guide); list-style: none;
}
li.node.folder.expanded > ul.children { display: block; }
li.node { position: relative; }
.row {
    display: flex; align-items: center; gap: 4px; height: 24px;
    padding: 0 8px 0 2px; border-radius: 4px; white-space: nowrap;
}
.row:hover { background: var(--hover); }
li.node.selected > .row { background: var(--sel); }
li.node.selected > .row .label { font-weight: 600; }
.twisty {
    display: inline-flex; flex: 0 0 16px; align-items: center; justify-content: center;
    width: 16px; height: 16px;
}
.twisty::before {
    content: ""; width: 0; height: 0; border-top: 4px solid transparent;
    border-bottom: 4px solid transparent; border-left: 5px solid var(--chev);
    transition: transform 0.12s ease; transform-origin: 40% 50%;
}
li.node.folder.expanded > .row .twisty::before { transform: rotate(90deg); }
.twisty.leaf::before { display: none; }
.ico {
    flex: 0 0 16px; width: 16px; height: 16px; background-repeat: no-repeat;
    background-position: center; background-size: 16px 16px;
}
.ico.folder-ico {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M1.5 3.6c0-.6.5-1.1 1.1-1.1h3.1c.4 0 .8.2 1 .5l1.1 1.5h5.6c.6 0 1.1.5 1.1 1.1v6.8c0 .6-.5 1.1-1.1 1.1H2.6c-.6 0-1.1-.5-1.1-1.1z' fill='%23f2b53d' stroke='%23c08a10' stroke-width='1'/%3E%3Cpath d='M2.6 6h10.8v6.4c0 .33-.27.6-.6.6H3.2a.6.6 0 0 1-.6-.6z' fill='%23ffd66b' stroke='%23c08a10' stroke-width='1'/%3E%3C/svg%3E");
}
li.node.folder.expanded > .row .ico.folder-ico {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M1.3 3.6c0-.6.5-1.1 1.1-1.1h3.1c.4 0 .8.2 1 .5l1.1 1.5h5.3c.6 0 1.1.5 1.1 1.1V6H6.2L4.9 7.3H1.3z' fill='%23e0a52f' stroke='%23c08a10' stroke-width='1'/%3E%3Cpath d='M5.6 6h9.5l-1.8 6.6c-.1.5-.5.8-1 .8H2.1c-.4 0-.7-.4-.6-.8z' fill='%23ffd66b' stroke='%23c08a10' stroke-width='1'/%3E%3C/svg%3E");
}
.ico.link-ico {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M12.7 8.6v4.1c0 .5-.4.9-.9.9H3.2c-.5 0-.9-.4-.9-.9V4.2c0-.5.4-.9.9-.9h4.1' fill='none' stroke='%234a90d9' stroke-width='1.4' stroke-linecap='round'/%3E%3Cpath d='M9.3 2.3h4.4v4.4' fill='none' stroke='%234a90d9' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M13.7 2.3L7.6 8.4' fill='none' stroke='%234a90d9' stroke-width='1.4' stroke-linecap='round'/%3E%3C/svg%3E");
}
li.node.link .row .ico.link-ico,
li.node.link .row .label { cursor: pointer; }
.label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tree-sep {
    flex: 1 1 auto; min-width: 40px; margin: 0; border: 0;
    border-top: 1px solid var(--guide);
}
li.node.separator > .row,
li.node.separator > .row:hover,
li.node.separator.selected > .row { background: transparent; }
li.node.separator.selected > .row .tree-sep { border-top-color: var(--accent); }
li.node.separator .edit-btn { position: absolute; top: 3px; right: 4px; }
.add-row {
    display: flex; align-items: center; height: 24px; padding: 0 8px 0 20px;
}
.add-btn,
.edit-btn {
    display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center;
    padding: 0; border: 0; border-radius: 3px; background: transparent; cursor: pointer;
}
.add-btn { width: 20px; height: 20px; color: #1e8e3e; }
.add-btn:hover { color: #146c2e; }
.add-btn:focus-visible { outline: 1px solid var(--accent); outline-offset: 1px; }
.add-btn svg { width: 16px; height: 16px; }
.edit-btn {
    width: 18px; height: 18px; margin-left: auto; color: var(--muted);
    opacity: 0; transition: opacity 0.12s ease;
}
.row:hover .edit-btn,
.row:focus-within .edit-btn { opacity: 1; }
.edit-btn:hover { color: var(--accent); }
.edit-btn:focus-visible { outline: 1px solid var(--accent); outline-offset: 1px; }
.edit-btn svg { width: 14px; height: 14px; }
.empty {
    position: absolute; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 8px; padding: 24px;
    text-align: center; color: var(--muted);
}
.empty[hidden] { display: none; }
.empty h1 { margin: 0; font-size: 15px; font-weight: 600; color: var(--fg); }
.empty p { margin: 0; max-width: 270px; }
.empty .empty-icon { width: 52px; height: 52px; opacity: 0.85; }
.primary {
    margin-top: 4px; padding: 6px 14px; border: 1px solid var(--accent);
    border-radius: 4px; background: var(--accent); color: #ffffff;
    font: inherit; cursor: pointer;
}
.primary:hover { filter: brightness(1.08); }
.primary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.secondary {
    padding: 6px 14px; border: 1px solid var(--line); border-radius: 4px;
    background: var(--hdr); color: var(--fg); font: inherit; cursor: pointer;
}
.secondary:hover { background: var(--btn-hover); }
.danger { background: var(--warn); border-color: var(--warn); color: #ffffff; }
.danger:hover { filter: brightness(1.08); }
.statusbar {
    flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between;
    gap: 8px; min-height: 22px; padding: 3px 8px; border-top: 1px solid var(--line);
    background: var(--hdr); color: var(--muted); font-size: 11px; user-select: none;
}
.statusbar.error #status-count { color: var(--warn); font-weight: 600; }
.status-sel { max-width: 55%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.modal-overlay {
    position: fixed; inset: 0; z-index: 60; display: flex; align-items: center;
    justify-content: center; padding: 16px; background: rgba(0, 0, 0, 0.45);
}
.modal-overlay[hidden] { display: none; }
.modal-card {
    box-sizing: border-box; position: relative; width: 100%; max-width: 300px;
    padding: 14px; border: 1px solid var(--line); border-radius: 6px;
    background: var(--bg); color: var(--fg);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35); font-size: 12px;
}
.modal-title { margin: 0 0 6px; padding-right: 20px; font-size: 13px; }
.modal-close {
    position: absolute; top: 6px; right: 6px; display: inline-flex;
    align-items: center; justify-content: center; width: 22px; height: 22px;
    padding: 0; border: 0; border-radius: 3px; background: transparent;
    color: #c42b1c; cursor: pointer;
}
.modal-close:hover { background: var(--btn-hover); color: #8f1f14; }
.modal-close:focus-visible { outline: 1px solid var(--accent); outline-offset: 1px; }
.modal-close svg { width: 11px; height: 11px; }
@media (prefers-color-scheme: dark) {
    .modal-close { color: #ff8b8b; }
    .modal-close:hover { color: #ffb3b3; }
}
.modal-text { margin: 0 0 10px; color: var(--muted); overflow-wrap: anywhere; }
.modal-label { display: block; margin: 8px 0 3px; color: var(--muted); }
.modal-check {
    display: flex; align-items: center; gap: 6px; margin: 0 0 2px;
    color: var(--muted); cursor: pointer; user-select: none;
}
.modal-check[hidden] { display: none; }
.modal-check input {
    width: 13px; height: 13px; margin: 0; accent-color: var(--accent); cursor: pointer;
}
.modal-input {
    box-sizing: border-box; width: 100%; height: 24px; padding: 0 6px;
    border: 1px solid var(--line); border-radius: 3px; background: var(--bg);
    color: var(--fg); font: 12px "Segoe UI", Tahoma, Arial, sans-serif; outline: none;
}
.modal-input:focus { border-color: var(--accent); }
.modal-input:disabled { opacity: 0.55; cursor: not-allowed; }
.modal-error { margin: 8px 0 0; color: var(--warn); }
.modal-actions {
    display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px;
}
.modal-actions #edit-delete { margin-right: auto; }
.modal-actions .primary { margin-top: 0; }
.tool.spinning svg { animation: tool-spin 0.7s linear infinite; }
@keyframes tool-spin { to { transform: rotate(360deg); } }
.toast {
    position: fixed; left: 50%; bottom: 24px; z-index: 1001; max-width: 80vw;
    padding: 10px 16px; border-radius: 6px; background: #323232; color: #fff;
    font-size: 13px; text-align: center; opacity: 0; pointer-events: none;
    transform: translateX(-50%) translateY(10px);
    transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
.sync-overlay {
    position: fixed; inset: 0; z-index: 2000; display: none; align-items: center;
    justify-content: center; padding: 24px; background: rgba(0, 0, 0, 0.38);
}
.sync-overlay.open { display: flex; }
.sync-modal {
    width: min(560px, 94vw); max-height: 86vh; overflow: auto;
    padding: 18px 20px 16px; border-radius: 10px;
    background: var(--bg); color: var(--fg);
    font: 13px/1.45 "Segoe UI", Tahoma, Arial, sans-serif;
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.4);
}
.sync-modal-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.sync-modal-head h2 { margin: 0; font-size: 16px; }
.sync-close {
    width: 26px; height: 26px; padding: 0; border: 1px solid transparent;
    border-radius: 4px; background: transparent; color: inherit; font-size: 18px;
    line-height: 1; cursor: pointer;
}
.sync-close:hover { background: rgba(127, 127, 127, 0.18); }
.sync-lead { margin: 8px 0 12px; color: var(--muted); }
.sync-providers { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.sync-provider {
    padding: 9px 10px; border: 1px solid var(--line); border-radius: 6px;
    background: var(--hdr); color: inherit; font: inherit; text-align: left; cursor: pointer;
}
.sync-provider:hover { border-color: var(--accent); }
.sync-provider.selected {
    border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent);
    background: rgba(0, 120, 212, 0.08);
}
@media (prefers-color-scheme: dark) {
    .sync-provider.selected { background: rgba(77, 163, 232, 0.18); }
}
.sync-instructions {
    margin: 12px 0; padding: 10px 12px; border-radius: 6px; background: var(--hdr);
}
.sync-instructions p { margin: 0 0 6px; }
.sync-instructions a { color: var(--accent); }
.sync-folder { display: flex; gap: 8px; align-items: center; }
.sync-folder label { flex: 0 0 auto; font-weight: 600; }
.sync-folder input {
    flex: 1 1 auto; min-width: 0; height: 28px; padding: 3px 8px;
    border: 1px solid var(--line); border-radius: 4px;
    background: var(--bg); color: inherit; font: inherit;
}
.sync-folder .primary-btn {
    flex: 0 0 auto; padding: 6px 12px; border: 0; border-radius: 4px;
    background: var(--accent); color: #ffffff; font: inherit; cursor: pointer;
}
.sync-folder .primary-btn:hover { filter: brightness(1.08); }
.sync-folder .primary-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.sync-status { min-height: 18px; margin: 10px 0 0; color: var(--accent); }
.sync-status.error { color: var(--warn); }
.sync-note { margin: 10px 0 0; font-size: 11px; color: var(--muted); }
.tree-wrap::-webkit-scrollbar { width: 12px; height: 12px; }
.tree-wrap::-webkit-scrollbar-thumb {
    border: 3px solid var(--bg); border-radius: 8px; background: var(--scroll);
}
</style>
</head>
<body>
<header class="pane-header">
    <a class="pane-title" href="https://radius.center/weblinks/weblinks.html" target="_blank" rel="noopener" title="Open the Weblinks app in a new tab">
        <svg class="star" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5l2 4.1 4.5.6-3.3 3.2.8 4.5L8 11.8l-4 2.1.8-4.5L1.5 6.2 6 5.6z" fill="currentColor"/></svg>
        <span>Bookmarks</span>
    </a>
    <div class="pane-tools">
        <button id="btn-clear" class="tool" type="button" title="Clear all bookmarks" aria-label="Clear all bookmarks">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>
        </button>
        <button id="btn-upload" class="tool" type="button" title="Upload bookmarks file" aria-label="Upload bookmarks file">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 10.5V2.5"/><path d="M5 5.5l3-3 3 3"/><path d="M2.5 10v2.5c0 .6.4 1 1 1h9c.6 0 1-.4 1-1V10"/></svg>
        </button>
        <button id="btn-download" class="tool" type="button" title="Download bookmarks.html" aria-label="Download bookmarks.html">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2.5v8"/><path d="M5 7.5l3 3 3-3"/><path d="M2.5 11v1.5c0 .6.4 1 1 1h9c.6 0 1-.4 1-1V11"/></svg>
        </button>
        <button id="btn-sync" class="tool" type="button" title="Sync bookmarks" aria-label="Sync bookmarks">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.6 7.4a5.5 5.5 0 0 1 9.6-3.3"/><path d="M12.4 2.2v2.6H9.8"/><path d="M13.4 8.6a5.5 5.5 0 0 1-9.6 3.3"/><path d="M3.6 13.8v-2.6h2.6"/></svg>
        </button>
        <button id="btn-popout-all" class="tool" type="button" title="Open in new tabs" aria-label="Open in new tabs" aria-pressed="false">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.7 8.6v4.1c0 .5-.4.9-.9.9H3.2c-.5 0-.9-.4-.9-.9V4.2c0-.5.4-.9.9-.9h4.1"/><path d="M9.3 2.3h4.4v4.4"/><path d="M13.7 2.3L7.6 8.4"/></svg>
        </button>
        <button id="btn-expand" class="tool" type="button" title="Expand all folders" aria-label="Expand all folders">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7.5l4 4 4-4"/><path d="M4 3.5l4 4 4-4"/></svg>
        </button>
        <button id="btn-collapse" class="tool" type="button" title="Collapse all folders" aria-label="Collapse all folders">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8.5l4-4 4 4"/><path d="M4 12.5l4-4 4 4"/></svg>
        </button>
    </div>
</header>
<main id="scroller" class="tree-wrap" tabindex="0" aria-label="Bookmark folders">
    <ul id="tree-root" class="tree" role="tree"></ul>
    <div id="empty" class="empty" hidden>
        <svg class="empty-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 3.6c0-.6.5-1.1 1.1-1.1h3.1c.4 0 .8.2 1 .5l1.1 1.5h5.6c.6 0 1.1.5 1.1 1.1v6.8c0 .6-.5 1.1-1.1 1.1H2.6c-.6 0-1.1-.5-1.1-1.1z" fill="#f2b53d" stroke="#c08a10" stroke-width=".6"/><path d="M2.6 6h10.8v6.4c0 .33-.27.6-.6.6H3.2a.6.6 0 0 1-.6-.6z" fill="#ffd66b" stroke="#c08a10" stroke-width=".6"/></svg>
        <h1>No bookmarks yet</h1>
        <p>Upload an exported bookmarks file (.html, .htm, or .json) from Edge, Chrome, Firefox, Brave, Opera, or Safari.</p>
        <button id="btn-empty-upload" class="primary" type="button">Upload bookmarks</button>
    </div>
</main>
<footer class="statusbar" id="statusbar">
    <span id="status-count">No bookmarks</span>
    <span id="status-sel" class="status-sel"></span>
</footer>
<div id="edit-overlay" class="modal-overlay" hidden>
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="edit-title">
        <button id="edit-close" class="modal-close" type="button" title="Close" aria-label="Close">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>
        </button>
        <h2 id="edit-title" class="modal-title"></h2>
        <p id="edit-text" class="modal-text"></p>
        <div id="edit-fields" hidden>
            <label class="modal-check" id="edit-folder-row"><input id="edit-is-folder" type="checkbox"> New Folder</label>
            <label class="modal-check" id="edit-separator-row"><input id="edit-is-separator" type="checkbox"> Separator</label>
            <label class="modal-label" id="edit-name-label" for="edit-name">Name</label>
            <input id="edit-name" class="modal-input" type="text" autocomplete="off" spellcheck="false">
            <label class="modal-label" for="edit-url">URL</label>
            <input id="edit-url" class="modal-input" type="text" placeholder="https://example.com" autocomplete="off" spellcheck="false">
            <label class="modal-label" for="edit-tags">Tags</label>
            <input id="edit-tags" class="modal-input" type="text" placeholder="Comma-separated, e.g. games, news" autocomplete="off" spellcheck="false">
            <p id="edit-error" class="modal-error" hidden></p>
        </div>
        <div class="modal-actions">
            <button id="edit-delete" class="primary danger" type="button" hidden>Delete</button>
            <button id="edit-cancel" class="secondary" type="button">Cancel</button>
            <button id="edit-save" class="primary" type="button">Save</button>
        </div>
    </div>
</div>
<input id="file-input" type="file" accept=".html,.htm,.json" hidden>
<div id="toast" class="toast" role="status" aria-live="polite"></div>
<div id="sync-overlay" class="sync-overlay" role="dialog" aria-modal="true" aria-labelledby="sync-title" aria-hidden="true">
    <div class="sync-modal">
        <div class="sync-modal-head">
            <h2 id="sync-title">Set up cloud sync</h2>
            <button id="sync-close" class="sync-close" type="button" title="Close" aria-label="Close">&times;</button>
        </div>
        <p class="sync-lead">Keep a synced copy of <b>bookmarks.html</b> in a cloud folder. Sign in to your provider, then choose the folder it syncs to on this computer. Weblinks writes the file there and keeps both copies matched each time you sync.</p>
        <div id="sync-providers" class="sync-providers" role="listbox" aria-label="Cloud storage provider">
            <button class="sync-provider" type="button" data-provider="Apple iCloud" data-url="https://www.icloud.com/">Apple iCloud</button>
            <button class="sync-provider" type="button" data-provider="Dropbox" data-url="https://www.dropbox.com/login">Dropbox</button>
            <button class="sync-provider" type="button" data-provider="Google Drive" data-url="https://drive.google.com/">Google Drive</button>
            <button class="sync-provider" type="button" data-provider="Microsoft OneDrive" data-url="https://onedrive.live.com/">Microsoft OneDrive</button>
            <button class="sync-provider" type="button" data-provider="pCloud" data-url="https://my.pcloud.com/">pCloud</button>
            <button class="sync-provider" type="button" data-provider="Proton Drive" data-url="https://drive.proton.me/">Proton Drive</button>
            <button class="sync-provider" type="button" data-provider="Local folder" data-url="">Local folder</button>
        </div>
        <div id="sync-instructions" class="sync-instructions">
            <p id="sync-instructions-text"></p>
            <a id="sync-open-provider" href="#" target="_blank" rel="noopener">Open provider sign-in</a>
        </div>
        <div class="sync-folder">
            <label for="sync-path">Folder</label>
            <input id="sync-path" type="text" spellcheck="false" autocomplete="off">
            <button id="sync-choose" class="primary-btn" type="button">Choose folder&hellip;</button>
        </div>
        <p id="sync-status" class="sync-status" role="status"></p>
        <p class="sync-note">The path is a reminder of where your cloud folder lives; the browser asks you to confirm the folder before anything is written. Bookmarks are only shared through the folder you choose.</p>
    </div>
</div>
<script type="application/json" id="bookmark-data">${dataJson}</script>
<script>
(function () {
    'use strict';
    var EXPORT_ID = '${exportId}';
    var BUILT_AT = ${builtAt};
    var STORAGE_KEY = 'weblinksStandaloneTree_' + EXPORT_ID;
    var UPDATED_KEY = 'weblinksStandaloneUpdated_' + EXPORT_ID;
    var FOLDER_TYPE = 'text/x-moz-place-container';
    var tree = [];
    try { tree = JSON.parse(document.getElementById('bookmark-data').textContent); } catch (e) { tree = []; }
    if (!Array.isArray(tree)) tree = [];
    var currentTree = tree;
    try {
        /* Keys are per-export so separate exported files never share edits. */
        var storedTree = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        if (Array.isArray(storedTree)) currentTree = storedTree;
    } catch (storageErr) { /* storage blocked: use the embedded copy */ }

    var treeRoot = document.getElementById('tree-root');
    var scroller = document.getElementById('scroller');
    var emptyState = document.getElementById('empty');
    var statusbar = document.getElementById('statusbar');
    var countEl = document.getElementById('status-count');
    var selectionEl = document.getElementById('status-sel');
    var fileInput = document.getElementById('file-input');
    var stats = { folders: 0, links: 0 };
    var selectedLi = null;
    var hintTimer = null;

    var EDIT_SVG = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.6 2.6l2.8 2.8-8.3 8.3-3.5.7.7-3.5z"/><path d="M9.2 4l2.8 2.8"/></svg>';
    var ADD_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v11M2.5 8h11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

    var editOverlay = document.getElementById('edit-overlay');
    var editTitle = document.getElementById('edit-title');
    var editText = document.getElementById('edit-text');
    var editFields = document.getElementById('edit-fields');
    var editName = document.getElementById('edit-name');
    var editNameLabel = document.getElementById('edit-name-label');
    var editUrl = document.getElementById('edit-url');
    var editTags = document.getElementById('edit-tags');
    var editIsFolder = document.getElementById('edit-is-folder');
    var editIsSeparator = document.getElementById('edit-is-separator');
    var editError = document.getElementById('edit-error');
    var editCancel = document.getElementById('edit-cancel');
    var editSave = document.getElementById('edit-save');
    var editDelete = document.getElementById('edit-delete');
    var editClose = document.getElementById('edit-close');
    var editFolderRow = document.getElementById('edit-folder-row');
    var editSeparatorRow = document.getElementById('edit-separator-row');
    var editMode = '';
    var editTarget = null;

    function countTree(nodes) {
        var folders = 0, links = 0, stack = (nodes || []).slice();
        while (stack.length) {
            var node = stack.pop();
            if (node.sep) continue;
            if (Array.isArray(node.c)) {
                folders++;
                for (var i = 0; i < node.c.length; i++) stack.push(node.c[i]);
            } else {
                links++;
            }
        }
        return { folders: folders, links: links };
    }

    function persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentTree));
            localStorage.setItem(UPDATED_KEY, String(Date.now()));
        } catch (err) { /* storage full or blocked: edits last for this session */ }
    }

    function getUpdatedAt() {
        try { return Number(localStorage.getItem(UPDATED_KEY)) || BUILT_AT; } catch (err) { return BUILT_AT; }
    }

    function setStatus(text, isError) {
        countEl.textContent = text;
        statusbar.classList.toggle('error', !!isError);
    }

    function updateCounts() {
        if (!currentTree.length) {
            setStatus('No bookmarks', false);
        } else {
            setStatus(
                stats.folders.toLocaleString() + ' folders \\u00b7 ' +
                stats.links.toLocaleString() + ' links',
                false
            );
        }
    }

    function cleanText(value) {
        return String(value == null ? '' : value).replace(/\\s+/g, ' ').trim();
    }

    function directChild(el, tagName) {
        for (var i = 0; i < el.children.length; i++) {
            if (el.children[i].tagName === tagName) return el.children[i];
        }
        return null;
    }

    function parseNetscapeHTML(raw) {
        var doc = new DOMParser().parseFromString(raw, 'text/html');
        function parseContainer(container) {
            var out = [];
            var children = Array.prototype.slice.call(container.children);
            var pendingFolder = null;
            for (var i = 0; i < children.length; i++) {
                var el = children[i];
                var tag = el.tagName;
                if (tag === 'DL') {
                    if (pendingFolder) pendingFolder.c = parseContainer(el);
                    else out.push.apply(out, parseContainer(el));
                    pendingFolder = null;
                    continue;
                }
                if (tag !== 'DT') {
                    if (tag === 'BODY' || tag === 'HTML') out.push.apply(out, parseContainer(el));
                    continue;
                }
                var heading = directChild(el, 'H3');
                if (heading) {
                    var folder = { n: cleanText(heading.textContent) || 'Untitled folder', c: [] };
                    out.push(folder);
                    var nestedList = directChild(el, 'DL');
                    if (nestedList) folder.c = parseContainer(nestedList);
                    else pendingFolder = folder;
                    continue;
                }
                var link = directChild(el, 'A');
                if (link) {
                    var href = (link.getAttribute('href') || '').trim();
                    out.push({ n: cleanText(link.textContent) || href || 'Untitled link', u: href });
                    pendingFolder = null;
                }
            }
            return out;
        }
        var root = doc.body || doc.documentElement;
        return root ? parseContainer(root) : [];
    }

    function parseFirefoxJSON(raw) {
        var data;
        try { data = JSON.parse(raw); } catch (err) { return []; }
        function convert(item) {
            if (!item || typeof item !== 'object') return null;
            if (item.type === 'text/x-moz-place-separator') return { sep: true };
            var title = cleanText(item.title);
            if (Array.isArray(item.children) || item.type === FOLDER_TYPE) {
                var kids = [];
                var list = item.children || [];
                for (var i = 0; i < list.length; i++) {
                    var child = convert(list[i]);
                    if (child) kids.push(child);
                }
                return { n: title || 'Untitled folder', c: kids };
            }
            if (item.uri) return { n: title || item.uri, u: item.uri };
            return null;
        }
        var out = [];
        if (Array.isArray(data)) {
            out = data.map(convert).filter(Boolean);
        } else if (data && data.roots && typeof data.roots === 'object') {
            var order = [
                ['toolbar', 'Bookmarks Toolbar'],
                ['menu', 'Bookmarks Menu'],
                ['unfiled', 'Other Bookmarks'],
                ['mobile', 'Mobile Bookmarks']
            ];
            for (var i = 0; i < order.length; i++) {
                var root = data.roots[order[i][0]];
                if (!root) continue;
                var converted = convert(root);
                if (converted && converted.c && converted.c.length) {
                    converted.n = order[i][1];
                    out.push(converted);
                }
            }
        } else if (data && Array.isArray(data.children)) {
            var rootLabels = {
                bookmarksMenuFolder: 'Bookmarks Menu',
                toolbarFolder: 'Bookmarks Toolbar',
                unfiledBookmarksFolder: 'Other Bookmarks',
                mobileFolder: 'Mobile Bookmarks'
            };
            out = data.children.map(function (item) {
                var result = convert(item);
                if (!result) return null;
                var label = rootLabels[item.root];
                if (!label) {
                    var guid = String(item.guid || '');
                    if (guid.indexOf('menu') === 0) label = 'Bookmarks Menu';
                    else if (guid.indexOf('toolbar') === 0) label = 'Bookmarks Toolbar';
                    else if (guid.indexOf('unfiled') === 0) label = 'Other Bookmarks';
                    else if (guid.indexOf('mobile') === 0) label = 'Mobile Bookmarks';
                }
                if (label && Array.isArray(result.c)) result.n = label;
                return result;
            }).filter(Boolean);
        }
        return out;
    }

    function parseAppExportHTML(raw) {
        var match = String(raw || '').match(/<script[^>]*\\bid\\s*=\\s*["']bookmark-data["'][^>]*>([\\s\\S]*?)<\\/script>/i);
        if (!match) return null;
        var tree;
        try {
            tree = JSON.parse(match[1]);
        } catch (err) {
            return null;
        }
        return Array.isArray(tree) ? tree : null;
    }

    function parseFileText(raw, fileName) {
        var name = String(fileName || '');
        var ext = name.indexOf('.') >= 0 ? name.split('.').pop().toLowerCase() : '';
        var looksJson = /^\\s*[\\[{]/.test(String(raw || ''));
        var parsed;
        if (ext === 'json' || (ext !== 'html' && ext !== 'htm' && looksJson)) {
            parsed = parseFirefoxJSON(raw);
        } else {
            parsed = parseAppExportHTML(raw) || parseNetscapeHTML(raw);
        }
        return { tree: parsed, stats: countTree(parsed) };
    }

    function makeEditButton(li, node, kind) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'edit-btn';
        var name = node.n || (kind === 'folder' ? 'Untitled folder' : (kind === 'separator' ? 'Separator' : 'Untitled link'));
        btn.title = 'Edit ' + kind;
        btn.setAttribute('aria-label', 'Edit ' + kind + ' ' + name);
        btn.innerHTML = EDIT_SVG;
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            openEditModal(li, node, kind);
        });
        return btn;
    }

    function buildAddRow(folderNode) {
        var li = document.createElement('li');
        li.className = 'add-row';
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'add-btn';
        btn.title = folderNode
            ? 'Add a bookmark to ' + (folderNode.n || 'this folder')
            : 'Add a bookmark';
        btn.setAttribute('aria-label', btn.title);
        btn.innerHTML = ADD_SVG;
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            openAddModal(folderNode, li);
        });
        li.appendChild(btn);
        return li;
    }

    function buildNode(node) {
        var isSeparator = !!node.sep;
        var isFolder = !isSeparator && Array.isArray(node.c);
        var li = document.createElement('li');
        li.className = 'node ' + (isSeparator ? 'separator' : (isFolder ? 'folder' : 'link'));
        li.setAttribute('role', 'treeitem');
        li.__node = node;

        var row = document.createElement('div');
        row.className = 'row';

        var twisty = document.createElement('span');
        twisty.className = 'twisty';
        row.appendChild(twisty);

        if (isSeparator) {
            twisty.classList.add('leaf');
            var spacer = document.createElement('span');
            spacer.className = 'ico';
            row.appendChild(spacer);
            var hr = document.createElement('hr');
            hr.className = 'tree-sep';
            row.appendChild(hr);
            li.appendChild(row);
            row.title = 'Separator';
            row.setAttribute('aria-label', 'Separator');
            row.appendChild(makeEditButton(li, node, 'separator'));
            return li;
        }

        var icon = document.createElement('span');
        icon.className = 'ico ' + (isFolder ? 'folder-ico' : 'link-ico');
        row.appendChild(icon);

        var label = document.createElement('span');
        label.className = 'label';
        label.textContent = node.n || (isFolder ? 'Untitled folder' : 'Untitled link');
        row.appendChild(label);

        li.appendChild(row);

        if (isFolder) {
            var children = node.c || [];
            var list = document.createElement('ul');
            list.className = 'children';
            list.setAttribute('role', 'group');
            var frag = document.createDocumentFragment();
            for (var i = 0; i < children.length; i++) frag.appendChild(buildNode(children[i]));
            list.appendChild(frag);
            list.appendChild(buildAddRow(node));
            li.appendChild(list);
            li.setAttribute('aria-expanded', 'false');
            row.title = (node.n || 'Untitled folder') + (children.length ? ' (' + children.length + ')' : ' (empty)');
            row.setAttribute('aria-label', node.n || 'Untitled folder');
            row.appendChild(makeEditButton(li, node, 'folder'));
        } else {
            twisty.classList.add('leaf');
            var url = node.u || '';
            row.dataset.url = url;
            row.title = (node.n ? node.n + '\\n' : '') + url;
            icon.title = 'Open in a new tab';
            label.title = (node.n ? node.n + ' \\u2014 ' : '') + url;
            row.appendChild(makeEditButton(li, node, 'bookmark'));
        }
        return li;
    }

    function setExpanded(li, expanded) {
        var list = li.querySelector(':scope > ul.children');
        if (!list) return;
        li.classList.toggle('expanded', expanded);
        li.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }

    function toggleFolder(li) {
        setExpanded(li, !li.classList.contains('expanded'));
    }

    function clearSelection() {
        if (selectedLi) selectedLi.classList.remove('selected');
        selectedLi = null;
        selectionEl.textContent = '';
        selectionEl.title = '';
    }

    function showSelectionText(node) {
        var text = node.sep ? 'Separator' : (node.n || '');
        if (!node.sep && !Array.isArray(node.c) && node.u) {
            text += (text ? ' \\u2014 ' : '') + node.u;
        }
        selectionEl.textContent = text;
        selectionEl.title = text;
    }

    function selectNode(li, scrollIntoView) {
        if (!li || li === selectedLi) {
            if (li && scrollIntoView) {
                var currentRow = li.querySelector(':scope > .row');
                if (currentRow) currentRow.scrollIntoView({ block: 'nearest' });
            }
            return;
        }
        if (selectedLi) selectedLi.classList.remove('selected');
        selectedLi = li;
        li.classList.add('selected');
        if (scrollIntoView) {
            var row = li.querySelector(':scope > .row');
            if (row) row.scrollIntoView({ block: 'nearest' });
        }
        showSelectionText(li.__node || {});
    }

    function isSafeUrl(url) {
        try {
            var parsed = new URL(url, document.baseURI);
            return ['http:', 'https:', 'file:', 'ftp:', 'mailto:'].indexOf(parsed.protocol) !== -1;
        } catch (err) {
            return false;
        }
    }

    function openLink(url) {
        url = String(url || '').trim();
        if (!url) return;
        if (!isSafeUrl(url)) {
            setStatus('Blocked unsafe link: ' + url, true);
            return;
        }
        window.open(url, '_blank', 'noopener');
    }

    function followLink(url) {
        url = String(url || '').trim();
        if (!url) return;
        if (!isSafeUrl(url)) {
            setStatus('Blocked unsafe link: ' + url, true);
            return;
        }
        window.location.href = url;
    }

    var POPOUT_KEY = 'weblinksOpenInNewTabs';
    var popoutButton = document.getElementById('btn-popout-all');
    var popoutAll = false;
    try { popoutAll = localStorage.getItem(POPOUT_KEY) === 'true'; } catch (err) { popoutAll = false; }

    function applyPopoutState() {
        popoutButton.setAttribute('aria-pressed', popoutAll ? 'true' : 'false');
    }

    applyPopoutState();

    popoutButton.addEventListener('click', function () {
        popoutAll = !popoutAll;
        try { localStorage.setItem(POPOUT_KEY, popoutAll ? 'true' : 'false'); } catch (err) { /* storage may be blocked on file:// */ }
        applyPopoutState();
    });

    function followBookmark(url) {
        if (popoutAll) openLink(url);
        else followLink(url);
    }

    function showEditError(text) {
        editError.textContent = text;
        editError.hidden = false;
    }

    function parseTags(text) {
        var parts = String(text || '').split(',');
        var seen = {};
        var tags = [];
        for (var i = 0; i < parts.length; i++) {
            var tag = parts[i].trim();
            if (!tag) continue;
            var key = tag.toLowerCase();
            if (seen[key]) continue;
            seen[key] = true;
            tags.push(tag);
        }
        return tags;
    }

    function findParentArray(node, list) {
        var pool = list || currentTree;
        for (var i = 0; i < pool.length; i++) {
            if (pool[i] === node) return pool;
            if (pool[i] && Array.isArray(pool[i].c)) {
                var found = findParentArray(node, pool[i].c);
                if (found) return found;
            }
        }
        return null;
    }

    function refreshFolderTitle(folderNode, folderLi) {
        if (!folderLi) return;
        var row = folderLi.querySelector(':scope > .row');
        if (!row) return;
        var count = (folderNode.c || []).length;
        row.title = (folderNode.n || 'Untitled folder') + (count ? ' (' + count + ')' : ' (empty)');
    }

    function afterTreeChange() {
        stats = countTree(currentTree);
        updateCounts();
        persist();
        if (!currentTree.length) render([]);
    }

    function closeEditModal() {
        editOverlay.hidden = true;
        editMode = '';
        editTarget = null;
        scroller.focus({ preventScroll: true });
    }

    function syncFolderMode() {
        if (editIsSeparator.checked) editIsFolder.checked = false;
        else if (editIsFolder.checked) editIsSeparator.checked = false;
        var isSep = editIsSeparator.checked;
        var isFolder = editIsFolder.checked;
        editIsFolder.disabled = isSep;
        editIsSeparator.disabled = isFolder;
        editName.disabled = isSep;
        editUrl.disabled = isSep || isFolder;
        editTags.disabled = isSep || isFolder;
        editName.placeholder = isSep ? 'Separators do not have a name' : '';
        editUrl.placeholder = isSep
            ? 'Separators do not have a URL'
            : (isFolder ? 'Folders do not have a URL' : 'https://example.com');
        editTags.placeholder = isSep
            ? 'Separators do not have tags'
            : (isFolder ? 'Folders do not have tags' : 'Comma-separated, e.g. games, news');
        editNameLabel.textContent = isFolder ? 'Folder name' : 'Name';
        if (editMode === 'add') {
            var noun = isSep ? 'separator' : (isFolder ? 'folder' : 'bookmark');
            var parentFolder = editTarget && editTarget.folder;
            editText.textContent = parentFolder
                ? 'New ' + noun + ' inside "' + (parentFolder.n || 'Untitled folder') + '".'
                : 'New ' + noun + ' in the top level.';
        }
        editError.hidden = true;
    }

    editIsFolder.addEventListener('change', syncFolderMode);
    editIsSeparator.addEventListener('change', syncFolderMode);

    function openAddModal(folderNode, addRowLi) {
        editMode = 'add';
        editTarget = { folder: folderNode, addRow: addRowLi };
        editTitle.textContent = 'Bookmark Properties';
        editText.textContent = folderNode
            ? 'New bookmark inside "' + (folderNode.n || 'Untitled folder') + '".'
            : 'New bookmark in the top level.';
        editFields.hidden = false;
        editFolderRow.hidden = false;
        editSeparatorRow.hidden = false;
        editName.value = '';
        editUrl.value = '';
        editTags.value = '';
        editIsFolder.checked = false;
        editIsSeparator.checked = false;
        syncFolderMode();
        editError.hidden = true;
        editSave.textContent = 'Save';
        editSave.classList.remove('danger');
        editDelete.hidden = true;
        editOverlay.hidden = false;
        editName.focus();
    }

    function openEditModal(li, node, kind) {
        var isFolder = kind === 'folder';
        var isSep = kind === 'separator';
        editMode = 'edit';
        editTarget = { li: li, node: node, kind: kind };
        editTitle.textContent = 'Bookmark Properties';
        var parentLi = li.parentElement ? li.parentElement.closest('li.node.folder') : null;
        editText.textContent = parentLi && parentLi.__node
            ? 'Inside "' + (parentLi.__node.n || 'Untitled folder') + '".'
            : 'Top level.';
        editFields.hidden = false;
        editFolderRow.hidden = false;
        editSeparatorRow.hidden = false;
        editName.value = node.n || '';
        editUrl.value = node.u || '';
        editTags.value = (node.t || []).join(', ');
        editIsFolder.checked = isFolder;
        editIsSeparator.checked = isSep;
        syncFolderMode();
        editError.hidden = true;
        editSave.textContent = 'Save';
        editSave.classList.remove('danger');
        editDelete.hidden = false;
        editOverlay.hidden = false;
        (isSep ? editSave : editName).focus();
    }

    function commitAdd() {
        var target = editTarget;
        var parentList = target.folder ? target.folder.c : currentTree;
        if (!Array.isArray(parentList)) return;

        var isSep = editIsSeparator.checked;
        var isFolder = !isSep && editIsFolder.checked;
        var name = editName.value.trim();
        var node;
        if (isSep) {
            node = { sep: true };
        } else if (isFolder) {
            if (!name) { showEditError('Enter a folder name.'); return; }
            node = { n: name, c: [] };
        } else {
            var url = editUrl.value.trim();
            if (!url) { showEditError('Enter a URL.'); return; }
            if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;
            if (!isSafeUrl(url)) { showEditError('That link type is not allowed.'); return; }
            node = { n: name || url, u: url };
            var tags = parseTags(editTags.value);
            if (tags.length) node.t = tags;
        }
        parentList.push(node);
        var li = buildNode(node);
        if (target.addRow && target.addRow.parentNode) {
            target.addRow.parentNode.insertBefore(li, target.addRow);
        }
        if (isFolder) setExpanded(li, true);
        if (target.folder) refreshFolderTitle(target.folder, target.addRow.parentNode.parentElement);
        closeEditModal();
        selectNode(li, true);
        afterTreeChange();
    }

    function commitEdit() {
        var target = editTarget;
        if (!target || !target.node) return;
        var node = target.node;
        var kind = target.kind;
        var name = editName.value.trim();
        var isSep = editIsSeparator.checked;
        var isFolder = !isSep && editIsFolder.checked;
        var nextKind = isSep ? 'separator' : (isFolder ? 'folder' : 'bookmark');

        if (isSep) {
            node.sep = true;
            delete node.c;
            delete node.n;
            delete node.u;
            delete node.t;
        } else if (isFolder) {
            if (!name) { showEditError('Enter a folder name.'); return; }
            delete node.sep;
            delete node.u;
            delete node.t;
            node.n = name;
            if (!Array.isArray(node.c)) node.c = [];
        } else {
            var url = editUrl.value.trim();
            if (!url) { showEditError('Enter a URL.'); return; }
            if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = 'https://' + url;
            if (!isSafeUrl(url)) { showEditError('That link type is not allowed.'); return; }
            delete node.sep;
            delete node.c;
            node.n = name || url;
            node.u = url;
            var tags = parseTags(editTags.value);
            if (tags.length) node.t = tags;
            else delete node.t;
        }

        if (nextKind !== kind) {
            var wasSelected = selectedLi === target.li;
            var parentLi = target.li.parentElement ? target.li.parentElement.closest('li.node.folder') : null;
            var parentNode = parentLi ? parentLi.__node : null;
            var replacement = buildNode(node);
            target.li.parentNode.replaceChild(replacement, target.li);
            if (selectedLi === target.li) selectedLi = null;
            if (nextKind === 'folder') setExpanded(replacement, true);
            if (parentNode) refreshFolderTitle(parentNode, parentLi);
            closeEditModal();
            if (wasSelected) selectNode(replacement, true);
            afterTreeChange();
            return;
        }

        refreshNodeRow(target.li, node, kind);
        if (selectedLi === target.li) showSelectionText(node);
        closeEditModal();
        afterTreeChange();
    }

    function refreshNodeRow(li, node, kind) {
        var row = li.querySelector(':scope > .row');
        if (!row) return;
        var editBtn = row.querySelector('.edit-btn');
        if (node.sep) {
            row.title = 'Separator';
            row.setAttribute('aria-label', 'Separator');
            if (editBtn) editBtn.setAttribute('aria-label', 'Edit separator Separator');
            return;
        }
        var label = row.querySelector('.label');
        var fallback = kind === 'folder' ? 'Untitled folder' : 'Untitled link';
        var text = node.n || fallback;
        if (label) label.textContent = text;
        if (editBtn) editBtn.setAttribute('aria-label', 'Edit ' + kind + ' ' + text);

        if (kind === 'folder') {
            refreshFolderTitle(node, li);
            row.setAttribute('aria-label', text);
        } else {
            var url = node.u || '';
            row.dataset.url = url;
            row.title = (node.n ? node.n + '\\n' : '') + url;
            if (label) label.title = (node.n ? node.n + ' \\u2014 ' : '') + url;
        }
    }

    function commitDelete() {
        var target = editTarget;
        var list = findParentArray(target.node);
        if (list) {
            var idx = list.indexOf(target.node);
            if (idx !== -1) list.splice(idx, 1);
        }
        if (selectedLi && target.li.contains(selectedLi)) clearSelection();
        var parentLi = target.li.parentElement ? target.li.parentElement.closest('li.node.folder') : null;
        var parentNode = parentLi ? parentLi.__node : null;
        target.li.remove();
        if (parentNode) refreshFolderTitle(parentNode, parentLi);
        closeEditModal();
        afterTreeChange();
    }

    function render(next) {
        currentTree = Array.isArray(next) ? next : [];
        stats = countTree(currentTree);
        clearSelection();
        treeRoot.textContent = '';
        emptyState.hidden = currentTree.length > 0;

        if (currentTree.length) {
            var frag = document.createDocumentFragment();
            for (var i = 0; i < currentTree.length; i++) frag.appendChild(buildNode(currentTree[i]));
            treeRoot.appendChild(frag);
            treeRoot.appendChild(buildAddRow(null));

            var top = treeRoot.querySelectorAll(':scope > li.folder');
            for (var j = 0; j < top.length; j++) setExpanded(top[j], true);
        }
        updateCounts();
    }

    treeRoot.addEventListener('click', function (e) {
        var row = e.target.closest ? e.target.closest('.row') : null;
        if (!row) return;
        var li = row.parentElement;
        if (!li || !li.classList.contains('node')) return;
        scroller.focus({ preventScroll: true });

        if (e.target.closest('.twisty') && li.classList.contains('folder')) {
            selectNode(li, false);
            toggleFolder(li);
            return;
        }
        selectNode(li, false);
        if (li.classList.contains('link') && e.detail <= 1) {
            var url = (li.__node || {}).u;
            if (e.target.closest('.ico.link-ico')) openLink(url);
            else followBookmark(url);
        }
    });

    treeRoot.addEventListener('dblclick', function (e) {
        if (e.target.closest && (e.target.closest('.edit-btn') || e.target.closest('.add-btn'))) return;
        var row = e.target.closest ? e.target.closest('.row') : null;
        if (!row) return;
        var li = row.parentElement;
        if (li && li.classList.contains('folder')) toggleFolder(li);
    });

    editSave.addEventListener('click', function () {
        if (editMode === 'add') commitAdd();
        else if (editMode === 'edit') commitEdit();
    });
    editDelete.addEventListener('click', function () {
        if (editMode === 'edit') commitDelete();
    });
    editClose.addEventListener('click', closeEditModal);
    editCancel.addEventListener('click', closeEditModal);
    editOverlay.addEventListener('mousedown', function (e) {
        if (e.target === editOverlay) closeEditModal();
    });
    editOverlay.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            closeEditModal();
        } else if (e.key === 'Enter' && e.target !== editIsFolder) {
            e.preventDefault();
            if (editMode === 'add') commitAdd();
            else if (editMode === 'edit') commitEdit();
        }
    });

    function showHint(text) {
        if (hintTimer) clearTimeout(hintTimer);
        setStatus(text, false);
        hintTimer = setTimeout(updateCounts, 4000);
    }

    document.getElementById('btn-expand').addEventListener('click', function () {
        var folders = treeRoot.querySelectorAll('li.folder');
        for (var i = 0; i < folders.length; i++) setExpanded(folders[i], true);
    });
    document.getElementById('btn-collapse').addEventListener('click', function () {
        var folders = treeRoot.querySelectorAll('li.folder');
        for (var i = 0; i < folders.length; i++) setExpanded(folders[i], false);
    });
    document.getElementById('btn-sync').addEventListener('click', function () {
        handleSyncClick();
    });

    document.getElementById('btn-upload').addEventListener('click', function () {
        fileInput.click();
    });
    document.getElementById('btn-empty-upload').addEventListener('click', function () {
        fileInput.click();
    });
    fileInput.addEventListener('change', function () {
        var file = fileInput.files && fileInput.files[0];
        fileInput.value = '';
        if (!file) return;
        var ext = file.name.indexOf('.') >= 0 ? file.name.split('.').pop().toLowerCase() : '';
        if (['html', 'htm', 'json'].indexOf(ext) === -1) {
            showHint('Unsupported file type. Choose an .html, .htm, or .json bookmarks export.');
            statusbar.classList.add('error');
            return;
        }
        showHint('Reading ' + file.name + '\\u2026');
        file.text().then(function (raw) {
            var result;
            try {
                result = parseFileText(raw, file.name);
            } catch (err) {
                showHint('Could not parse ' + file.name + '.');
                return;
            }
            if (!result.tree.length) {
                showHint('No bookmarks were found in ' + file.name + '.');
                return;
            }
            render(result.tree);
            persist();
        }).catch(function () {
            showHint('Could not read ' + file.name + '.');
        });
    });

    document.getElementById('btn-clear').addEventListener('click', function () {
        currentTree = [];
        persist();
        render([]);
    });

    document.getElementById('btn-download').addEventListener('click', function () {
        if (!currentTree.length) {
            showHint('No bookmarks are available to download yet.');
            statusbar.classList.add('error');
            return;
        }
        closeEditModal();
        var html = buildExportHTML(currentTree);
        var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'bookmarks.html';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 5000);
    });

    /* ---- Cloud folder sync ---- */
    var SYNC_PROVIDER_KEY = 'weblinksSyncProvider';
    var SYNC_FOLDER_KEY = 'weblinksSyncFolderName';
    var SYNC_DB_NAME = 'weblinks-sync';
    var SYNC_STORE = 'handles';
    var SYNC_HANDLE_KEY = 'folder';
    var SYNC_FILE = 'bookmarks.html';

    var syncOverlay = document.getElementById('sync-overlay');
    var syncStatusEl = document.getElementById('sync-status');
    var syncPathInput = document.getElementById('sync-path');
    var syncChooseBtn = document.getElementById('sync-choose');
    var syncInstructionsText = document.getElementById('sync-instructions-text');
    var syncOpenLink = document.getElementById('sync-open-provider');
    var syncProviders = Array.prototype.slice.call(document.querySelectorAll('.sync-provider'));
    var selectedProvider = 'Local folder';
    var savedHandle = null;
    var syncModalMode = 'setup';
    var toastEl = document.getElementById('toast');
    var toastTimer = null;

    var SYNC_STEPS = {
        'Apple iCloud': 'Sign in to iCloud and turn on iCloud Drive on this computer, then choose your iCloud Drive folder below.',
        'Dropbox': 'Sign in to Dropbox and install the Dropbox desktop app so the folder syncs locally, then choose your Dropbox folder below.',
        'Google Drive': 'Sign in to Google Drive and install Google Drive for desktop, then choose your Google Drive folder below.',
        'Microsoft OneDrive': 'Sign in to OneDrive and use the OneDrive desktop app, then choose your OneDrive folder below.',
        'pCloud': 'Sign in to pCloud and install pCloud Drive, then choose your pCloud Drive folder below.',
        'Proton Drive': 'Sign in to Proton Drive and install Proton Drive for desktop, then choose your Proton Drive folder below.',
        'Local folder': 'Choose any folder on this computer. The browser will ask you to confirm access.'
    };

    function showSyncToast(message) {
        if (!toastEl) return;
        toastEl.textContent = message;
        toastEl.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 4000);
    }

    function readSyncConfig(key) {
        try { return localStorage.getItem(key) || ''; } catch (err) { return ''; }
    }

    function writeSyncConfig(key, value) {
        try {
            if (value) localStorage.setItem(key, value);
            else localStorage.removeItem(key);
        } catch (err) { /* ignore */ }
    }

    function defaultFolderHint() {
        var ua = navigator.userAgent;
        if (/Windows/i.test(ua)) return '%USERPROFILE%';
        if (/Macintosh|Mac OS X|Linux/i.test(ua)) return '~';
        return '~';
    }

    function openSyncDb() {
        return new Promise(function (resolve, reject) {
            if (!window.indexedDB) { reject(new Error('This browser cannot remember folder access.')); return; }
            var req = indexedDB.open(SYNC_DB_NAME, 1);
            req.onupgradeneeded = function () {
                if (!req.result.objectStoreNames.contains(SYNC_STORE)) req.result.createObjectStore(SYNC_STORE);
            };
            req.onsuccess = function () { resolve(req.result); };
            req.onerror = function () { reject(req.error || new Error('Could not open local storage.')); };
        });
    }

    function syncDbGet() {
        return openSyncDb().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx = db.transaction(SYNC_STORE, 'readonly');
                var req = tx.objectStore(SYNC_STORE).get(SYNC_HANDLE_KEY);
                req.onsuccess = function () { resolve(req.result || null); };
                req.onerror = function () { reject(req.error); };
            });
        });
    }

    function syncDbSet(handle) {
        return openSyncDb().then(function (db) {
            return new Promise(function (resolve, reject) {
                var tx = db.transaction(SYNC_STORE, 'readwrite');
                tx.objectStore(SYNC_STORE).put(handle, SYNC_HANDLE_KEY);
                tx.oncomplete = function () { resolve(); };
                tx.onerror = function () { reject(tx.error); };
            });
        });
    }

    function setSyncStatus(message, isError) {
        syncStatusEl.textContent = message || '';
        syncStatusEl.classList.toggle('error', !!isError);
    }

    function selectSyncProvider(btn) {
        if (!btn) return;
        selectedProvider = btn.getAttribute('data-provider');
        for (var i = 0; i < syncProviders.length; i++) {
            var p = syncProviders[i];
            var on = p === btn;
            p.classList.toggle('selected', on);
            p.setAttribute('aria-selected', on ? 'true' : 'false');
        }
        syncInstructionsText.textContent = SYNC_STEPS[selectedProvider] || '';
        var url = btn.getAttribute('data-url');
        if (url) {
            syncOpenLink.hidden = false;
            syncOpenLink.href = url;
            syncOpenLink.textContent = 'Open ' + selectedProvider + ' sign-in';
        } else {
            syncOpenLink.hidden = true;
            syncOpenLink.removeAttribute('href');
        }
    }

    function closeSyncModal() {
        syncOverlay.classList.remove('open');
        syncOverlay.setAttribute('aria-hidden', 'true');
    }

    function openSyncModal(mode) {
        syncModalMode = mode === 'reconnect' ? 'reconnect' : 'setup';
        setSyncStatus('');

        var folderName = readSyncConfig(SYNC_FOLDER_KEY);
        syncPathInput.value = folderName || defaultFolderHint();
        syncChooseBtn.textContent = syncModalMode === 'reconnect' ? 'Reconnect folder\\u2026' : 'Choose folder\\u2026';

        var wanted = readSyncConfig(SYNC_PROVIDER_KEY);
        var match = null;
        for (var i = 0; i < syncProviders.length; i++) {
            if (syncProviders[i].getAttribute('data-provider') === wanted) match = syncProviders[i];
        }
        selectSyncProvider(match || syncProviders[syncProviders.length - 1]);

        if (!('showDirectoryPicker' in window)) {
            syncChooseBtn.disabled = true;
            setSyncStatus('This browser cannot write to a folder. Use the Download button to save bookmarks.html into your cloud folder instead.', true);
        } else {
            syncChooseBtn.disabled = false;
            if (syncModalMode === 'reconnect') setSyncStatus('Reconnect the saved folder to continue syncing.');
            else if (folderName) setSyncStatus('Syncing with "' + folderName + '".');
        }

        syncOverlay.classList.add('open');
        syncOverlay.setAttribute('aria-hidden', 'false');
        document.getElementById('sync-close').focus();
    }

    function querySyncPermission(handle) {
        return Promise.resolve()
            .then(function () { return handle.queryPermission({ mode: 'readwrite' }); })
            .catch(function () { return 'prompt'; });
    }

    async function readRemote(dir) {
        try {
            var fh = await dir.getFileHandle(SYNC_FILE);
            var file = await fh.getFile();
            return { file: file, text: await file.text() };
        } catch (err) {
            if (err && (err.name === 'NotFoundError' || err.name === 'TypeMismatchError')) return null;
            throw err;
        }
    }

    async function writeRemote(dir, html) {
        var fh = await dir.getFileHandle(SYNC_FILE, { create: true });
        var writer = await fh.createWritable();
        await writer.write(html);
        await writer.close();
    }

    function treeFromSyncedText(text) {
        if (!text) return [];
        try {
            var doc = new DOMParser().parseFromString(text, 'text/html');
            var el = doc.getElementById('bookmark-data');
            if (el) {
                var data = JSON.parse(el.textContent);
                if (Array.isArray(data)) return data;
            }
        } catch (err) { /* fall through to a plain export */ }
        try { return parseFileText(text, SYNC_FILE).tree; } catch (err) { return []; }
    }

    function buildExportHTML(tree) {
        var dataEl = document.getElementById('bookmark-data');
        dataEl.textContent = JSON.stringify(Array.isArray(tree) ? tree : []).replace(/</g, '\\u003c');

        /* Normalize transient UI before serializing so repeated builds of the
         * same tree are byte-identical (needed for the sync comparison). */
        var syncWasOpen = syncOverlay.classList.contains('open');
        var toastWasShown = toastEl.classList.contains('show');
        var toastWasText = toastEl.textContent;
        var popoutWasPressed = popoutButton.getAttribute('aria-pressed') === 'true';
        var spinners = Array.prototype.slice.call(document.querySelectorAll('.tool.spinning'));
        syncOverlay.classList.remove('open');
        syncOverlay.setAttribute('aria-hidden', 'true');
        toastEl.classList.remove('show');
        toastEl.textContent = '';
        syncStatusEl.textContent = '';
        syncStatusEl.classList.remove('error');
        syncStatusEl.textContent = '';
        syncInstructionsText.textContent = '';
        syncOpenLink.hidden = false;
        syncOpenLink.setAttribute('href', '#');
        syncOpenLink.textContent = 'Open provider sign-in';
        syncChooseBtn.disabled = false;
        syncChooseBtn.textContent = 'Choose folder\\u2026';
        for (var i = 0; i < syncProviders.length; i++) {
            syncProviders[i].classList.remove('selected');
            syncProviders[i].removeAttribute('aria-selected');
        }
        statusbar.classList.remove('error');
        countEl.textContent = 'No bookmarks';
        selectionEl.textContent = '';
        selectionEl.title = '';
        document.getElementById('edit-overlay').hidden = true;
        treeRoot.textContent = '';
        popoutButton.setAttribute('aria-pressed', 'false');
        for (var s = 0; s < spinners.length; s++) spinners[s].classList.remove('spinning');

        var html = '<!DOCTYPE html>\\n' + document.documentElement.outerHTML;

        popoutButton.setAttribute('aria-pressed', popoutWasPressed ? 'true' : 'false');
        if (syncWasOpen) syncOverlay.classList.add('open');
        if (toastWasShown) {
            toastEl.textContent = toastWasText;
            toastEl.classList.add('show');
        }
        for (var s2 = 0; s2 < spinners.length; s2++) spinners[s2].classList.add('spinning');
        render(currentTree);
        return html;
    }

    async function syncWithFolder(dir, tree, updatedAt) {
        var localTree = Array.isArray(tree) ? tree : [];
        var remote = await readRemote(dir);
        var localHtml = localTree.length ? buildExportHTML(localTree) : '';

        if (!remote) {
            if (!localTree.length) return { ok: true, message: 'No bookmarks to sync yet.' };
            await writeRemote(dir, localHtml);
            persist();
            return { ok: true, message: 'Saved bookmarks.html to "' + dir.name + '".' };
        }

        var remoteTree = treeFromSyncedText(remote.text);

        if (!localTree.length) {
            if (!remoteTree.length) return { ok: true, message: 'No bookmarks to sync yet.' };
            render(remoteTree);
            persist();
            var normalized = buildExportHTML(remoteTree);
            if (remote.text !== normalized) {
                try { await writeRemote(dir, normalized); } catch (err) { /* keep the local copy */ }
            }
            return { ok: true, message: 'Loaded bookmarks from "' + dir.name + '".' };
        }

        var remoteTs = remote.file.lastModified || 0;
        if (remote.text === localHtml) {
            return { ok: true, message: 'Already in sync with "' + dir.name + '".' };
        }
        if (remoteTs > updatedAt + 1000) {
            if (remoteTree.length) {
                render(remoteTree);
                persist();
                return { ok: true, message: 'Updated from "' + dir.name + '" (that copy was newer).' };
            }
            await writeRemote(dir, localHtml);
            persist();
            return { ok: true, message: 'Saved bookmarks.html to "' + dir.name + '".' };
        }

        await writeRemote(dir, localHtml);
        persist();
        return { ok: true, message: 'Saved bookmarks.html to "' + dir.name + '".' };
    }

    async function handleSyncClick() {
        var syncBtn = document.getElementById('btn-sync');
        syncBtn.classList.add('spinning');
        try {
            var handle = savedHandle;
            if (!handle) {
                try { handle = await syncDbGet(); } catch (err) { handle = null; }
            }
            savedHandle = handle;
            if (!handle) { openSyncModal('setup'); return; }
            var perm = await querySyncPermission(handle);
            if (perm !== 'granted') { openSyncModal('reconnect'); return; }
            showHint('Syncing\\u2026');
            var result = await syncWithFolder(handle, currentTree, getUpdatedAt()).catch(function (err) {
                return { ok: false, message: 'Could not sync: ' + ((err && err.message) || err) };
            });
            showHint(result.message);
            statusbar.classList.toggle('error', !result.ok);
            if (result.ok) showSyncToast(result.message);
        } finally {
            syncBtn.classList.remove('spinning');
        }
    }

    async function connectSyncFolder(dir) {
        var perm = 'granted';
        try { perm = await dir.queryPermission({ mode: 'readwrite' }); } catch (err) { /* ask below */ }
        if (perm !== 'granted') {
            try { perm = await dir.requestPermission({ mode: 'readwrite' }); } catch (err) { perm = 'denied'; }
        }
        if (perm !== 'granted') {
            setSyncStatus('Folder access was not granted.', true);
            return;
        }

        savedHandle = dir;
        try { await syncDbSet(dir); } catch (err) { /* the folder still works this session */ }
        writeSyncConfig(SYNC_FOLDER_KEY, dir.name);
        writeSyncConfig(SYNC_PROVIDER_KEY, selectedProvider);
        syncPathInput.value = dir.name;
        syncChooseBtn.textContent = 'Choose different folder\\u2026';

        var result = await syncWithFolder(dir, currentTree, getUpdatedAt()).catch(function (err) {
            return { ok: false, message: 'Could not sync that folder: ' + ((err && err.message) || err) };
        });

        if (result.ok) {
            closeSyncModal();
            showSyncToast(result.message);
        } else {
            setSyncStatus(result.message, true);
        }
    }

    async function chooseSyncFolder() {
        if (!('showDirectoryPicker' in window)) return;
        setSyncStatus('Waiting for the folder picker\\u2026');
        try {
            var dir = null;
            if (!savedHandle) {
                try { savedHandle = await syncDbGet(); } catch (err) { savedHandle = null; }
            }
            if (syncModalMode === 'reconnect' && savedHandle) {
                var perm = await savedHandle.requestPermission({ mode: 'readwrite' });
                if (perm === 'granted') dir = savedHandle;
            }
            if (!dir) {
                dir = await window.showDirectoryPicker({ id: 'weblinks-sync', mode: 'readwrite', startIn: 'documents' });
            }
            await connectSyncFolder(dir);
        } catch (err) {
            if (err && err.name === 'AbortError') {
                setSyncStatus('');
                return;
            }
            setSyncStatus('Could not access that folder: ' + ((err && err.message) || err), true);
        }
    }

    for (var sp = 0; sp < syncProviders.length; sp++) {
        syncProviders[sp].addEventListener('click', function () { selectSyncProvider(this); });
    }
    syncChooseBtn.addEventListener('click', chooseSyncFolder);
    document.getElementById('sync-close').addEventListener('click', closeSyncModal);
    syncOverlay.addEventListener('click', function (e) {
        if (e.target === syncOverlay) closeSyncModal();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && syncOverlay.classList.contains('open')) closeSyncModal();
    });

    render(currentTree);
})();
</script>
</body>
</html>`;
    }

    /* Firefox "Bookmarks backup" JSON (Places structure), so the tree can be
     * restored in Firefox or re-imported by parseFirefoxJSON. */
    function buildFirefoxJSON(tree) {
        function convert(node) {
            if (node.sep) return { type: 'text/x-moz-place-separator' };
            if (Array.isArray(node.c)) {
                return {
                    type: 'text/x-moz-place-container',
                    title: node.n || '',
                    children: node.c.map(convert)
                };
            }
            return { type: 'text/x-moz-place', title: node.n || node.u || '', uri: node.u || '' };
        }

        return {
            guid: 'root________',
            title: '',
            type: 'text/x-moz-place-container',
            root: 'placesRoot',
            children: [{
                guid: 'menu________',
                title: 'menu',
                type: 'text/x-moz-place-container',
                root: 'bookmarksMenuFolder',
                children: (Array.isArray(tree) ? tree : []).map(convert)
            }]
        };
    }

    function siblingFrame(name) {
        try {
            var topWindow = global.top;
            if (topWindow && topWindow.frames && topWindow.frames[name] && topWindow.frames[name] !== global) {
                return topWindow.frames[name];
            }
        } catch (err) { /* cross-origin */ }
        return null;
    }

    function postToLeftFrame(tree, stats) {
        var payload = {
            type: 'weblinks:render-tree',
            tree: tree,
            stats: stats || countTree(tree)
        };
        var target = siblingFrame('leftFrame');
        if (target) {
            try {
                target.postMessage(payload, '*');
                return true;
            } catch (err) { /* fall through to the parent relay */ }
        }
        try {
            if (global.parent && global.parent !== global) {
                global.parent.postMessage({
                    type: 'weblinks:forward-to-left',
                    tree: payload.tree,
                    stats: payload.stats
                }, '*');
                return true;
            }
        } catch (err) { /* ignore */ }
        return false;
    }

    function postStatsToRightFrame(stats) {
        var target = siblingFrame('rightFrame');
        if (target) {
            try {
                target.postMessage({ type: 'weblinks:tree-updated', stats: stats }, '*');
                return true;
            } catch (err) { /* fall through to the parent relay */ }
        }
        try {
            if (global.parent && global.parent !== global) {
                global.parent.postMessage({ type: 'weblinks:forward-to-right', stats: stats }, '*');
                return true;
            }
        } catch (err) { /* ignore */ }
        return false;
    }

    global.WeblinksBookmarks = {
        parseFileText: parseFileText,
        parseNetscapeHTML: parseNetscapeHTML,
        parseFirefoxJSON: parseFirefoxJSON,
        parseAppExportHTML: parseAppExportHTML,
        countTree: countTree,
        saveTree: saveTree,
        loadTree: loadTree,
        clearTree: clearTree,
        getSourceName: getSourceName,
        buildStandaloneHTML: buildStandaloneHTML,
        buildFirefoxJSON: buildFirefoxJSON,
        postToLeftFrame: postToLeftFrame,
        postStatsToRightFrame: postStatsToRightFrame,
        TREE_KEY: TREE_KEY,
        SOURCE_KEY: SOURCE_KEY,
        UPDATED_KEY: UPDATED_KEY
    };
})(window);
