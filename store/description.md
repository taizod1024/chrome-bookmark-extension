# Chrome Web Store listing

## Name
chrome-bookmark-extension

## Summary (max 132 chars)
View, search, and edit your bookmarks as folder panels in a single page.

## Detailed description
chrome-bookmark-extension shows your bookmarks bar as a grid of folder panels, so you can find and organize its bookmarks without digging through menus.

Features
- Every folder is shown as a panel; subfolders are stacked under their top-level folder.
- Instant AND search: type several words and each must match the title, folder name, or URL.
- Keep folders: keep non-matching folders visible while searching.
- Edit mode: drag and drop bookmarks between folders, add folders, rename, and delete.
- When a dropped URL has no title, use the title of a matching open tab for the new bookmark.
- Layout options: 4/8/12 columns, bookmarks per panel (10/20/30 or unlimited), panel height modes, and a single scrolling row.
- Chrome-cached favicons with a fallback when unavailable.
- Light and dark themes follow your system settings.
- Bookmark management works locally without an account or tracking. Opening a website may require an internet connection.

Click the toolbar icon to open the page. An existing tab is reused and its search is cleared.

## Single purpose
Display and manage the user's Chrome bookmarks as folder panels on a single page.

## Permission justifications
- bookmarks: read the bookmark tree and create, move, rename, and delete bookmarks and folders as the user requests.
- favicon: show site icons next to bookmarks.
- tabs: read open-tab URLs and titles to find the tab matching a user-dropped URL and use its title as the bookmark name. Tab information is processed locally; a matching title may be saved as the new bookmark name.

## Privacy
This extension reads and processes bookmarks and tab information locally. It does not transmit or sell user data. Preferences are stored locally with localStorage. See privacy/privacy-policy.md.

## Assets
- store/screenshots/01-panels.png, 02-search.png, 03-edit.png, 04-layout.png (1280x800)
- store/promo-440x280.png (small promo tile)
- Screenshots use sample bookmarks and placeholder favicons.
