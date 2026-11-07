# Calendar PSD Studio

A Vite + vanilla JS website that designs a commercial calendar (cover + 12 months)
and exports every page as a **layered .PSD** you can open in Adobe Photoshop.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/ (works from any host or folder)
npm test           # optional: builds sample PSDs in Node and checks them (needs the `canvas` package)
```

## Page border options

*Border & lines* → **Page border** picks the style (template's own, none, solid line, **double line**, rounded line, key pattern, your artwork).
The new **Pattern / design border: border only, or with line(s)** menu adds *Border only*, *Border + one line* or *Border + double line*
just inside a pattern / artwork / ornamental border (the line colour follows the border, or untick **Line colour is the same as the border**
to pick another, e.g. blue pattern with a red line). Each style also has a **"+ horizontal line"** choice in the Page border list: on the ornate templates it replaces the strip under the ads / logo area with a line in that style (the plain choices hide the strip; "Template's own border" keeps it); on other templates it draws one rule across the top section, which you can move or hide in Layers. The horizontal line is one layer: **click it on the page and drag it up / down with the mouse**, press **Delete** to remove it (Undo brings it back); the **Horizontal line position** slider does the same in fixed steps. Solid / double / rounded styles are already lines, so that menu does not change them.

## Shared date cell (24 / 31)

On 6-week months the overflow days share one cell. *Style → Shared date cell on 6-week months* picks the look:
**Template's own**, **Diagonal line** (24 top-left, 31 bottom-right), **Corners, no line**, **One line: 24 / 31**, or **Stacked** (24 over 31 with a line between).
Works on Big black & red, Pink floral, Two-month blue & red / black, Philippine navy and Chinese lunar. The toolbar button **▨ 24/31** shows the same choices as pictures. The two ornate templates
(Philippine ornate, Two-month ornate) keep their stacked cell with tide times and lunar characters; *Diagonal line* swaps the divider for a diagonal and *Corners, no line* removes it (*One line* is not used there).

## Moon designs

The **☾ Moon** button offers 5 designs for every moon cell: 1 face artwork, 2 red faces, 3 grey cratered moon, 4 red faces (April sample)
and **5 gold & navy** (gold full moon, starry navy new moon, navy | gold first quarter, gold | navy last quarter — fixed colours).

## Moon style position

The **☾ Position** button (or *Calendar → Moon style position*) chooses where the phase name, moon face and date sit inside every moon cell:
**Name top, face, date below**, **Face top, name + date below**, **Name + date top-left, face right** and **Name + date top-right, face left**.
*Template's own* keeps each template's default. It applies to every month and to Big black, Two-month blue & red / ornate, Philippine wall, Philippine ornate and Philippine navy (moons fill the empty cells; with no room they sit in the day cell corner).
Code: `src/moonCell.js` (`moonCellLayers`) - the five templates call it, so a new position is added in one place.

## Moons on every template / "No moon"

Every template now shows the four moon phases (Classic, Minimal, Bold, Chinese lunar, Photo collage and the full-year posters put a small face in the
corner of each phase day; the Philippine / Big black / Two-month / Pink / Navy templates fill their empty cells). Moons follow the **☾ Moon** artwork
and **☾ Position** style. For a client who does not want moons, pick **No moon** in **☾ Position** (or *Calendar → Moon style position → No moon*):
every page drops its moons. Picking any other position turns moons back on.

## Design gallery (opening screen)

The site now opens on a **Welcome** screen (like Photoshop's Home): two sections, **Portrait designs** and **Landscape designs** (the orientation you are working in comes first), each with a picture of every template, drawn with your
current year, colours, photos, logo and moon settings. Click a design to open it in the editor in that orientation, or **Continue editing ›** to keep the current one.
On the **landscape** side, Sky blue bubbles, Minimal and Bold (Green & Red) and Philippine ornate and Two-month ornate (Black & Red) always show the same sample picture (Jan 2027, no photo / logo; Minimal and Bold show February); the portrait cards keep following your settings.
Type in *Filter designs…* to narrow the list. Inside the editor, the **▦ Designs** button (first in the toolbar) brings the gallery back; Esc closes it.

## Use it

1. Fill in **Brand** (company, tagline, contacts), upload a **logo** and up to **13 photos**
   (cover + Jan–Dec; fewer photos simply repeat).
2. Pick a **template**, year, week start, canvas size (A5, A4, A3, Short 8.5×11 in, Long 8.5×13 in, Legal, Tabloid) / orientation, **print bleed**, fonts and colours.
   The **Philippine wall (black & red)** template adds moon phases (computed, in your chosen
   UTC offset), mini previous/next-month calendars, a holiday list box and a monthly
   reminders box. Portrait paper works best for it. Tide times are not generated.
   The **Philippine ornate** template is the black & red wall calendar with the patterned key border:
   ad/photo/logo area on top (portrait), `01 | JANUARY | 2027` title bar, tide times above/below every date,
   lunar-day characters (computed), moon faces in the empty cells, 24/31 shared cell on 6-week months,
   mini calendars and the red holidays box. Works in portrait and landscape.
   **Tide times are not calculated** – paste them in *Tide table* (one line per day:
   `2027-01-01 | 4:25 AM 0.8m, 5:35 PM 1.2m | 10:20 AM 0.3m`). A button fills January 2027 from the sample.
   The **Big black & red** template is the January 2026 sample design: `2026 | JANUARY | 2026` title row (red years),
   black weekday bar with a red SUN box, huge Impact numbers, holiday names in the date cell, moon-phase name/date/face
   in the empty cells (24/31 shared cell on 6-week months), mini previous/next calendars and a two-column red
   `• LEGAL HOLIDAYS •` list. Landscape matches the sample; portrait adds a photo / ads area on top.
   The **Two-month blue & red** template is the July/August 2026 sheet: a photo banner with a verse box
   (edit *Banner verse* / *Verse reference* under Brand), then two stacked month blocks per page
   (blue month bar, red years, thick blue cells, moon-phase cells, 24/31 shared cell), a mini previous-month
   calendar beside the first block, a mini next-month calendar beside the second, the legal-holidays list split
   across both side panels and ruled NOTES. It makes **7 pages**: cover + Jan–Feb … Nov–Dec.
   The **Two-month black & red ornate** template is the January/February 2027 sheet: patterned key border,
   ADS OR LOGO area on top, two month blocks per page (`01 | JANUARY | 2027` bars, tide times above/below the dates —
   blue = high, red = low —, lunar-day characters, moon faces in the empty cells, 24/31 shared cell), a mini
   previous-month calendar + red legal-holidays box beside the first block and red ruled notes + a mini next-month
   calendar beside the second. 7 pages (cover + 6 sheets). Portrait paper works best; paste tide times in *Tide table*.
   The **Chinese lunar wall** template is the red wall calendar (Jan 2022 sample): banner
   photo with a text card (*Tagline* = heading, *Banner verse* = text), a huge red month number, `2022 Jan` with lunar-date /
   solar-term / 干支 lines, bilingual weekday bar (red Sun/Sat), rounded cells with the lunar day (or 节气 / lunar month / holiday
   name) under each date, and a zodiac card with the animal's Western-calendar year ranges in the empty leading cells.
   Lunar dates are computed; solar terms use the standard formula (check before printing). The 宜/忌 almanac columns
   are optional and are *not* generated – paste lines in *Almanac*: `01-04 | 宜 开市 纳财 | 忌 嫁娶`. Works in landscape and portrait.
   The **Two-month black & red** template is the January/February 2027 sheet with the goat header: a red zodiac emblem in a
   flower ring (goat drawing in Goat years, the animal's character otherwise) with *HAPPY CHINESE NEW YEAR / YEAR OF THE …*, a big
   outlined diagonal year, then two black & red month blocks per page, moon-phase cells with the exact time, 24/31 shared cell,
   mini calendars, LEGAL HOLIDAYS and NOTES. Upload a photo to replace the emblem. 7 pages (cover + 6 sheets). The outlined year is
   a flat (non-live) layer in the PSD.
   The **Pink floral** template is the pink January 2027 wall calendar: floral-style pink background (upload a photo to
   use your own artwork instead), black years either side of a white-outlined magenta script month name (*Brush Script MT*),
   magenta weekday bar with a pale-pink SUN, translucent cells with huge numbers, moon-phase cells, 24/31 shared cell, previous/next
   mini calendars and a two-column LEGAL HOLIDAYS list. Landscape matches the sample; portrait adds the same layout taller. The outlined
   month name is a flat (non-live) layer in the PSD.
   The **Photo collage** template is the "2027 Calendar" sheet: an angled photo collage on top (three photo panels + a dark blue brand
   panel with your logo / company name), bold year with a script *Calendar*, then two staggered months per page (`03/ MARCH`,
   bold Sat/Sun) each with a ruled NOTES block. 7 pages (cover + 6 sheets), portrait. The page photo fills the three panels with
   different crops – use the **Image** tool to drop a different picture on any panel. Holidays show as coral dates.
   The **Sky blue bubbles** template is a sister of the pink floral wall calendar: aqua / sky-blue bubble background (upload a photo to use your own
   artwork), navy years either side of a white-outlined script month name, aqua weekday bar with a pale SUN, translucent cells with huge numbers,
   moon-phase cells (name + date left, face right), 24/31 shared cell, previous / next mini calendars and a two-column LEGAL HOLIDAYS list.
   Landscape matches the pink sample; portrait adds the photo / ads area on top. Pick a colour theme to change the aqua to any colour.
   Two **Full-year poster** templates put all 12 months on ONE page (the project then has a single page, no cover):
   *red & blue* (photo / brand banner with logo badge, big year + ribbon, 4 × 3 month cards with alternating red / blue headers, cream
   holidays box, red contact bar from *Address · Company · Phone · Tagline*) and *red & green* (swoosh header with outlined company name,
   script tagline, *Owner / proprietor line* and address pills, big outlined year, 3 × 4 grid-lined month cards with green Saturdays,
   3-column national-holidays footer). In the holidays box, lines starting with `# ` make headed groups, e.g. `# Regular Holidays`
   (other templates ignore them); a button under *Holidays* fills the grouped Philippine 2027 list. Portrait A4 / Short / Long work best.
3. Edit the **holiday list** (one per line: `MM-DD Name` or `YYYY-MM-DD Name`).
4. Click a page tab to preview it, then export:
   - **Download PSD (this page)** – one file
   - **All 13 pages · ZIP** – cover + 12 months in one ZIP
   - **All 13 pages · one by one** – separate downloads (lighter on memory at 300 dpi)
   - **PNG** – flat preview

## Edit like Photoshop (new)

Click anything on the page preview to select it; the right-hand panel shows its **Properties** and the **Layers** list.

| Do this | How |
| --- | --- |
| Select / move | Click, then drag. Arrow keys nudge 1 unit (Shift = 10) |
| Resize | Drag a corner handle (text, images and the moon keep their proportions; Shift locks others) |
| Delete | Select + **Delete** key, or the 🗑 button. Template layers are *removed* (bring them back with the ○ icon in Layers or Ctrl+Z) |
| Delete on ALL pages | Select + **Shift+Delete**, or **🗑 Delete on all pages** (toolbar / Properties). In Layers, the 🗑 on a group removes the whole group (Shift-click or OK in the prompt = all pages) |
| Drop text | **T Text** tool, then click where it should go. Double-click any text to edit it |
| Fonts / size / colour | Properties panel: font list, size in pt, bold, colour, opacity. Also works on template text (dates, month names…) |
| Your own font | *Upload a font file…* (.ttf/.otf/.woff) or *Use an installed font by name…* |
| Add an image / logo | **🖼 Image** button, drag a picture onto the page, or paste (Ctrl+V) |
| Rectangles | **▭ Rectangle**, then change colour / opacity / size |
| Position & size | X / Y / Width / Height boxes in mm |
| Order, copy | ▲ ▼ reorder, **Duplicate** (Ctrl+D), **Copy to all pages** |
| Undo / redo | Ctrl+Z / Ctrl+Shift+Z (100 steps) |

Everything you add or change is included in **every export** (PSD, ZIP, PNG): text stays a live Photoshop
text layer, images and rectangles become their own layers. Edits live in the open browser tab only
(they are not saved if you reload), so export before closing. Edits to template layers follow the
layer's position in the template, so after switching template / week start / "show previous-next days"
some edited template layers may need re-doing; layers you added are unaffected.

## What's inside each PSD

Named groups: `Photo`, `Brand`, `Month band`, `Calendar grid` (`Grid lines` / `Cells`,
`Weekday headers`, `Dates` – one layer per day, `Holidays`) and `Footer`.
The photo is a normal pixel layer (swap it in Photoshop), dates/holidays/names are
live text layers (when "keep text layers editable" is on), and the document carries
the chosen DPI and bleed.

## Notes

- Only fonts found on every Windows/Mac install are offered (Arial, Georgia, Times New
  Roman, Trebuchet MS, Verdana, Impact) so Photoshop's live text matches the pixels.
- Use 150 dpi for drafts; switch to 300 dpi for final print files. 300 dpi on A3 makes big
  files – prefer "one by one" over ZIP there.
- Colours are RGB. Convert to CMYK in Photoshop (Image → Mode) for press.

## Code map

- `src/layout.js` – layout engine: config → layer tree (classic / minimal / bold live here)
- `src/template*.js` – the Philippine, navy and big-black templates
- `src/render.js` – draws each layer to its own canvas (preview + PSD pixels)
- `src/psd.js` – builds the layered PSD with [ag-psd](https://github.com/Agamnentzar/ag-psd)
- `src/edits.js` – edit model (overrides + custom layers), hit-testing
- `src/editor.js` – the Photoshop-style tools, Properties and Layers panels
- `src/main.js` – UI, previews, downloads

## Moon designs and colour themes (v9)

- **☾ Moon** (toolbar): pick any of the 3 design rows. The chosen design is used for every moon cell on every
  month page and in every template; each cell still shows the phase computed for its own month.
- **Colour theme** (left panel): pick a colour pair (Main & Highlight) or set the two colours yourself.
  The Style colours are rewritten and every month / template re-colours automatically. *Original* restores each template's own colours.

## Holiday layout (v11)

*Calendar → Holiday layout* picks how a holiday name sits on its date cell (Big black, Pink, Philippine wall / ornate,
Two-month blue & red / ornate and Philippine navy templates):
**Classic** (small name), **Faded date + centred name**, **Big date + name across the bottom**, **Big date + slanted white name**.
The slanted name is a flat (non-live) layer in the PSD; the others keep live text where possible.

## Border & lines (v13)

*Border & lines* panel: page border style (template's own / none / solid / double / rounded / key pattern), colour
(follows the colour theme, or untick to pick any colour), thickness and distance from the page edge; plus grid / cell
line colour and thickness. It re-draws every page; the ornate templates swap their key-pattern frame for the style you choose.

## Your border design (v14)

*Border & lines → Page border → **Your border design (BOARDER.png) — any colour*** draws the supplied pattern border
(corners + repeating edge tiles, so it fits every page size, portrait or landscape, without stretching).
- **Colour:** tap **Red / Blue / Black / Green / Gold / Navy / Purple / Pink** at the top of *Border & lines*, or use the colour box
  for any colour, or tick *Border colour follows the colour theme* to match the Main colour.
- **Size:** *Border thickness* and *Distance from the page edge* sliders.
- On the ornate templates it replaces their built-in key pattern; on every other template it is added around the page.
- It is a single "Page border (your design)" layer in the PSD, tinted to the chosen colour.
- Artwork lives in `src/borderArtData.js` (8 alpha-mask pieces cut from BOARDER.png, 8x resolution).

## Picture controls + on-screen zoom (v38)

**Any picture layer** (template Photo / Banner, or one you added with 🖼 Image) now has a *Picture inside the frame* section in Properties:
**Fit** (fill the frame and crop, or fit inside with no crop), **Zoom picture**, **Top part ↕ Bottom part** and **Left part ↔ Right part** sliders,
quick **⬆ Top / ◎ Middle / ⬇ Bottom** and **⬅ Left / ◎ Centre / ➡ Right** buttons, **✋ Slide picture on the page** (drag the picture inside its frame; also *Alt + drag* on any selected picture) and **Reset picture**.
Picture frames that fill (crop) now resize freely; fit-inside pictures keep their shape (Shift locks either).
This is per layer and per page; the old Photo *Zoom / Focus* sliders in the left panel still set the default for all pages.

**Zoom** – bar at the bottom-right of the page area: **− / slider / + / 100% / Fit page**. Also **Ctrl + mouse wheel** (or trackpad pinch), keys **+ / − / 0**,
and hold **Space** (or middle mouse) and drag to move around a zoomed page. The preview is re-drawn sharper when you zoom in; selection handles keep the same on-screen size.
