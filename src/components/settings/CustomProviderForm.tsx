/**
 * Custom Provider Form - Add/Edit custom OpenAI-compatible providers
 *
 * Validates input via ai-provider-registry, handles add/edit operations.
 * Custom providers: Ollama, LM Studio, or other OpenAI-compatible endpoints.
 */

import { useState } from 'react';
import type { ProviderConfig, CustomProviderInput } from '../../types/aiProvider';
import { validateCustomProvider, addCustomProvider, removeCustomProvider } from '../../lib/ai-provider-registry';
import { setApiKey, getApiKey } from '../../lib/ai';
import { useTranslation } from '../../i18n';

interface CustomProviderFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  editProvider?: ProviderConfig;
}

interface ValidationErrors {
  name?: string;
  baseURL?: string;
  defaultModel?: string;
}

export function CustomProviderForm({ onSuccess, onCancel, editProvider }: CustomProviderFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(editProvider?.name || '');
  const [baseURL, setBaseURL] = useState(editProvider?.baseURL || '');
  const [defaultModel, setDefaultModel] = useState(editProvider?.defaultModel || '');
  const [apiKey, setApiKeyState] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load existing API key if editing
  useState(() => {
    if (editProvider) {
      const existingKey = getApiKey(editProvider.id);
      setApiKeyState(existingKey || '');
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    try {
      // Build input object
      const input: CustomProviderInput = {
        name: name.trim(),
        baseURL: baseURL.trim(),
        defaultModel: defaultModel.trim(),
        apiKey: apiKey.trim() || undefined,
      };

      // Validate
      const validation = validateCustomProvider(input);
      if (!validation.success) {
        // Parse validation error and set field-specific errors
        const errorMsg = validation.error;
        if (errorMsg.includes('name')) {
          setErrors({ name: errorMsg });
        } else if (errorMsg.includes('baseURL') || errorMsg.includes('HTTPS') || errorMsg.includes('localhost')) {
          setErrors({ baseURL: errorMsg });
        } else if (errorMsg.includes('defaultModel')) {
          setErrors({ defaultModel: errorMsg });
        } else {
          setErrors({ name: errorMsg });
        }
        setIsSubmitting(false);
        return;
      }

      // If editing, remove old provider first (registry has no update function)
      if (editProvider) {
        removeCustomProvider(editProvider.id);
      }

      // Add new provider
      const result = addCustomProvider(input);
      if (!result.success) {
        setErrors({ name: result.error });
        setIsSubmitting(false);
        return;
      }

      // Store API key if provided
      if (input.apiKey) {
        setApiKey(input.apiKey, result.provider.id);
      }

      onSuccess();
    } catch (error) {
      setErrors({ name: error instanceof Error ? error.message : 'Unknown error' }); // TODO: i18n
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-on-surface-secondary mb-2">
          Provider Name {/* TODO: i18n */}
        </label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Ollama Local" // TODO: i18n
          className={`w-full px-3 py-2 border rounded-lg bg-input-bg focus:ring-2 focus:ring-accent outline-none ${
            errors.name ? 'border-danger' : 'border-input-border'
          }`}
          disabled={isSubmitting}
        />
        {errors.name && (
          <p className="mt-1 text-xs text-danger-text">{errors.name}</p>
        )}
      </div>

      {/* Base URL */}
      <div>
        <label className="block text-sm font-medium text-on-surface-secondary mb-2">
          Base URL {/* TODO: i18n */}
        </label>
        <input
          type="url"
          value={baseURL}
          onChange={e => setBaseURL(e.target.value)}
          placeholder="http://localhost:11434/v1" // TODO: i18n
          className={`w-full px-3 py-2 border rounded-lg bg-input-bg focus:ring-2 focus:ring-accent outline-none font-mono text-sm ${
            errors.baseURL ? 'border-danger' : 'border-input-border'
          }`}
          disabled={isSubmitting}
        />
        {errors.baseURL && (
          <p className="mt-1 text-xs text-danger-text">{errors.baseURL}</p>
        )}
        <p className="mt-1 text-xs text-on-surface-muted">
          Must use HTTPS or localhost {/* TODO: i18n */}
        </p>
      </div>

      {/* Default Model */}
      <div>
        <label className="block text-sm font-medium text-on-surface-secondary mb-2">
          Default Model {/* TODO: i18n */}
        </label>
        <input
          type="text"
          value={defaultModel}
          onChange={e => setDefaultModel(e.target.value)}
          placeholder="llama3.2" // TODO: i18n
          className={`w-full px-3 py-2 border rounded-lg bg-input-bg focus:ring-2 focus:ring-accent outline-none font-mono text-sm ${
            errors.defaultModel ? 'border-danger' : 'border-input-border'
          }`}
          disabled={isSubmitting}
        />
        {errors.defaultModel && (
          <p className="mt-1 text-xs text-danger-text">{errors.defaultModel}</p>
        )}
      </div>

      {/* API Key (optional) */}
      <div>
        <label className="block text-sm font-medium text-on-surface-secondary mb-2">
          {t.settings.apiKey} <span className="text-on-surface-muted">(optional)</span> {/* TODO: i18n "optional" */}
        </label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={e => setApiKeyState(e.target.value)}
            placeholder="Optional for localhost providers" // TODO: i18n
            className="w-full px-3 py-2 pr-20 border border-input-border rounded-lg bg-input-bg focus:ring-2 focus:ring-accent outline-none font-mono text-sm"
            disabled={isSubmitting}
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-on-surface-muted hover:text-on-surface-secondary"
          >
            {showKey ? t.settings.hideKey : t.settings.showKey}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-on-surface-secondary hover:bg-surface-alt rounded-lg"
          disabled={isSubmitting}
        >
          {t.action.cancel}
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !name.trim() || !baseURL.trim() || !defaultModel.trim()}
          className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? t.settings.loading : (editProvider ? 'Save Changes' : 'Add Provider')} {/* TODO: i18n */}
        </button>
      </div>
    </form>
  );
}
