# Style and theme the site with golf colours, responsive mobile-first layout

## Current state

All HTML is server-rendered via inline template strings in route files. There are **zero CSS files** -- pages are unstyled browser defaults with occasional `style="color:red"` for errors.

Route files with HTML page functions:
- `src/routes/auth.ts` -- `loginPage()`, `registerPage()` (2 pages)
- `src/routes/dashboard.ts` -- inline HTML (1 page)
- `src/routes/courses.ts` -- `coursesListPage()`, `newCoursePage()`, `courseDetailPage()`, `editCoursePage()`, `newHolePage()`, `editHolePage()`, `importPage()`, `searchResultsPage()`, `previewPage()`, `notFoundPage()` (10 pages)
- `src/routes/bags.ts` -- `bagsListPage()`, `newBagPage()`, `bagDetailPage()`, `editBagPage()`, `importBagPage()`, `notFoundPage()` (6 pages)
- `src/routes/strategies.ts` -- `strategiesListPage()`, `noBagPage()`, `newStrategyPage()`, `strategyDetailPage()`, `editStrategyPage()`, `errorPage()`, `notFoundPage()` (7 pages)

No static file serving is configured in `src/app.ts`.

## Scope

1. **Create a CSS file** with golf-themed styling -- serve it as a static asset via Express
2. **Define a colour palette** -- light greens, fairway tones, white/cream backgrounds, dark text. Golf club aesthetic, not garish
3. **Create a layout helper** -- shared HTML wrapper function that all page functions use, providing consistent `<head>`, nav bar, and footer
4. **Responsive layout** -- mobile-first, large touch targets for phone use. Forms and lists should be comfortable at 375px width
5. **Update all page functions** to use the shared layout and remove their individual `<!DOCTYPE html>` boilerplate
6. **Style components** -- forms, buttons, tables/lists, nav, cards, error messages, links

## Approach

### 1. Static file serving
Add `express.static` middleware in `src/app.ts` to serve `public/` directory. Create `public/styles.css`.

### 2. Colour palette
- Primary: forest green (`#2d5016` range)
- Secondary: fairway green (`#4a7c29` range)
- Background: off-white/cream (`#f8f6f0` range)
- Surface: white (`#ffffff`)
- Text: dark charcoal (`#1a1a1a`)
- Accent: gold/sand (`#c4a35a` range)
- Error: muted red
- Border: light grey-green

### 3. Layout helper
Create `src/layout.ts` exporting a `layout(title: string, body: string, nav?: boolean): string` function. All page functions call this instead of repeating `<!DOCTYPE html>...`. Includes:
- `<meta viewport>` for responsive
- Link to `/styles.css`
- Nav bar with links (Dashboard, Courses, Bags) + logout button (when `nav` is true)
- Main content wrapper

### 4. CSS structure
Mobile-first with breakpoints at `768px` and `1024px`. Large form inputs, big tap targets (min 44px), readable font sizes. Card-based layouts for lists. Clean form styling.

### 5. Update route files
Refactor each page function to use the layout helper. Strip the `<!DOCTYPE html>` wrappers. Remove inline styles.

## Acceptance criteria

- All pages use a consistent shared layout with nav
- Golf-themed green/cream colour scheme throughout
- Fully responsive -- usable on a 375px phone screen
- Touch-friendly: buttons and inputs are large enough for finger taps
- No inline `<!DOCTYPE html>` boilerplate in individual page functions
- Static CSS served from `/styles.css`
- All existing tests pass (styling changes are additive, should not break tests)
- Error messages styled consistently (not inline `style="color:red"`)
