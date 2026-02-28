/**
 * ItemEditorModal - Modal pour créer/éditer un item du backlog
 *
 * Design épuré et futuriste avec intégration Gemini
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTextareaHeight } from '../../hooks/useTextareaHeight';
import { useAIQuestioning } from '../../hooks/useAIQuestioning';
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
import { hasApiKey, generateItemFromDescription, getProvider, type AIProvider, type ImageData } from '../../lib/ai';
import { detectDependencies } from '../../lib/ai-dependencies';
import type { DependencySuggestion } from '../../types/ai';
import { getProviderLabel } from '../ui/ProviderToggle';
import { extractImageFromClipboard } from '../../lib/screenshots';
import { getNextItemNumber } from '../../db/queries/counters';
import { isAbortError } from '../../lib/abort';
import { CloseIcon, SparklesIcon, PlusIcon, TrashIcon, SaveIcon, CameraIcon } from '../ui/Icons';
import { ListEditor } from '../ui/ListEditor';
import { ScreenshotEditor } from './ScreenshotEditor';
import { AIGenerationMode } from './AIGenerationMode';
import { AIQuestionFlow } from './AIQuestionFlow';
import { AIRefineModal } from './AIRefineModal';
import { AIFeedbackWidget } from './AIFeedbackWidget';
import { useAIFeedback } from '../../hooks/useAIFeedback';
import { DependencySuggestions } from '../detail/DependencySuggestions';
import type { TicketTemplate } from '../../db/queries/templates';
import { TemplateSelector } from '../templates/TemplateSelector';
import { useTranslation } from '../../i18n';

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
  onSave: (data: ItemFormData, isNew: boolean) => Promise<void>;
  existingIds: string[];
  screenshotOps?: ScreenshotOperations;
  types: TypeDefinition[];
  projectPath?: string;
  items?: BacklogItem[];
  projectId?: number | null;
  templates?: TicketTemplate[];
}

// ============================================================
// DEFAULT VALUES & CREATION MODE PERSISTENCE
// ============================================================

const CREATION_MODE_KEY = 'ticketflow-creation-mode';
type CreationMode = 'ai' | 'templates';

function getPreferredCreationMode(): CreationMode {
  return (localStorage.getItem(CREATION_MODE_KEY) as CreationMode) || 'ai';
}

function setPreferredCreationMode(mode: CreationMode) {
  localStorage.setItem(CREATION_MODE_KEY, mode);
}

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
// SCREENSHOT → BASE64 CONVERSION
// ============================================================

/**
 * Convert screenshots to base64 ImageData for AI multimodal requests.
 * Reads blobs from the screenshot storage and converts to base64.
 */
async function screenshotsToImageData(
  screenshots: Screenshot[],
  getUrl?: (filename: string) => Promise<string | null>,
): Promise<ImageData[]> {
  if (!getUrl || screenshots.length === 0) return [];

  const results: ImageData[] = [];

  for (const screenshot of screenshots) {
    try {
      const url = await getUrl(screenshot.filename);
      if (!url) continue;

      // Fetch the blob from the object URL
      const response = await fetch(url);
      const blob = await response.blob();

      // Convert blob to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          // Strip the "data:image/png;base64," prefix
          const base64Data = dataUrl.split(',')[1];
          if (base64Data) resolve(base64Data);
          else reject(new Error('Failed to extract base64'));
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      results.push({
        base64,
        mimeType: blob.type || 'image/png',
      });
    } catch (err) {
      console.warn('[Screenshots] Failed to convert screenshot to base64:', screenshot.filename, err);
      // Continue with other screenshots
    }
  }

  return results;
}

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
  items,
  projectId,
  templates,
}: ItemEditorModalProps) {
  const { t } = useTranslation();
  const isNew = !item;
  const [form, setForm] = useState<ItemFormData>(createEmptyForm());
  const [activeTab, setActiveTab] = useState<'general' | 'details' | 'criteria' | 'screenshots'>('general');
  const [showRefineModal, setShowRefineModal] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [geminiSuggestions, setGeminiSuggestions] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // AI Creation Mode
  const [aiMode, setAiMode] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(() => getProvider());
  const [progressText, setProgressText] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // AI Questioning Flow
  const questioning = useAIQuestioning(projectPath);
  // Ref to track whether we should auto-trigger generation after questioning completes
  const pendingGenerationRef = useRef(false);
  // AbortController for cancelling AI generation
  const abortControllerRef = useRef<AbortController | null>(null);
  // Ref guard to prevent re-entry into handleGenerateFromAI before React re-renders
  const isGeneratingRef = useRef(false);

  // Ref to track latest screenshots for async generation (avoids stale closure)
  const screenshotsRef = useRef(form.screenshots);
  screenshotsRef.current = form.screenshots;

  // Save guard to prevent double submissions
  const [isSaving, setIsSaving] = useState(false);

  // AI Feedback
  const feedback = useAIFeedback(projectId ?? null, projectPath);
  const [showFeedbackWidget, setShowFeedbackWidget] = useState(false);

  // AI Dependency Detection
  const [dependencySuggestions, setDependencySuggestions] = useState<DependencySuggestion[]>([]);
  const [isDetectingDeps, setIsDetectingDeps] = useState(false);

  // Textarea resizable heights (persisted globally)
  const descriptionHeight = useTextareaHeight({ fieldId: 'description' });
  const userStoryHeight = useTextareaHeight({ fieldId: 'userStory' });

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (item) {
        setForm(itemToFormData(item));
        setAiMode(false);
        setShowTemplateSelector(false);
      } else {
        // Use first available type or fallback to 'BUG'
        const defaultType = types?.[0]?.id as ItemType || 'BUG';
        setForm(createEmptyForm(defaultType));

        // Default to AI mode (AI-first), but respect user preference
        const preferred = getPreferredCreationMode();
        if (preferred === 'ai') {
          setShowTemplateSelector(false);
          setAiMode(true);
        } else if (templates && templates.length > 0) {
          setShowTemplateSelector(true);
          setAiMode(false);
        } else {
          // User prefers templates but none exist, fall back to AI
          setShowTemplateSelector(false);
          setAiMode(true);
        }
      }
      setActiveTab('general');
      setErrors({});
      setGeminiSuggestions([]);
      setAiPrompt('');
      setIsGenerating(false);
      setProgressText(null);
      setGenerationError(null);
      setIsSaving(false);
      abortControllerRef.current?.abort();
      questioning.reset();
      pendingGenerationRef.current = false;
      isGeneratingRef.current = false;
      setDependencySuggestions([]);
      setIsDetectingDeps(false);
      setShowFeedbackWidget(false);
    }
  }, [isOpen, item, types, templates]); // eslint-disable-line react-hooks/exhaustive-deps -- questioning.reset is stable

  /**
   * Generate temporary ID for UI purposes (type changes, templates).
   * The real ID from the counter will be assigned at save time.
   * This is only used for in-memory form state before saving.
   */
  const generateTempId = useCallback((type: ItemType): string => {
    const prefix = type;
    const existingNumbers = existingIds
      .filter(id => id.startsWith(prefix + '-'))
      .map(id => parseInt(id.split('-')[1], 10))
      .filter(n => !isNaN(n));

    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    return `${prefix}-${String(maxNumber + 1).padStart(3, '0')}`;
  }, [existingIds]);

  // Auto-generate preview ID for new items (display only, not consuming counter)
  // The definitive counter-based ID is assigned at save time in handleSave
  useEffect(() => {
    if (isNew && isOpen && !form.id) {
      setForm(f => ({ ...f, id: generateTempId(f.type) }));
    }
  }, [isNew, isOpen, form.id, generateTempId]);

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
      id: isNew ? generateTempId(type) : f.id,
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
      newErrors.id = t.validation.idRequired;
    } else if (isNew && existingIds.includes(form.id)) {
      newErrors.id = t.validation.idExists;
    }

    if (!form.title.trim()) {
      newErrors.title = t.validation.titleRequired;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Save handler - delay close to let React batch updates settle
  const handleSave = async () => {
    if (isSaving) {
      return;
    }

    const isValid = validate();
    if (!isValid) return;

    setIsSaving(true);
    try {
      // For new items, get the definitive counter-based ID at save time
      // This avoids premature counter consumption from the useEffect
      if (isNew && projectPath && projectId !== null && projectId !== undefined) {
        const nextNum = await getNextItemNumber(projectPath, projectId, form.type);
        const definitiveId = `${form.type}-${String(nextNum).padStart(3, '0')}`;
        const finalForm = { ...form, id: definitiveId };
        setForm(finalForm);
        await onSave(finalForm, isNew);
      } else {
        await onSave(form, isNew);
      }
      // Delay close to allow state update to propagate before modal unmounts
      // This fixes the race condition where UI doesn't refresh after creation
      requestAnimationFrame(() => {
        onClose();
      });
    } catch (error) {
      // Show error to user - previously this was silent
      console.error('[DEBUG-SAVE] Save FAILED:', error);
      const msg = error instanceof Error ? error.message : String(error);
      setErrors(prev => ({ ...prev, save: msg }));
    } finally {
      setIsSaving(false);
    }
  };

  // AI refinement - now uses modal
  const handleAcceptRefinement = (refinedItem: Partial<BacklogItem>, suggestions: string[]) => {
    setGeminiSuggestions(suggestions);
    setForm(f => ({
      ...f,
      title: refinedItem.title || f.title,
      userStory: refinedItem.userStory || f.userStory,
      specs: refinedItem.specs || f.specs,
      criteria: refinedItem.criteria || f.criteria,
      dependencies: refinedItem.dependencies || f.dependencies,
      constraints: refinedItem.constraints || f.constraints,
    }));
  };

  // Core generation logic (shared between direct and post-questioning flows)
  const executeGeneration = useCallback(async (promptText: string) => {
    setIsGenerating(true);
    setProgressText(t.ai.progressAnalyzing);
    setGenerationError(null);

    // Create AbortController for this generation
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Cycle progress text every 2s
    const progressInterval = setInterval(() => {
      setProgressText(prev => {
        if (prev === t.ai.progressAnalyzing) return t.ai.progressGenerating;
        if (prev === t.ai.progressGenerating) return t.ai.progressFinalizing;
        return prev;
      });
    }, 2000);

    try {
      // Convert attached screenshots to base64 for multimodal AI
      const imageData = await screenshotsToImageData(
        screenshotsRef.current,
        screenshotOps?.getUrl,
      );

      const result = await generateItemFromDescription(promptText, {
        provider: selectedProvider,
        projectPath,
        availableTypes: types,
        items,
        projectId: projectId ?? undefined,
        typeConfigs: types,
        images: imageData.length > 0 ? imageData : undefined,
        signal: controller.signal,
      });

      if (result.success && result.item) {
        // Validate that the suggested type exists in available types
        let suggestedType = result.item.suggestedType;
        const typeExists = types.some(t => t.id === suggestedType);
        if (!typeExists) {
          console.warn(`[AI] Unknown suggested type: ${suggestedType}, falling back to first available type`);
          suggestedType = types[0]?.id || 'CT';
        }

        // Use temp ID for preview - the definitive counter-based ID
        // will be assigned at save time in handleSave to avoid
        // premature counter consumption and gaps in numbering
        const newId = generateTempId(suggestedType);

        setForm(f => ({
          id: newId,
          type: suggestedType,
          title: result.item!.title,
          emoji: result.item!.emoji,
          description: result.item!.description,
          userStory: result.item!.userStory,
          specs: result.item!.specs,
          criteria: result.item!.criteria,
          priority: suggestedType !== 'BUG' ? result.item!.suggestedPriority : undefined,
          severity: suggestedType === 'BUG' ? result.item!.suggestedSeverity : undefined,
          effort: result.item!.suggestedEffort,
          module: result.item!.suggestedModule,
          component: suggestedType === 'BUG' ? result.item!.suggestedModule : undefined,
          reproduction: [],
          dependencies: result.item!.dependencies || [],
          constraints: result.item!.constraints || [],
          screenshots: f.screenshots, // Preserve screenshots from AI mode
        }));

        // Exit AI mode to show the form for review
        setAiMode(false);
        setActiveTab('general');
        questioning.reset();
        setShowFeedbackWidget(true);

        // Trigger dependency detection in background (non-blocking)
        // Delay to avoid 429 rate-limit from back-to-back API calls
        if (items && items.length > 0) {
          const depItem = { title: result.item.title, description: result.item.description, type: result.item.suggestedType };
          setIsDetectingDeps(true);
          setTimeout(() => {
            detectDependencies(
              depItem,
              items,
              { provider: selectedProvider, projectPath, projectId: projectId ?? undefined }
            ).then(suggestions => {
              setDependencySuggestions(suggestions);
            }).finally(() => {
              setIsDetectingDeps(false);
            });
          }, 2000);
        }
      } else {
        // Show error with retry option
        setGenerationError(result.error || t.aiErrors.unknownError);
      }
    } catch (error) {
      if (isAbortError(error)) {
        // User cancelled - silent, no error shown
        return;
      }
      setGenerationError(error instanceof Error ? error.message : t.aiErrors.unknownError);
    } finally {
      clearInterval(progressInterval);
      setIsGenerating(false);
      setProgressText(null);
      abortControllerRef.current = null;
    }
  }, [selectedProvider, projectPath, types, items, projectId, generateTempId, questioning, screenshotOps, t]);

  // Generate item from AI description (entry point from Generate button)
  const handleGenerateFromAI = async () => {
    // Re-entry guard: prevents duplicate API calls from rapid clicks before React
    // re-renders disable the button. isGeneratingRef is synchronously set unlike state.
    if (isGeneratingRef.current) return;

    if (!hasApiKey(selectedProvider)) {
      alert(`${t.error.apiConfigMissing} (${getProviderLabel(selectedProvider)})`);
      return;
    }

    if (!aiPrompt.trim()) {
      alert(t.ai.describeWhatToCreate);
      return;
    }

    // Mark as in-progress immediately (synchronous, no re-render delay)
    isGeneratingRef.current = true;
    // Also set React state to disable button and show spinner in UI
    setIsGenerating(true);

    // If questioning is enabled and not yet started, start the questioning flow
    if (questioning.isEnabled && questioning.state.phase === 'idle') {
      try {
        await questioning.start(aiPrompt);
      } finally {
        // Reset loading state after questioning.start() completes:
        // the questioning UI takes over visibility, hiding the Generate button.
        isGeneratingRef.current = false;
        setIsGenerating(false);
      }
      return; // Wait for questioning to complete
    }

    // If questioning completed or was skipped, generate with enriched prompt.
    // executeGeneration manages isGenerating internally, so reset the ref now.
    isGeneratingRef.current = false;

    if (questioning.state.phase === 'ready' || questioning.state.phase === 'recap' || questioning.state.phase === 'skipped') {
      const enrichedPrompt = questioning.getEnrichedPrompt();
      await executeGeneration(enrichedPrompt);
      return;
    }

    // Fallback: direct generation (questioning disabled or not applicable)
    await executeGeneration(aiPrompt);
  };

  // Auto-trigger generation when questioning completes via skip or confirm
  useEffect(() => {
    if (!pendingGenerationRef.current) return;
    const phase = questioning.state.phase;
    if (phase === 'skipped' || phase === 'ready') {
      pendingGenerationRef.current = false;
      const enrichedPrompt = questioning.getEnrichedPrompt();
      executeGeneration(enrichedPrompt);
    }
  }, [questioning.state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle skip from questioning flow: skip and trigger generation
  const handleQuestioningSkip = useCallback(() => {
    questioning.skip();
    pendingGenerationRef.current = true;
  }, [questioning]);

  // Handle AI generation cancellation
  const handleCancelGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsGenerating(false);
    setProgressText(null);
    abortControllerRef.current = null;
  }, []);

  // Handle retry generation after error
  const handleRetryGeneration = useCallback(() => {
    setGenerationError(null);
    handleGenerateFromAI();
  }, [handleGenerateFromAI]);

  // Handle recap confirmation: confirm and trigger generation
  const handleQuestioningConfirmRecap = useCallback(() => {
    pendingGenerationRef.current = true;
    questioning.skip(); // Sets phase to 'skipped' which triggers generation via useEffect
  }, [questioning]);

  // Handle template selection
  const handleTemplateSelect = useCallback((template: TicketTemplate) => {
    const data = template.templateData;

    // Validate type exists in project config, fallback to first type
    const templateType = types.find(t => t.id === template.type)
      ? template.type
      : types[0]?.id ?? 'BUG';

    const newForm: ItemFormData = {
      ...createEmptyForm(templateType as ItemType),
      ...(data.severity ? { severity: data.severity as Severity } : {}),
      ...(data.priority ? { priority: data.priority as Priority } : {}),
      ...(data.effort ? { effort: data.effort as Effort } : {}),
      ...(data.description ? { description: data.description as string } : {}),
      ...(data.userStory ? { userStory: data.userStory as string } : {}),
      ...(data.specs ? { specs: data.specs as string[] } : {}),
      ...(data.reproduction ? { reproduction: data.reproduction as string[] } : {}),
      ...(data.criteria ? { criteria: data.criteria as Criterion[] } : {}),
    };

    setForm(f => ({ ...newForm, id: f.id || generateTempId(templateType as ItemType) }));
    setShowTemplateSelector(false);
    setAiMode(false);
  }, [types, generateTempId]);

  // Handle skip template selection - go to AI mode
  const handleTemplateSkip = useCallback(() => {
    setShowTemplateSelector(false);
    setAiMode(true);
    setPreferredCreationMode('ai');
  }, []);

  // Dependency suggestion handlers
  const handleAcceptDependency = useCallback((suggestion: DependencySuggestion) => {
    const depText = `${suggestion.relationship}: ${suggestion.targetId} - ${suggestion.reason}`;
    setForm(prev => ({
      ...prev,
      dependencies: [...prev.dependencies, depText],
    }));
    setDependencySuggestions(prev => prev.filter(s => s.targetId !== suggestion.targetId));
  }, []);

  const handleDismissDependency = useCallback((targetId: string) => {
    setDependencySuggestions(prev => prev.filter(s => s.targetId !== targetId));
  }, []);

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
      <div className="fixed inset-0 bg-overlay backdrop-blur-sm z-50" onClick={onClose} />

      {/* Modal - Centre avec largeur adaptee */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
        <div className="bg-surface rounded-2xl shadow-2xl flex flex-col overflow-hidden w-full max-w-4xl min-h-[70vh] max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-outline bg-surface-alt">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-accent-soft">
                {aiMode ? (
                  <SparklesIcon className="text-accent-text" />
                ) : (
                  <span className="text-accent-text font-bold text-sm">{form.type}</span>
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-on-surface">
                  {showTemplateSelector ? t.editor.newTicket : aiMode ? t.editor.createWithAI : isNew ? t.editor.newItem : `${t.editor.editItem} ${form.id}`}
                </h2>
                <p className="text-sm text-on-surface-muted">
                  {showTemplateSelector
                    ? t.editor.modeSelection
                    : aiMode
                      ? t.editor.aiModeDesc
                      : isNew
                        ? t.editor.reviewDesc
                        : t.editor.editDesc}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Creation Mode Toggle (AI/Templates) */}
              {isNew && (aiMode || showTemplateSelector) && (
                <div className="flex items-center bg-surface rounded-lg border border-outline p-0.5 gap-0.5">
                  <button
                    onClick={() => {
                      setAiMode(true);
                      setShowTemplateSelector(false);
                      setPreferredCreationMode('ai');
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      aiMode
                        ? 'bg-accent-soft text-accent-text'
                        : 'text-on-surface-muted hover:text-on-surface-secondary'
                    }`}
                  >
                    <SparklesIcon className="w-3.5 h-3.5 inline mr-1" />
                    {t.editor.creationModeAI}
                  </button>
                  <button
                    onClick={() => {
                      if (templates && templates.length > 0) {
                        setShowTemplateSelector(true);
                        setAiMode(false);
                      } else {
                        setAiMode(false);
                        setShowTemplateSelector(false);
                      }
                      setPreferredCreationMode('templates');
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      showTemplateSelector || (!aiMode && isNew)
                        ? 'bg-accent-soft text-accent-text'
                        : 'text-on-surface-muted hover:text-on-surface-secondary'
                    }`}
                  >
                    {t.editor.creationModeTemplates}
                  </button>
                </div>
              )}
              {/* Toggle AI Mode button (only when in manual form mode) */}
              {isNew && !aiMode && !showTemplateSelector && (
                <button
                  onClick={() => {
                    setAiMode(true);
                    setPreferredCreationMode('ai');
                  }}
                  className="px-4 py-2 border border-outline text-on-surface-secondary text-sm font-medium rounded-lg hover:bg-surface-alt flex items-center gap-2 transition-colors"
                >
                  <SparklesIcon />
                  {t.ai.aiMode}
                </button>
              )}
              {/* AI Refine Button (only in form mode) */}
              {!aiMode && !showTemplateSelector && (
                <button
                  onClick={() => setShowRefineModal(true)}
                  disabled={!form.title}
                  className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                >
                  <SparklesIcon />
                  {t.action.refine}
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 text-on-surface-faint hover:text-on-surface-secondary rounded-lg hover:bg-surface-alt"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          {/* Tabs (only in form mode) */}
          {!aiMode && !showTemplateSelector && (
            <div className="flex gap-1 mt-4">
              {(['general', 'details', 'criteria', 'screenshots'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    activeTab === tab
                      ? 'bg-accent-soft text-accent-text'
                      : 'text-on-surface-muted hover:text-on-surface-secondary hover:bg-surface-alt'
                  }`}
                >
                  {tab === 'general' && t.editor.general}
                  {tab === 'details' && t.editor.details}
                  {tab === 'criteria' && t.editor.criteria}
                  {tab === 'screenshots' && (
                    <span className="flex items-center gap-1.5">
                      <CameraIcon />
                      {t.editor.captures}
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
          <div className="px-6 py-3 bg-accent-soft border-b border-accent/20">
            <div className="flex items-start gap-3">
              <SparklesIcon className="w-5 h-5 text-accent-text mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-on-surface">{t.ai.suggestions}</p>
                <ul className="mt-1 space-y-1">
                  {geminiSuggestions.map((s, i) => (
                    <li key={i} className="text-sm text-on-surface-secondary">• {s}</li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => setGeminiSuggestions([])}
                className="ml-auto text-on-surface-muted hover:text-on-surface-secondary"
              >
                <CloseIcon />
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-surface">
          {/* Template Selector (shown first for new items with templates) */}
          {showTemplateSelector && templates && templates.length > 0 ? (
            <TemplateSelector
              templates={templates}
              onSelect={handleTemplateSelect}
              onSkip={handleTemplateSkip}
            />
          ) : (
          <>
          {/* AI Mode */}
          {aiMode && (
            <>
              <AIGenerationMode
                prompt={aiPrompt}
                onPromptChange={setAiPrompt}
                provider={selectedProvider}
                onProviderChange={setSelectedProvider}
                isGenerating={isGenerating}
                onGenerate={handleGenerateFromAI}
                onCancel={handleCancelGeneration}
                onSwitchToManual={() => {
                  setAiMode(false);
                  setPreferredCreationMode('templates');
                  questioning.reset();
                }}
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
                questioningFlow={
                  questioning.state.phase !== 'idle' && (
                    <AIQuestionFlow
                      messages={questioning.state.messages.filter(m => m.role !== 'system')}
                      phase={questioning.state.phase}
                      questions={questioning.state.lastQuestions}
                      recap={questioning.state.lastRecap}
                      confidence={questioning.state.confidence}
                      isProcessing={questioning.isProcessing}
                      onAnswer={questioning.answer}
                      onSkip={handleQuestioningSkip}
                      onConfirmRecap={handleQuestioningConfirmRecap}
                      error={questioning.error}
                    />
                  )
                }
                isQuestioning={
                  questioning.state.phase !== 'idle' &&
                  questioning.state.phase !== 'ready' &&
                  questioning.state.phase !== 'skipped'
                }
                progressText={progressText}
              />
              {/* Error feedback UI */}
              {generationError && (
                <div className="max-w-2xl mx-auto mt-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-800 dark:text-red-300">
                        {t.ai.generationFailed}
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        {generationError}
                      </p>
                    </div>
                    <button
                      onClick={handleRetryGeneration}
                      className="px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-800/40 hover:bg-red-200 dark:hover:bg-red-800/60 rounded-lg transition-colors"
                    >
                      {t.ai.retry}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* General Tab - Layout 2 colonnes responsive */}
          {!aiMode && activeTab === 'general' && (
            <div>
              {/* Title - Full width en haut */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-on-surface mb-2">
                  {t.editor.title} <span className="text-danger-text">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.emoji || ''}
                    onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))}
                    placeholder="🔥"
                    className="w-14 px-2 py-2.5 border border-outline-strong rounded-lg focus:ring-2 focus:ring-accent focus:border-accent text-center text-xl"
                  />
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder={t.placeholder.title}
                    className={`flex-1 px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-accent focus:border-accent ${
                      errors.title ? 'border-red-500' : 'border-outline-strong'
                    }`}
                  />
                </div>
                {errors.title && <p className="mt-1 text-sm text-danger-text">{errors.title}</p>}
              </div>

              {/* Grid 2 colonnes: Gauche (contenu) / Droite (metadata) */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
                {/* Colonne gauche: Description + User Story (60%) */}
                <div className="lg:col-span-3 space-y-6">
                  {/* Description */}
                  <div>
                    <label className="block text-sm font-semibold text-on-surface mb-2">{t.editor.description}</label>
                    <textarea
                      ref={descriptionHeight.ref}
                      value={form.description || ''}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value || undefined }))}
                      onInput={descriptionHeight.onInput}
                      onMouseUp={descriptionHeight.onMouseUp}
                      style={descriptionHeight.style}
                      placeholder={t.placeholder.detailedDescription}
                      className="w-full px-4 py-3 border border-outline-strong rounded-xl focus:ring-2 focus:ring-accent focus:border-accent resize-y transition-all"
                    />
                  </div>

                  {/* User Story */}
                  <div>
                    <label className="block text-sm font-semibold text-on-surface mb-2">
                      {t.editor.userStory}
                    </label>
                    <textarea
                      ref={userStoryHeight.ref}
                      value={form.userStory || ''}
                      onChange={e => setForm(f => ({ ...f, userStory: e.target.value || undefined }))}
                      onInput={userStoryHeight.onInput}
                      onMouseUp={userStoryHeight.onMouseUp}
                      style={userStoryHeight.style}
                      placeholder={t.placeholder.userStory}
                      className="w-full px-4 py-3 border border-outline-strong rounded-xl focus:ring-2 focus:ring-accent focus:border-accent resize-y italic transition-all"
                    />
                  </div>
                </div>

                {/* Colonne droite: Metadata (40%) */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Type & ID */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-on-surface mb-2">{t.editor.type}</label>
                      <select
                        value={form.type}
                        onChange={e => handleTypeChange(e.target.value as ItemType)}
                        disabled={!isNew}
                        className="w-full px-3 py-2.5 bg-input-bg text-on-surface border border-outline-strong rounded-lg focus:ring-2 focus:ring-accent focus:border-accent disabled:bg-surface-alt disabled:cursor-not-allowed text-sm"
                      >
                        {types.map(t => (
                          <option key={t.id} value={t.id}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-on-surface mb-2">{t.editor.id}</label>
                      <input
                        type="text"
                        value={form.id}
                        onChange={e => setForm(f => ({ ...f, id: e.target.value.toUpperCase() }))}
                        disabled={!isNew}
                        className={`w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-accent focus:border-accent font-mono text-sm disabled:bg-surface-alt disabled:cursor-not-allowed ${
                          errors.id ? 'border-red-500' : 'border-outline-strong'
                        }`}
                      />
                      {errors.id && <p className="mt-1 text-xs text-danger-text">{errors.id}</p>}
                    </div>
                  </div>

                  {/* Severity/Priority & Effort */}
                  <div className="grid grid-cols-2 gap-3">
                    {form.type === 'BUG' ? (
                      <div>
                        <label className="block text-sm font-semibold text-on-surface mb-2">{t.editor.severity}</label>
                        <select
                          value={form.severity || ''}
                          onChange={e => setForm(f => ({ ...f, severity: e.target.value as Severity || undefined }))}
                          className="w-full px-3 py-2.5 bg-input-bg text-on-surface border border-outline-strong rounded-lg focus:ring-2 focus:ring-accent focus:border-accent text-sm"
                        >
                          <option value="">{t.editor.notDefinedF}</option>
                          {(['P0', 'P1', 'P2', 'P3', 'P4'] as Severity[]).map(s => (
                            <option key={s} value={s}>{s} - {SEVERITY_LABELS[s]}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-semibold text-on-surface mb-2">{t.editor.priority}</label>
                        <select
                          value={form.priority || ''}
                          onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority || undefined }))}
                          className="w-full px-3 py-2.5 bg-input-bg text-on-surface border border-outline-strong rounded-lg focus:ring-2 focus:ring-accent focus:border-accent text-sm"
                        >
                          <option value="">{t.editor.notDefinedF}</option>
                          {(['Haute', 'Moyenne', 'Faible'] as Priority[]).map(p => (
                            <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-semibold text-on-surface mb-2">{t.editor.effort}</label>
                      <select
                        value={form.effort || ''}
                        onChange={e => setForm(f => ({ ...f, effort: e.target.value as Effort || undefined }))}
                        className="w-full px-3 py-2.5 bg-input-bg text-on-surface border border-outline-strong rounded-lg focus:ring-2 focus:ring-accent focus:border-accent text-sm"
                      >
                        <option value="">{t.editor.notDefined}</option>
                        {(['XS', 'S', 'M', 'L', 'XL'] as Effort[]).map(e => (
                          <option key={e} value={e}>{e} - {EFFORT_LABELS[e]}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Composant/Module */}
                  <div>
                    <label className="block text-sm font-semibold text-on-surface mb-2">
                      {form.type === 'BUG' ? t.editor.component : t.editor.module}
                    </label>
                    <input
                      type="text"
                      value={form.type === 'BUG' ? (form.component || '') : (form.module || '')}
                      onChange={e => setForm(f => ({
                        ...f,
                        [form.type === 'BUG' ? 'component' : 'module']: e.target.value || undefined,
                      }))}
                      placeholder={form.type === 'BUG' ? t.editor.affectedComponent : t.editor.relatedModule}
                      className="w-full px-3 py-2.5 border border-outline-strong rounded-lg focus:ring-2 focus:ring-accent focus:border-accent text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Details Tab */}
          {!aiMode && activeTab === 'details' && (
            <div className="space-y-6">
              {/* Specs */}
              <ListEditor
                label={t.editor.specs}
                items={form.specs}
                onAdd={() => addListItem('specs')}
                onUpdate={(i, v) => updateListItem('specs', i, v)}
                onRemove={(i) => removeListItem('specs', i)}
                placeholder={t.placeholder.spec}
              />

              {/* Reproduction (for bugs) */}
              {form.type === 'BUG' && (
                <ListEditor
                  label={t.editor.reproductionSteps}
                  items={form.reproduction}
                  onAdd={() => addListItem('reproduction')}
                  onUpdate={(i, v) => updateListItem('reproduction', i, v)}
                  onRemove={(i) => removeListItem('reproduction', i)}
                  placeholder={t.placeholder.reproductionStep}
                  numbered
                />
              )}

              {/* Dependencies */}
              <ListEditor
                label={t.editor.dependencies}
                items={form.dependencies}
                onAdd={() => addListItem('dependencies')}
                onUpdate={(i, v) => updateListItem('dependencies', i, v)}
                onRemove={(i) => removeListItem('dependencies', i)}
                placeholder={t.placeholder.dependency}
              />

              {/* AI Dependency Suggestions */}
              {(dependencySuggestions.length > 0 || isDetectingDeps) && (
                <DependencySuggestions
                  suggestions={dependencySuggestions}
                  isLoading={isDetectingDeps}
                  onAccept={handleAcceptDependency}
                  onDismiss={handleDismissDependency}
                />
              )}

              {/* Constraints */}
              <ListEditor
                label={t.editor.constraints}
                items={form.constraints}
                onAdd={() => addListItem('constraints')}
                onUpdate={(i, v) => updateListItem('constraints', i, v)}
                onRemove={(i) => removeListItem('constraints', i)}
                placeholder={t.placeholder.constraint}
              />
            </div>
          )}

          {/* Criteria Tab */}
          {!aiMode && activeTab === 'criteria' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-on-surface-secondary">
                  {t.editor.criteria}
                </label>
                <button
                  onClick={addCriterion}
                  className="px-3 py-1.5 text-sm text-accent-text hover:bg-accent-soft rounded-lg flex items-center gap-1"
                >
                  <PlusIcon />
                  {t.action.add}
                </button>
              </div>

              {form.criteria.length === 0 ? (
                <div className="text-center py-12 bg-surface-alt rounded-xl border-2 border-dashed border-outline">
                  <p className="text-on-surface-muted">{t.editor.noCriteria}</p>
                  <button
                    onClick={addCriterion}
                    className="mt-2 text-accent-text hover:underline text-sm"
                  >
                    {t.editor.addFirstCriterion}
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
                        className="w-5 h-5 rounded border-outline-strong text-accent-text focus:ring-accent"
                      />
                      <input
                        type="text"
                        value={criterion.text}
                        onChange={e => updateCriterion(index, e.target.value)}
                        placeholder={t.placeholder.criterion}
                        className="flex-1 px-4 py-2 border border-outline-strong rounded-lg focus:ring-2 focus:ring-accent focus:border-accent"
                      />
                      <button
                        onClick={() => removeCriterion(index)}
                        className="p-2 text-on-surface-faint hover:text-danger-text opacity-0 group-hover:opacity-100 transition-opacity"
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
            <div>
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
                <div className="text-center py-12 bg-surface-alt rounded-xl border-2 border-dashed border-outline">
                  <CameraIcon className="w-12 h-12 mx-auto text-on-surface-faint mb-3" />
                  <p className="text-on-surface-muted">{t.screenshot.notAvailable}</p>
                  <p className="text-sm text-on-surface-faint mt-1">
                    {t.screenshot.notAvailableDesc}
                  </p>
                </div>
              )}
            </div>
          )}
          </>
          )}
        </div>

        {/* AI Feedback Widget (shown after generation) */}
        {!aiMode && showFeedbackWidget && !feedback.hasSubmitted && (
          <div className="px-6 pb-2">
            <AIFeedbackWidget
              visible={showFeedbackWidget}
              onSubmit={(rating, text) => {
                feedback.submitRating(form.id, rating, text);
              }}
              hasSubmitted={feedback.hasSubmitted}
            />
          </div>
        )}

        {/* Footer (hidden in AI mode and template selector) */}
        {!aiMode && !showTemplateSelector && (
          <div className="px-6 py-4 border-t border-outline bg-surface-alt">
            {/* Save error display */}
            {errors.save && (
              <div className="mb-3 px-3 py-2 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-300">
                {t.editor.errorPrefix}: {errors.save}
              </div>
            )}
            <div className="flex items-center justify-between">
            <div className="text-sm text-on-surface-muted">
              {isNew ? t.editor.verifyBeforeCreate : `${t.editor.lastModification}: ${form.id}`}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-5 py-2.5 text-on-surface-secondary hover:bg-outline rounded-lg font-medium transition-colors"
              >
                {t.action.cancel}
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-5 py-2.5 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <SaveIcon />
                {isSaving ? t.editor.saving : isNew ? t.editor.create : t.action.save}
              </button>
            </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* AI Refine Modal */}
      <AIRefineModal
        isOpen={showRefineModal}
        onClose={() => setShowRefineModal(false)}
        item={{
          ...form,
          rawMarkdown: '',
          sectionIndex: 0,
        }}
        onAccept={handleAcceptRefinement}
        projectPath={projectPath}
        items={items}
        projectId={projectId}
        typeConfigs={types}
      />
    </>
  );
}
