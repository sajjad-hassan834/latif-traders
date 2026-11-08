/**
 * Voice-to-Bill Speech Recognition and Parsing Engine
 * Supports Urdu (Roman Urdu / Phonetic) and English voice inputs.
 */

const URDU_NUMBER_MAP = {
  ek: 1,
  aik: 1,
  one: 1,
  do: 2,
  two: 2,
  teen: 3,
  three: 3,
  char: 4,
  chaar: 4,
  four: 4,
  panch: 5,
  paanch: 5,
  five: 5,
  chey: 6,
  chheh: 6,
  six: 6,
  saat: 7,
  seven: 7,
  aath: 8,
  eight: 8,
  nau: 9,
  nine: 9,
  das: 10,
  ten: 10,
  barah: 12,
  dozen: 12,
  darjan: 12
};

export function isSpeechRecognitionSupported() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function createSpeechRecognizer({ onResult, onError, onEnd }) {
  if (!isSpeechRecognitionSupported()) return null;

  const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognitionClass();

  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US'; // Works universally for English and Romanized speech

  recognition.onresult = (event) => {
    const transcript = event.results[0]?.[0]?.transcript || '';
    onResult?.(transcript);
  };

  recognition.onerror = (err) => {
    onError?.(err);
  };

  recognition.onend = () => {
    onEnd?.();
  };

  return recognition;
}

/**
 * Parses a spoken transcript against available store products.
 * Example transcript: "Do dabba Panadol aur teen Dawn bread"
 */
export function parseVoiceOrder(transcript, products = []) {
  if (!transcript || !products.length) return [];

  const clean = transcript.toLowerCase().trim();
  // Split on connectors like "aur", "and", comma
  const segments = clean.split(/\s+(?:aur|and|,)\s+/i);
  const matchedItems = [];

  for (const segment of segments) {
    const tokens = segment.trim().split(/\s+/);
    if (!tokens.length) continue;

    let qty = 1;
    let productTokens = [...tokens];

    // Check first token for quantity (digit or Urdu word)
    const first = tokens[0];
    if (/^\d+$/.test(first)) {
      qty = parseInt(first, 10);
      productTokens.shift();
    } else if (URDU_NUMBER_MAP[first]) {
      qty = URDU_NUMBER_MAP[first];
      productTokens.shift();
    }

    // Ignore filler words like "packet", "dabba", "piece", "kg"
    const filteredTokens = productTokens.filter(
      (t) => !['dabba', 'packet', 'pkt', 'piece', 'box', 'strip', 'tablet', 'carton'].includes(t)
    );

    const searchTerm = filteredTokens.join(' ').trim();
    if (!searchTerm) continue;

    // Fuzzy match against product catalogue
    let bestProduct = null;
    let highestScore = 0;

    for (const prod of products) {
      const name = (prod.name || prod.product_name || '').toLowerCase();
      const sku = (prod.sku || '').toLowerCase();
      const formula = (prod.salt_formula || '').toLowerCase();

      let score = 0;
      if (name === searchTerm) score = 100;
      else if (name.startsWith(searchTerm)) score = 80;
      else if (name.includes(searchTerm)) score = 60;
      else if (formula && formula.includes(searchTerm)) score = 50;
      else {
        // Token match
        for (const tok of filteredTokens) {
          if (name.includes(tok)) score += 20;
        }
      }

      if (score > highestScore && score >= 20) {
        highestScore = score;
        bestProduct = prod;
      }
    }

    if (bestProduct) {
      matchedItems.push({
        product: bestProduct,
        quantity: Math.max(1, qty),
        matchedTerm: searchTerm,
        score: highestScore
      });
    }
  }

  return matchedItems;
}

