export function isAudioMuted() {
  return localStorage.getItem('latif_pos_muted') === 'true';
}

export function toggleAudioMute() {
  const next = !isAudioMuted();
  localStorage.setItem('latif_pos_muted', String(next));
  return next;
}

// Web Audio API POS feedback sounds (zero dependencies, works completely offline)
export function playBeep(type = 'add') {
  if (isAudioMuted()) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'add') {
      // Crisp barcode scanner chirp
      osc.type = 'sine';
      osc.frequency.setValueAtTime(950, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
      osc.start();
      osc.stop(ctx.currentTime + 0.07);
    } else if (type === 'success') {
      // Cheerful transaction completed chime
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.07); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.14); // G5
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'error') {
      // Low buzz for insufficient stock
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    }
  } catch (e) {
    // Ignore autoplay restriction or missing sound device
  }
}
