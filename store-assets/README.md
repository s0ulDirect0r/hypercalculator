# Store assets

Assets for the Chrome Web Store listing.

## Screenshots (ready to upload)

All 1280×800 PNG — the store's expected size.

| File | Shows |
| --- | --- |
| `01-graph-2d.png` | Standalone app graphing `x²-4` with roots called out |
| `02-graph-3d.png` | Standalone app rendering the 3D surface `x²-y²` |
| `03-overlay-on-page.png` | The floating overlay on a real web page |
| `04-geometry-triangle.png` | Geometry object analysis for a triangle |
| `05-vector-analysis.png` | Vector visualization for `<3, 4>` |
| `small-promo-tile.png` | Required 440×280 promotional tile |
| `marquee-promo-tile.png` | Optional 1400×560 promotional tile |

## Listing Copy

See `listing.md` for the name, summary, detailed description, and privacy
disclosure text.

Privacy form: declare "does not collect user data" (accurate — the extension
does not use analytics, accounts, tracking scripts, cookies, remote APIs, or
remote font requests).

Run `npm run package` to build the upload archive.
