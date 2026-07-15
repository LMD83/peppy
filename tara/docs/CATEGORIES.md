# Catalogue categories — how the groupings were chosen

`src/lib/products.ts`'s `category` field used to be mechanism-of-action
jargon lifted straight from the pricing sheet ("Metabolic / GLP", "Growth /
GHRH", "Regenerative / Cosmetic" — 17 categories, several overlapping). That
told a researcher who already knows the field which shelf a compound is on,
but not a plain-English visitor anything. Rebuilt into 8 groups a first-time
visitor can navigate by outcome-area, sourced from the original design
reference (`design-reference/TARA Website.dc.html`, the `PRODUCTS` array,
which already carries a proper one-sentence "studied for X" description per
compound) plus PubMed-level domain knowledge for the ~10 SKUs added after
that reference was written (SLU-PP-322/332, the cartridge/pen format
variants, L-Carnitine).

| Group | What's in it | Why grouped this way |
|---|---|---|
| Weight & Metabolism | Retatrutide, Tirzepatide, Cagrilintide, AOD-9604, 5-Amino-1MQ, MOTS-c, L-Carnitine, SLU-PP-322/332 | GLP-1-class agonists, amylin, and metabolic/mitochondrial compounds — different mechanisms, same research question (energy metabolism, body weight). |
| Recovery & Tissue Repair | BPC-157, TB-500, ARA-290, Follistatin 344, IGF-1 LR3, PEG-MGF, Wolverine Blend, BPC+TB-500 cartridge | Healing-focused peptides — tendon, gut, nerve, and muscle-tissue repair research. |
| Growth Hormone Peptides | Tesamorelin, Sermorelin, CJC-1295 (DAC/no DAC), Ipamorelin, the Ipamorelin+CJC blend, both pen variants | GHRH analogues and secretagogues — compounds studied for the body's own growth-hormone pulse, not growth hormone itself. |
| Longevity & Cellular Health | Epitalon, NAD+, Glutathione, SS-31 | Cellular-ageing and mitochondrial-energy research — kept separate from Weight & Metabolism since the research question is cellular health, not body weight. |
| Mind & Sleep | Semax, Selank, DSIP | Cognitive and sleep-architecture research. |
| Skin & Hair | GHK-Cu, Melanotan 1/2, GLOW and KLOW (blend, cartridge, pen) | Skin, pigmentation, and connective-tissue research — kept separate from general Recovery since the research framing (cosmetic/dermal) is distinct even where the underlying peptides overlap (GLOW/KLOW both contain BPC-157/TB-500). |
| Hormone & Sexual Health | PT-141, Kisspeptin-10 | Reproductive-axis and sexual-arousal research. |
| Immune & Gut Health | KPV, LL-37, VIP | Inflammation, antimicrobial, and immune-signalling research. VIP moved here from the design reference's "Nootropic" grouping — its actual described research area (immune balance, airway inflammation) fits this group, not Mind & Sleep. |
| *Lab Supplies* (not a compound group) | Bacteriostatic water, acetic acid, syringes | Diluents and consumables — not research compounds, so they never appear inside a compound group or count toward "N compounds." Rendered as a clearly separate catalogue section (`kind: "supply"` in `products.ts`). |

## Compliance constraint this had to work inside

Per `docs/COMPLIANCE.md`: no aesthetic, anti-aging, or therapeutic claims —
copy describes what's being *studied*, not what a compound *does for you*.
This shaped two decisions:

- **No "Anti-Aging" category.** The design reference's GHRH compounds don't
  have a clean existing group name in this codebase; "Growth Hormone
  Peptides" was chosen over "Growth Hormone & Anti-Aging" specifically to
  avoid the claim-adjacent term the compliance doc calls out by name.
- **Every `plain` sentence follows "[compound] studied for/in [research
  area]," never "[compound] does/gives/boosts [outcome]."** A few sentences
  ported from the design reference used softer claim language ("studied for
  *reducing* visceral fat," Glutathione's "skin brightness") — reworded to
  stay strictly in research-topic framing.

`Weight & Metabolism` and `Skin & Hair` are themselves topic/domain labels
(what a researcher would search a database for), not outcome promises — the
same distinction as a journal section titled "Dermatology" not claiming to
cure anything. If category copy is ever revisited, keep that distinction:
naming the research field is fine; promising the field's outcome isn't.
