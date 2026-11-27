# Chrome Web Store listing

## Name
chrome-bookmark-extension

## Summary (max 132 chars)
View, search, and edit your bookmarks as folder panels in a single page.

## Detailed description
chrome-bookmark-extension shows all of your bookmarks at once as a grid of folder panels, so you can find and organize them without digging through menus.

Features
- Every folder is shown as a panel; subfolders are stacked under their top-level folder.
- Instant AND search: type several words and each must match the title, folder name, or URL.
- Keep folders: keep non-matching folders visible while searching.
- Edit mode: drag and drop bookmarks between folders, add folders, rename, and delete.
- When a dropped URL has no title, use the title of a matching open tab for the new bookmark.
- Layout options: 3/6/10 columns, bookmarks per panel (10/20/30), equal height, single scrolling row.
- Favicons for every bookmark.
- Works entirely offline. No accounts, no tracking.

Click the toolbar icon to open the page (an existing tab is reused).

## Single purpose
Display and manage the user's Chrome bookmarks as folder panels on a single page.

## Permission justifications
- bookmarks: read the bookmark tree and create, move, rename, and delete bookmarks and folders as the user requests.
- favicon: show site icons next to bookmarks.
- tabs: read open-tab URLs and titles to find the tab matching a user-dropped URL and use its title as the bookmark name. The data is processed locally; no tab data is stored or transmitted.

## Privacy
This extension does not collect, transmit, or sell any user data. All data stays in the browser; preferences are stored locally with localStorage.

## Assets
- store/screenshots/01-panels.png, 02-search.png, 03-edit.png, 04-layout.png (1280x800)
- store/promo-440x280.png (small promo tile)
