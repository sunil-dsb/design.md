# shadcn theme not emitted  ibm

**Source:** https://www.ibm.com/  
**Generated:** 2026-05-18

## Why

The source site uses neither Tailwind nor shadcn/ui. A shadcn theme generated from values designed for a different framework (Material UI / Chakra / vanilla) is speculative  the design system assumptions don't carry over cleanly. Skipping to avoid emitting a misleading file. (The tailwind.css emitter still runs because Tailwind v4 themes are general; only the shadcn-specific slot mapping is omitted.)

## What you still got

- `tokens.json`  every extracted design token
- `tailwind.css` (if emitted)  Tailwind v4 @theme block, not shadcn-specific
- `regenerated-ramp.json`  the brand + neutral colour ramps
- `DESIGN.md`  human-readable design system documentation
- `prompts/universal.md`  paste-into-any-agent build prompt

If you genuinely want a shadcn theme for this brand anyway, the manual path is:

1. Open `regenerated-ramp.json` and copy the brand + neutral hex stops.
2. Drop them into the [shadcn theme generator](https://ui.shadcn.com/themes) or hand-map them into your project's `globals.css`.
3. Adjust contrast pairs to meet WCAG AA on your specific surface colours.
