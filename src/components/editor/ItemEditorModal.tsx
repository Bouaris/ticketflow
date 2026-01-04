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
import type { TypeDefinition } from '../../types/typeConfig';
import { SEVERITY_LABELS, PRIORITY_LABELS, EFFORT_LABELS } from '../../constants/labels';
import { refineItem, hasApiKey, generateItemFromDescription, getProvider, type AIProvider } from '../../lib/ai';
import { getProviderLabel } from '../ui/ProviderToggle';
import { extractImageFromClipboard } from '../../lib/screenshots';
import { CloseIcon, SparklesIcon, PlusIcon, TrashIcon, SaveIcon, CameraIcon } from '../ui/Icons';
import { ListEditor } from '../ui/ListEditor';
import { Spinner } from '../ui/Spinner';
import { ScreenshotEditor } from './ScreenshotEditor';
import { AIGenerationMode } from './AIGenerationMode';

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
  types: TypeDefinition[];
  projectPath?: string;
}

// ============================================================
// DEFAULT VALUES
// ============================================================

const createEmptyForm = (type: ItemType = 'BUG'): ItemFormData => ({
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
  types,
  projectPath,
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
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(() => getProvider());

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (item) {
        setForm(itemToFormData(item));
        setAiMode(false);
      } else {
        // Use first available type or fallback to 'BUG'
        const defaultType = types?.[0]?.id as ItemType || 'BUG';
        setForm(createEmptyForm(defaultType));
        setAiMode(true); // Start in AI mode for new items
      }
      setActiveTab('general');
      setErrors({});
      setGeminiSuggestions([]);
      setAiPrompt('');
      setIsGenerating(false);
    }
  }, [isOpen, item, types]);

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
      module: type !== 'BUG' ? f.module : undefined,
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

  // Save handler - delay close to let React batch updates settle
  const handleSave = () => {
    if (validate()) {
      onSave(form, isNew);
      // Delay close to allow state update to propagate before modal unmounts
      // This fixes the race condition where UI doesn't refresh after creation
      requestAnimationFrame(() => {
        onClose();
      });
    }
  };

  // AI refinement
  const handleRefineWithAI = async () => {
    if (!hasApiKey(selectedProvider)) {
      alert(`Configurez votre clé API ${getProviderLabel(selectedProvider)} dans les paramètres`);
      return;
    }

    setIsRefining(true);

    // Create a temporary BacklogItem for the API
    const tempItem: BacklogItem = {
      ...form,
      rawMarkdown: '',
      sectionIndex: 0,
    };

    const result = await refineItem(tempItem, {
      provider: selectedProvider,
      projectPath,
    });
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
      alert(`Erreur ${getProviderLabel(selectedProvider)}: ${result.error}`);
    }
  };

  // Generate item from AI description
  const handleGenerateFromAI = async () => {
    if (!hasApiKey(selectedProvider)) {
      alert(`Configurez votre clé API ${getProviderLabel(selectedProvider)} dans les paramètres`);
      return;
    }

    if (!aiPrompt.trim()) {
      alert('Décrivez ce que vous voulez créer');
      return;
    }

    setIsGenerating(true);

    const result = await generateItemFromDescription(aiPrompt, {
      provider: selectedProvider,
      projectPath,
    });
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
      alert(`Erreur ${getProviderLabel(selectedProvider)}: ${result.error}`);
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
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose} />

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
              {/* AI Refine Button (only in form mode) */}
              {!aiMode && (
                <button
                  onClick={handleRefineWithAI}
                  disabled={isRefining || !form.title}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-medium rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
                >
                  {isRefining ? (
                    <>
                      <Spinner size="sm" color="white" />
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

        {/* AI Suggestions Banner */}
        {geminiSuggestions.length > 0 && (
          <div className="px-6 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-purple-100">
            <div className="flex items-start gap-3">
              <SparklesIcon className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-purple-900">Suggestions IA</p>
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
        <div className="flex-1 overflow-y-auto p-6 bg-white">
          {/* AI Mode */}
          {aiMode && (
            <AIGenerationMode
              prompt={aiPrompt}
              onPromptChange={setAiPrompt}
              provider={selectedProvider}
              onProviderChange={setSelectedProvider}
              isGenerating={isGenerating}
              onGenerate={handleGenerateFromAI}
              onSwitchToManual={() => setAiMode(false)}
              projectPath={projectPath}
              screenshots={form.screenshots}
              getScreenshotUrl={screenshotOps?.getUrl}
              onRemoveScreenshot={(filename) => {
                screenshotOps?.deleteFile(filename);
                setForm(f => ({
                  ...f,
                  screenshots: f.screenshots.filter(s => s.filename !== filename),
                }));
              }}
            />
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
                    {types.map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
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
                    placeholder={form.type === 'BUG' ? 'Composant affecté...' : 'Module concerné...'}
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
