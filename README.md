# WebLinks-TreeView

A lightweight, zero-dependency web app that turns your browser's exported bookmarks file into a **navigable, collapsible folder hierarchy**.

## Features

- 📂 **Drag-and-drop or file-picker upload** of a browser bookmark export
- 🌲 **Interactive tree view** – click any folder to expand or collapse it
- 🔍 **Live search** – instantly filter bookmarks and auto-expands matching branches
- 📊 **Stats bar** – total folder and bookmark counts
- ��️ **Favicons** – shows site icons next to each bookmark
- 🌐 **Works entirely in the browser** – no server, no build step, no dependencies

## Supported Browsers

All major browsers export bookmarks in the standard **Netscape Bookmark HTML** format:

| Browser | How to export |
|---------|--------------|
| **Chrome** | Bookmarks Manager → ⋮ → *Export bookmarks* |
| **Firefox** | Bookmarks → Manage Bookmarks → Import and Backup → *Export Bookmarks to HTML* |
| **Edge** | Favorites → ⋯ → *Export favorites* |
| **Safari** | File → *Export Bookmarks…* |
| **Opera** | Bookmarks → *Export bookmarks* |

## Usage

1. Open `index.html` in any modern browser (or serve the folder with any static file server).
2. Drag your exported `.html` / `.htm` bookmark file onto the drop zone, or click **Choose File**.
3. Browse your bookmarks as a collapsible tree. Click a folder row to expand/collapse it.
4. Use the **Search** box to filter by title or URL. Matching branches expand automatically.
5. Use **Expand all / Collapse all** to control the entire tree at once.
6. Click **Load new file** to reset and load a different file.

## Running Locally

```bash
# Any static server works, e.g.:
npx serve .
# Then open http://localhost:3000
```

Or simply open `index.html` directly from your file system – no server required.

## Project Structure

```
index.html   – Main page (upload UI + tree container)
style.css    – Styles
app.js       – Bookmark parser and tree renderer
```

## License

See [LICENSE](LICENSE).
