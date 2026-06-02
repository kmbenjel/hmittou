# AI Agent Context & Developer Guidelines

This document provides explicit architectural context, layout constraints, and rules for AI agents (specifically Claude 3.5 Sonnet, Claude 3 Opus, GPT-4/5.5, and Gemini) interacting with or modifying the `hmittou` project. 

**Always read this document before proposing CSS or layout changes to `index.html`.**

## 1. Project Architecture
- **Single File Build**: The entire application (HTML, CSS, JavaScript) is bundled into a single `index.html` file. Do not attempt to split it into React components or separate CSS files unless explicitly requested.
- **Content**: The project hosts Arabic poetry (Rajaz). It relies on standard vanilla HTML/CSS with zero external framework dependencies.

## 2. Arabic Poetry Layout (The "Spine" Grid)
The most critical visual element of this project is the traditional "Kaseedah" layout, which requires a flawless, mathematically centered vertical "spine" (the gap between the two hemistiches/verses of a line).

- **Structure**: A line of poetry (`.bayt`) contains two `.verse` elements: the Sadr (first child, right side) and the Ajuz (last child, left side).
- **CSS Grid Requirement**: To achieve the perfect spine, `.bayt` uses `display: grid; grid-template-columns: 1fr 1fr;`.
- **Text Alignment Trick**: Because the `body` is `direction: rtl`, the first child (Sadr) falls into the right column. We set `.verse:first-child { text-align: left; }` and `.verse:last-child { text-align: right; }`. This pushes the text of both verses inward towards the central gap, creating a perfectly symmetrical, straight vertical spine regardless of character count.
- **CRITICAL AI RULE**: **Do NOT attempt to replace this grid with `width: 50%` flexbox halves or `width: auto` hacks.** Flexbox widths with variable text lengths in RTL will cause jagged, non-vertical spines or trigger overlapping/margin-bleeding. Stick strictly to `grid-template-columns: 1fr 1fr`.

## 3. Print Media & PDF Generation (`@media print`)
The project relies on Headless Chrome to generate high-quality PDF booklets (mobile layout and desktop layout). The print engine is extremely sensitive to margin bleed and box-model shifts.

### Dynamic Print Contexts
- The UI checks for `?print=mobile` or `?print=desktop` query parameters and injects specific `@page` physical dimensions via JS. 
- Mobile uses a custom `120mm x 210mm portrait` layout (`body.print-mobile`).
- Desktop uses a standard `A4 portrait` layout (`body.print-desktop`).

### Print CSS Constraints (DO NOT REGRESS)
1. **Margin-Inline Bleed Risk**: The web UI uses negative margins (`margin-inline: -1rem` or `-0.5rem`) on `.bayt` for hover effects. **You MUST forcefully reset this in print** (e.g., `margin: 0 0 25pt 0 !important`). If you only reset `margin-bottom`, the negative inline margins will bleed into the PDF and physically drag the poem off the center axis, causing it to overlap the left/right page margins.
2. **Container Padding**: The web `.container` uses `padding: 0 15px`. This asymmetric padding must be wiped in print (`padding: 0 !important;`) to maintain strict mathematical centering on the physical page.
3. **Numbering and Safe Zones**: The verse numbers (`.bayt::before`) are absolutely positioned. If placed outside the 100% width of the `.bayt`, Chrome's PDF renderer will **clip them in the unprintable @page margin**. 
   - **Solution**: The `.bayt` container is given symmetrical inward padding (e.g., `padding: 0 45pt 0 45pt !important;`). The poetic text stays perfectly centered in the remaining space, and the number is positioned inside the reserved right-hand padding (`right: 0`), guaranteeing it is never clipped and never overlapped by text.

### Print Footer & Resources
- The resource links (`.resource-grid`) must use `flex-wrap: wrap !important;` in print mode. Without wrapping, long resource names will stretch the grid beyond the physical page width, dragging the entire page's centering axis with it.

## 4. Typography and JavaScript
- The project uses `Amiri` for all poetic text.
- JavaScript dynamically handles:
  - Dark mode (`toggleTheme()`).
  - Font scaling (`changeFontSize()`).
  - Clipboard sanitization (removing Arabic Tatweel/Kashida `ـ` characters when users copy text).
  - Indian numeral conversion (converts Western Arabic digits to Eastern Arabic digits `٠١٢٣٤٥٦٧٨٩`).
