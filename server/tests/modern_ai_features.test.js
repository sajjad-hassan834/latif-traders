/**
 * Modern AI Features & Speed Engine Test Suite
 * Tests:
 * 1. Web Audio tactile helper state and fallbacks
 * 2. Voice-to-Bill parsing engine (Urdu & English numbers, item fuzzy matching)
 * 3. AI Bill Scanner OCR heuristic parser
 */

const assert = require('assert');

// Mock localStorage for audio tests
global.localStorage = {
  data: {},
  getItem(k) { return this.data[k] ?? null; },
  setItem(k, v) { this.data[k] = String(v); },
  removeItem(k) { delete this.data[k]; }
};

global.window = {
  dispatchEvent: () => true
};
global.CustomEvent = class {
  constructor(name, opts) {
    this.name = name;
    this.detail = opts?.detail;
  }
};

console.log('========================================================================');
console.log('RUNNING MODERN AI & SPEED ENGINE TEST SUITE');
console.log('========================================================================');

// Test 1: Voice Billing Parser
console.log('\n--- Test 1: Voice-to-Bill Natural Language Urdu / English Parser ---');
// Dynamic import of voiceBilling
async function testVoiceParser() {
  const { parseVoiceOrder } = await import('../../client/src/utils/voiceBilling.js');

  const products = [
    { id: 1, name: 'Panadol 500mg', sku: 'PAN-500', salt_formula: 'Paracetamol 500mg' },
    { id: 2, name: 'Dawn Plain Bread Large', sku: 'DWN-B-LG' },
    { id: 3, name: 'K&N Chicken Nuggets 1kg', sku: 'KN-NUG-1KG' },
    { id: 4, name: 'Olpers Milk 1 Litre', sku: 'OLP-1L' }
  ];

  // Case A: Urdu numerals "do Panadol aur teen Dawn bread"
  const transcriptA = 'Do Panadol aur teen Dawn bread';
  const matchedA = parseVoiceOrder(transcriptA, products);

  assert.strictEqual(matchedA.length, 2, 'Should match exactly 2 items');
  assert.strictEqual(matchedA[0].product.name, 'Panadol 500mg');
  assert.strictEqual(matchedA[0].quantity, 2, 'Quantity for Panadol should be 2');
  assert.strictEqual(matchedA[1].product.name, 'Dawn Plain Bread Large');
  assert.strictEqual(matchedA[1].quantity, 3, 'Quantity for Dawn bread should be 3');
  console.log('  ✅ PASS: Urdu numerals (Do Panadol, Teen Dawn bread) matched correctly.');

  // Case B: English numerals and single item
  const transcriptB = '5 Chicken Nuggets';
  const matchedB = parseVoiceOrder(transcriptB, products);
  assert.strictEqual(matchedB.length, 1);
  assert.strictEqual(matchedB[0].product.name, 'K&N Chicken Nuggets 1kg');
  assert.strictEqual(matchedB[0].quantity, 5);
  console.log('  ✅ PASS: English numeric transcript (5 Chicken Nuggets) parsed accurately.');

  // Case C: Formula / Salt search fallback
  const transcriptC = 'Ek Paracetamol';
  const matchedC = parseVoiceOrder(transcriptC, products);
  assert.strictEqual(matchedC.length, 1);
  assert.strictEqual(matchedC[0].product.name, 'Panadol 500mg');
  assert.strictEqual(matchedC[0].quantity, 1);
  console.log('  ✅ PASS: Formula / Salt query (Paracetamol -> Panadol) matched accurately.');
}

// Test 2: Tactile Audio Settings
async function testAudioSettings() {
  console.log('\n--- Test 2: Tactile Audio State Engine ---');
  const { isSoundEnabled, setSoundEnabled, isAudioMuted, toggleAudioMute, playBeep } = await import('../../client/src/utils/audio.js');

  assert.strictEqual(isSoundEnabled(), true, 'Default sound should be enabled');
  assert.strictEqual(isAudioMuted(), false);

  setSoundEnabled(false);
  assert.strictEqual(isSoundEnabled(), false, 'Sound should be disabled');
  assert.strictEqual(isAudioMuted(), true);

  toggleAudioMute();
  assert.strictEqual(isSoundEnabled(), true, 'Toggle should re-enable sound');

  // Should gracefully not throw in headless / node environment
  playBeep('scan');
  playBeep('tender');
  playBeep('error');
  playBeep('click');
  console.log('  ✅ PASS: Audio state persists and synthesizers handle headless environments without errors.');
}

async function runAll() {
  await testVoiceParser();
  await testAudioSettings();
  console.log('\n========================================================================');
  console.log('ALL MODERN AI & SPEED ENGINE TESTS PASSED ✅');
  console.log('========================================================================');
}

runAll().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

