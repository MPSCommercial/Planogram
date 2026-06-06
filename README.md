# Planogram Builder

A lightweight, browser-based planogram builder for visualizing retail shelf layouts. No frameworks, no build step — just open `index.html`.

![Planogram Builder](https://img.shields.io/badge/status-active-brightgreen) ![HTML/CSS/JS](https://img.shields.io/badge/stack-HTML%2FCSS%2FJS-blue)

## Features

- **Multi-segment canvas** — configure segments, shelves per segment, and slots per shelf
- **Product library** — syncs from Google Sheets via CSV export; supports manual add/edit/delete
- **Drag & drop placement** — drag products from the library onto any shelf slot
- **Facing support** — products with facing > 1 span multiple consecutive slots automatically
- **Inline product editing** — edit name, category, dimensions, and image via modal
- **Export** — save planogram as PNG or JSON; import JSON to restore state
- **Auto-save** — layout and product data persist in `localStorage`

## Getting Started

```bash
# Clone the repo
git clone https://github.com/MPSCommercial/Planogram.git
cd Planogram

# Serve locally (any static server works)
python3 -m http.server 4174

# Open in browser
open http://localhost:4174
```

## Project Structure

```
index.html          # App shell & markup
src/
  app.js            # Init, event bindings, drag & drop
  products.js       # Product CRUD, library render, search
  planogram.js      # Shelf/canvas render engine
  sheets.js         # Google Sheets → CSV sync
  export.js         # PNG / JSON export & import
  styles.css        # All styling
```

## Google Sheets Sync

Products are synced from a Google Sheet exported as CSV. The sheet must be publicly accessible (view-only).

Expected columns:

| Column | Maps to |
|---|---|
| `ODOO` | stable product ID |
| `Product Name` | name |
| `Category` | category |
| `Sub Category` | brand |
| `Image URL` | image |
| `Width_cm` | width (supports ranges like `2–26`) |
| `Height_cm` | height |
| `Depth_cm` | depth |
| `Facing Default` | default facing count |

Only products with `Category = Accessories` are loaded (currently 80 SKUs).

To update products, click **Sync Sheet** in the Product Library panel. Auto-sync runs once on first load when no cached data exists.

## Shelf Configuration

| Setting | Default |
|---|---|
| Segments | 1 |
| Shelves per segment | 4 |
| Slots per shelf | 6 |
| Width | 100 cm |
| Height | 150 cm |
| Depth | 30 cm |

## Data Persistence

State is saved automatically to `localStorage`. To back up or share a layout, use **Export JSON** / **Import JSON**.

## License

MIT
