# chrome bookmark extension

A Chrome extension that displays the bookmarks bar as panels organized by folder. It reads and writes bookmarks directly in Chrome and does not send bookmark data elsewhere.

## Installation

1. Open `chrome://extensions` in Chrome and enable Developer mode.
2. Select **Load unpacked** and choose this repository's folder.
3. Click the extension icon in the toolbar to open the bookmark view in a new tab.

## Usage

- Every folder under the bookmarks bar is displayed as its own panel. Nested panel titles show the full path, such as `folder1` or `folder1/folder11`. Bookmarks appear in the panel for their direct parent folder; bookmarks directly under the bookmarks bar appear in the **Bookmarks bar** panel.
- Consecutive panels are paired vertically when both contain 10 or fewer direct bookmarks; pairing then continues with the next panel. Panels with more than 10 bookmarks occupy a column on their own. The **Bookmarks bar** panel remains last.
- Favicons stored by Chrome are displayed for bookmarks. A fallback icon is used if a favicon is unavailable.
- Search filters by partial matches in bookmark names, folder names, and URLs. If a folder name matches, bookmarks in that folder are also shown.
- Switch between 4, 6, and 10 columns. Use the horizontal scrollbar above the panels when they do not fit on screen.
- Select **Edit** to edit names and URLs. Drag an item by its handle and drop it onto another item to place it immediately before that item. Drop it on **Move here** beside a folder name to place it at the end of that folder. Drop on a panel header to reorder folders directly under the bookmarks bar. Drop on the **Bookmarks bar** panel to move an item directly under the bar. All destination folders remain visible while searching.
- Changes made in Chrome are reflected in the view. Edits and moves are saved to Chrome immediately.

For safety, `javascript:` and `data:` bookmarks cannot be opened from this view.

## Tests

Run `npm test` to execute the logic tests (requires Node.js).
