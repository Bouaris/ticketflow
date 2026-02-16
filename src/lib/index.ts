/**
 * Lib Module - Barrel Export
 *
 * Centralise toutes les fonctions utilitaires de l'application.
 */

// Parser
export { parseBacklog, getAllItems, getItemsByType } from './parser';

// Serializer
export { serializeBacklog, updateItem, toggleCriterion } from './serializer';

// AI
export type { AIProvider, RefinementResult, GenerateItemResult } from './ai';
export {
  getProvider,
  setProvider,
  getApiKey,
  setApiKey,
  clearApiKey,
  hasApiKey,
  getClientConfig,
  resetClient,
  refineItem,
  generateItemFromDescription,
  suggestImprovements,
} from './ai';

// File System (Web)
export {
  isFileSystemAccessSupported,
  openMarkdownFile,
  readFile,
  saveFile,
  saveAsMarkdownFile,
  getFileName,
  storeHandle,
  getStoredHandle,
  clearStoredHandle,
  verifyPermission,
} from './fileSystem';

// Tauri Bridge
export {
  isTauri,
  openMarkdownFileDialog,
  saveMarkdownFileDialog,
  readTextFileContents,
  writeTextFileContents,
  fileExists,
  getFileNameFromPath,
  getDirFromPath,
  readImageAsBase64,
  writeImageFromBase64,
  openFolderDialog,
  openExternalUrl,
  setupExternalLinkHandler,
  listMarkdownFiles,
  getFolderName,
  joinPath,
} from './tauri-bridge';

// AI Provider Registry
export {
  BUILT_IN_PROVIDERS,
  getAllProviders,
  getProviderById,
  addCustomProvider,
  removeCustomProvider,
  validateCustomProvider,
  isBuiltInProvider,
} from './ai-provider-registry';

// Screenshots
export type { ScreenshotInfo } from './screenshots';
export {
  ASSETS_FOLDER_NAME,
  SCREENSHOTS_FOLDER_NAME,
  generateScreenshotFilename,
  parseScreenshotFilename,
  getScreenshotMarkdownRef,
  getScreenshotsFolder,
  saveScreenshot,
  readScreenshot,
  deleteScreenshot,
  deleteScreenshotsForTicket,
  listScreenshotsForTicket,
  convertToPng,
  extractImageFromClipboard,
  isValidImageFile,
  isDirectoryPickerSupported,
} from './screenshots';
