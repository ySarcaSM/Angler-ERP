import { updateDoc_ } from '../services/firebase/firestore.js';

const STORAGE_KEY = 'angler-accessibility-preferences';

function getStorageKey(userId) {
  return userId ? `${STORAGE_KEY}-${userId}` : null;
}

export const DEFAULT_ACCESSIBILITY = {
  textScale: 100,
  lineSpacing: 'normal',
  letterSpacing: 'normal',
  fontDyslexic: false,
  theme: 'dark',
  highContrast: false,
  grayscale: false,
  invertColors: false,
  highlightInteractive: false,
  enhancedFocus: false,
  readingGuide: false,
  reducedMotion: false,
};

export function getAccessibilityPreferences(userId) {
  try {
    const storageKey = getStorageKey(userId);
    if (!storageKey) return { ...DEFAULT_ACCESSIBILITY };
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    return {
      ...DEFAULT_ACCESSIBILITY,
      ...saved,
      textScale: saved.textScale || (saved.textSize === 'large' ? 112 : saved.textSize === 'xlarge' ? 125 : 100),
    };
  } catch {
    return DEFAULT_ACCESSIBILITY;
  }
}

export function applyAccessibilityPreferences(preferences) {
  const root = document.documentElement;
  root.style.setProperty('--accessibility-text-scale', `${preferences.textScale || 100}%`);
  root.dataset.accessibilityTheme = preferences.theme || 'dark';
  root.classList.toggle('accessibility-line-spacing', preferences.lineSpacing !== 'normal');
  root.classList.toggle('accessibility-line-spacing-wide', preferences.lineSpacing === 'wide');
  root.classList.toggle('accessibility-line-spacing-extra-wide', preferences.lineSpacing === 'extra-wide');
  root.classList.toggle('accessibility-letter-spacing', preferences.letterSpacing !== 'normal');
  root.classList.toggle('accessibility-letter-spacing-wide', preferences.letterSpacing === 'wide');
  root.classList.toggle('accessibility-font-dyslexic', preferences.fontDyslexic);
  root.classList.toggle('accessibility-high-contrast', preferences.highContrast);
  root.classList.toggle('accessibility-grayscale', preferences.grayscale);
  root.classList.toggle('accessibility-invert', preferences.invertColors);
  root.classList.toggle('accessibility-highlight-interactive', preferences.highlightInteractive);
  root.classList.toggle('accessibility-enhanced-focus', preferences.enhancedFocus);
  root.classList.toggle('accessibility-reading-guide', preferences.readingGuide);
  root.classList.toggle('accessibility-reduced-motion', preferences.reducedMotion);
}

export function saveAccessibilityPreferences(preferences, userId) {
  const storageKey = getStorageKey(userId);
  if (!storageKey) return;
  localStorage.setItem(storageKey, JSON.stringify(preferences));
  applyAccessibilityPreferences(preferences);
  window.dispatchEvent(new CustomEvent('accessibility-preferences-changed', { detail: preferences }));
}

export async function saveAccessibilityPreferencesForUser(preferences, userId) {
  if (!userId) throw new Error('Usuário não identificado.');
  saveAccessibilityPreferences(preferences, userId);
  await updateDoc_('users', userId, { accessibilityPreferences: preferences });
}

export function storeAccessibilityPreferences(preferences, userId) {
  const storageKey = getStorageKey(userId);
  if (!storageKey) return;
  localStorage.setItem(storageKey, JSON.stringify(preferences));
  applyAccessibilityPreferences(preferences);
}

export function promptAccessibilityPreferences(preferences) {
  if (sessionStorage.getItem('angler-accessibility-confirmed')) return false;

  const hasChanges = Object.keys(DEFAULT_ACCESSIBILITY).some(
    (key) => preferences[key] !== DEFAULT_ACCESSIBILITY[key],
  );
  if (!hasChanges) {
    sessionStorage.setItem('angler-accessibility-confirmed', 'true');
    return false;
  }

  const shouldApply = window.confirm('Encontramos preferências de acessibilidade salvas. Deseja aplicá-las agora?');
  sessionStorage.setItem('angler-accessibility-confirmed', 'true');
  return shouldApply;
}

export function promptSavedAccessibilityPreferences(userId) {
  const storageKey = getStorageKey(userId);
  if (!storageKey || !localStorage.getItem(storageKey)) return false;
  return promptAccessibilityPreferences(getAccessibilityPreferences(userId));
}
