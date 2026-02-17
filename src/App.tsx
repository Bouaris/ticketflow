/**
 * Backlog Manager App
 *
 * Application principale pour gerer le Product Backlog.
 *
 * State Isolation Architecture:
 * - App.tsx: Global state (settings, file access, type config)
 * - ProjectWorkspace: Project-specific state (backlog, AI suggestions)
 *
 * The key={projectPath} pattern on ProjectWorkspace forces React to
 * completely destroy and recreate the component when projects change,
 * guaranteeing no state leakage between projects.
 */

import { useState, useCallback, useEffect } from 'react';
import { useFileAccess } from './hooks/useFileAccess';
import { useScreenshotFolder } from './hooks/useScreenshotFolder';
import { useTauriScreenshots } from './hooks/useTauriScreenshots';
import { useTypeConfig } from './hooks/useTypeConfig';
import { useUpdater } from './hooks/useUpdater';
import { AppSettingsModal } from './components/settings/AppSettingsModal';
import { AISettingsModal } from './components/settings/AISettingsModal';
import { TypeConfigModal } from './components/settings/TypeConfigModal';
import { ProjectSettingsModal } from './components/settings/ProjectSettingsModal';
import { WelcomePage } from './components/welcome/WelcomePage';
import { WelcomeScreen } from './components/welcome/WelcomeScreen';
import { ProjectWorkspace } from './components/workspace/ProjectWorkspace';
import { initSecureStorage } from './lib/ai';
import type { TypeDefinition } from './types/typeConfig';
import { isFileSystemAccessSupported } from './lib/fileSystem';
import { isTauri, getDirFromPath, getFolderName, forceQuit, listenTrayQuitRequested } from './lib/tauri-bridge';
import { UpdateModal } from './components/ui/UpdateModal';
import { WhatsNewModal } from './components/ui/WhatsNewModal';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { shouldShowWhatsNew, getLastSeenVersion } from './lib/changelog';
import { APP_VERSION } from './lib/version';
import { SettingsIcon } from './components/ui/Icons';
import { useOnboarding } from './hooks/useOnboarding';
import { OnboardingWizard } from './components/onboarding/OnboardingWizard';
import { QuickCaptureApp } from './components/capture/QuickCapture';
import { ConsentDialog } from './components/consent/ConsentDialog';
import { getConsentState, setConsentState, shouldPromptConsent, incrementDismissCount, initTelemetry, track } from './lib/telemetry';

function App() {
  // ============================================================
  // WINDOW MODE DETECTION (must be before any hooks)
  // ============================================================

  // Secondary window: quick-capture renders a minimal standalone form
  const windowMode = new URLSearchParams(window.location.search).get('window');
  if (windowMode === 'quick-capture') {
    return <QuickCaptureApp />;
  }

  // ============================================================
  // GLOBAL HOOKS (persist across project switches)
  // ============================================================

  // File access - handles persist across projects
  const fileAccess = useFileAccess();

  // Type configuration (dynamic types) - manages projectPath
  const typeConfig = useTypeConfig();

  // Screenshot folder - folder handles persist across projects
  // In Tauri mode: use direct FS access (no permission dialogs)
  // In Web mode: use File System Access API
  const webScreenshotFolder = useScreenshotFolder();
  const tauriScreenshots = useTauriScreenshots(
    isTauri() ? typeConfig.projectPath : null
  );
  const screenshotFolder = isTauri() ? tauriScreenshots : webScreenshotFolder;

  // Auto-updater (Tauri only) - app-level
  const updater = useUpdater();

  // Onboarding - first-run wizard (global, not per-project)
  const onboarding = useOnboarding();

  // ============================================================
  // GLOBAL UI STATE (persist across project switches)
  // ============================================================

  const [isAppSettingsOpen, setIsAppSettingsOpen] = useState(false);
  const [isAISettingsOpen, setIsAISettingsOpen] = useState(false);
  const [isTypeConfigOpen, setIsTypeConfigOpen] = useState(false);
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);

  // Telemetry consent dialog state
  const [showConsent, setShowConsent] = useState(false);

  // What's New modal state
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [whatsNewSinceVersion, setWhatsNewSinceVersion] = useState<string | null>(null);

  // ============================================================
  // INITIALIZATION EFFECTS
  // ============================================================

  // Initialize secure storage for API keys on startup
  useEffect(() => {
    initSecureStorage();
  }, []);

  // Check if we should show What's New modal after update
  useEffect(() => {
    if (shouldShowWhatsNew(APP_VERSION)) {
      const lastSeen = getLastSeenVersion();
      setWhatsNewSinceVersion(lastSeen);
      setShowWhatsNew(true);
    }
  }, []);

  // Telemetry: check consent state on startup
  useEffect(() => {
    const consent = getConsentState();
    if (consent === 'granted') {
      // Previously accepted — initialize telemetry and fire app_launched
      initTelemetry();
      track('app_launched');
    } else if (consent === null && shouldPromptConsent()) {
      // First launch or one previous dismiss — show consent dialog
      setShowConsent(true);
    }
    // consent === 'declined' or dismissed twice: do nothing
  }, []);

  // Update window title based on project
  useEffect(() => {
    const projectPath = typeConfig.projectPath;

    if (projectPath) {
      const projectName = getFolderName(projectPath);
      document.title = `Ticketflow - ${projectName}`;
    } else {
      document.title = 'Ticketflow';
    }
  }, [typeConfig.projectPath]);

  // Tray quit listener (Tauri only)
  useEffect(() => {
    if (!isTauri()) return;

    let unlisten: (() => void) | undefined;

    listenTrayQuitRequested(() => {
      forceQuit();
    }).then(fn => { unlisten = fn; });

    return () => { unlisten?.(); };
  }, []);

  // ============================================================
  // TELEMETRY CONSENT HANDLERS
  // ============================================================

  const handleConsentAccept = useCallback(() => {
    setConsentState('granted');
    setShowConsent(false);
    initTelemetry();
    track('consent_granted');
    track('app_launched');
  }, []);

  const handleConsentDecline = useCallback(() => {
    setConsentState('declined');
    setShowConsent(false);
  }, []);

  const handleConsentDismiss = useCallback(() => {
    incrementDismissCount();
    setShowConsent(false);
    // On next launch, shouldPromptConsent() will check dismiss count
    // and show again if count <= 1, otherwise treat as permanent decline
  }, []);

  // ============================================================
  // PROJECT NAVIGATION HANDLERS
  // ============================================================

  // Handle file open
  const handleOpenFile = useCallback(async () => {
    const content = await fileAccess.openFile();
    if (content && fileAccess.filePath) {
      const projectDir = getDirFromPath(fileAccess.filePath);
      // Don't detect from markdown — SQLite is the source of truth.
      typeConfig.initializeForProject(projectDir);
      setShowWelcome(false);
    }
  }, [fileAccess, typeConfig]);

  // Handle project selection from WelcomePage
  const handleProjectSelect = useCallback(async (projectPath: string, _backlogFile: string, types?: TypeDefinition[]) => {
    if (types && types.length > 0) {
      typeConfig.initializeWithTypes(projectPath, types);
      track('project_created');
    } else {
      // Don't detect from markdown — SQLite is the source of truth.
      // ProjectWorkspace Step 1 will load types from SQLite via backlog.typeConfigs.
      typeConfig.initializeForProject(projectPath);
    }
    setShowWelcome(false);
  }, [typeConfig]);

  // Handle go home (return to welcome page)
  const handleGoHome = useCallback(() => {
    fileAccess.closeFile();
    setShowWelcome(true);
  }, [fileAccess]);

  // Handle load stored file
  const handleLoadStoredFile = useCallback(async () => {
    const content = await fileAccess.loadStoredFile();
    if (content && fileAccess.filePath) {
      const projectDir = getDirFromPath(fileAccess.filePath);
      // Don't detect from markdown — SQLite is the source of truth.
      typeConfig.initializeForProject(projectDir);
      setShowWelcome(false);
    }
  }, [fileAccess, typeConfig]);

  // ============================================================
  // TYPE CONFIG HANDLERS (for global modal)
  // ============================================================

  // Handle type config save - just updates type config
  // Note: Section creation is handled by ProjectWorkspace when it receives type changes
  const handleTypeConfigSave = useCallback((newTypes: TypeDefinition[]) => {
    typeConfig.setTypes(newTypes);
  }, [typeConfig]);

  // Handle type deletion
  const handleDeleteType = useCallback((typeId: string) => {
    typeConfig.removeTypeById(typeId);
  }, [typeConfig]);

  // ============================================================
  // BROWSER SUPPORT CHECK
  // ============================================================

  if (!isFileSystemAccessSupported()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-alt p-8">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-on-surface mb-4">
            Navigateur non supporte
          </h1>
          <p className="text-on-surface-secondary mb-6">
            Cette application utilise l'API File System Access qui n'est disponible que sur Chrome et Edge.
          </p>
          <a
            href="https://www.google.com/chrome/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent-hover"
          >
            Telecharger Chrome
          </a>
        </div>
      </div>
    );
  }

  // ============================================================
  // ONBOARDING CHECK (first-run only)
  // ============================================================

  if (!onboarding.isLoading && !onboarding.isComplete) {
    return (
      <div className="min-h-screen bg-surface-alt">
        <OnboardingWizard onComplete={onboarding.markComplete} />
      </div>
    );
  }

  // ============================================================
  // RENDER LOGIC
  // ============================================================

  const shouldShowWelcome = showWelcome || !typeConfig.projectPath;
  const shouldShowTauriWelcome = shouldShowWelcome && isTauri();

  return (
    <ErrorBoundary>
    <div className="min-h-screen flex flex-col bg-surface-alt">
      {/* Settings FAB - Only visible on web welcome screen (not Tauri, not in project) */}
      {!shouldShowTauriWelcome && shouldShowWelcome && (
        <div className="fixed bottom-4 right-4 z-30">
          <button
            onClick={() => setIsAppSettingsOpen(true)}
            className="relative p-3 bg-surface rounded-full shadow-lg dark:shadow-none dark:ring-1 dark:ring-outline hover:shadow-xl transition-shadow"
            title="Parametres"
          >
            <SettingsIcon className="w-5 h-5 text-on-surface-secondary" />
            {/* Badge notification: update dismissed but available */}
            {updater.dismissed && updater.available && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full ring-2 ring-white animate-pulse" />
            )}
          </button>
        </div>
      )}

      {/* Main content */}
      {shouldShowWelcome ? (
        shouldShowTauriWelcome ? (
          <WelcomePage onProjectSelect={handleProjectSelect} />
        ) : (
          <WelcomeScreen
            onOpenFile={handleOpenFile}
            onLoadStored={handleLoadStoredFile}
            hasStoredHandle={fileAccess.hasStoredHandle}
          />
        )
      ) : typeConfig.projectPath ? (
        /**
         * CRITICAL: key={projectPath} forces complete remount on project change
         * This guarantees all project-specific state is destroyed and recreated fresh
         */
        <ProjectWorkspace
          key={typeConfig.projectPath}
          projectPath={typeConfig.projectPath}
          typeConfig={typeConfig}
          screenshotFolder={screenshotFolder}
          onOpenTypeConfig={() => setIsTypeConfigOpen(true)}
          onOpenProjectSettings={() => setIsProjectSettingsOpen(true)}
          onOpenSettings={() => setIsAppSettingsOpen(true)}
          onOpenAISettings={() => setIsAISettingsOpen(true)}
          onGoHome={isTauri() ? handleGoHome : undefined}
          showUpdateBadge={updater.dismissed && !!updater.available}
        />
      ) : null}

      {/* Error display */}
      {fileAccess.error && (
        <div className="fixed bottom-4 left-4 right-24 bg-danger-soft border border-danger text-danger-text px-4 py-3 rounded-lg z-[100]">
          {fileAccess.error}
        </div>
      )}

      {/* ============================================================ */}
      {/* GLOBAL MODALS (persist across project switches) */}
      {/* ============================================================ */}

      {/* App Settings modal */}
      <AppSettingsModal
        isOpen={isAppSettingsOpen}
        onClose={() => setIsAppSettingsOpen(false)}
        updater={updater}
        projectPath={typeConfig.projectPath || undefined}
      />

      {/* AI Settings modal */}
      <AISettingsModal
        isOpen={isAISettingsOpen}
        onClose={() => setIsAISettingsOpen(false)}
        projectPath={typeConfig.projectPath || undefined}
      />

      {/* Type Config modal */}
      <TypeConfigModal
        isOpen={isTypeConfigOpen}
        types={typeConfig.sortedTypes}
        onSave={handleTypeConfigSave}
        onDeleteType={handleDeleteType}
        onCancel={() => setIsTypeConfigOpen(false)}
      />

      {/* Project Settings modal */}
      {typeConfig.projectPath && (
        <ProjectSettingsModal
          isOpen={isProjectSettingsOpen}
          onClose={() => setIsProjectSettingsOpen(false)}
          projectPath={typeConfig.projectPath}
          projectName={getFolderName(typeConfig.projectPath)}
          onOpenTypeConfig={() => setIsTypeConfigOpen(true)}
        />
      )}

      {/* Consent dialog (first-launch GDPR consent — before any telemetry) */}
      <ConsentDialog
        isOpen={showConsent}
        onAccept={handleConsentAccept}
        onDecline={handleConsentDecline}
        onDismiss={handleConsentDismiss}
      />

      {/* Update modal (Tauri only) */}
      <UpdateModal
        isOpen={updater.showModal}
        updateInfo={updater.available}
        downloading={updater.downloading}
        progress={updater.progress}
        error={updater.error}
        onInstall={updater.installUpdate}
        onDismiss={updater.dismissUpdate}
        onClearError={updater.clearError}
      />

      {/* What's New Modal */}
      <WhatsNewModal
        isOpen={showWhatsNew}
        onClose={() => setShowWhatsNew(false)}
        sinceVersion={whatsNewSinceVersion}
      />
    </div>
    </ErrorBoundary>
  );
}

export default App;
