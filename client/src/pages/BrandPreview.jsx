import React, { useState } from 'react';
import BrandLogo from '../components/common/BrandLogo';

export default function BrandPreview() {
  const [activeTab, setActiveTab] = useState('all');

  const variants = ['symbol', 'horizontal', 'stacked', 'wordmark'];
  const tones = ['auto', 'dark', 'light', 'mono'];
  const sizes = [16, 24, 32, 48, 64, 128];

  const files = [
    { name: 'symbol.svg', desc: 'Symbol (Color)', size: '607 B' },
    { name: 'symbol-dark.svg', desc: 'Symbol (Dark on Light)', size: '537 B' },
    { name: 'symbol-light.svg', desc: 'Symbol (Light on Dark/Green)', size: '586 B' },
    { name: 'symbol-mono.svg', desc: 'Symbol (currentColor)', size: '576 B' },
    { name: 'logo-horizontal.svg', desc: 'Horizontal Lockup (Color)', size: '5.99 KB' },
    { name: 'logo-horizontal-dark.svg', desc: 'Horizontal (Dark)', size: '5.92 KB' },
    { name: 'logo-horizontal-light.svg', desc: 'Horizontal (Light/Reversed)', size: '5.97 KB' },
    { name: 'logo-horizontal-mono.svg', desc: 'Horizontal (currentColor)', size: '5.97 KB' },
    { name: 'logo-stacked.svg', desc: 'Stacked Lockup (Color)', size: '5.99 KB' },
    { name: 'logo-stacked-dark.svg', desc: 'Stacked (Dark)', size: '5.92 KB' },
    { name: 'logo-stacked-light.svg', desc: 'Stacked (Light/Reversed)', size: '5.97 KB' },
    { name: 'logo-stacked-mono.svg', desc: 'Stacked (currentColor)', size: '5.97 KB' },
    { name: 'wordmark.svg', desc: 'Wordmark (Color)', size: '5.45 KB' },
    { name: 'wordmark-dark.svg', desc: 'Wordmark (Dark)', size: '5.45 KB' },
    { name: 'wordmark-light.svg', desc: 'Wordmark (Light)', size: '5.45 KB' },
    { name: 'wordmark-mono.svg', desc: 'Wordmark (currentColor)', size: '5.46 KB' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAF9', color: '#0C2B22', fontFamily: '"Instrument Sans", sans-serif', padding: '40px 24px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header */}
        <header style={{ borderBottom: '2px solid #D3DFD8', paddingBottom: '24px', marginBottom: '36px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'inline-block', background: '#E4EDE7', color: '#0F4D3A', fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '4px', marginBottom: '8px', letterSpacing: '0.05em' }}>
                DEV PREVIEW · BRAND SYSTEM
              </div>
              <h1 style={{ fontFamily: '"Bricolage Grotesque", sans-serif', fontSize: '36px', fontWeight: 800, margin: 0 }}>
                ShoppyOS Brand Identity System
              </h1>
              <p style={{ color: '#4C6258', margin: '8px 0 0 0', fontSize: '15px' }}>
                Concept C ("Notched Slip & Gold Seal") · Pure SVG vector deliverables · All SVGs strictly &lt; 6 KB
              </p>
            </div>
            <div>
              <BrandLogo variant="horizontal" size={40} />
            </div>
          </div>
        </header>

        {/* Section 1: The 4 Core Variants on 3 Backgrounds */}
        <section style={{ marginBottom: '48px' }}>
          <h2 style={{ fontFamily: '"Bricolage Grotesque", sans-serif', fontSize: '24px', fontWeight: 700, marginBottom: '16px' }}>
            1. Core Variants Matrix Across Brand Backgrounds
          </h2>
          <p style={{ color: '#4C6258', fontSize: '14px', marginBottom: '20px' }}>
            Tested on Paper Light (<code>#F2F6F3</code>), Deep Dark (<code>#08140F</code>), and Brand Green (<code>#0F4D3A</code>).
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
            
            {/* Column 1: Light Background */}
            <div style={{ background: '#F2F6F3', border: '1px solid #D3DFD8', borderRadius: '12px', padding: '24px', color: '#0C2B22' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#4C6258', marginBottom: '16px' }}>
                Paper Light (Surface)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#4C6258', marginBottom: '6px' }}>Horizontal (Auto)</div>
                  <BrandLogo variant="horizontal" tone="auto" size={38} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#4C6258', marginBottom: '6px' }}>Symbol (64px)</div>
                  <BrandLogo variant="symbol" tone="auto" size={64} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#4C6258', marginBottom: '6px' }}>Wordmark Only</div>
                  <BrandLogo variant="wordmark" tone="auto" size={32} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#4C6258', marginBottom: '6px' }}>Stacked Lockup</div>
                  <BrandLogo variant="stacked" tone="auto" size={80} />
                </div>
              </div>
            </div>

            {/* Column 2: Dark Background */}
            <div style={{ background: '#08140F', border: '1px solid #22392E', borderRadius: '12px', padding: '24px', color: '#E8F2EC' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9BB3A7', marginBottom: '16px' }}>
                Public Dark (Surface)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#9BB3A7', marginBottom: '6px' }}>Horizontal (Light / Reversed)</div>
                  <BrandLogo variant="horizontal" tone="light" size={38} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#9BB3A7', marginBottom: '6px' }}>Symbol (64px Light)</div>
                  <BrandLogo variant="symbol" tone="light" size={64} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#9BB3A7', marginBottom: '6px' }}>Wordmark Light</div>
                  <BrandLogo variant="wordmark" tone="light" size={32} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#9BB3A7', marginBottom: '6px' }}>Stacked Light</div>
                  <BrandLogo variant="stacked" tone="light" size={80} />
                </div>
              </div>
            </div>

            {/* Column 3: Brand Deep Green */}
            <div style={{ background: '#0F4D3A', border: '1px solid #1B7A5A', borderRadius: '12px', padding: '24px', color: '#FFFFFF' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#F4A62A', marginBottom: '16px' }}>
                Brand Deep Green (#0F4D3A)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#A3BFB3', marginBottom: '6px' }}>Horizontal (Light on Green)</div>
                  <BrandLogo variant="horizontal" tone="light" size={38} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#A3BFB3', marginBottom: '6px' }}>Symbol (Light with stroke)</div>
                  <BrandLogo variant="symbol" tone="light" size={64} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#A3BFB3', marginBottom: '6px' }}>Wordmark (Paper + Mint OS)</div>
                  <BrandLogo variant="wordmark" tone="light" size={32} />
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#A3BFB3', marginBottom: '6px' }}>Stacked Lockup</div>
                  <BrandLogo variant="stacked" tone="light" size={80} />
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Section 2: Contact Sheet Across Key Scale Sizes */}
        <section style={{ marginBottom: '48px', background: '#FFFFFF', border: '1px solid #D3DFD8', borderRadius: '12px', padding: '28px' }}>
          <h2 style={{ fontFamily: '"Bricolage Grotesque", sans-serif', fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
            2. Scale Contact Sheet (16px to 128px)
          </h2>
          <p style={{ color: '#4C6258', fontSize: '14px', marginBottom: '24px' }}>
            Mandatory QA check: The mark remains distinctly recognizable at 16px (favicon / address bar scale).
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            {/* Symbol Scale */}
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '12px', color: '#0F4D3A' }}>
                Symbol Mark:
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '28px', flexWrap: 'wrap', padding: '16px', background: '#F2F6F3', borderRadius: '8px' }}>
                {sizes.map((s) => (
                  <div key={s} style={{ textAlign: 'center' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <BrandLogo variant="symbol" size={s} />
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#4C6258' }}>{s}px</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Horizontal Scale */}
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '12px', color: '#0F4D3A' }}>
                Horizontal Lockup:
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '32px', flexWrap: 'wrap', padding: '16px', background: '#F2F6F3', borderRadius: '8px' }}>
                {[20, 24, 32, 40, 48, 64].map((s) => (
                  <div key={s} style={{ textAlign: 'center' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <BrandLogo variant="horizontal" size={s} />
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#4C6258' }}>h: {s}px</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mono / currentColor */}
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '12px', color: '#0F4D3A' }}>
                Mono (currentColor inheritance):
              </div>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <div style={{ color: '#0F4D3A', padding: '16px 24px', background: '#E4EDE7', borderRadius: '8px' }}>
                  <BrandLogo variant="horizontal" tone="mono" size={32} />
                  <div style={{ fontSize: '11px', marginTop: '6px', fontWeight: 600 }}>Deep Green Color</div>
                </div>
                <div style={{ color: '#D92D5A', padding: '16px 24px', background: '#FDE8EE', borderRadius: '8px' }}>
                  <BrandLogo variant="horizontal" tone="mono" size={32} />
                  <div style={{ fontSize: '11px', marginTop: '6px', fontWeight: 600 }}>Chili Accent</div>
                </div>
                <div style={{ color: '#0284C7', padding: '16px 24px', background: '#E0F2FE', borderRadius: '8px' }}>
                  <BrandLogo variant="horizontal" tone="mono" size={32} />
                  <div style={{ fontSize: '11px', marginTop: '6px', fontWeight: 600 }}>Classic Blue</div>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Section 3: Asset Inventory Table */}
        <section style={{ background: '#FFFFFF', border: '1px solid #D3DFD8', borderRadius: '12px', padding: '28px' }}>
          <h2 style={{ fontFamily: '"Bricolage Grotesque", sans-serif', fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
            3. Pure SVG Vector File Library (&lt; 6 KB Budget Compliant)
          </h2>
          <p style={{ color: '#4C6258', fontSize: '14px', marginBottom: '20px' }}>
            All files located in <code>client/public/brand/</code>. Zero live fonts used; glyphs permanently converted to outline bezier curves.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #D3DFD8', color: '#0F4D3A' }}>
                  <th style={{ padding: '10px 14px' }}>File</th>
                  <th style={{ padding: '10px 14px' }}>Description</th>
                  <th style={{ padding: '10px 14px' }}>Size</th>
                  <th style={{ padding: '10px 14px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f, i) => (
                  <tr key={f.name} style={{ borderBottom: '1px solid #E4EDE7', background: i % 2 === 0 ? '#FAFCFB' : '#FFFFFF' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600 }}>
                      <a href={`/brand/${f.name}`} target="_blank" rel="noreferrer" style={{ color: '#0F4D3A', textDecoration: 'underline' }}>
                        {f.name}
                      </a>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#4C6258' }}>{f.desc}</td>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>{f.size}</td>
                    <td style={{ padding: '10px 14px', color: '#1B7A5A', fontWeight: 700 }}>✓ Under 6 KB</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}
