import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSavedPublicTheme, applyPublicTheme } from '../utils/theme';
import {
  Store,
  User,
  Mail,
  Lock,
  Phone,
  Building,
  MapPin,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Loader2,
  Sun,
  Moon,
  Check,
  Package,
  ShoppingCart,
  Users,
  ReceiptText
} from 'lucide-react';

const BUSINESS_TYPES = [
  { id: 'frozen_food', icon: '🧊', label: 'Frozen Food' },
  { id: 'retail_general', icon: '🛒', label: 'Retail / General Shop' },
  { id: 'pharmacy', icon: '💊', label: 'Pharmacy' },
  { id: 'clothing', icon: '👕', label: 'Clothing & Fashion' },
  { id: 'restaurant', icon: '🍕', label: 'Restaurant / Food' },
  { id: 'hardware', icon: '🔧', label: 'Hardware & Construction' },
  { id: 'wholesale', icon: '📦', label: 'Wholesale / Distribution' },
  { id: 'other', icon: '⚙️', label: 'Other (specify)' }
];

export default function Register({ onNavigateLogin, onNavigateLanding }) {
  const { register } = useAuth();

  const [step, setStep] = useState(1); // 1: Account, 2: Business, 3: Done
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState(() => getSavedPublicTheme());
  const isDark = theme === 'dark';

  useEffect(() => {
    applyPublicTheme(getSavedPublicTheme());
    const handleThemeSync = (e) => {
      if (e?.detail) setTheme(e.detail);
    };
    window.addEventListener('public_theme_changed', handleThemeSync);
    return () => window.removeEventListener('public_theme_changed', handleThemeSync);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    applyPublicTheme(next);
    setTheme(next);
  };

  // Form Fields
  const [formData, setFormData] = useState({
    // Step 1: Account Details
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
    phone: '',
    // Step 2: Business Setup
    business_name: '',
    business_type: 'retail_general',
    custom_business_type: '',
    city: ''
  });

  // Registered info for Step 3
  const [completedInfo, setCompletedInfo] = useState({
    name: '',
    businessName: ''
  });

  // Onboarding checklist state
  const [checkedItems, setCheckedItems] = useState({
    product: false,
    sale: false,
    customer: false,
    invoice: false
  });

  const t = {
    pageBg: isDark ? '#0b1120' : '#f0f4f8',
    textColor: isDark ? '#f8fafc' : '#0f172a',
    headerBg: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)',
    headerBorder: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
    cardBg: isDark ? '#131d31' : '#ffffff',
    cardBorder: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0',
    cardShadow: isDark ? '0 25px 60px -15px rgba(0, 0, 0, 0.7)' : '0 20px 60px rgba(0,0,0,0.08)',
    inputBg: isDark ? '#0f172a' : '#ffffff',
    inputBorder: isDark ? 'rgba(255, 255, 255, 0.14)' : '#cbd5e1',
    inputText: isDark ? '#ffffff' : '#0f172a',
    labelColor: isDark ? '#cbd5e1' : '#334155',
    subText: isDark ? '#94a3b8' : '#64748b',
    titleColor: isDark ? '#ffffff' : '#0f172a',
    boxBg: isDark ? '#0f172a' : '#f8fafc',
    boxBorder: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0',
    tealBtn: 'linear-gradient(135deg, #0266FE 0%, #1D4ED8 100%)',
    tealSolid: '#0266FE'
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  // Password Strength Calculation
  const calculatePasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '', color: '#e2e8f0', width: '0%' };
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (pwd.length >= 12) score += 1;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score += 1;
    if (/\d/.test(pwd)) score += 1;
    if (/[^a-zA-Z0-9]/.test(pwd)) score += 1;

    if (score <= 1) return { score: 1, label: 'Weak', color: '#ef4444', width: '25%' };
    if (score <= 3) return { score: 2, label: 'Medium', color: '#f59e0b', width: '60%' };
    return { score: 3, label: 'Strong', color: '#10b981', width: '100%' };
  };

  const strength = calculatePasswordStrength(formData.password);

  const validateStep1 = () => {
    if (!formData.full_name.trim()) {
      setError('Please enter your Full Name.');
      return false;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setError('Please provide a valid Email Address.');
      return false;
    }
    if (!formData.password || formData.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return false;
    }
    if (formData.password !== formData.confirm_password) {
      setError('Password and Confirm Password do not match.');
      return false;
    }
    if (!formData.phone.trim()) {
      setError('Please enter your Phone / WhatsApp Number.');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.business_name.trim()) {
      setError('Business Name is required.');
      return false;
    }
    if (formData.business_type === 'other' && !formData.custom_business_type.trim()) {
      setError('Please specify your Business Type.');
      return false;
    }
    if (!formData.city.trim()) {
      setError('City / Location is required.');
      return false;
    }
    return true;
  };

  const handleContinueToBusiness = (e) => {
    e.preventDefault();
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleCompleteSetup = async (e) => {
    e.preventDefault();
    if (!validateStep2()) return;

    setError('');
    setLoading(true);

    try {
      const actualBusinessType = formData.business_type === 'other'
        ? formData.custom_business_type.trim()
        : formData.business_type;

      const payload = {
        fullName: formData.full_name.trim(),
        full_name: formData.full_name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        phone: formData.phone.trim(),
        businessName: formData.business_name.trim(),
        business_name: formData.business_name.trim(),
        businessType: actualBusinessType,
        business_type: actualBusinessType,
        city: formData.city.trim(),
        businessPhone: formData.phone.trim(),
        plan: 'free'
      };

      await register(payload);
      setCompletedInfo({
        name: formData.full_name.trim(),
        businessName: formData.business_name.trim()
      });
      setStep(3);
    } catch (err) {
      console.error('Registration failed:', err);
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoToDashboard = () => {
    // AuthContext already has the user logged in, reload or route to root
    window.location.href = '/';
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: t.pageBg,
      color: t.textColor,
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Top Header */}
      <header style={{
        padding: '16px 32px',
        borderBottom: `1px solid ${t.headerBorder}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: t.headerBg,
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
      }}>
        <div
          onClick={onNavigateLanding}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
        >
          <img
            src="/logo.png"
            alt="ShopOS Logo"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '9px',
              objectFit: 'contain',
              boxShadow: '0 2px 8px rgba(2, 102, 254, 0.25)'
            }}
          />
          <span style={{ fontSize: '20px', fontWeight: 800, color: t.titleColor, letterSpacing: '-0.5px' }}>
            Shop<span style={{ color: '#0266FE' }}>OS</span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '14px' }}>
          <button
            onClick={toggleTheme}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              border: `1px solid ${t.headerBorder}`,
              background: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
              color: t.textColor,
              cursor: 'pointer'
            }}
            title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
          {step < 3 && (
            <button
              onClick={onNavigateLogin}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                border: '1px solid #0266FE',
                background: '#0266FE',
                color: '#ffffff',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '13px',
                boxShadow: '0 2px 8px rgba(2, 102, 254, 0.25)',
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#0052cc'}
              onMouseLeave={e => e.currentTarget.style.background = '#0266FE'}
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Main Registration Content */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '36px 20px'
      }}>
        <div style={{
          width: '100%',
          maxWidth: '560px',
          background: t.cardBg,
          borderRadius: '20px',
          border: `1px solid ${t.cardBorder}`,
          padding: '36px 32px',
          boxShadow: t.cardShadow,
          transition: 'all 0.3s ease'
        }}>
          {/* STEP INDICATOR [1: Account] → [2: Business] → [3: Done] */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '28px',
            userSelect: 'none'
          }}>
            {/* Step 1 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: step >= 1 ? '#0266FE' : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'),
                color: step >= 1 ? '#fff' : (isDark ? '#94a3b8' : '#64748b'),
                fontSize: '13px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}>1</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: step >= 1 ? t.titleColor : t.subText }}>Account</span>
            </div>

            <div style={{
              width: '36px',
              height: '2px',
              background: step >= 2 ? '#0266FE' : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'),
              transition: 'all 0.2s'
            }} />

            {/* Step 2 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: step >= 2 ? '#0266FE' : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'),
                color: step >= 2 ? '#fff' : (isDark ? '#94a3b8' : '#64748b'),
                fontSize: '13px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}>2</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: step >= 2 ? t.titleColor : t.subText }}>Business</span>
            </div>

            <div style={{
              width: '36px',
              height: '2px',
              background: step >= 3 ? '#0266FE' : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'),
              transition: 'all 0.2s'
            }} />

            {/* Step 3 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: step >= 3 ? '#10b981' : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'),
                color: step >= 3 ? '#fff' : (isDark ? '#94a3b8' : '#64748b'),
                fontSize: '13px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}>3</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: step >= 3 ? t.titleColor : t.subText }}>Done</span>
            </div>
          </div>

          {/* Error Message Alert */}
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 16px',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              fontSize: '13px',
              marginBottom: '20px'
            }}>
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ═════════ STEP 1: ACCOUNT DETAILS ═════════ */}
          {step === 1 && (
            <form onSubmit={handleContinueToBusiness}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 800, color: t.titleColor, margin: '0 0 6px 0' }}>
                  Account Details
                </h2>
                <p style={{ color: t.subText, fontSize: '13px', margin: 0 }}>
                  Enter your information to set up the primary administrator account.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Full Name * */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: t.labelColor, marginBottom: '6px' }}>
                    Full Name *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <User className="w-4 h-4 text-slate-400" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mudassir Arif"
                      value={formData.full_name}
                      onChange={e => handleChange('full_name', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px 10px 38px',
                        borderRadius: '8px',
                        background: t.inputBg,
                        border: `1px solid ${t.inputBorder}`,
                        color: t.inputText,
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                {/* Email Address * */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: t.labelColor, marginBottom: '6px' }}>
                    Email Address *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Mail className="w-4 h-4 text-slate-400" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                    <input
                      type="email"
                      required
                      placeholder="e.g. owner@business.com"
                      value={formData.email}
                      onChange={e => handleChange('email', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px 10px 38px',
                        borderRadius: '8px',
                        background: t.inputBg,
                        border: `1px solid ${t.inputBorder}`,
                        color: t.inputText,
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                {/* Password * (min 8 chars, show strength bar) */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: t.labelColor, margin: 0 }}>
                      Password * (min 8 chars)
                    </label>
                    {formData.password && (
                      <span style={{ fontSize: '11px', fontWeight: 700, color: strength.color }}>
                        {strength.label}
                      </span>
                    )}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <Lock className="w-4 h-4 text-slate-400" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                    <input
                      type="password"
                      required
                      placeholder="At least 8 characters"
                      value={formData.password}
                      onChange={e => handleChange('password', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px 10px 38px',
                        borderRadius: '8px',
                        background: t.inputBg,
                        border: `1px solid ${t.inputBorder}`,
                        color: t.inputText,
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Password Strength Bar */}
                  {formData.password && (
                    <div style={{
                      marginTop: '6px',
                      height: '4px',
                      background: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%',
                        width: strength.width,
                        background: strength.color,
                        transition: 'all 0.3s ease'
                      }} />
                    </div>
                  )}
                </div>

                {/* Confirm Password * */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: t.labelColor, marginBottom: '6px' }}>
                    Confirm Password *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Lock className="w-4 h-4 text-slate-400" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                    <input
                      type="password"
                      required
                      placeholder="Re-enter your password"
                      value={formData.confirm_password}
                      onChange={e => handleChange('confirm_password', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px 10px 38px',
                        borderRadius: '8px',
                        background: t.inputBg,
                        border: `1px solid ${t.inputBorder}`,
                        color: t.inputText,
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                {/* Phone Number * */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: t.labelColor, marginBottom: '6px' }}>
                    Phone Number *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Phone className="w-4 h-4 text-slate-400" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                    <input
                      type="text"
                      required
                      placeholder="e.g. 0300 1234567"
                      value={formData.phone}
                      onChange={e => handleChange('phone', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px 10px 38px',
                        borderRadius: '8px',
                        background: t.inputBg,
                        border: `1px solid ${t.inputBorder}`,
                        color: t.inputText,
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                {/* Continue → button (teal) */}
                <button
                  type="submit"
                  style={{
                    marginTop: '8px',
                    width: '100%',
                    padding: '13px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#0266FE',
                    color: '#ffffff',
                    fontSize: '15px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(2, 102, 254, 0.35)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#0052cc'}
                  onMouseLeave={e => e.currentTarget.style.background = '#0266FE'}
                >
                  <span>Continue</span>
                </button>

                {/* Already have account? Sign In link */}
                <div style={{ textAlign: 'center', marginTop: '6px', fontSize: '13px', color: t.subText }}>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={onNavigateLogin}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0266FE',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    Sign In
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ═════════ STEP 2: BUSINESS SETUP ═════════ */}
          {step === 2 && (
            <form onSubmit={handleCompleteSetup}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 800, color: t.titleColor, margin: '0 0 6px 0' }}>
                  Business Setup
                </h2>
                <p style={{ color: t.subText, fontSize: '13px', margin: 0 }}>
                  Configure your store profile so we can tailor POS categories and receipts.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Business Name * */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: t.labelColor, marginBottom: '6px' }}>
                    Business Name *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Building className="w-4 h-4 text-slate-400" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Latif Traders, Al-Madina Superstore"
                      value={formData.business_name}
                      onChange={e => handleChange('business_name', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px 10px 38px',
                        borderRadius: '8px',
                        background: t.inputBg,
                        border: `1px solid ${t.inputBorder}`,
                        color: t.inputText,
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                {/* Business Type * (dropdown with icons) */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: t.labelColor, marginBottom: '6px' }}>
                    Business Type *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={formData.business_type}
                      onChange={e => handleChange('business_type', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        background: t.inputBg,
                        border: `1px solid ${t.inputBorder}`,
                        color: t.inputText,
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      {BUSINESS_TYPES.map(bt => (
                        <option key={bt.id} value={bt.id}>
                          {bt.icon} {bt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* If Other is selected, show specify input */}
                {formData.business_type === 'other' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: t.labelColor, marginBottom: '6px' }}>
                      Specify Business Type *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Automobile Spare Parts, Bookshop"
                      value={formData.custom_business_type}
                      onChange={e => handleChange('custom_business_type', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        background: t.inputBg,
                        border: `1px solid ${t.inputBorder}`,
                        color: t.inputText,
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none'
                      }}
                    />
                  </div>
                )}

                {/* City / Location * */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: t.labelColor, marginBottom: '6px' }}>
                    City / Location *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <MapPin className="w-4 h-4 text-slate-400" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Lahore, Karachi, Rawalpindi"
                      value={formData.city}
                      onChange={e => handleChange('city', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px 10px 38px',
                        borderRadius: '8px',
                        background: t.inputBg,
                        border: `1px solid ${t.inputBorder}`,
                        color: t.inputText,
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                {/* Action Buttons: Complete Setup → (teal) & ← Back link */}
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    marginTop: '8px',
                    width: '100%',
                    padding: '13px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#0266FE',
                    color: '#ffffff',
                    fontSize: '15px',
                    fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(2, 102, 254, 0.35)',
                    transition: 'all 0.2s',
                    opacity: loading ? 0.8 : 1
                  }}
                  onMouseEnter={e => !loading && (e.currentTarget.style.background = '#0052cc')}
                  onMouseLeave={e => !loading && (e.currentTarget.style.background = '#0266FE')}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Setting up Workspace...</span>
                    </>
                  ) : (
                    <span>Complete Setup</span>
                  )}
                </button>

                <div style={{ textAlign: 'center', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => { setError(''); setStep(1); }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: t.subText,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>← Back</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ═════════ STEP 3: DONE / WELCOME ═════════ */}
          {step === 3 && (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              {/* Big green checkmark animation */}
              <div style={{
                width: '76px',
                height: '76px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '2px solid #10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                animation: 'bounce 0.6s ease'
              }}>
                <Check className="w-10 h-10 text-emerald-500" strokeWidth={3} />
              </div>

              <h2 style={{ fontSize: '24px', fontWeight: 800, color: t.titleColor, margin: '0 0 8px 0' }}>
                Welcome to ShopOS, {completedInfo.name || formData.full_name}! 🎉
              </h2>

              <p style={{ fontSize: '14px', color: t.subText, margin: '0 0 24px 0', lineHeight: 1.5 }}>
                Your <strong>{completedInfo.businessName || formData.business_name}</strong> workspace is ready.
              </p>

              {/* Onboarding checklist */}
              <div style={{
                background: t.boxBg,
                borderRadius: '12px',
                border: `1px solid ${t.boxBorder}`,
                padding: '16px 20px',
                textAlign: 'left',
                marginBottom: '26px'
              }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: t.titleColor, marginBottom: '12px' }}>
                  Quick Onboarding Checklist:
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label
                    onClick={() => setCheckedItems(prev => ({ ...prev, product: !prev.product }))}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontSize: '13px',
                      color: checkedItems.product ? '#10b981' : t.labelColor,
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checkedItems.product}
                      onChange={() => {}}
                      style={{ accentColor: '#0266FE', width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <Package className="w-4 h-4 text-slate-400" />
                    <span style={{ textDecoration: checkedItems.product ? 'line-through' : 'none' }}>
                      Add your first product
                    </span>
                  </label>

                  <label
                    onClick={() => setCheckedItems(prev => ({ ...prev, sale: !prev.sale }))}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontSize: '13px',
                      color: checkedItems.sale ? '#10b981' : t.labelColor,
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checkedItems.sale}
                      onChange={() => {}}
                      style={{ accentColor: '#0266FE', width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <ShoppingCart className="w-4 h-4 text-slate-400" />
                    <span style={{ textDecoration: checkedItems.sale ? 'line-through' : 'none' }}>
                      Make your first sale
                    </span>
                  </label>

                  <label
                    onClick={() => setCheckedItems(prev => ({ ...prev, customer: !prev.customer }))}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontSize: '13px',
                      color: checkedItems.customer ? '#10b981' : t.labelColor,
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checkedItems.customer}
                      onChange={() => {}}
                      style={{ accentColor: '#0266FE', width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <Users className="w-4 h-4 text-slate-400" />
                    <span style={{ textDecoration: checkedItems.customer ? 'line-through' : 'none' }}>
                      Add a customer
                    </span>
                  </label>

                  <label
                    onClick={() => setCheckedItems(prev => ({ ...prev, invoice: !prev.invoice }))}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontSize: '13px',
                      color: checkedItems.invoice ? '#10b981' : t.labelColor,
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checkedItems.invoice}
                      onChange={() => {}}
                      style={{ accentColor: '#0266FE', width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <ReceiptText className="w-4 h-4 text-slate-400" />
                    <span style={{ textDecoration: checkedItems.invoice ? 'line-through' : 'none' }}>
                      Set up invoice details
                    </span>
                  </label>
                </div>
              </div>

              {/* Go to Dashboard button */}
              <button
                type="button"
                onClick={handleGoToDashboard}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#0266FE',
                  color: '#ffffff',
                  fontSize: '16px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 6px 20px rgba(2, 102, 254, 0.4)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#0052cc'}
                onMouseLeave={e => e.currentTarget.style.background = '#0266FE'}
              >
                <span>Go to Dashboard</span>
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
