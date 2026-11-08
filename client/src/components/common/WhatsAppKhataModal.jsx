import React, { useState, useEffect } from 'react';
import { MessageSquare, Copy, Send, X, Check, Sparkles } from 'lucide-react';
import { playBeep } from '../../utils/audio';

export default function WhatsAppKhataModal({ isOpen, onClose, customer, tenantName }) {
  const [tone, setTone] = useState('polite');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const shopName = tenantName || 'Our Store';
  const customerName = customer?.name || 'Customer';
  const balance = Math.abs(Number(customer?.current_balance || customer?.balance || 0));
  const phone = customer?.phone ? customer.phone.replace(/[^0-9]/g, '') : '';

  // Generate templates based on tone
  useEffect(() => {
    if (!isOpen) return;
    const formattedBalance = `Rs ${balance.toLocaleString()}`;

    if (tone === 'polite') {
      setMessage(
        `Assalam-o-Alaikum ${customerName} bhai, umeed hai aap kheriyat se honge.\n\n${shopName} ki janib se aap ki taraf ledger balance ${formattedBalance} hai.\n\nFursat milne par tashreef layein ya online transfer kar dein. JazakAllah khair!`
      );
    } else if (tone === 'business') {
      setMessage(
        `Dear ${customerName},\n\nThis is an automated balance notification from ${shopName}.\n\nYour current outstanding balance as of today is ${formattedBalance}.\n\nKindly arrange settlement or visit our counter for balance reconciliation. Thank you for your business!`
      );
    } else if (tone === 'urgent') {
      setMessage(
        `Mohtaram ${customerName} Sahab,\n\n${shopName} ke records ke mutabiq aap ka ${formattedBalance} ka udhaar balance overdue ho chuka hai.\n\nBaraye meherbani foran rabta farmayein ya counter par aakar ledger clear karwayein taake service mutasir na ho. Shukriya.`
      );
    }
  }, [isOpen, tone, customerName, shopName, balance]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    playBeep('click');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWhatsApp = () => {
    playBeep('click');
    const cleanPhone = phone.startsWith('0') ? '92' + phone.substring(1) : phone;
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99998,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'var(--card-bg, #ffffff)',
          color: 'var(--text, #0f172a)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: '#22c55e20',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <MessageSquare size={20} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800 }}>AI WhatsApp Khata Reminder</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
                {customerName} • Balance: <strong>Rs {balance.toLocaleString()}</strong>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: '4px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tone Selector */}
        <div style={{ padding: '16px 20px 0 20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Sparkles size={14} style={{ color: '#0284c7' }} /> SELECT AI REMINDER TONE
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { id: 'polite', label: 'Polite / Friendly' },
              { id: 'business', label: 'Formal Business' },
              { id: 'urgent', label: 'Urgent / Due Notice' }
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTone(t.id);
                  playBeep('click');
                }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: tone === t.id ? 'var(--primary, #0284c7)' : 'var(--border, #e2e8f0)',
                  background: tone === t.id ? 'var(--primary, #0284c7)' : 'transparent',
                  color: tone === t.id ? '#ffffff' : 'inherit',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Message Editor */}
        <div style={{ padding: '16px 20px' }}>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={7}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '10px',
              border: '1px solid var(--border, #cbd5e1)',
              background: 'var(--bg-subtle, #f8fafc)',
              color: 'inherit',
              fontSize: '13px',
              lineHeight: 1.5,
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'inherit'
            }}
          />
        </div>

        {/* Actions Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-subtle, #f8fafc)'
          }}
        >
          <button
            type="button"
            onClick={handleCopy}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border, #cbd5e1)',
              background: 'var(--card-bg, #ffffff)',
              color: 'inherit',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {copied ? <Check size={15} style={{ color: '#16a34a' }} /> : <Copy size={15} />}
            {copied ? 'Copied!' : 'Copy Text'}
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted, #64748b)',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSendWhatsApp}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: '#16a34a',
                color: '#ffffff',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)'
              }}
            >
              <Send size={15} />
              Open WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

