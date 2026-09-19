import React, { useEffect, useState } from 'react';
import { Accessibility, RotateCcw, Volume2, X } from 'lucide-react';
import {
  DEFAULT_ACCESSIBILITY,
  getAccessibilityPreferences,
} from '../../utils/accessibility';
import { saveAccessibilityPreferencesForUser } from '../../utils/accessibility';
import { useAuth } from '../../context/useAuth';

export default function AccessibilityFloatingButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [preferences, setPreferences] = useState(getAccessibilityPreferences());
  const [textScaleDraft, setTextScaleDraft] = useState(preferences.textScale);

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
    saveAccessibilityPreferencesForUser(next, user?.uid).catch(() => {});
  };

  const openPanel = () => {
    const current = getAccessibilityPreferences();
    setPreferences(current);
    setTextScaleDraft(current.textScale);
    setOpen(true);
  };

  const reset = () => {
    setPreferences(DEFAULT_ACCESSIBILITY);
    setTextScaleDraft(DEFAULT_ACCESSIBILITY.textScale);
    saveAccessibilityPreferencesForUser(DEFAULT_ACCESSIBILITY, user?.uid).catch(() => {});
  };

  const readSelectedText = () => {
    const text = window.getSelection()?.toString().trim() || document.activeElement?.getAttribute('aria-label') || 'Nenhum texto selecionado.';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  };

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        className="fixed right-3 top-[30%] z-[60] w-9 h-9 rounded-full bg-primary-400 text-dark-950 shadow-lg flex items-center justify-center hover:bg-primary-300 focus:outline-none focus:ring-4 focus:ring-primary-400/50"
        aria-label="Abrir opções de acessibilidade"
        aria-expanded={open}
        title="Acessibilidade"
      >
        <Accessibility size={22} />
      </button>

      {open && (
        <div className="fixed right-3 top-[30%] translate-y-12 z-[61] w-72 max-w-[calc(100vw-1.5rem)] bg-dark-900 border border-dark-700 rounded-xl shadow-2xl p-3" role="dialog" aria-label="Opções de acessibilidade">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-dark-100">Acessibilidade</h2>
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm" aria-label="Fechar opções de acessibilidade"><X size={18} /></button>
          </div>
          <div className="space-y-3 max-h-[55vh] overflow-y-scroll overscroll-contain pr-1">
            <div>
              <label className="label text-xs" htmlFor="floating-text-scale">Tamanho do texto: {textScaleDraft}%</label>
              <input id="floating-text-scale" type="range" min="90" max="150" step="10" value={textScaleDraft} onChange={(e) => setTextScaleDraft(Number(e.target.value))} className="w-full accent-primary-500" aria-valuemin="90" aria-valuemax="150" aria-valuenow={textScaleDraft} />
            </div>
            <button type="button" className="btn-primary btn-sm w-full" onClick={() => updatePreferences({ textScale: textScaleDraft })}>Aplicar tamanho do texto</button>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-dark-300">Linhas
                <select className="input mt-1 text-xs" value={preferences.lineSpacing} onChange={(e) => updatePreferences({ lineSpacing: e.target.value })}><option value="normal">Normal</option><option value="wide">Amplo</option><option value="extra-wide">Muito amplo</option></select>
              </label>
              <label className="text-xs text-dark-300">Letras
                <select className="input mt-1 text-xs" value={preferences.letterSpacing} onChange={(e) => updatePreferences({ letterSpacing: e.target.value })}><option value="normal">Normal</option><option value="wide">Amplo</option></select>
              </label>
            </div>
            <label className="text-xs text-dark-300">Tema
              <select className="input mt-1 text-xs" value={preferences.theme} onChange={(e) => updatePreferences({ theme: e.target.value })}><option value="dark">Escuro</option><option value="light">Claro</option></select>
            </label>
            <label className="flex items-center gap-3 text-sm text-dark-300 cursor-pointer"><input type="checkbox" checked={preferences.fontDyslexic} onChange={(e) => updatePreferences({ fontDyslexic: e.target.checked })} className="accent-primary-500" /> Fonte de alta legibilidade</label>
            <label className="flex items-center gap-3 text-sm text-dark-300 cursor-pointer"><input type="checkbox" checked={preferences.highContrast} onChange={(e) => updatePreferences({ highContrast: e.target.checked })} className="accent-primary-500" /> Alto contraste</label>
            <label className="flex items-center gap-3 text-sm text-dark-300 cursor-pointer"><input type="checkbox" checked={preferences.grayscale} onChange={(e) => updatePreferences({ grayscale: e.target.checked })} className="accent-primary-500" /> Escala de cinza</label>
            <label className="flex items-center gap-3 text-sm text-dark-300 cursor-pointer"><input type="checkbox" checked={preferences.invertColors} onChange={(e) => updatePreferences({ invertColors: e.target.checked })} className="accent-primary-500" /> Inverter cores</label>
            <label className="flex items-center gap-3 text-sm text-dark-300 cursor-pointer"><input type="checkbox" checked={preferences.highlightInteractive} onChange={(e) => updatePreferences({ highlightInteractive: e.target.checked })} className="accent-primary-500" /> Destacar links e botões</label>
            <label className="flex items-center gap-3 text-sm text-dark-300 cursor-pointer"><input type="checkbox" checked={preferences.reducedMotion} onChange={(e) => updatePreferences({ reducedMotion: e.target.checked })} className="accent-primary-500" /> Reduzir animações</label>
            <label className="flex items-center gap-3 text-sm text-dark-300 cursor-pointer"><input type="checkbox" checked={preferences.enhancedFocus} onChange={(e) => updatePreferences({ enhancedFocus: e.target.checked })} className="accent-primary-500" /> Foco ampliado</label>
            <label className="flex items-center gap-3 text-sm text-dark-300 cursor-pointer"><input type="checkbox" checked={preferences.readingGuide} onChange={(e) => updatePreferences({ readingGuide: e.target.checked })} className="accent-primary-500" /> Guia de leitura</label>
            <div className="flex gap-2 pt-3 border-t border-dark-800">
              <button type="button" className="btn-secondary btn-sm" onClick={readSelectedText}><Volume2 size={15} /> Ler seleção</button>
              <button type="button" className="btn-secondary btn-sm" onClick={reset}><RotateCcw size={15} /> Restaurar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
