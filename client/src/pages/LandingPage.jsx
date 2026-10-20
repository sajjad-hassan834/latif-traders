import React, { useState, useEffect, useRef } from 'react';
import {
  Store,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Package,
  Receipt,
  Users,
  ShieldCheck,
  Smartphone,
  Star,
  Check,
  X
} from 'lucide-react';

const BUSINESS_TYPES = [
  {
    id: 'frozen_food',
    icon: '🧊',
    name: 'Frozen Food',
    description: 'Batch & expiry tracking'
  },
  {
    id: 'retail',
    icon: '🛒',
    name: 'Retail Shop',
    description: 'Fast POS & stock alerts'
  },
  {
    id: 'pharmacy',
    icon: '💊',
    name: 'Pharmacy',
    description: 'Medicine batch management'
  },
  {
    id: 'clothing',
    icon: '👕',
    name: 'Clothing',
    description: 'Size & color variants'
  },
  {
    id: 'restaurant',
    icon: '🍕',
    name: 'Restaurant',
    description: 'Menu & ingredient tracking'
  },
  {
    id: 'hardware',
    icon: '🔧',
    name: 'Hardware',
    description: 'Large catalog management'
  },
  {
    id: 'wholesale',
    icon: '📦',
    name: 'Wholesale',
    description: 'Bulk pricing & ledgers'
  },
  {
    id: 'custom',
    icon: '⚙️',
    name: 'Any Business',
    description: 'Custom categories'
  }
];

const FEATURES = [
  {
    icon: <Package className="w-6 h-6 text-teal-600" />,
    title: 'Smart Inventory',
    description: 'Real-time stock with low stock alerts and expiry warnings'
  },
  {
    icon: <Receipt className="w-6 h-6 text-teal-600" />,
    title: 'POS & Invoicing',
    description: 'Fast counter sales with A4 and 80mm thermal receipt printing'
  },
  {
    icon: <Users className="w-6 h-6 text-teal-600" />,
    title: 'Customer Khata',
    description: 'Track udhaar, credit limits and send payment reminders'
  },
  {
    icon: <TrendingUp className="w-6 h-6 text-teal-600" />,
    title: 'Profit & Loss',
    description: 'Automated daily P&L with expense and COGS calculation'
  },
  {
    icon: <ShieldCheck className="w-6 h-6 text-teal-600" />,
    title: 'Role-Based Access',
    description: 'Admin, Cashier, Inventory and Accountant roles with permissions'
  },
  {
    icon: <Smartphone className="w-6 h-6 text-teal-600" />,
    title: 'Cloud + Local',
    description: 'Works on local PC or cloud. One-click backup and restore'
  }
];

// FIX 7: Structured features with included/excluded flags for clear comparison
const PRICING_PLANS = [
  {
    id: 'free',
    name: 'FREE',
    price: 'Rs 0',
    cadence: '/ month',
    desc: 'For small shops getting started with digital management.',
    highlight: false,
    cta: 'Sign Up',
    features: [
      { text: '50 products & 100 invoices/mo', included: true },
      { text: '1 user account', included: true },
      { text: 'Basic daily sales reports', included: true },
      { text: 'Thermal & A4 invoice printing', included: true },
      { text: 'Multi-user staff permissions', included: false },
      { text: 'Automated daily cloud backups', included: false }
    ]
  },
  {
    id: 'pro',
    name: 'PRO',
    badge: 'Most Popular',
    price: 'Rs 2,500',
    cadence: '/ month ($10)',
    desc: 'For retail shops, wholesalers & growing teams.',
    highlight: true,
    cta: 'Start Pro Trial',
    features: [
      { text: 'Unlimited products & invoices', included: true },
      { text: 'Up to 5 staff user accounts', included: true },
      { text: 'Full P&L & customer ledgers', included: true },
      { text: 'Custom business logo on invoices', included: true },
      { text: 'Automated daily cloud backups', included: true },
      { text: 'Multi-branch sync & custom domain', included: false }
    ]
  },
  {
    id: 'enterprise',
    name: 'ENTERPRISE',
    price: 'Rs 8,000',
    cadence: '/ month ($30)',
    desc: 'For multi-branch chains, large wholesalers, and high-volume operations.',
    highlight: false,
    cta: 'Contact Us',
    features: [
      { text: 'Unlimited products & invoices', included: true },
      { text: 'Unlimited staff user accounts', included: true },
      { text: 'Multi-branch warehouse syncing', included: true },
      { text: 'Dedicated cloud database', included: true },
      { text: 'Priority WhatsApp & phone support', included: true },
      { text: 'Custom store domain connection', included: true }
    ]
  }
];

const TESTIMONIALS = [
  {
    name: 'Ahmed Raza',
    business: 'Frozen Food Wholesale',
    location: 'Lahore, Pakistan',
    quote: 'ShopOS ne hamara poora hisab kitab easy kar diya. Ab roz profit pata chalta hai!',
    rating: 5
  },
  {
    name: 'Fatima Malik',
    business: 'Clothing Retail',
    location: 'Karachi, Pakistan',
    quote: 'Pehle sab copy mein likhte thay, ab mobile se hi sab check ho jata hai.',
    rating: 5
  },
  {
    name: 'Usman Khan',
    business: 'General Store',
    location: 'Islamabad, Pakistan',
    quote: 'Customer ka udhaar track karna ab bohot aasan ho gaya. Highly recommended!',
    rating: 5
  }
];

const CYCLING_PHRASES = [
  'Built for Frozen Food',
  'Built for Retail Shops',
  'Built for Pharmacies',
  'Built for Clothing Stores',
  'Built for Restaurants',
  'Built for Hardware Shops',
  'Built for Wholesalers'
];

// FIX 2: 4 non-redundant, essential trust badges
const TRUST_BADGES = [
  'Instant Setup',
  'Invoice Printing',
  'Udhaar Tracking',
  'Auto Backups'
];

/**
 * Animated Section Wrapper with Intersection Observer fade-in
 */
function Section({ id, bg = '#FFFFFF', children, style = {} }) {
  const sectionRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id={id}
      ref={sectionRef}
      style={{
        background: bg,
        padding: '80px 0',
        transition: 'opacity 500ms ease-out, transform 500ms ease-out',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
        ...style
      }}
    >
      <div style={{ maxWidth: '1140px', margin: '0 auto', padding: '0 24px', boxSizing: 'border-box' }}>
        {children}
      </div>
    </section>
  );
}

export default function LandingPage({ onNavigateLogin, onNavigateRegister }) {
  // Hero Cycling Badge state
  const [cyclingIndex, setCyclingIndex] = useState(0);
  const [fadeState, setFadeState] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setFadeState(false);
      setTimeout(() => {
        setCyclingIndex(prev => (prev + 1) % CYCLING_PHRASES.length);
        setFadeState(true);
      }, 300);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#FFFFFF',
      color: '#0F172A',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    }}>
      {/* ── Top Navigation Bar ── */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backdropFilter: 'blur(16px)',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderBottom: '1px solid #E2E8F0',
        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.04)'
      }}>
        <div style={{
          maxWidth: '1140px',
          margin: '0 auto',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxSizing: 'border-box'
        }}>
          {/* Brand Logo */}
          <div
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
          >
            <img
              src="/logo.png"
              alt="ShopOS"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                objectFit: 'contain',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
              }}
            />
            <div>
              <div style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.5px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                Shop<span style={{ color: '#0284c7' }}>OS</span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: '20px',
                  background: '#e0f2fe',
                  color: '#0369a1',
                  border: '1px solid #bae6fd'
                }}>SaaS ERP</span>
              </div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>Operating System for Smart Businesses</div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
            <a href="#business-types" style={{ color: '#475569', fontSize: '14px', textDecoration: 'none', fontWeight: 500, transition: 'color 0.15s' }}>Industries</a>
            <a href="#features" style={{ color: '#475569', fontSize: '14px', textDecoration: 'none', fontWeight: 500, transition: 'color 0.15s' }}>Features</a>
            <a href="#pricing" style={{ color: '#475569', fontSize: '14px', textDecoration: 'none', fontWeight: 500, transition: 'color 0.15s' }}>Pricing</a>
            <a href="#testimonials" style={{ color: '#475569', fontSize: '14px', textDecoration: 'none', fontWeight: 500, transition: 'color 0.15s' }}>Testimonials</a>
          </nav>

          {/* Top Navbar Actions: Sign In & Sign Up Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={onNavigateLogin}
              style={{
                background: 'transparent',
                color: '#1e293b',
                borderRadius: '8px',
                padding: '8px 18px',
                fontWeight: 600,
                fontSize: '14px',
                border: '1px solid #cbd5e1',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#0266FE';
                e.currentTarget.style.color = '#0266FE';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#cbd5e1';
                e.currentTarget.style.color = '#1e293b';
              }}
            >
              Sign In
            </button>
            <button
              onClick={onNavigateRegister}
              style={{
                background: '#0266FE',
                color: '#ffffff',
                borderRadius: '8px',
                padding: '8px 20px',
                fontWeight: 600,
                fontSize: '14px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(2, 102, 254, 0.25)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#0052cc';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(2, 102, 254, 0.35)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#0266FE';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(2, 102, 254, 0.25)';
              }}
            >
              Sign Up
            </button>
          </div>
        </div>
      </header>

      {/* ── 1. Hero Section ── */}
      <section style={{
        background: '#FFFFFF',
        padding: '70px 0 60px'
      }}>
        <div style={{
          maxWidth: '1140px',
          margin: '0 auto',
          padding: '0 24px',
          textAlign: 'center',
          boxSizing: 'border-box'
        }}>
          {/* Release Pill */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 16px',
            borderRadius: '30px',
            background: '#e0f2fe',
            border: '1px solid #bae6fd',
            color: '#0284c7',
            fontSize: '13px',
            fontWeight: 600,
            marginBottom: '20px'
          }}>
            <Sparkles className="w-4 h-4 text-cyan-600" />
            <span>Next-Gen Cloud Business ERP • Made in Pakistan 🇵🇰</span>
          </div>

          {/* Hero Title */}
          <h1 style={{
            fontSize: '54px',
            lineHeight: 1.15,
            fontWeight: 900,
            letterSpacing: '-1.5px',
            maxWidth: '920px',
            margin: '0 auto 16px',
            color: '#0F172A'
          }}>
            Run Your Business Smarter with <span style={{ color: '#0284c7' }}>ShopOS</span>
          </h1>

          {/* Animated Cycling Industry Badge */}
          <div style={{
            minHeight: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '22px'
          }}>
            <div style={{
              background: 'rgba(2, 102, 254, 0.08)',
              border: '1px solid rgba(2, 102, 254, 0.2)',
              borderRadius: '100px',
              padding: '8px 20px',
              color: '#0266FE',
              fontSize: '15px',
              fontWeight: 600,
              minWidth: '280px',
              textAlign: 'center',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxSizing: 'border-box'
            }}>
              <span>✨</span>
              <span style={{
                display: 'inline-block',
                transition: 'opacity 300ms ease, transform 300ms ease',
                opacity: fadeState ? 1 : 0,
                transform: fadeState ? 'translateY(0)' : 'translateY(4px)'
              }}>
                {CYCLING_PHRASES[cyclingIndex]}
              </span>
            </div>
          </div>

          {/* Subtitle */}
          <p style={{
            fontSize: '19px',
            color: '#475569',
            maxWidth: '740px',
            margin: '0 auto 36px',
            lineHeight: 1.6
          }}>
            Inventory, Sales, Invoices & Customer Khata — all in one unified cloud system. Built specifically for Pakistani shops, retail chains, wholesalers, and food businesses.
          </p>

          {/* FIX 3 & 5: Hero CTA Buttons (#2563EB gradient - primary & prominent) */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            marginBottom: '36px'
          }}>
            {/* Primary button */}
            <button
              onClick={onNavigateRegister}
              style={{
                background: '#0266FE',
                color: '#ffffff',
                padding: '16px 36px',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(2, 102, 254, 0.35)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#0052cc';
                e.currentTarget.style.transform = 'translateY(-1px) scale(1.02)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(2, 102, 254, 0.45)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#0266FE';
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(2, 102, 254, 0.35)';
              }}
            >
              Sign Up
            </button>

            {/* Secondary button */}
            <button
              onClick={onNavigateLogin}
              style={{
                background: '#ffffff',
                border: '2px solid #E5E7EB',
                color: '#374151',
                padding: '16px 36px',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#0266FE';
                e.currentTarget.style.color = '#0266FE';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#E5E7EB';
                e.currentTarget.style.color = '#374151';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Sign In
            </button>
          </div>

          {/* FIX 2: 4 Trust Badges in ONE Clean Transparent Row */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '32px',
            maxWidth: '100%',
            margin: '0 auto',
            padding: '4px 0'
          }}>
            {TRUST_BADGES.map((item, idx) => (
              <div
                key={idx}
                style={{
                  background: 'transparent',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  color: '#6B7280',
                  fontWeight: 500,
                  whiteSpace: 'nowrap'
                }}
              >
                <Check size={14} color="#0266FE" strokeWidth={2.5} />
                <span>{item}</span>
              </div>
            ))}
          </div>

          {/* Dashboard Preview Mockup Card */}
          <div style={{
            marginTop: '56px',
            borderRadius: '16px',
            border: '1px solid #E2E8F0',
            boxShadow: '0 24px 80px rgba(0, 0, 0, 0.12), 0 8px 24px rgba(0, 0, 0, 0.08)',
            overflow: 'hidden',
            background: '#F8FAFC',
            textAlign: 'left'
          }}>
            {/* Browser bar */}
            <div style={{
              background: '#F1F5F9',
              padding: '10px 16px',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FF5F57', display: 'inline-block' }}></span>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FFBD2E', display: 'inline-block' }}></span>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#28C840', display: 'inline-block' }}></span>
                <span style={{
                  background: '#ffffff',
                  border: '1px solid #E2E8F0',
                  borderRadius: '6px',
                  padding: '3px 14px',
                  fontSize: '12px',
                  color: '#64748B',
                  marginLeft: '8px',
                  fontWeight: 500
                }}>
                  app.shopos.pk/dashboard
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#0284c7',
                  background: '#e0f2fe',
                  border: '1px solid #bae6fd',
                  padding: '3px 10px',
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  ⚡ Real-Time Cloud Sync
                </span>
              </div>
            </div>

            {/* Mock Dashboard UI */}
            <div style={{ padding: '28px', background: '#ffffff' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                marginBottom: '24px'
              }}>
                {/* Stat 1: Today's Sales Revenue -> blue #0266FE */}
                <div style={{ background: '#F8FAFC', padding: '18px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '6px', fontWeight: 600 }}>Today's Sales Revenue</div>
                  <div style={{ fontSize: '26px', fontWeight: 800, color: '#0266FE', letterSpacing: '-0.5px' }}>₨ 84,500</div>
                  <div style={{ fontSize: '11px', color: '#16A34A', marginTop: '4px', fontWeight: 600 }}>↑ 18% vs yesterday</div>
                </div>

                {/* Stat 2: Cash Collected -> green #16A34A */}
                <div style={{ background: '#F8FAFC', padding: '18px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '6px', fontWeight: 600 }}>Cash Collected</div>
                  <div style={{ fontSize: '26px', fontWeight: 800, color: '#16A34A', letterSpacing: '-0.5px' }}>₨ 62,000</div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>32 POS Receipts</div>
                </div>

                {/* Stat 3: Receivable Khata -> orange #D97706 */}
                <div style={{ background: '#F8FAFC', padding: '18px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '6px', fontWeight: 600 }}>Receivable Khata</div>
                  <div style={{ fontSize: '26px', fontWeight: 800, color: '#D97706', letterSpacing: '-0.5px' }}>₨ 22,500</div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>4 credit customers</div>
                </div>

                {/* Stat 4: Net Estimated Profit -> purple #7C3AED */}
                <div style={{ background: '#F8FAFC', padding: '18px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '6px', fontWeight: 600 }}>Net Estimated Profit</div>
                  <div style={{ fontSize: '26px', fontWeight: 800, color: '#7C3AED', letterSpacing: '-0.5px' }}>₨ 19,400</div>
                  <div style={{ fontSize: '11px', color: '#16A34A', marginTop: '4px', fontWeight: 600 }}>23.2% net margin</div>
                </div>
              </div>

              {/* Sample Orders preview row */}
              <div style={{ background: '#F8FAFC', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>Recent Orders & Real-time Transactions</div>
                  <span style={{ fontSize: '12px', color: '#0284c7', fontWeight: 600 }}>Live Store Feed</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', color: '#0F172A' }}>
                    <span style={{ fontWeight: 600 }}>INV-20261018-0042 • Walk-in Customer</span>
                    <span style={{ color: '#64748B' }}>3 Items (Chicken Nuggets, Fries)</span>
                    <span style={{ color: '#16A34A', fontWeight: 700 }}>₨ 3,450 (Cash Paid)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#ffffff', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', color: '#0F172A' }}>
                    <span style={{ fontWeight: 600 }}>INV-20261018-0041 • Gourmet Bakery</span>
                    <span style={{ color: '#64748B' }}>Wholesale Bulk Lot #LOT-2610-001</span>
                    <span style={{ color: '#D97706', fontWeight: 700 }}>₨ 18,200 (₨ 8,200 Due)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Social Proof Bar ── */}
      <div style={{
        background: '#FFFFFF',
        borderTop: '1px solid #E5E7EB',
        borderBottom: '1px solid #E5E7EB',
        padding: '28px 0'
      }}>
        <div style={{ maxWidth: '1140px', margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
            color: '#64748B',
            marginBottom: '14px'
          }}>
            Trusted by businesses across Pakistan
          </div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px'
          }}>
            {[
              { icon: '🛒', label: 'Retail' },
              { icon: '🧊', label: 'Frozen Food' },
              { icon: '💊', label: 'Pharmacy' },
              { icon: '👕', label: 'Clothing' },
              { icon: '🔧', label: 'Hardware' },
              { icon: '🍕', label: 'Food & Dining' }
            ].map((tag, idx) => (
              <div
                key={idx}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#334155',
                  padding: '7px 16px',
                  borderRadius: '10px',
                  background: '#F8FAFC',
                  border: '1px solid #E5E7EB'
                }}
              >
                <span>{tag.icon}</span> {tag.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 2. Business Types / Industries Section (Alternate: #F8FAFC) ── */}
      <Section id="business-types" bg="#F8FAFC">
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{
            fontSize: '12px',
            letterSpacing: '2px',
            color: '#0266FE',
            fontWeight: 600,
            textAlign: 'center',
            textTransform: 'uppercase',
            marginBottom: '10px'
          }}>
            TAILORED FOR YOUR TRADE
          </div>
          <h2 style={{
            fontSize: '36px',
            fontWeight: 800,
            color: '#0F172A',
            textAlign: 'center',
            lineHeight: 1.2,
            margin: '0 0 14px 0',
            letterSpacing: '-0.5px'
          }}>
            Built for Every Type of Business
          </h2>
          <p style={{
            fontSize: '17px',
            color: '#64748B',
            textAlign: 'center',
            maxWidth: '560px',
            margin: '0 auto',
            lineHeight: 1.6
          }}>
            Whether you run a fast-paced retail counter, a freezer warehouse, or a pharmacy, ShopOS adapts its workflows to match your specific industry.
          </p>
        </div>

        {/* Business Grid (8 Cards) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '20px'
        }}>
          {BUSINESS_TYPES.map(bt => (
            <div
              key={bt.id}
              style={{
                background: '#FFFFFF',
                borderRadius: '16px',
                padding: '24px',
                border: '1px solid #E5E7EB',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                transition: 'all 0.25s ease',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#0266FE';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(2, 102, 254, 0.15)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#E5E7EB';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.04)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '50%',
                background: '#EFF6FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px'
              }}>
                {bt.icon}
              </div>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#111827', margin: '0 0 6px 0' }}>
                  {bt.name}
                </h3>
                <p style={{ fontSize: '13px', color: '#6B7280', margin: 0, lineHeight: 1.5 }}>
                  {bt.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 3. Features Section (Main: #FFFFFF) ── */}
      <Section id="features" bg="#FFFFFF" style={{ borderTop: '1px solid #E5E7EB' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{
            fontSize: '12px',
            letterSpacing: '2px',
            color: '#0266FE',
            fontWeight: 600,
            textAlign: 'center',
            textTransform: 'uppercase',
            marginBottom: '10px'
          }}>
            COMPREHENSIVE TOOLS
          </div>
          <h2 style={{
            fontSize: '36px',
            fontWeight: 800,
            color: '#0F172A',
            textAlign: 'center',
            lineHeight: 1.2,
            margin: '0 0 14px 0',
            letterSpacing: '-0.5px'
          }}>
            Everything You Need to Scale
          </h2>
          <p style={{
            fontSize: '17px',
            color: '#64748B',
            textAlign: 'center',
            maxWidth: '560px',
            margin: '0 auto',
            lineHeight: 1.6
          }}>
            Stop juggling spreadsheets and paper receipts. ShopOS unifies every aspect of daily business operations into one intuitive interface.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '24px'
        }}>
          {FEATURES.map((feat, idx) => (
            <div
              key={idx}
              style={{
                background: '#FFFFFF',
                borderRadius: '16px',
                padding: '28px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 4px 18px -2px rgba(15, 23, 42, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#0266FE';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#E2E8F0';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: '#EFF6FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #BAE6FD'
              }}>
                {feat.icon}
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: 0 }}>{feat.title}</h3>
              <p style={{ fontSize: '14px', color: '#64748B', lineHeight: 1.6, margin: 0 }}>{feat.description}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── 4. Pricing Section (Alternate: #F8FAFC) ── */}
      <Section id="pricing" bg="#F8FAFC" style={{ borderTop: '1px solid #E5E7EB' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{
            fontSize: '12px',
            letterSpacing: '2px',
            color: '#0266FE',
            fontWeight: 600,
            textAlign: 'center',
            textTransform: 'uppercase',
            marginBottom: '10px'
          }}>
            TRANSPARENT PLANS
          </div>
          <h2 style={{
            fontSize: '36px',
            fontWeight: 800,
            color: '#0F172A',
            textAlign: 'center',
            lineHeight: 1.2,
            margin: '0 0 14px 0',
            letterSpacing: '-0.5px'
          }}>
            Simple, Transparent Pricing
          </h2>
          <p style={{
            fontSize: '17px',
            color: '#64748B',
            textAlign: 'center',
            maxWidth: '560px',
            margin: '0 auto',
            lineHeight: 1.6
          }}>
            Start 100% free with no credit card required. Upgrade as your shop grows and you add staff members.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
          alignItems: 'stretch'
        }}>
          {PRICING_PLANS.map(plan => (
            <div
              key={plan.id}
              style={{
                borderRadius: '20px',
                padding: '36px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                background: '#FFFFFF',
                border: plan.highlight ? '2px solid #0266FE' : '1px solid #E2E8F0',
                boxShadow: plan.highlight
                  ? '0 20px 40px -10px rgba(2, 102, 254, 0.22)'
                  : '0 4px 18px -2px rgba(15, 23, 42, 0.05)'
              }}
            >
              {plan.badge && (
                <div style={{
                  position: 'absolute',
                  top: '-12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'linear-gradient(135deg, #0266FE 0%, #1D4ED8 100%)',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  padding: '4px 14px',
                  borderRadius: '20px',
                  letterSpacing: '0.5px',
                  boxShadow: '0 4px 10px rgba(2, 102, 254, 0.3)'
                }}>
                  {plan.badge}
                </div>
              )}

              <div>
                <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', marginBottom: '8px' }}>{plan.name}</h3>
                <p style={{ fontSize: '13px', color: '#64748B', minHeight: '38px', lineHeight: 1.5, margin: 0 }}>{plan.desc}</p>

                <div style={{ margin: '24px 0', borderBottom: '1px solid #E2E8F0', paddingBottom: '24px' }}>
                  <div style={{ fontSize: '40px', fontWeight: 900, color: plan.highlight ? '#0266FE' : '#0F172A' }}>{plan.price}</div>
                  <div style={{ fontSize: '13px', color: '#64748B' }}>{plan.cadence}</div>
                </div>

                {/* FIX 7: Professional circle icons with white check / gray cross */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '32px' }}>
                  {plan.features.map((feat, fidx) => (
                    <div key={fidx} style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: feat.included ? '#0266FE' : '#E5E7EB',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {feat.included ? (
                          <Check size={10} color="#ffffff" strokeWidth={3} />
                        ) : (
                          <X size={10} color="#9CA3AF" strokeWidth={3} />
                        )}
                      </div>
                      <span style={{
                        fontSize: '14px',
                        color: feat.included ? '#374151' : '#9CA3AF',
                        marginLeft: '10px',
                        lineHeight: 1.5
                      }}>
                        {feat.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pricing Section Action Buttons */}
              {plan.id === 'free' && (
                <button
                  onClick={onNavigateRegister}
                  style={{
                    height: '48px',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: 600,
                    width: '100%',
                    background: '#ffffff',
                    border: '2px solid #E5E7EB',
                    color: '#374151',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#0266FE';
                    e.currentTarget.style.color = '#0266FE';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = '#E5E7EB';
                    e.currentTarget.style.color = '#374151';
                  }}
                >
                  Sign Up
                </button>
              )}

              {plan.id === 'pro' && (
                <button
                  onClick={onNavigateRegister}
                  style={{
                    height: '48px',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: 600,
                    width: '100%',
                    background: '#0266FE',
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(2, 102, 254, 0.3)',
                    transition: 'all 0.2s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#0052cc';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(2, 102, 254, 0.45)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#0266FE';
                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(2, 102, 254, 0.3)';
                  }}
                >
                  Sign Up for Pro
                </button>
              )}

              {plan.id === 'enterprise' && (
                <button
                  onClick={onNavigateRegister}
                  style={{
                    height: '48px',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: 600,
                    width: '100%',
                    background: '#ffffff',
                    border: '2px solid #374151',
                    color: '#374151',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#374151';
                    e.currentTarget.style.color = '#ffffff';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#ffffff';
                    e.currentTarget.style.color = '#374151';
                  }}
                >
                  Contact Us
                </button>
              )}
            </div>
          ))}
        </div>

        {/* FIX 1: Clean single line bottom text (no scattered emojis, professional light gray) */}
        <div style={{
          marginTop: '32px',
          textAlign: 'center',
          fontSize: '13px',
          color: '#9CA3AF',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px'
        }}>
          <span>No credit card required</span>
          <span>•</span>
          <span>Cancel anytime</span>
          <span>•</span>
          <span>PKR pricing</span>
        </div>
      </Section>

      {/* ── 5. Testimonials Section (Main: #FFFFFF) ── */}
      <Section id="testimonials" bg="#FFFFFF" style={{ borderTop: '1px solid #E5E7EB' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{
            fontSize: '12px',
            letterSpacing: '2px',
            color: '#0266FE',
            fontWeight: 600,
            textAlign: 'center',
            textTransform: 'uppercase',
            marginBottom: '10px'
          }}>
            TRUSTED BY BUSINESS OWNERS
          </div>
          <h2 style={{
            fontSize: '36px',
            fontWeight: 800,
            color: '#0F172A',
            textAlign: 'center',
            lineHeight: 1.2,
            margin: '0 0 14px 0',
            letterSpacing: '-0.5px'
          }}>
            Loved by Pakistani Traders & Shopkeepers
          </h2>
          <p style={{
            fontSize: '17px',
            color: '#64748B',
            textAlign: 'center',
            maxWidth: '560px',
            margin: '0 auto',
            lineHeight: 1.6
          }}>
            Real stories from shops, retail chains, and wholesalers who simplified their daily bookkeeping and inventory with ShopOS.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px'
        }}>
          {TESTIMONIALS.map((tItem, idx) => (
            <div
              key={idx}
              style={{
                background: '#FFFFFF',
                borderRadius: '16px',
                padding: '28px',
                border: '1px solid #E2E8F0',
                boxShadow: '0 4px 18px -2px rgba(15, 23, 42, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '14px' }}>
                  {[...Array(tItem.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p style={{ fontSize: '15px', color: '#334155', lineHeight: 1.6, fontStyle: 'italic', marginBottom: '20px' }}>
                  "{tItem.quote}"
                </p>
              </div>

              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
                <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '15px' }}>{tItem.name}</div>
                <div style={{ fontSize: '13px', color: '#0266FE', fontWeight: 600 }}>{tItem.business}</div>
                <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                  <span>📍</span> {tItem.location}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Final Call to Action ── */}
      <section style={{
        background: '#FFFFFF',
        padding: '30px 0 80px'
      }}>
        <div style={{ maxWidth: '1140px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{
            borderRadius: '24px',
            padding: '60px 40px',
            background: 'linear-gradient(135deg, #0266FE 0%, #1D4ED8 50%, #0f172a 100%)',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(2, 102, 254, 0.35)'
          }}>
            <h2 style={{ fontSize: '40px', fontWeight: 900, color: '#ffffff', marginBottom: '16px', letterSpacing: '-0.5px' }}>
              Ready to Digitize Your Shop?
            </h2>
            <p style={{ fontSize: '18px', color: '#e0f2fe', maxWidth: '640px', margin: '0 auto 32px', lineHeight: 1.6 }}>
              Join thousands of traders moving from messy registers to ShopOS. Setup in under 60 seconds.
            </p>
            <button
              onClick={onNavigateRegister}
              style={{
                padding: '16px 44px',
                borderRadius: '12px',
                border: 'none',
                background: '#ffffff',
                color: '#0266FE',
                fontSize: '16px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#EFF6FF';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.2)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.15)';
              }}
            >
              Sign Up
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer (Alternate: #F8FAFC) ── */}
      <footer style={{
        borderTop: '1px solid #E2E8F0',
        background: '#F8FAFC',
        padding: '60px 0 30px'
      }}>
        <div style={{
          maxWidth: '1140px',
          margin: '0 auto',
          padding: '0 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '40px'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '30px'
          }}>
            {/* Left side: Brand */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <img
                  src="/logo.png"
                  alt="ShopOS"
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    objectFit: 'contain'
                  }}
                />
                <span style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A' }}>
                  Shop<span style={{ color: '#0266FE' }}>OS</span>
                </span>
              </div>
              <p style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.6', margin: '0 0 12px' }}>
                Operating System for Smart Businesses
              </p>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#0266FE' }}>
                🇵🇰 Made in Pakistan
              </div>
            </div>

            {/* Middle Column 1: Product */}
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '14px' }}>Product</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                <a href="#features" style={{ color: '#64748B', textDecoration: 'none' }}>Features</a>
                <a href="#pricing" style={{ color: '#64748B', textDecoration: 'none' }}>Pricing</a>
                <a href="#business-types" style={{ color: '#64748B', textDecoration: 'none' }}>Industries</a>
                <a href="#testimonials" style={{ color: '#64748B', textDecoration: 'none' }}>Testimonials</a>
              </div>
            </div>

            {/* FIX 3: Middle Column 2: Simplified "Get Started" (max 2 non-redundant links) */}
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '14px' }}>Get Started</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                <button
                  onClick={onNavigateRegister}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0266FE',
                    textAlign: 'left',
                    padding: 0,
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Sign Up (Free)
                </button>
                <button
                  onClick={onNavigateLogin}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#475569',
                    textAlign: 'left',
                    padding: 0,
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Sign In to Your Shop
                </button>
              </div>
            </div>

            {/* FIX 3: Right side: Connect with us (no placeholder WhatsApp, clean email) */}
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '14px' }}>Connect with us</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#64748B' }}>
                <a
                  href="mailto:support@shopos.pk"
                  style={{
                    color: '#0266FE',
                    fontWeight: 600,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>📧</span> support@shopos.pk
                </a>
              </div>
            </div>
          </div>

          {/* FIX 6: Clean Minimal Bottom Bar without vague claims */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid #E2E8F0',
            paddingTop: '24px',
            fontSize: '13px',
            color: '#64748B',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>© 2026 ShopOS. All rights reserved.</div>
            <div>Made with ❤️ in Pakistan 🇵🇰</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
