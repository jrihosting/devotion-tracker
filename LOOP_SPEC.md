# Loop: High-tech investigation terminal UI for Settings page

## Goal
Restyle the Anviwònman (Settings) page in `Index.html` from the current sage/slate design into a dark, high-tech "investigation system" terminal with:
- Dark theme with midnight-blue, void-black, and purple gradients
- Glowing cyan/teal/green/red-orange data elements
- All original text, icons, Creole labels, stat values (3, 3, —, 0), and positions preserved verbatim
- Color swatches become glowing multi-dimensional orbs with pulse indicator on selected
- Range slider styled as futuristic digital schematic bar with holographic thumb
- Buttons as brushed-metal/carbon-fiber with glowing borders (teal-green for Re-Konfigire, red-orange for Reset)
- Bottom nav bar rendered as solid glowing cyan data-bar
- Background has faint scrolling hex grid / data-grid pattern with bloom effect
- All text remains perfectly legible over glowing elements

## Verification
LLM-judge rubric: Load the page, inspect each section (stats, info table, theme swatches, slider, buttons, bottom nav) and confirm:
1. All original values/text/icons/Creole labels are present and unmodified
2. Dark terminal aesthetic is applied consistently
3. Glow effects are present on data elements, borders, buttons
4. Selected color swatch has a distinct "active" indicator (pulse/ring)
5. Slider has non-default styling matching the theme
6. Bottom nav has cyan glow styling
7. All text remains readable
8. Layout positions match the original (no reordering)

No deterministic test command exists for visual styling — this is a pure CSS/HTML restyle.

## Termination
- Success: LLM-judge rubric passes all 8 criteria
- Max iterations: 6
- No-progress: stop if 2 consecutive iterations produce identical result + unchanged working tree
- Budget: none

## Scope
- Allowed: `Index.html` (CSS `<style>` block, `loadSettings()` function), `mock-api.js` (if needed)
- Forbidden: No changes to `Code.gs` backend. No changes to stat values, labels, or data. No reordering of DOM elements. No removal of existing classes/functions on other pages.

## Escalation
On cap or no-progress: stop, summarize styling attempts + what remains unstyled, wait for human review.
