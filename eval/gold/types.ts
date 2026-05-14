// Gold-token schema  hand-curated ground truth that the scoreboard scores
// extractions against. One file per brand at eval/gold/<brand>.json.
//
// The fields are deliberately narrow: only the parts of a design system
// that have a defensible "right answer" we can verify against the brand's
// public assets, source CSS, or design documentation. Anything subjective
// (visual feel, brand voice, prose accuracy) is NOT measured by the
// scoreboard  that's what the universal prompt + an AI agent are for.
//
// File location: eval/gold/<brand>.json
// Schema version: v1

export interface GoldColorEntry {
  /** 6-digit lowercase hex, e.g. "#635bff". */
  hex: string;
  /** Optional canonical brand name (e.g. "Iris", "Vercel Black"). */
  name?: string;
}

export interface GoldFontFamily {
  /** Primary family as it appears in CSS, e.g. "sohne-var" or "Inter". */
  family: string;
  /** Optional fallback stack, e.g. ["sans-serif"] or ["Helvetica", "Arial"]. */
  fallbacks?: string[];
}

export interface GoldTokens {
  $schema?: string;

  //  Metadata 
  /** Brand slug  matches the file name and the extraction's <slug>. */
  brand: string;
  /** Canonical homepage URL the gold was verified against. */
  url: string;
  /** ISO date when this gold file was last manually verified. */
  verifiedAt: string;
  /** Human or "manual review"  for provenance during scoreboard audits. */
  verifiedBy: string;
  /** Optional sources where each value was confirmed. */
  sources?: string[];

  //  Colors 
  colors: {
    /** The brand's documented primary color. The single most-important value. */
    primary: GoldColorEntry;
    /**
     * Secondary brand color, if the brand has one (Stripe has accent
     * orange; some brands are mono-chromatic and won't).
     */
    accent?: GoldColorEntry;
    /** Documented semantic role colors when the brand defines them. */
    semantic?: {
      success?: string;
      warning?: string;
      error?: string;
      info?: string;
    };
    /** Named neutrals  text/background/border ladder values. */
    neutrals?: GoldColorEntry[];
    /**
     * Every hex the brand officially lists in their system palette,
     * including primary/accent/semantic/neutrals all flattened.
     * The scoreboard's precision/recall calculations operate on this list.
     */
    paletteHexes: string[];
  };

  //  Typography 
  typography: {
    /** Display / heading font family. */
    display: GoldFontFamily;
    /** Body / paragraph font family. */
    body: GoldFontFamily;
    /** Monospace family (for code blocks); omit when brand has none. */
    mono?: GoldFontFamily;
  };

  //  Spacing 
  spacing: {
    /** Base grid unit in px (typically 4 or 8). */
    baseUnit: number;
    /** Known visible spacing scale steps in px, ascending. */
    scale: number[];
  };

  //  Radius (optional) 
  radius?: {
    /** Known radius values in px, ascending. */
    scale: number[];
  };

  //  Dark mode (optional) 
  darkMode?: {
    /** True if the brand officially supports a dark theme. */
    supported: boolean;
  };
}
