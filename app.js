/**
 * WebLinks-TreeView – app.js
 *
 * Parses a Netscape Bookmark File (HTML format exported by Chrome, Firefox,
 * Edge, Safari, Opera) and renders it as a collapsible tree view.
 */

'use strict';

/* ── DOM references ──────────────────────────────────────── */
const dropZone       = document.getElementById('drop-zone');
const fileInput      = document.getElementById('file-input');
const treeContainer  = document.getElementById('tree-container');
const toolbar        = document.getElementById('toolbar');
const statsEl        = document.getElementById('stats');
const searchInput    = document.getElementById('search');
const expandAllBtn   = document.getElementById('expand-all');
const collapseAllBtn = document.getElementById('collapse-all');
const loadNewBtn     = document.getElementById('load-new');
const errorMsg       = document.getElementById('error-msg');

/* ── Globals ─────────────────────────────────────────────── */
let totalFolders  = 0;
let totalBookmarks = 0;

/* ─────────────────────────────────────────────────────────
   File input / drag-and-drop
   ───────────────────────────────────────────────────────── */

dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  if (fileInput.files.length) loadFile(fileInput.files[0]);
});

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) loadFile(file);
});

loadNewBtn.addEventListener('click', resetUI);

/* ─────────────────────────────────────────────────────────
   File reading
   ───────────────────────────────────────────────────────── */

function loadFile(file) {
  hideError();

  // Accept .html and .htm files; also allow generic text types
  const name = file.name.toLowerCase();
  if (!name.endsWith('.html') && !name.endsWith('.htm')) {
    showError('Please upload an HTML bookmark file (.html or .htm) exported from your browser.');
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    try {
      processBookmarks(e.target.result);
    } catch (err) {
      showError('Could not parse the bookmark file. Make sure it was exported directly from your browser.');
      console.error(err);
    }
  };
  reader.onerror = () => showError('Could not read the file.');
  reader.readAsText(file);
}

/* ─────────────────────────────────────────────────────────
   Parse & render
   ───────────────────────────────────────────────────────── */

function processBookmarks(html) {
  totalFolders   = 0;
  totalBookmarks = 0;

  const parser = new DOMParser();
  const doc    = parser.parseFromString(html, 'text/html');

  // A valid Netscape Bookmark file contains at least one <DL>
  const rootDL = doc.querySelector('dl');
  if (!rootDL) {
    showError('No bookmark data found. Please use a file exported via your browser\'s "Export Bookmarks" feature.');
    return;
  }

  const rootUL = buildTree(rootDL);
  renderTree(rootUL);
}

/**
 * Recursively converts a <DL> element (Netscape bookmark list) into
 * a <ul class="tree"> element.
 */
function buildTree(dl) {
  const ul = document.createElement('ul');
  ul.className = 'tree';

  // Direct children of <dl> that are <dt> elements
  for (const child of dl.children) {
    if (child.tagName !== 'DT') continue;

    const h3 = child.querySelector(':scope > h3');
    const a  = child.querySelector(':scope > a');
    const nestedDL = child.querySelector(':scope > dl');

    if (h3) {
      // ── Folder ──────────────────────────────────────────
      totalFolders++;
      const li = document.createElement('li');
      li.className = 'folder';

      const row = document.createElement('div');
      row.className = 'node-row';

      const toggle = document.createElement('span');
      toggle.className = 'icon-toggle';
      toggle.textContent = '▾';

      const folderIcon = document.createElement('span');
      folderIcon.className = 'icon-node';
      folderIcon.textContent = '📁';

      const label = document.createElement('span');
      label.className = 'folder-label';
      label.textContent = h3.textContent.trim() || '(unnamed folder)';

      row.appendChild(toggle);
      row.appendChild(folderIcon);
      row.appendChild(label);
      li.appendChild(row);

      if (nestedDL) {
        const childUL = buildTree(nestedDL);
        li.appendChild(childUL);
      }

      // Toggle collapse on click
      row.addEventListener('click', () => toggleFolder(li, toggle));

      ul.appendChild(li);

    } else if (a) {
      // ── Bookmark ─────────────────────────────────────────
      totalBookmarks++;
      const li = document.createElement('li');
      li.className = 'bookmark';

      const row = document.createElement('div');
      row.className = 'node-row';

      // Spacer to align with folder toggle arrow
      const spacer = document.createElement('span');
      spacer.className = 'icon-toggle';

      const linkIcon = document.createElement('span');
      linkIcon.className = 'icon-node';

      // Use favicon if available, otherwise default icon
      const faviconURL = getFavicon(a);
      if (faviconURL) {
        const img = document.createElement('img');
        img.src    = faviconURL;
        img.width  = 16;
        img.height = 16;
        img.style.flexShrink = '0';
        img.onerror = () => { img.replaceWith(createDefaultIcon()); };
        row.appendChild(spacer);
        row.appendChild(img);
      } else {
        linkIcon.textContent = '🔗';
        row.appendChild(spacer);
        row.appendChild(linkIcon);
      }

      const link = document.createElement('a');
      link.href   = a.href;
      link.target = '_blank';
      link.rel    = 'noopener noreferrer';
      link.title  = a.href;
      link.textContent = a.textContent.trim() || a.href;

      row.appendChild(link);
      li.appendChild(row);
      ul.appendChild(li);
    }
    // Separators (<hr>) and other elements are intentionally skipped
  }

  return ul;
}

function createDefaultIcon() {
  const s = document.createElement('span');
  s.className = 'icon-node';
  s.textContent = '🔗';
  return s;
}

/**
 * Extract a favicon URL from the bookmark's ICON_URI / ICON attribute,
 * or construct one from the bookmark's host.
 */
function getFavicon(anchor) {
  // Firefox stores a data: URI in the ICON attribute
  const icon = anchor.getAttribute('icon');
  if (icon && icon.startsWith('data:image')) return icon;

  // Chrome / Edge store an ICON_URI (usually https://...)
  const iconUri = anchor.getAttribute('icon_uri');
  if (iconUri) return iconUri;

  // Fall back to Google's public favicon service
  try {
    const url = new URL(anchor.href);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url.hostname)}&sz=16`;
    }
  } catch (_) { /* non-URL href */ }

  return null;
}

/* ─────────────────────────────────────────────────────────
   Render into DOM
   ───────────────────────────────────────────────────────── */

function renderTree(ul) {
  treeContainer.innerHTML = '';
  treeContainer.appendChild(ul);

  // Show UI elements
  dropZone.style.display  = 'none';
  treeContainer.classList.add('visible');
  toolbar.classList.add('visible');
  statsEl.classList.add('visible');

  statsEl.textContent =
    `${totalFolders} folder${totalFolders !== 1 ? 's' : ''}, ` +
    `${totalBookmarks} bookmark${totalBookmarks !== 1 ? 's' : ''}`;
}

/* ─────────────────────────────────────────────────────────
   Folder toggle
   ───────────────────────────────────────────────────────── */

function toggleFolder(li, toggleIcon) {
  const collapsed = li.classList.toggle('collapsed');
  toggleIcon.textContent = collapsed ? '▸' : '▾';
}

/* ─────────────────────────────────────────────────────────
   Expand / collapse all
   ───────────────────────────────────────────────────────── */

expandAllBtn.addEventListener('click', () => {
  document.querySelectorAll('li.folder').forEach(li => {
    li.classList.remove('collapsed');
    const t = li.querySelector(':scope > .node-row > .icon-toggle');
    if (t) t.textContent = '▾';
  });
});

collapseAllBtn.addEventListener('click', () => {
  document.querySelectorAll('li.folder').forEach(li => {
    li.classList.add('collapsed');
    const t = li.querySelector(':scope > .node-row > .icon-toggle');
    if (t) t.textContent = '▸';
  });
});

/* ─────────────────────────────────────────────────────────
   Search / filter
   ───────────────────────────────────────────────────────── */

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase();
  filterTree(q);
});

function filterTree(query) {
  const allBookmarks = document.querySelectorAll('li.bookmark');
  const allFolders   = document.querySelectorAll('li.folder');

  if (!query) {
    // Restore everything
    allBookmarks.forEach(li => li.classList.remove('hidden'));
    allFolders.forEach(li => {
      li.classList.remove('hidden');
      // Restore labels (remove marks)
      restoreLabel(li);
    });
    allBookmarks.forEach(li => restoreLabel(li));
    return;
  }

  // First pass: mark/hide bookmarks
  allBookmarks.forEach(li => {
    const link  = li.querySelector('a');
    const text  = link ? link.textContent.toLowerCase() : '';
    const href  = link ? link.href.toLowerCase() : '';
    const match = text.includes(query) || href.includes(query);

    li.classList.toggle('hidden', !match);

    if (match && link) {
      highlightText(link, query);
    } else if (link) {
      restoreLabel(li);
    }
  });

  // Second pass: hide empty folders, show folders that have visible children
  // Process deepest first (reverse DOM order)
  const folderArr = Array.from(allFolders).reverse();
  folderArr.forEach(folder => {
    const hasVisible =
      folder.querySelector('li.bookmark:not(.hidden)') ||
      folder.querySelector('li.folder:not(.hidden)');
    folder.classList.toggle('hidden', !hasVisible);
    if (hasVisible) {
      folder.classList.remove('collapsed');
      const t = folder.querySelector(':scope > .node-row > .icon-toggle');
      if (t) t.textContent = '▾';
    }
  });
}

function highlightText(el, query) {
  const original = el.dataset.originalText || el.textContent;
  el.dataset.originalText = original;

  const lower = original.toLowerCase();
  let result = '';
  let i = 0;
  while (i < original.length) {
    const idx = lower.indexOf(query, i);
    if (idx === -1) { result += escapeHTML(original.slice(i)); break; }
    result += escapeHTML(original.slice(i, idx));
    result += `<mark>${escapeHTML(original.slice(idx, idx + query.length))}</mark>`;
    i = idx + query.length;
  }
  el.innerHTML = result;
}

function restoreLabel(li) {
  const link = li.querySelector('a');
  if (link && link.dataset.originalText) {
    link.textContent = link.dataset.originalText;
    delete link.dataset.originalText;
  }
  const label = li.querySelector('.folder-label');
  if (label && label.dataset.originalText) {
    label.textContent = label.dataset.originalText;
    delete label.dataset.originalText;
  }
}

function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/* ─────────────────────────────────────────────────────────
   Reset UI
   ───────────────────────────────────────────────────────── */

function resetUI() {
  treeContainer.innerHTML = '';
  treeContainer.classList.remove('visible');
  toolbar.classList.remove('visible');
  statsEl.classList.remove('visible');
  dropZone.style.display = '';
  searchInput.value = '';
  fileInput.value   = '';
  hideError();
}

/* ─────────────────────────────────────────────────────────
   Error display
   ───────────────────────────────────────────────────────── */

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.add('visible');
}

function hideError() {
  errorMsg.classList.remove('visible');
  errorMsg.textContent = '';
}
