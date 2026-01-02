/**
 * ItemEditorModal - Modal pour créer/éditer un item du backlog
 *
 * Design épuré et futuriste avec intégration Gemini
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  BacklogItem,
  ItemType,
  Severity,
  Priority,
  Effort,
  Criterion,
  Screenshot,
} from '../../types/backlog';
import { TYPE_LABELS, SEVERITY_LABELS, PRIORITY_LABELS, EFFORT_LABELS } from '../../types/backlog';
import { refineItem, hasApiKey, generateItemFromDescription } from '../../lib/ai';
import { ScreenshotEditor } from './ScreenshotEditor';
import { extractImageFromClipboard } from '../../lib/screenshots';

// ============================================================
// TYPES
// ============================================================

export interface ItemFormData {
  id: string;
  type: ItemType;
  title: string;
  emoji?: string;
  component?: string;
  module?: string;
  severity?: Severity;
  priority?: Priority;
  effort?: Effort;
  description?: string;
  userStory?: string;
  specs: string[];
  reproduction: string[];
  criteria: Criterion[];
  dependencies: string[];
  constraints: string[];
  screenshots: Screenshot[];
}

// Screenshot operations interface
export interface ScreenshotOperations {
  isReady: boolean;
  needsPermission: boolean;
  isProcessing: boolean;
  onRequestAccess: () => Promise<boolean>;
  saveBlob: (ticketId: string, blob: Blob) => Promise<string | null>;
  importFile: (ticketId: string, file: File) => Promise<string | null>;
  getUrl: (filename: string) => Promise<string | null>;
  deleteFile: (filename: string) => Promise<boolean>;
}

interface ItemEditorModalProps {
  isOpen: boolean;
  item?: BacklogItem | null;
  onClose: () => void;
  onSave: (data: ItemFormData, isNew: boolean) => void;
  existingIds: string[];
  screenshotOps?: ScreenshotOperations;
}

// ============================================================
// DEFAULT VALUES
// ============================================================

const createEmptyForm = (type: ItemType = 'EXT'): ItemFormData => ({
  id: '',
  type,
  title: '',
  specs: [],
  reproduction: [],
  criteria: [],
  dependencies: [],
  constraints: [],
  screenshots: [],
});

const itemToFormData = (item: BacklogItem): ItemFormData => ({
  id: item.id,
  type: item.type,
  title: item.title,
  emoji: item.emoji,
  component: item.component,
  module: item.module,
  severity: item.severity,
  priority: item.priority,
  effort: item.effort,
  description: item.description,
  userStory: item.userStory,
  specs: item.specs || [],
  reproduction: item.reproduction || [],
  criteria: item.criteria || [],
  dependencies: item.dependencies || [],
  constraints: item.constraints || [],
  screenshots: item.screenshots || [],
});

// ============================================================
// COMPONENT
// ============================================================

export function ItemEditorModal({
  isOpen,
  item,
  onClose,
  onSave,
  existingIds,
  screenshotOps,
}: ItemEditorModalProps) {
  const isNew = !item;
  const [form, setForm] = useState<ItemFormData>(createEmptyForm());
  const [activeTab, setActiveTab] = useState<'general' | 'details' | 'criteria' | 'screenshots'>('general');
  const [isRefining, setIsRefining] = useState(false);
  const [geminiSuggestions, setGeminiSuggestions] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // AI Creation Mode
  const [aiMode, setAiMode] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (item) {
        setForm(itemToFormData(item));
        setAiMode(false);
      } else {
        setForm(createEmptyForm());
        setAiMode(true); // Start in AI mode for new items
      }
      setActiveTab('general');
      setErrors({});
      setGeminiSuggestions([]);
      setAiPrompt('');
      setIsGenerating(false);
    }
  }, [isOpen, item]);

  // Generate next ID
  const generateNextId = useCallback((type: ItemType): string => {
    const prefix = type;
    const existingNumbers = existingIds
      .filter(id => id.startsWith(prefix + '-'))
      .map(id => parseInt(id.split('-')[1], 10))
      .filter(n => !isNaN(n));

    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    return `${prefix}-${String(maxNumber + 1).padStart(3, '0')}`;
  }, [existingIds]);

  // Auto-generate ID for new items
  useEffect(() => {
    if (isNew && isOpen && !form.id) {
      setForm(f => ({ ...f, id: generateNextId(f.type) }));
    }
  }, [isNew, isOpen, form.type, generateNextId, form.id]);

  // Global paste handler for screenshots (works in any tab, including AI mode)
  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalPaste = async (e: ClipboardEvent) => {
      const file = extractImageFromClipboard(e.clipboardData);
      if (!file) return; // Not an image, let normal paste happen (for text in AI mode)

      // Check if we have screenshot operations available
      if (!screenshotOps) return;

      e.preventDefault();

      // Request access if needed
      if (!screenshotOps.isReady && screenshotOps.needsPermission) {
        const granted = await screenshotOps.onRequestAccess();
        if (!granted) return;
      }

      if (!screenshotOps.isReady) return;

      // Switch to screenshots tab only if not in AI mode
      // In AI mode, screenshots are shown inline
      if (!aiMode) {
        setActiveTab('screenshots');
      }

      // Save the screenshot
      const ticketId = form.id || 'NEW';
      const filename = await screenshotOps.saveBlob(ticketId, file);
      if (filename) {
        setForm(f => ({
          ...f,
          screenshots: [...f.screenshots, {
            filename,
            addedAt: Date.now(),
          }],
        }));
      }
    };

    document.addEventListener('paste', handleGlobalPaste);
    return () => document.removeEventListener('paste', handleGlobalPaste);
  }, [isOpen, aiMode, screenshotOps, form.id]);

  // Update ID when type changes (for new items)
  const handleTypeChange = (type: ItemType) => {
    setForm(f => ({
      ...f,
      type,
      id: isNew ? generateNextId(type) : f.id,
      // Reset type-specific fields
      severity: type === 'BUG' ? f.severity : undefined,
      component: type === 'BUG' ? f.component : undefined,
      module: ['EXT', 'ADM'].includes(type) ? f.module : undefined,
    }));
  };

  // Validation
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.id.trim()) {
      newErrors.id = 'ID requis';
    } else if (isNew && existingIds.includes(form.id)) {
      newErrors.id = 'ID déjà existant';
    }

    if (!form.title.trim()) {
      newErrors.title = 'Titre requis';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Save handler
  const handleSave = () => {
    if (validate()) {
      onSave(form, isNew);
      onClose();
    }
  };

  // Gemini refinement
  const handleRefineWithGemini = async () => {
    if (!hasApiKey()) {
      alert('Configurez votre clé API Gemini dans les paramètres');
      return;
    }

    setIsRefining(true);

    // Create a temporary BacklogItem for the API
    const tempItem: BacklogItem = {
      ...form,
      rawMarkdown: '',
      sectionIndex: 0,
    };

    const result = await refineItem(tempItem);
    setIsRefining(false);

    if (result.success && result.refinedItem) {
      // Show suggestions
      setGeminiSuggestions(result.suggestions || []);

      // Apply refinements with confirmation
      setForm(f => ({
        ...f,
        title: result.refinedItem?.title || f.title,
        userStory: result.refinedItem?.userStory || f.userStory,
        specs: result.refinedItem?.specs || f.specs,
        criteria: result.refinedItem?.criteria || f.criteria,
      }));
    } else {
      alert(`Erreur Gemini: ${result.error}`);
    }
  };

  // Generate item from AI description
  const handleGenerateFromAI = async () => {
    if (!hasApiKey()) {
      alert('Configurez votre clé API Gemini dans les paramètres');
      return;
    }

    if (!aiPrompt.trim()) {
      alert('Décrivez ce que vous voulez créer');
      return;
    }

    setIsGenerating(true);

    const result = await generateItemFromDescription(aiPrompt);
    setIsGenerating(false);

    if (result.success && result.item) {
      const suggestedType = result.item.suggestedType;
      const newId = generateNextId(suggestedType);

      setForm({
        id: newId,
        type: suggestedType,
        title: result.item.title,
        emoji: result.item.emoji,
        description: result.item.description,
        userStory: result.item.userStory,
        specs: result.item.specs,
        criteria: result.item.criteria,
        priority: suggestedType !== 'BUG' ? result.item.suggestedPriority : undefined,
        severity: suggestedType === 'BUG' ? result.item.suggestedSeverity : undefined,
        effort: result.item.suggestedEffort,
        module: result.item.suggestedModule,
        component: suggestedType === 'BUG' ? result.item.suggestedModule : undefined,
        reproduction: [],
        dependencies: [],
        constraints: [],
        screenshots: form.screenshots, // Preserve screenshots from AI mode
      });

      // Exit AI mode to show the form for review
      setAiMode(false);
      setActiveTab('general');
    } else {
      alert(`Erreur Gemini: ${result.error}`);
    }
  };

  // List field handlers
  const addListItem = (field: 'specs' | 'reproduction' | 'dependencies' | 'constraints') => {
    setForm(f => ({ ...f, [field]: [...f[field], ''] }));
  };

  const updateListItem = (field: 'specs' | 'reproduction' | 'dependencies' | 'constraints', index: number, value: string) => {
    setForm(f => ({
      ...f,
      [field]: f[field].map((item, i) => i === index ? value : item),
    }));
  };

  const removeListItem = (field: 'specs' | 'reproduction' | 'dependencies' | 'constraints', index: number) => {
    setForm(f => ({
      ...f,
      [field]: f[field].filter((_, i) => i !== index),
    }));
  };

  // Criteria handlers
  const addCriterion = () => {
    setForm(f => ({
      ...f,
      criteria: [...f.criteria, { text: '', checked: false }],
    }));
  };

  const updateCriterion = (index: number, text: string) => {
    setForm(f => ({
      ...f,
      criteria: f.criteria.map((c, i) => i === index ? { ...c, text } : c),
    }));
  };

  const removeCriterion = (index: number) => {
    setForm(f => ({
      ...f,
      criteria: f.criteria.filter((_, i) => i !== index),
    }));
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-4 md:inset-10 bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                aiMode
                  ? 'bg-gradient-to-br from-purple-500 to-pink-600'
                  : 'bg-gradient-to-br from-blue-500 to-purple-600'
              }`}>
                {aiMode ? (
                  <SparklesIcon className="text-white" />
                ) : (
                  <span className="text-white font-bold text-sm">{form.type}</span>
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {aiMode ? 'Créer avec l\'IA' : isNew ? 'Nouvel item' : `Éditer ${form.id}`}
                </h2>
                <p className="text-sm text-gray-500">
                  {aiMode
                    ? 'Décrivez votre besoin, Gemini génère le ticket'
                    : isNew
                      ? 'Vérifiez et ajustez les détails générés'
                      : 'Modifier les détails de l\'item'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Toggle AI/Manual Mode for new items */}
              {isNew && !aiMode && (
                <button
                  onClick={() => setAiMode(true)}
                  className="px-4 py-2 border border-purple-300 text-purple-600 text-sm font-medium rounded-lg hover:bg-purple-50 flex items-center gap-2 transition-all"
                >
                  <SparklesIcon />
                  Mode IA
                </button>
              )}
              {/* Gemini Refine Button (only in form mode) */}
              {!aiMode && (
                <button
                  onClick={handleRefineWithGemini}
                  disabled={isRefining || !form.title}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
                >
                  {isRefining ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Analyse...
                    </>
                  ) : (
                    <>
                      <SparklesIcon />
                      Affiner
                    </>
                  )}
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          {/* Tabs (only in form mode) */}
          {!aiMode && (
            <div className="flex gap-1 mt-4">
              {(['general', 'details', 'criteria', 'screenshots'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    activeTab === tab
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {tab === 'general' && 'Général'}
                  {tab === 'details' && 'Détails'}
                  {tab === 'criteria' && 'Critères'}
                  {tab === 'screenshots' && (
                    <span className="flex items-center gap-1.5">
                      <CameraIcon />
                      Captures
                      {form.screenshots.length > 0 && (
                        <span className="bg-blue-200 text-blue-800 text-xs px-1.5 rounded-full">
                          {form.screenshots.length}
                        </span>
                      )}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Gemini Suggestions Banner */}
        {geminiSuggestions.length > 0 && (
          <div className="px-6 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-purple-100">
            <div className="flex items-start gap-3">
              <SparklesIcon className="text-purple-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-purple-900">Suggestions Gemini</p>
                <ul className="mt-1 space-y-1">
                  {geminiSuggestions.map((s, i) => (
                    <li key={i} className="text-sm text-purple-700">• {s}</li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => setGeminiSuggestions([])}
                className="ml-auto text-purple-400 hover:text-purple-600"
              >
                <CloseIcon />
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* AI Mode */}
          {aiMode && (
            <div className="max-w-2xl mx-auto py-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                  <SparklesIcon className="text-white w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Décrivez votre idée
                </h3>
                <p className="text-sm text-gray-500">
                  Gemini va analyser votre description et générer un ticket complet avec titre, user story, specs et critères d'acceptation.
                </p>
              </div>

              <div className="space-y-4">
                <textarea
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  placeholder="Ex: Je voudrais ajouter un bouton pour exporter les données en PDF. L'utilisateur doit pouvoir choisir les colonnes à inclure et le format (portrait/paysage)..."
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none text-gray-900 placeholder:text-gray-400"
                  autoFocus
                />

                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setAiMode(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium"
                  >
                    Créer manuellement
                  </button>

                  <button
                    onClick={handleGenerateFromAI}
                    disabled={isGenerating || !aiPrompt.trim()}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium rounded-xl hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-lg shadow-purple-500/25"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Génération en cours...
                      </>
                    ) : (
                      <>
                        <SparklesIcon />
                        Générer le ticket
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Screenshots in AI mode */}
              {form.screenshots.length > 0 && (
                <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <CameraIcon />
                      Captures jointes
                      <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded">
                        {form.screenshots.length}
                      </span>
                    </p>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {form.screenshots.map((screenshot) => (
                      <AiModeScreenshotThumb
                        key={screenshot.filename}
                        screenshot={screenshot}
                        getUrl={screenshotOps?.getUrl}
                        onRemove={() => {
                          screenshotOps?.deleteFile(screenshot.filename);
                          setForm(f => ({
                            ...f,
                            screenshots: f.screenshots.filter(s => s.filename !== screenshot.filename),
                          }));
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Paste hint */}
              <p className="mt-4 text-xs text-center text-gray-400">
                Astuce: Collez une capture d'écran (CTRL+V) pour l'ajouter
              </p>

              {/* Examples */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Exemples</p>
                <div className="grid gap-2">
                  {[
                    'Bug: Le bouton de sauvegarde ne fonctionne pas sur Safari',
                    'Feature: Ajouter un mode sombre à l\'interface',
                    'API: Intégrer l\'endpoint de synchronisation Cosium',
                  ].map((example, i) => (
                    <button
                      key={i}
                      onClick={() => setAiPrompt(example)}
                      className="text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* General Tab */}
          {!aiMode && activeTab === 'general' && (
            <div className="space-y-6 max-w-3xl">
              {/* Type & ID */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                  <select
                    value={form.type}
                    onChange={e => handleTypeChange(e.target.value as ItemType)}
                    disabled={!isNew}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    {(['BUG', 'EXT', 'ADM', 'COS', 'LT'] as ItemType[]).map(type => (
                      <option key={type} value={type}>{TYPE_LABELS[type]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">ID</label>
                  <input
                    type="text"
                    value={form.id}
                    onChange={e => setForm(f => ({ ...f, id: e.target.value.toUpperCase() }))}
                    disabled={!isNew}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono disabled:bg-gray-100 disabled:cursor-not-allowed ${
                      errors.id ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.id && <p className="mt-1 text-sm text-red-600">{errors.id}</p>}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Titre <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.emoji || ''}
                    onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))}
                    placeholder="🔥"
                    className="w-16 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-xl"
                  />
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Titre de l'item..."
                    className={`flex-1 px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.title ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                </div>
                {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
              </div>

              {/* Priority/Severity/Effort */}
              <div className="grid grid-cols-3 gap-4">
                {form.type === 'BUG' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Sévérité</label>
                    <select
                      value={form.severity || ''}
                      onChange={e => setForm(f => ({ ...f, severity: e.target.value as Severity || undefined }))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Non définie</option>
                      {(['P0', 'P1', 'P2', 'P3', 'P4'] as Severity[]).map(s => (
                        <option key={s} value={s}>{s} - {SEVERITY_LABELS[s]}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Priorité</label>
                    <select
                      value={form.priority || ''}
                      onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority || undefined }))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Non définie</option>
                      {(['Haute', 'Moyenne', 'Faible'] as Priority[]).map(p => (
                        <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Effort</label>
                  <select
                    value={form.effort || ''}
                    onChange={e => setForm(f => ({ ...f, effort: e.target.value as Effort || undefined }))}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Non défini</option>
                    {(['XS', 'S', 'M', 'L', 'XL'] as Effort[]).map(e => (
                      <option key={e} value={e}>{e} - {EFFORT_LABELS[e]}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {form.type === 'BUG' ? 'Composant' : 'Module'}
                  </label>
                  <input
                    type="text"
                    value={form.type === 'BUG' ? (form.component || '') : (form.module || '')}
                    onChange={e => setForm(f => ({
                      ...f,
                      [form.type === 'BUG' ? 'component' : 'module']: e.target.value || undefined,
                    }))}
                    placeholder={form.type === 'BUG' ? 'Extension Chrome...' : 'Appareillage...'}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={form.description || ''}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value || undefined }))}
                  rows={3}
                  placeholder="Description détaillée..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>

              {/* User Story */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  User Story
                  <span className="ml-2 text-xs text-gray-400">En tant que... je veux... afin de...</span>
                </label>
                <textarea
                  value={form.userStory || ''}
                  onChange={e => setForm(f => ({ ...f, userStory: e.target.value || undefined }))}
                  rows={2}
                  placeholder="En tant qu'utilisateur, je veux..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none italic"
                />
              </div>
            </div>
          )}

          {/* Details Tab */}
          {!aiMode && activeTab === 'details' && (
            <div className="space-y-6 max-w-3xl">
              {/* Specs */}
              <ListEditor
                label="Spécifications"
                items={form.specs}
                onAdd={() => addListItem('specs')}
                onUpdate={(i, v) => updateListItem('specs', i, v)}
                onRemove={(i) => removeListItem('specs', i)}
                placeholder="Ajouter une spécification..."
              />

              {/* Reproduction (for bugs) */}
              {form.type === 'BUG' && (
                <ListEditor
                  label="Étapes de reproduction"
                  items={form.reproduction}
                  onAdd={() => addListItem('reproduction')}
                  onUpdate={(i, v) => updateListItem('reproduction', i, v)}
                  onRemove={(i) => removeListItem('reproduction', i)}
                  placeholder="Étape de reproduction..."
                  numbered
                />
              )}

              {/* Dependencies */}
              <ListEditor
                label="Dépendances"
                items={form.dependencies}
                onAdd={() => addListItem('dependencies')}
                onUpdate={(i, v) => updateListItem('dependencies', i, v)}
                onRemove={(i) => removeListItem('dependencies', i)}
                placeholder="Ajouter une dépendance..."
              />

              {/* Constraints */}
              <ListEditor
                label="Contraintes"
                items={form.constraints}
                onAdd={() => addListItem('constraints')}
                onUpdate={(i, v) => updateListItem('constraints', i, v)}
                onRemove={(i) => removeListItem('constraints', i)}
                placeholder="Ajouter une contrainte..."
              />
            </div>
          )}

          {/* Criteria Tab */}
          {!aiMode && activeTab === 'criteria' && (
            <div className="space-y-4 max-w-3xl">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  Critères d'acceptation
                </label>
                <button
                  onClick={addCriterion}
                  className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-1"
                >
                  <PlusIcon />
                  Ajouter
                </button>
              </div>

              {form.criteria.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                  <p className="text-gray-500">Aucun critère d'acceptation</p>
                  <button
                    onClick={addCriterion}
                    className="mt-2 text-blue-600 hover:underline text-sm"
                  >
                    Ajouter le premier critère
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {form.criteria.map((criterion, index) => (
                    <div key={index} className="flex items-center gap-3 group">
                      <input
                        type="checkbox"
                        checked={criterion.checked}
                        onChange={e => setForm(f => ({
                          ...f,
                          criteria: f.criteria.map((c, i) =>
                            i === index ? { ...c, checked: e.target.checked } : c
                          ),
                        }))}
                        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        value={criterion.text}
                        onChange={e => updateCriterion(index, e.target.value)}
                        placeholder="Critère d'acceptation..."
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        onClick={() => removeCriterion(index)}
                        className="p-2 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Screenshots Tab */}
          {!aiMode && activeTab === 'screenshots' && (
            <div className="max-w-3xl">
              {screenshotOps ? (
                <ScreenshotEditor
                  ticketId={form.id || 'NEW'}
                  screenshots={form.screenshots}
                  isReady={screenshotOps.isReady}
                  needsPermission={screenshotOps.needsPermission}
                  isProcessing={screenshotOps.isProcessing}
                  onAdd={(filename) => {
                    setForm(f => ({
                      ...f,
                      screenshots: [...f.screenshots, {
                        filename,
                        addedAt: Date.now(),
                      }],
                    }));
                  }}
                  onRemove={(filename) => {
                    screenshotOps.deleteFile(filename);
                    setForm(f => ({
                      ...f,
                      screenshots: f.screenshots.filter(s => s.filename !== filename),
                    }));
                  }}
                  onRequestAccess={screenshotOps.onRequestAccess}
                  saveBlob={screenshotOps.saveBlob}
                  importFile={screenshotOps.importFile}
                  getUrl={screenshotOps.getUrl}
                />
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                  <CameraIcon className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                  <p className="text-gray-500">Fonctionnalité screenshots non disponible</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Vérifiez que votre navigateur supporte l'API File System Access
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer (hidden in AI mode) */}
        {!aiMode && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {isNew ? 'Vérifiez les détails avant de créer' : `Dernière modification: ${form.id}`}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-5 py-2.5 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <SaveIcon />
                {isNew ? 'Créer' : 'Enregistrer'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ============================================================
// LIST EDITOR COMPONENT
// ============================================================

interface ListEditorProps {
  label: string;
  items: string[];
  onAdd: () => void;
  onUpdate: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  placeholder?: string;
  numbered?: boolean;
}

function ListEditor({ label, items, onAdd, onUpdate, onRemove, placeholder, numbered }: ListEditorProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <button
          onClick={onAdd}
          className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-1"
        >
          <PlusIcon />
          Ajouter
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200">
          <p className="text-sm text-gray-400">Aucun élément</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-2 group">
              {numbered && (
                <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center font-medium">
                  {index + 1}
                </span>
              )}
              <input
                type="text"
                value={item}
                onChange={e => onUpdate(index, e.target.value)}
                placeholder={placeholder}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={() => onRemove(index)}
                className="p-2 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// ICONS
// ============================================================

function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={`w-5 h-5 ${className || ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M5 13l4 4L19 7" />
    </svg>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className || "w-4 h-4"} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

// ============================================================
// AI MODE SCREENSHOT THUMBNAIL
// ============================================================

interface AiModeScreenshotThumbProps {
  screenshot: Screenshot;
  getUrl?: (filename: string) => Promise<string | null>;
  onRemove: () => void;
}

function AiModeScreenshotThumb({ screenshot, getUrl, onRemove }: AiModeScreenshotThumbProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!getUrl) return;

    let mounted = true;
    getUrl(screenshot.filename).then(url => {
      if (mounted && url) {
        setThumbnailUrl(url);
      }
    });

    return () => {
      mounted = false;
      if (thumbnailUrl) {
        URL.revokeObjectURL(thumbnailUrl);
      }
    };
  }, [screenshot.filename, getUrl]);

  return (
    <div className="relative group aspect-video bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm">
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={screenshot.alt || screenshot.filename}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
        </div>
      )}

      {/* Delete button */}
      <button
        onClick={onRemove}
        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-lg"
        title="Supprimer"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
