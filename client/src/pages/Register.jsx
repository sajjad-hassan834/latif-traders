import BrandLogo from '../components/common/BrandLogo';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSavedPublicTheme, applyPublicTheme } from '../utils/theme';
import PublicThemeToggle from '../components/common/PublicThemeToggle';
import {
  Store,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
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
import { BUSINESS_TYPES_LIST } from '../utils/terminology';

const BUSINESS_TYPES = BUSINESS_TYPES_LIST;

export default function Register({ onNavigateLogin, onNavigateLanding }) {
  const { register } = useAuth();

  const [step, setStep] = useState(1); // 1: Account, 2: Business, 3: Done
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
    pageBg: 'var(--bg)',
    textColor: 'var(--ink)',
    headerBg: 'color-mix(in srgb, var(--bg) 92%, transparent)',
    headerBorder: 'var(--line)',
    cardBg: 'var(--paper)',
    cardBorder: 'var(--line)',
    cardShadow: 'var(--pub-card-shadow)',
    inputBg: 'var(--pub-input-bg)',
    inputBorder: 'var(--line)',
    inputText: 'var(--ink)',
    labelColor: 'var(--ink)',
    subText: 'var(--mut)',
    titleColor: 'var(--ink)',
    boxBg: 'var(--soft)',
    boxBorder: 'var(--line)',
    goldBtn: 'var(--gold)',
    goldBtnText: '#241800'
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
      width: '100%',
      maxWidth: '100vw',
      boxSizing: 'border-box',
      overflowX: 'hidden',
      background: t.pageBg,
      color: t.textColor,
      fontFamily: 'var(--font-body)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Top Header */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        width: '100%',
        boxSizing: 'border-box',
        padding: '12px 16px',
        borderBottom: `1px solid ${t.headerBorder}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: t.headerBg,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
      }}>
        <div
          onClick={onNavigateLanding}
          style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <BrandLogo variant="horizontal" size={32} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '14px' }}>
          <PublicThemeToggle />
          {step < 3 && (
            <button
              onClick={onNavigateLogin}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                border: '1px solid var(--gold)',
                background: 'var(--gold)', color: '#241800', fontWeight: 600, cursor: 'pointer', fontSize: '13px', borderRadius: '999px', border: 'none'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#e59920'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--gold)'}
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Main Registration Content */}
      <main style={{
        flex: 1,
        width: '100%',
        maxWidth: '100vw',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: '32px 16px 48px',
        overflowX: 'hidden'
      }}>
        <div style={{
          width: 'min(560px, 100%)',
          maxWidth: '100%',
          margin: 'auto 0',
          background: t.cardBg,
          borderRadius: '20px',
          border: `1px solid ${t.cardBorder}`,
          padding: '32px 20px',
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
                background: step >= 1 ? (isDark ? 'var(--leaf)' : 'var(--deep)') : 'var(--line)', color: step >= 1 ? (isDark ? '#0C2B22' : '#ffffff') : 'var(--mut)',
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
              background: step >= 2 ? (isDark ? 'var(--leaf)' : 'var(--deep)') : 'var(--line)',
              transition: 'all 0.2s'
            }} />

            {/* Step 2 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: step >= 2 ? (isDark ? 'var(--leaf)' : 'var(--deep)') : 'var(--line)', color: step >= 2 ? (isDark ? '#0C2B22' : '#ffffff') : 'var(--mut)',
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
              background: step >= 3 ? (isDark ? 'var(--leaf)' : 'var(--deep)') : 'var(--line)',
              transition: 'all 0.2s'
            }} />

            {/* Step 3 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: step >= 3 ? (isDark ? 'var(--leaf)' : 'var(--deep)') : 'var(--line)', color: step >= 3 ? (isDark ? '#0C2B22' : '#ffffff') : 'var(--mut)',
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
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <User size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--mut)', pointerEvents: 'none' }} />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Mudassir Arif"
                      value={formData.full_name}
                      onChange={e => handleChange('full_name', e.target.value)}
                      style={{
                        width: '100%',
                        height: '46px',
                        padding: '0 14px 0 44px',
                        borderRadius: '10px',
                        background: t.inputBg,
                        border: `1px solid ${t.inputBorder}`,
                        color: t.inputText,
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none',
                        transition: 'border-color 0.2s, box-shadow 0.2s'
                      }}
                    />
                  </div>
                </div>

                {/* Email Address * */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: t.labelColor, marginBottom: '6px' }}>
                    Email Address *
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Mail size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--mut)', pointerEvents: 'none' }} />
                    <input
                      type="email"
                      required
                      placeholder="e.g. owner@business.com"
                      value={formData.email}
                      onChange={e => handleChange('email', e.target.value)}
                      style={{
                        width: '100%',
                        height: '46px',
                        padding: '0 14px 0 44px',
                        borderRadius: '10px',
                        background: t.inputBg,
                        border: `1px solid ${t.inputBorder}`,
                        color: t.inputText,
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none',
                        transition: 'border-color 0.2s, box-shadow 0.2s'
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
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--mut)', pointerEvents: 'none' }} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="At least 8 characters"
                      value={formData.password}
                      onChange={e => handleChange('password', e.target.value)}
                      style={{
                        width: '100%',
                        height: '46px',
                        padding: '0 44px 0 44px',
                        borderRadius: '10px',
                        background: t.inputBg,
                        border: `1px solid ${t.inputBorder}`,
                        color: t.inputText,
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none',
                        transition: 'border-color 0.2s, box-shadow 0.2s'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '14px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--mut)',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>

                  {/* Password Strength Bar */}
                  {formData.password && (
                    <div style={{
                      marginTop: '10px',
                      height: '5px',
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
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--mut)', pointerEvents: 'none' }} />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      placeholder="Re-enter your password"
                      value={formData.confirm_password}
                      onChange={e => handleChange('confirm_password', e.target.value)}
                      style={{
                        width: '100%',
                        height: '46px',
                        padding: '0 44px 0 44px',
                        borderRadius: '10px',
                        background: t.inputBg,
                        border: `1px solid ${t.inputBorder}`,
                        color: t.inputText,
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none',
                        transition: 'border-color 0.2s, box-shadow 0.2s'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={{
                        position: 'absolute',
                        right: '14px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--mut)',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Phone Number * */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: t.labelColor, marginBottom: '6px' }}>
                    Phone Number *
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Phone size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--mut)', pointerEvents: 'none' }} />
                    <input
                      type="text"
                      required
                      placeholder="e.g. 0300 1234567"
                      value={formData.phone}
                      onChange={e => handleChange('phone', e.target.value)}
                      style={{
                        width: '100%',
                        height: '46px',
                        padding: '0 14px 0 44px',
                        borderRadius: '10px',
                        background: t.inputBg,
                        border: `1px solid ${t.inputBorder}`,
                        color: t.inputText,
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none',
                        transition: 'border-color 0.2s, box-shadow 0.2s'
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
                    background: 'var(--gold)', color: '#241800', borderRadius: '999px', boxShadow: '0 4px 14px rgba(244, 166, 42, 0.35)',
                    fontSize: '15px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(244, 166, 42, 0.35)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#e59920'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--gold)'}
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
                      color: 'var(--leaf)',
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
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Building size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--mut)', pointerEvents: 'none' }} />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Latif Traders, Al-Madina Superstore"
                      value={formData.business_name}
                      onChange={e => handleChange('business_name', e.target.value)}
                      style={{
                        width: '100%',
                        height: '46px',
                        padding: '0 14px 0 44px',
                        borderRadius: '10px',
                        background: t.inputBg,
                        border: `1px solid ${t.inputBorder}`,
                        color: t.inputText,
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none',
                        transition: 'border-color 0.2s, box-shadow 0.2s'
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
                        height: '46px',
                        padding: '0 14px',
                        borderRadius: '10px',
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
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <MapPin size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--mut)', pointerEvents: 'none' }} />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Lahore, Karachi, Rawalpindi"
                      value={formData.city}
                      onChange={e => handleChange('city', e.target.value)}
                      style={{
                        width: '100%',
                        height: '46px',
                        padding: '0 14px 0 44px',
                        borderRadius: '10px',
                        background: t.inputBg,
                        border: `1px solid ${t.inputBorder}`,
                        color: t.inputText,
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        outline: 'none',
                        transition: 'border-color 0.2s, box-shadow 0.2s'
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
                    background: 'var(--gold)', color: '#241800', borderRadius: '999px', boxShadow: '0 4px 14px rgba(244, 166, 42, 0.35)',
                    fontSize: '15px',
                    fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(244, 166, 42, 0.35)',
                    transition: 'all 0.2s',
                    opacity: loading ? 0.8 : 1
                  }}
                  onMouseEnter={e => !loading && (e.currentTarget.style.background = '#e59920')}
                  onMouseLeave={e => !loading && (e.currentTarget.style.background = 'var(--gold)')}
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
                      style={{ accentColor: 'var(--deep)', width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <Package className="w-4 h-4" style={{ color: 'var(--mut)', position: 'absolute', left: '12px', top: '12px' }} />
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
                      style={{ accentColor: 'var(--deep)', width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <ShoppingCart className="w-4 h-4" style={{ color: 'var(--mut)', position: 'absolute', left: '12px', top: '12px' }} />
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
                      style={{ accentColor: 'var(--deep)', width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <Users className="w-4 h-4" style={{ color: 'var(--mut)', position: 'absolute', left: '12px', top: '12px' }} />
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
                      style={{ accentColor: 'var(--deep)', width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <ReceiptText className="w-4 h-4" style={{ color: 'var(--mut)', position: 'absolute', left: '12px', top: '12px' }} />
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
                  background: 'var(--gold)', color: '#241800', borderRadius: '999px', boxShadow: '0 4px 14px rgba(244, 166, 42, 0.35)',
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
                onMouseEnter={e => e.currentTarget.style.background = '#e59920'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--gold)'}
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
