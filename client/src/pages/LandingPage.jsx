import React, { useState, useEffect } from 'react';
import PublicThemeToggle from '../components/common/PublicThemeToggle';
import BrandLogo from '../components/common/BrandLogo';

const TRADES_DATA = [
  {
    id: 'frozen_food',
    label: 'Frozen food',
    title: 'Frozen food',
    desc: 'Batches, expiry and cold-chain stock.',
    points: [
      'Track every batch with its expiry date',
      'Sell the oldest stock first',
      'Weight and carton pricing'
    ],
    recHeader: 'Lot FZ-2610',
    recRows: [
      { k: 'Nuggets 1kg', v: '210 pk', type: 'normal' },
      { k: 'Expires', v: '14 Dec', type: 'flag' },
      { k: 'Status', v: 'Sell first', type: 'flag' }
    ]
  },
  {
    id: 'retail',
    label: 'Retail shop',
    title: 'Retail shop',
    desc: 'A fast counter that never lets a shelf run dry.',
    points: [
      'Barcode scan POS',
      'Low-stock alerts per item',
      'Daily cash summary'
    ],
    recHeader: 'Counter 1',
    recRows: [
      { k: 'Scanned items', v: '32', type: 'normal' },
      { k: 'Low stock', v: '4 items', type: 'flag' },
      { k: 'Cash', v: 'Rs 62,000', type: 'normal' }
    ]
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy',
    title: 'Pharmacy',
    desc: 'Medicine batches you can trust.',
    points: [
      'Batch and expiry for every strip',
      'Warnings before items expire',
      'Generic and brand search'
    ],
    recHeader: 'Batch PX-118',
    recRows: [
      { k: 'Paracetamol 500', v: '28 left', type: 'flag' },
      { k: 'Expires', v: 'Mar 2027', type: 'normal' },
      { k: 'Alert', v: 'Reorder', type: 'flag' }
    ]
  },
  {
    id: 'clothing',
    label: 'Clothing',
    title: 'Clothing',
    desc: 'Size and colour without separate listings.',
    points: [
      'One product, many variants',
      'Stock by size and colour',
      'Seasonal discounts'
    ],
    recHeader: 'Kurta 3-piece',
    recRows: [
      { k: 'M / Navy', v: '6', type: 'normal' },
      { k: 'L / Navy', v: '2', type: 'flag' },
      { k: 'XL / Grey', v: '9', type: 'normal' }
    ]
  },
  {
    id: 'restaurant',
    label: 'Restaurant',
    title: 'Restaurant',
    desc: 'Menu items tied to ingredients.',
    points: [
      'Recipes deduct ingredients',
      'Dine-in, takeaway and delivery',
      'Kitchen-friendly 80mm slips'
    ],
    recHeader: 'Table 6',
    recRows: [
      { k: 'Chicken karahi', v: 'Rs 1,850', type: 'normal' },
      { k: 'Naan x4', v: 'Rs 240', type: 'normal' },
      { k: 'Chicken stock', v: 'low', type: 'flag' }
    ]
  },
  {
    id: 'hardware',
    label: 'Hardware',
    title: 'Hardware',
    desc: 'A big catalogue, found in seconds.',
    points: [
      'Thousands of items, instant search',
      'Unit conversions: pcs, feet, boxes',
      'Supplier price history'
    ],
    recHeader: 'Item HW-4410',
    recRows: [
      { k: 'Pipe 1 inch', v: '340 ft', type: 'normal' },
      { k: 'Fittings', v: '1,200 pcs', type: 'normal' },
      { k: 'Supplier rate', v: 'Rs 95', type: 'normal' }
    ]
  },
  {
    id: 'wholesale',
    label: 'Wholesale',
    title: 'Wholesale',
    desc: 'Bulk prices and big ledgers.',
    points: [
      'Price tiers by quantity',
      'A4 invoices with due amounts',
      'Customer-wise khata'
    ],
    recHeader: 'INV-0041',
    recRows: [
      { k: 'Gourmet Bakery', v: 'Rs 18,200', type: 'normal' },
      { k: 'Paid', v: 'Rs 10,000', type: 'ok' },
      { k: 'Due', v: 'Rs 8,200', type: 'flag' }
    ]
  },
  {
    id: 'custom',
    label: 'Anything else',
    title: 'Anything else',
    desc: 'Custom categories for any kind of shop.',
    points: [
      'Create your own fields',
      'Your own units and prices',
      'Same stock, khata and reports'
    ],
    recHeader: 'Custom item',
    recRows: [
      { k: 'Category', v: 'Yours', type: 'normal' },
      { k: 'Fields', v: 'Any', type: 'normal' },
      { k: 'Reports', v: 'Ready', type: 'ok' }
    ]
  }
];

export default function LandingPage({ onNavigateLogin, onNavigateRegister }) {
  const [activeTrade, setActiveTrade] = useState(0);
  const [printedLines, setPrintedLines] = useState([]);
  const [showStamp, setShowStamp] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);

  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || 'support@shoppyos.com';
  const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || '+923001234567';

  // Receipt line-by-line print animation
  useEffect(() => {
    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const totalLines = 8;

    if (isReducedMotion) {
      setPrintedLines(Array.from({ length: totalLines }, (_, i) => i));
      setShowStamp(true);
      return;
    }

    const timers = [];
    for (let i = 0; i < totalLines; i++) {
      timers.push(
        setTimeout(() => {
          setPrintedLines((prev) => [...prev, i]);
        }, 400 + i * 240)
      );
    }

    timers.push(
      setTimeout(() => {
        setShowStamp(true);
      }, 400 + totalLines * 240 + 200)
    );

    return () => timers.forEach(clearTimeout);
  }, []);

  const curTrade = TRADES_DATA[activeTrade];

  return (
    <div className="public-landing">
      {/* Sticky Navigation */}
      <nav aria-label="Main Navigation">
        <div className="wrap">
          <a className="logo" href="#top" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
            <BrandLogo variant="horizontal" size={32} />
          </a>
          <ul>
            <li><a href="#trades">Trades</a></li>
            <li><a href="#features">Features</a></li>
            <li><a href="#pricing">Pricing</a></li>
            <li><a href="#voices">Shopkeepers</a></li>
          </ul>
          <div className="nav-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
            <PublicThemeToggle />
            <button
              type="button"
              className="btn pri"
              onClick={onNavigateRegister}
            >
              Start free
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero" id="top">
        <div className="wrap">
          <div>
            <p className="ur" lang="ur" dir="rtl">
              آپ کی دکان، آپ کے ہاتھ میں
            </p>
            <h1>Every sale, every udhaar, every shelf. One screen.</h1>
            <p className="lead">
              Inventory, POS invoices and customer khata in one cloud system, built for Pakistani shops, wholesalers and restaurants.
            </p>
            <div className="cta">
              <button
                type="button"
                className="btn pri"
                onClick={onNavigateRegister}
              >
                Sign up free
              </button>
              <button
                type="button"
                className="btn sec"
                onClick={onNavigateLogin}
              >
                Sign in
              </button>
            </div>
            <ul className="ticks">
              <li>Setup in 60 seconds</li>
              <li>A4 and 80mm printing</li>
              <li>Udhaar reminders</li>
              <li>Daily cloud backup</li>
            </ul>
          </div>

          {/* Interactive Printed Receipt Visual */}
          <div className="stage" aria-label="Sample receipt printed by ShoppyOS">
            <div className="rc" id="rc">
              <h3>AL-MADINA FROZEN MART</h3>
              <div className="c">Johar Town, Lahore</div>
              <hr />
              <div className={`ln ${printedLines.includes(0) ? 'on' : ''}`}>
                <span>INV-20261018-0042</span>
                <span>14:32</span>
              </div>
              <div className={`ln ${printedLines.includes(1) ? 'on' : ''}`}>
                <span>Walk-in customer</span>
                <span></span>
              </div>
              <hr />
              <div className={`ln ${printedLines.includes(2) ? 'on' : ''}`}>
                <span>Chicken nuggets x2</span>
                <span className="price-val">1,900</span>
              </div>
              <div className={`ln ${printedLines.includes(3) ? 'on' : ''}`}>
                <span>Fries x2</span>
                <span className="price-val">1,100</span>
              </div>
              <div className={`ln ${printedLines.includes(4) ? 'on' : ''}`}>
                <span>Sauce x1</span>
                <span className="price-val">450</span>
              </div>
              <hr />
              <div className={`ln tot ${printedLines.includes(5) ? 'on' : ''}`}>
                <span>TOTAL Rs</span>
                <span className="price-val">3,450</span>
              </div>
              <div className={`ln ${printedLines.includes(6) ? 'on' : ''}`}>
                <span>Paid cash</span>
                <span className="price-val">3,450</span>
              </div>
              <hr />
              <div
                className={`ln c ${printedLines.includes(7) ? 'on' : ''}`}
                style={{ justifyContent: 'center' }}
              >
                Khata: Gourmet Bakery<br />
                Rs 8,200 due, reminder sent
              </div>
              <div className={`stamp ${showStamp ? 'on' : ''}`} id="stamp">
                PAID<br />IN FULL
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Trades Section */}
      <section id="trades">
        <div className="wrap">
          <div className="hd">
            <h2>Whatever you sell, ShoppyOS counts it your way.</h2>
            <p>Pick your trade to see what changes behind the counter.</p>
          </div>
          <div className="tabs" role="tablist" aria-label="Business type">
            {TRADES_DATA.map((t, idx) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={activeTrade === idx}
                onClick={() => setActiveTrade(idx)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="panel" role="tabpanel">
            <div>
              <h3 style={{ color: '#FFFFFF' }}>{curTrade.title}</h3>
              <p className="sub" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>{curTrade.desc}</p>
              <ul>
                {curTrade.points.map((pt, i) => (
                  <li key={i} style={{ color: '#F2F6F3' }}>{pt}</li>
                ))}
              </ul>
            </div>
            <div className="rec">
              <b>{curTrade.recHeader}</b>
              {curTrade.recRows.map((r, i) => (
                <div key={i}>
                  <span>{r.k}</span>
                  <span className={r.type === 'flag' ? 'flag' : r.type === 'ok' ? 'ok' : ''}>
                    {r.v}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features">
        <div className="wrap">
          <div className="hd">
            <h2>The shop floor, the counter and the ledger, all in sync.</h2>
            <p>Stop juggling copies and paper receipts. Everything you record shows up everywhere you need it.</p>
          </div>
          <div className="grid">
            <div className="f a">
              <h3>Stock that warns you first</h3>
              <p>Live counts for every branch, with alerts before an item runs out or expires.</p>
              <div className="bars">
                <div className="bar">
                  <span>Chicken nuggets</span>
                  <i style={{ '--w': '82%' }}></i>
                  <span>164 pk</span>
                </div>
                <div className="bar low">
                  <span>Paracetamol 500</span>
                  <i style={{ '--w': '14%' }}></i>
                  <span>28 left</span>
                </div>
                <div className="bar">
                  <span>Cooking oil 5L</span>
                  <i style={{ '--w': '56%' }}></i>
                  <span>112 btl</span>
                </div>
              </div>
            </div>

            <div className="f b">
              <h3>Print on anything</h3>
              <p>A4 invoices for wholesale, 80mm thermal slips for the counter.</p>
              <div className="sz">
                <span>A4</span>
                <span>80mm</span>
              </div>
            </div>

            <div className="f c">
              <h3>Udhaar, tracked</h3>
              <p>Credit limits and payment reminders sent for you.</p>
              <div className="led">
                <div>
                  <span>Gourmet Bakery</span>
                  <span className="flag price-val">Rs 8,200</span>
                </div>
                <div>
                  <span>Haji Traders</span>
                  <span className="flag price-val">Rs 6,100</span>
                </div>
                <div>
                  <span>Bilal Store</span>
                  <span className="ok">Settled</span>
                </div>
              </div>
            </div>

            <div className="f d">
              <h3>Know your profit, not just your sales</h3>
              <p>Today's revenue, cash collected, receivables and net margin on one dashboard. Rs 84,500 in sales, Rs 19,400 profit, and you can see why.</p>
            </div>

            <div className="f e">
              <h3>Roles and permissions</h3>
              <p>Give cashiers the counter and keep costs and reports for yourself.</p>
            </div>

            <div className="f g">
              <h3>Works from your phone</h3>
              <p>Check the shop from home. Backups run daily, so nothing is lost with the shop computer.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing">
        <div className="wrap">
          <div className="hd">
            <h2>Start free. Grow into more.</h2>
            <p>No credit card needed. Pay in rupees, cancel any time.</p>
          </div>
          <div className="plans">
            <div className="plan">
              <h3>Free</h3>
              <div className="pr price-val">Rs 0</div>
              <small>per month</small>
              <ul>
                <li>One shop</li>
                <li>POS and invoicing</li>
                <li>Basic inventory</li>
              </ul>
              <button
                type="button"
                className="btn sec"
                onClick={onNavigateRegister}
              >
                Sign up
              </button>
            </div>

            <div className="plan pro">
              <h3>Pro</h3>
              <div className="pr price-val">Rs 2,500</div>
              <small>per month ($10)</small>
              <ul>
                <li>Retail, wholesale and growing teams</li>
                <li>Staff accounts</li>
                <li>Udhaar reminders</li>
                <li>Automated daily backups</li>
              </ul>
              <button
                type="button"
                className="btn pri"
                onClick={onNavigateRegister}
              >
                Sign up for Pro
              </button>
            </div>

            <div className="plan ent">
              <h3>Enterprise</h3>
              <div className="pr price-val">Rs 8,000</div>
              <small>per month ($30)</small>
              <ul>
                <li>Multi-branch sync</li>
                <li>Custom store domain</li>
                <li>High-volume operations</li>
              </ul>
              <button
                type="button"
                className="btn sec"
                onClick={() => setShowContactModal(true)}
              >
                Contact us
              </button>
            </div>
          </div>
          <p className="note">No credit card required. Cancel any time. Prices in PKR.</p>
        </div>
      </section>

      {/* Shopkeepers / Voices Section */}
      <section id="voices">
        <div className="wrap">
          <div className="hd">
            <span className="sample-pill">Sample User Feedback</span>
            <h2>Run by Pakistani traders every day.</h2>
          </div>
          <div className="vq">
            <figure>
              <div className="big" aria-hidden="true">“</div>
              <div>
                <blockquote>Udhaar ka hisaab ab ek click mein hai. No more notebooks.</blockquote>
                <figcaption><b>Ahmed Raza</b>, Frozen Food Wholesale, Lahore</figcaption>
              </div>
            </figure>
            <figure>
              <div className="big" aria-hidden="true">“</div>
              <div>
                <blockquote>Sizes and colours finally sit in one place. I always know what is left.</blockquote>
                <figcaption><b>Fatima Malik</b>, Clothing Retail, Karachi</figcaption>
              </div>
            </figure>
            <figure>
              <div className="big" aria-hidden="true">“</div>
              <div>
                <blockquote>Set up in a minute and the slips print straight away. Highly recommended.</blockquote>
                <figcaption><b>Usman Khan</b>, General Store, Islamabad</figcaption>
              </div>
            </figure>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <div className="wrap">
        <div className="close">
          <h2>Put your shop on ShoppyOS today.</h2>
          <p>Free to start, ready in under a minute.</p>
          <div className="cta">
            <button
              type="button"
              className="btn pri"
              onClick={onNavigateRegister}
            >
              Sign up free
            </button>
            <button
              type="button"
              className="btn sec"
              onClick={onNavigateLogin}
            >
              Sign in
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer id="footer">
        <div className="wrap">
          <div>
            <a className="logo" href="#top" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', marginBottom: '8px' }}>
              <BrandLogo variant="horizontal" tone="auto" size={28} />
            </a>
            <br />
            Operating system for smart businesses. Made in Pakistan.
          </div>
          <div>
            <a href="#features">Features</a><br />
            <a href="#pricing">Pricing</a><br />
            <a href="#trades">Trades</a>
          </div>
          <div>
            <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
            <br />
            © 2026 ShoppyOS. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Contact Modal */}
      {showContactModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1rem'
          }}
          onClick={() => setShowContactModal(false)}
        >
          <div
            style={{
              background: 'var(--paper)',
              color: 'var(--ink)',
              borderRadius: '1.25rem',
              padding: '2rem',
              maxWidth: '460px',
              width: '100%',
              border: '1px solid var(--line)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', margin: '0 0 0.5rem' }}>
              Enterprise & Custom Plans
            </h3>
            <p style={{ color: 'var(--mut)', fontSize: '0.95rem', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
              Talk directly with our team in Pakistan for custom multi-branch setup, dedicated migration, and custom integrations.
            </p>
            <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <a
                href={`mailto:${supportEmail}`}
                className="btn pri"
                style={{ justifyContent: 'center' }}
              >
                Email: {supportEmail}
              </a>
              <a
                href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn sec"
                style={{ justifyContent: 'center' }}
              >
                WhatsApp: {whatsappNumber}
              </a>
            </div>
            <button
              type="button"
              className="btn sec"
              style={{ width: '100%', justifyContent: 'center', padding: '0.6rem' }}
              onClick={() => setShowContactModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
