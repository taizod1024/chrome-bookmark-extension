# chrome bookmark extension

A Chrome extension that displays the bookmarks bar as panels organized by folder. It reads and writes bookmarks directly in Chrome and does not send bookmark data elsewhere.

## Installation

1. Open `chrome://extensions` in Chrome and enable Developer mode.
2. Select **Load unpacked** and choose the `extension` folder.
3. Click the extension icon in the toolbar to open the bookmark view in a new tab, or switch to its existing tab if it is already open.

The extension uses the tabs permission to find the title of an open page when its URL is dropped. After updating the extension, reload it and accept any new permission prompt.

## Usage

- Every folder under the bookmarks bar is displayed as its own panel. Nested panel titles show the full path, such as `folder1` or `folder1/folder11`. Bookmarks appear in the panel for their direct parent folder; bookmarks directly under the bookmarks bar appear in the **Bookmarks bar** panel.
- Panels are stacked vertically per top-level folder: each folder directly under the Bookmarks bar and all of its subfolders share one column. The **Bookmarks bar** panel remains last in its own column.
- Favicons stored by Chrome are displayed for bookmarks. A fallback icon is used if a favicon is unavailable.
- Search filters by partial matches in bookmark names, folder names, and URLs. Panels with no matching bookmarks are hidden, including in Edit mode. If a folder name matches, bookmarks in that folder are also shown.
- Drag a URL from the browser onto a bookmark to add it before that bookmark, or onto **File / Folder** at the bottom of a panel to add it to that folder. This works without entering Edit mode. The title from the drag data or a matching open tab is used when available; otherwise the URL is used as the name.
- Switch between 3, 6, and 10 columns. Use the horizontal scrollbar above the panels when they do not fit on screen.
- Select **Edit** to change names or bookmark URLs using separate buttons and browser prompts, or to delete bookmarks and folders. A folder containing child folders cannot be deleted; an error dialog is shown. Deleting a folder with bookmarks removes those bookmarks after confirmation. Drag an item onto another item of the same kind to move it to that item's original position; between folders it is inserted before the target. Drop a bookmark on a folder name to move it to the end of that folder. Use **File / Folder** at the bottom of a folder panel to move an item to the end of that folder. The same area in the **Bookmarks bar** panel accepts both bookmarks and folders; folders appear before the **Bookmarks bar** panel.
- Changes made in Chrome are reflected in the view. Edits and moves are saved to Chrome immediately.

For safety, `javascript:` and `data:` bookmarks cannot be opened from this view.

## Tests

Run `npm test` to execute the logic tests (requires Node.js).

## Packaging

Chrome runtime files live in `extension/`. Run `npm run zip` to package the entire folder as `chrome-bookmark-extension.zip`; new files added there are included automatically.
