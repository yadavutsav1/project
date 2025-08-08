# PDF Merger & Editor (Client-only)

A single-page web app to:
- Upload multiple PDFs
- Reorder pages via drag & drop
- Rotate or delete pages
- Add simple text annotations (click to place)
- Download the merged PDF

No server required; everything runs in your browser using pdf.js (render) and pdf-lib (generate).

## How to run

Open `index.html` in a modern browser (Chrome, Edge, Firefox). If opening directly from the filesystem has CORS issues, serve the folder:

```bash
# from /workspace
python3 -m http.server 8000
# then visit http://localhost:8000/
```

## Usage tips
- Click "Add PDFs" or drag & drop PDF files onto the page.
- Reorder pages by dragging tiles.
- Click ⟲ to rotate; click ✖ to toggle delete/restore.
- Toggle "Add Text Mode", type your text, choose size/color, then click a page preview to place.
- Press "Download Merged PDF" to save `merged.pdf`.

## Notes
- Only simple text annotations are supported in this version.
- Very large PDFs may be memory-heavy in the browser.