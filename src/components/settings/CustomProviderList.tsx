/**
 * Custom Provider List - Manage custom OpenAI-compatible providers
 *
 * Lists custom providers with edit and delete actions.
 * Allows adding new providers via CustomProviderForm.
 */

import { useState, useEffect } from 'react';
import type { ProviderConfig } from '../../types/aiProvider';
import { loadCustomProviders, removeCustomProvider } from '../../lib/ai-provider-registry';
import { CustomProviderForm } from './CustomProviderForm';
import { PlusIcon, EditIcon, TrashIcon } from '../ui/Icons';
import { useTranslation } from '../../i18n';

export function CustomProviderList() {
  const { t } = useTranslation();
  const [customProviders, setCustomProviders] = useState<ProviderConfig[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ProviderConfig | undefined>(undefined);
  const [deleteConfirm, setDeleteConfirm] = useState<ProviderConfig | null>(null);

  // Load custom providers
  const loadProviders = () => {
    setCustomProviders(loadCustomProviders());
  };

  useEffect(() => {
    loadProviders();
  }, []);

  const handleAdd = () => {
    setEditingProvider(undefined);
    setShowForm(true);
  };

  const handleEdit = (provider: ProviderConfig) => {
    setEditingProvider(provider);
    setShowForm(true);
  };

  const handleDelete = (provider: ProviderConfig) => {
    setDeleteConfirm(provider);
  };

  const confirmDelete = () => {
    if (deleteConfirm) {
      removeCustomProvider(deleteConfirm.id);
      loadProviders();
      setDeleteConfirm(null);
    }
  };

  const handleFormSuccess = () => {
    loadProviders();
    setShowForm(false);
    setEditingProvider(undefined);
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingProvider(undefined);
  };

  // Show form if in add/edit mode
  if (showForm) {
    return (
      <div>
        <h3 className="text-sm font-medium text-on-surface-secondary mb-4">
          {editingProvider ? t.settings.editProvider : t.settings.addProvider}
        </h3>
        <CustomProviderForm
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
          editProvider={editingProvider}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with add button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-on-surface-secondary">
          {t.settings.customProviders}
        </h3>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-accent-text bg-accent-soft hover:bg-accent-soft/80 rounded-lg transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          {t.settings.addProvider}
        </button>
      </div>

      {/* Provider list */}
      {customProviders.length === 0 ? (
        <div className="text-center py-8 text-on-surface-muted">
          <p className="text-sm">
            {t.settings.noCustomProviders}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {customProviders.map((provider) => (
            <li
              key={provider.id}
              className="flex items-center justify-between p-3 bg-surface-alt rounded-lg hover:bg-surface-alt/80 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-on-surface-secondary truncate">
                  {provider.name}
                </p>
                <p className="text-xs text-on-surface-muted font-mono truncate">
                  {provider.baseURL}
                </p>
                <p className="text-xs text-on-surface-faint mt-0.5">
                  {t.settings.defaultModel}: {provider.defaultModel}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => handleEdit(provider)}
                  className="p-2 text-on-surface-muted hover:text-accent-text hover:bg-accent-soft rounded transition-colors"
                  aria-label={t.settings.editProvider}
                >
                  <EditIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(provider)}
                  className="p-2 text-on-surface-muted hover:text-danger-text hover:bg-danger-soft rounded transition-colors"
                  aria-label={t.settings.deleteProvider}
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="mt-4 p-3 bg-warning-soft border border-warning-text/30 rounded-lg">
          <p className="text-sm text-warning-text mb-3">
            {t.settings.deleteProviderConfirm}
          </p>
          <div className="flex gap-2">
            <button
              onClick={confirmDelete}
              className="px-3 py-1.5 text-sm bg-danger text-white rounded hover:bg-danger/90"
            >
              {t.action.delete}
            </button>
            <button
              onClick={() => setDeleteConfirm(null)}
              className="px-3 py-1.5 text-sm text-on-surface-secondary hover:bg-surface-alt rounded"
            >
              {t.action.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
