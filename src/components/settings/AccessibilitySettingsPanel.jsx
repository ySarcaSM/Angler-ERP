import React, { useEffect, useState } from 'react';
import { Accessibility, RotateCcw, Volume2 } from 'lucide-react';
import { DEFAULT_ACCESSIBILITY, getAccessibilityPreferences } from '../../utils/accessibility';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/useAuth';
import { saveAccessibilityPreferencesForUser } from '../../utils/accessibility';

export default function AccessibilitySettingsPanel() {
  const { user, userData } = useAuth();
  const userId = user?.uid || userData?.uid;
  const [preferences, setPreferences] = useState(getAccessibilityPreferences(userId));
  const [textScaleDraft, setTextScaleDraft] = useState(preferences.textScale);

  useEffect(() => {
    if (!userId) return;
    const saved = userData?.accessibilityPreferences || getAccessibilityPreferences(userId);
    setPreferences({ ...DEFAULT_ACCESSIBILITY, ...saved });
    setTextScaleDraft(saved.textScale || DEFAULT_ACCESSIBILITY.textScale);
  }, [userId, userData?.accessibilityPreferences]);

  useEffect(() => {
    const handlePreferencesChange = (event) => {
      setPreferences(event.detail);
      setTextScaleDraft(event.detail.textScale);
    };
    window.addEventListener('accessibility-preferences-changed', handlePreferencesChange);
    return () => window.removeEventListener('accessibility-preferences-changed', handlePreferencesChange);
  }, []);

  const updatePreferences = (changes) => {
    const next = { ...preferences, ...changes };
    setPreferences(next);
    saveAccessibilityPreferencesForUser(next, userId).catch((error) => toast.error(`Não foi possível salvar acessibilidade: ${error.message}`));
  };

  const reset = () => {
    setPreferences(DEFAULT_ACCESSIBILITY);
    setTextScaleDraft(DEFAULT_ACCESSIBILITY.textScale);
    saveAccessibilityPreferencesForUser(DEFAULT_ACCESSIBILITY, userId).catch((error) => toast.error(`Não foi possível salvar acessibilidade: ${error.message}`));
    toast.success('Acessibilidade restaurada.');
  };

  const readSelectedText = () => {
    const text = window.getSelection()?.toString().trim() || document.activeElement?.getAttribute('aria-label') || 'Nenhum texto selecionado.';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  };

  return (
    <div className="card" id="accessibility-settings">
      <div className="card-header flex items-center gap-2"><Accessibility size={18} className="text-primary-400" /><h3 className="text-sm font-semibold text-dark-200">Acessibilidade</h3></div>
      <div className="card-body space-y-5">
        <div>
          <label className="label" htmlFor="settings-text-scale">Tamanho do texto: {textScaleDraft}%</label>
          <input id="settings-text-scale" type="range" min="90" max="150" step="10" value={textScaleDraft} onChange={(e) => setTextScaleDraft(Number(e.target.value))} className="w-full max-w-md accent-primary-500" aria-valuemin="90" aria-valuemax="150" aria-valuenow={textScaleDraft} />
          <button type="button" className="btn-primary btn-sm mt-3 block" onClick={() => updatePreferences({ textScale: textScaleDraft })}>Aplicar tamanho do texto</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="label">Espaçamento entre linhas<select className="input mt-1" value={preferences.lineSpacing} onChange={(e) => updatePreferences({ lineSpacing: e.target.value })}><option value="normal">Normal</option><option value="wide">Amplo</option><option value="extra-wide">Muito amplo</option></select></label>
          <label className="label">Espaçamento entre letras<select className="input mt-1" value={preferences.letterSpacing} onChange={(e) => updatePreferences({ letterSpacing: e.target.value })}><option value="normal">Normal</option><option value="wide">Amplo</option></select></label>
        </div>
        <label className="label">Tema<select className="input mt-1 max-w-md" value={preferences.theme} onChange={(e) => updatePreferences({ theme: e.target.value })}><option value="dark">Escuro</option><option value="light">Claro</option></select></label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            ['fontDyslexic', 'Fonte de alta legibilidade'], ['highContrast', 'Alto contraste'], ['grayscale', 'Escala de cinza'], ['invertColors', 'Inverter cores'],
            ['highlightInteractive', 'Destacar links e botões'], ['enhancedFocus', 'Foco do teclado ampliado'], ['readingGuide', 'Guia de leitura'], ['reducedMotion', 'Reduzir animações'],
          ].map(([key, label]) => <label key={key} className="flex items-center gap-3 text-sm text-dark-300 cursor-pointer"><input type="checkbox" checked={preferences[key]} onChange={(e) => updatePreferences({ [key]: e.target.checked })} className="w-4 h-4 accent-primary-500" />{label}</label>)}
        </div>
        <div className="flex flex-wrap gap-3 pt-3 border-t border-dark-800">
          <button type="button" className="btn-secondary" onClick={readSelectedText}><Volume2 size={17} /> Ler texto selecionado</button>
          <button type="button" className="btn-secondary" onClick={reset}><RotateCcw size={17} /> Restaurar padrões</button>
        </div>
      </div>
    </div>
  );
}
