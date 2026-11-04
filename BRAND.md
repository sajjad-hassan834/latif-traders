# ShoppyOS Brand Guidelines & Identity System

> **Official Design Token & Vector Asset Manual**  
> **Brand Name:** ShoppyOS  
> **Live Web Domain:** [https://www.shoppyos.com/](https://www.shoppyos.com/)  
> **Concept:** Concept C ("Notched Slip & Gold Seal")

---

## 1. Core Concept & Narrative

ShoppyOS is the operating system for Pakistan's daily retail and wholesale trade.  
The brand mark represents **"a shop's daily paper trail made modern and indelible"**:
- **The Squircle Base:** A solid, grounded deep green foundation (`#0F4D3A`) reflecting trust, growth, and security.
- **The White Ledger Slip:** A 45° dog-ear folded corner with crisp ledger lines representing receipts, invoices, and accounting.
- **The 3-Notch Edge:** A torn bottom edge evoking physical thermal receipts and POS slips.
- **The Marigold Seal:** A warm golden coin/stamp (`#F4A62A`) symbolizing verified payment, settled udhaar, and daily barakah.

---

## 2. Vector Asset Library (`client/public/brand/`)

All vector assets are hand-coded SVGs with glyph outlines converted to bezier curves (zero live font dependencies).  
**Budget Guarantee:** Every single SVG is strictly **under 6 KB**.

| File | Purpose | Tone / Background | File Size |
| :--- | :--- | :--- | :--- |
| `symbol.svg` | App icon / Favicon / Standalone avatar | Full Colour (Deep Green + Gold) | **607 B** |
| `symbol-dark.svg` | Dark ink on light surfaces | Monochrome Dark (`#0C2B22`) | **537 B** |
| `symbol-light.svg` | Light/Reversed for dark green or dark modes | Translucent with White Stroke | **586 B** |
| `symbol-mono.svg` | Inherits parent CSS `currentColor` | Dynamic currentColor | **576 B** |
| `logo-horizontal.svg` | Main platform lockup (Symbol + Wordmark) | Full Colour on Light | **5.99 KB** |
| `logo-horizontal-dark.svg` | High contrast on paper surfaces | Deep Green Ink | **5.92 KB** |
| `logo-horizontal-light.svg` | Reversed lockup on dark or deep green | Paper White + Mint OS | **5.97 KB** |
| `logo-horizontal-mono.svg` | Single-color applications | Dynamic currentColor | **5.97 KB** |
| `logo-stacked.svg` | Vertical/Stacked brand lockup | Full Colour | **5.99 KB** |
| `logo-stacked-dark.svg` | Vertical lockup dark | Deep Green Ink | **5.92 KB** |
| `logo-stacked-light.svg` | Vertical lockup reversed | Paper White + Mint OS | **5.97 KB** |
| `logo-stacked-mono.svg` | Vertical lockup currentColor | Dynamic currentColor | **5.97 KB** |
| `wordmark.svg` | Typography wordmark only | Deep Green + Leaf "OS" | **5.45 KB** |
| `wordmark-dark.svg` | High contrast wordmark | Deep Green | **5.45 KB** |
| `wordmark-light.svg` | Reversed wordmark | Paper White + Mint "OS" | **5.45 KB** |
| `wordmark-mono.svg` | Single-color wordmark | Dynamic currentColor | **5.46 KB** |

---

## 3. Brand Color Palette & Contrast Standards

| Color Role | Hex Code | RGB | HSL | Contrast on Light (`#FFFFFF`) | Contrast on Dark (`#08140F`) | WCAG Rating |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Deep Green** | `#0F4D3A` | `15, 77, 58` | `162°, 67%, 18%` | **8.87:1** | 2.14:1 | **AAA (on Light)** |
| **Marigold Gold** | `#F4A62A` | `244, 166, 42` | `37°, 89%, 56%` | *1.83:1 (Banned)* | **9.70:1** | **AAA (on Dark)** |
| **Chili Red** | `#D92D5A` | `217, 45, 90` | `344°, 68%, 51%` | **4.82:1** | 4.20:1 | **AA (on Light)** |
| **Paper White** | `#FFFFFF` | `255, 255, 255` | `0°, 0%, 100%` | 1:1 | **18.9:1** | **AAA (on Dark)** |
| **Mint Green (OS)**| `#4ADE80` | `74, 222, 128` | `142°, 69%, 58%` | 1.62:1 | **10.9:1** | **AAA (on Dark)** |
| **Surface Dark** | `#08140F` | `8, 20, 15` | `155°, 43%, 5%` | **18.9:1** | 1:1 | **AAA Background** |
| **Surface Light** | `#F2F6F3` | `242, 246, 243` | `135°, 14%, 96%` | 1.07:1 | **17.7:1** | **AAA Background** |

> [!CAUTION]
> **Contrast Restriction:** Marigold Gold (`#F4A62A`) has an insufficient contrast ratio (1.83:1) on white or light backgrounds. **Never** render gold text on white or paper backgrounds. Use Marigold Gold exclusively on dark green backgrounds, dark mode surfaces, as button/badge backgrounds with dark text (`#241800`), or as the vector seal accent.

---

## 4. Clear-Space & Minimum Size Rules

### Clear-Space Rule ($x$)
- The clear space boundary around the logo or symbol must be at least **$x$**, where **$x$ equals the height of the paper slip's torn notch** (approx. 10% of the mark's total height).
- No text, borders, buttons, or page margins may intrude inside the $x$ buffer.

### Minimum Sizes
- **Symbol Mark (`symbol.svg`):**  
  Minimum **16 px × 16 px**. At 16 px, the squircle, paper slip silhouette, and gold seal remain crisp and distinguishable in browser tabs and dense accounting grids.
- **Horizontal Lockup (`logo-horizontal.svg`):**  
  Minimum width **96 px** (height approx. **19 px**). Below this width, switch to the standalone Symbol.
- **Stacked Lockup (`logo-stacked.svg`):**  
  Minimum height **64 px**.
- **Wordmark Only (`wordmark.svg`):**  
  Minimum width **72 px**.

---

## 5. Allowed Backgrounds & Pairings

| Surface / Background | Recommended Variant | Wordmark Fill |
| :--- | :--- | :--- |
| **Paper Light** (`#FFFFFF` / `#F2F6F3`) | `logo-horizontal.svg` or `tone="auto"` | Deep Green `#0F4D3A` + Leaf `#1B7A5A` |
| **Public Dark** (`#08140F` / `#11231B`) | `logo-horizontal-light.svg` or `tone="light"` | Paper White `#F2F6F3` + Mint `#4ADE80` |
| **Brand Deep Green** (`#0F4D3A`) | `logo-horizontal-light.svg` | Paper White `#F2F6F3` + Mint `#4ADE80` |
| **Accent Color Card** (e.g. Blue `#E0F2FE`) | `tone="mono"` | Inherits `currentColor` |

---

## 6. Brand Don'ts

1. **Do NOT** render the wordmark as live, selectable text in vector assets; always use the exact outlined bezier curves.
2. **Do NOT** stretch, distort, or skew the symbol or lockup aspect ratios.
3. **Do NOT** add outer drop shadows, embosses, bevels, or gradients to the vector geometry.
4. **Do NOT** alter the proportions of the 45° dog-ear corner fold or the 3-notch torn slip.
5. **Do NOT** display the ShoppyOS platform logo over a tenant's own uploaded store logo on their bills or invoices.
6. **Do NOT** use gold text on white surfaces.

---

## 7. React Component Usage

```jsx
import BrandLogo from '@/components/common/BrandLogo';

// 1. Standard auto-adapting horizontal lockup (Header / Navbar)
<BrandLogo variant="horizontal" size={36} />

// 2. Standalone symbol for compact toolbars or favicons
<BrandLogo variant="symbol" size={24} />

// 3. Reversed light lockup on deep green hero banners
<BrandLogo variant="horizontal" tone="light" size={40} />

// 4. Mono lockup inheriting text color from CSS
<div style={{ color: '#0F4D3A' }}>
  <BrandLogo variant="horizontal" tone="mono" size={32} />
</div>
```

---

## 8. Favicon & Web Manifest Suite

- `favicon.svg` — Modern scalable SVG favicon.
- `favicon.ico` — Multi-resolution binary ICO containing 16x16, 32x32, and 48x48 PNG layers.
- `apple-touch-icon.png` — 180x180 square PNG for iOS home screens.
- `pwa-192.png` & `pwa-512.png` — Standard and high-DPI maskable icons with 14% safe zone padding.
- `og-image.png` — 1200x630 OpenGraph social share card with receipt illustration.
- `site.webmanifest` — Compliant PWA web manifest.

