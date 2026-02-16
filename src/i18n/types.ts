/**
 * i18n Type Definitions
 *
 * Defines the Translations interface that both locale files must implement.
 * TypeScript enforces completeness at build time: if a key is missing in
 * any locale file, the build will fail.
 *
 * @module i18n/types
 */

/** Supported locale codes */
export type Locale = 'fr' | 'en';

/** List of supported locales with display labels */
export const SUPPORTED_LOCALES: { code: Locale; label: string }[] = [
  { code: 'fr', label: 'Francais' },
  { code: 'en', label: 'English' },
];

/**
 * Complete translations interface.
 *
 * Every key defined here MUST be present in both fr.ts and en.ts.
 * TypeScript will produce a build error if any key is missing.
 */
export interface Translations {
  // -- App ----------------------------------------------------------
  app: {
    name: string;
    browserNotSupported: string;
    downloadChrome: string;
  };

  // -- Navigation & Views -------------------------------------------
  nav: {
    kanban: string;
    list: string;
    graph: string;
    dashboard: string;
    archive: string;
    search: string;
    home: string;
  };

  // -- Settings -----------------------------------------------------
  settings: {
    title: string;
    language: string;
    aiProvider: string;
    aiProviderDefault: string;
    apiKey: string;
    getKeyAt: string;
    showKey: string;
    hideKey: string;
    save: string;
    saved: string;
    cancel: string;
    clearKey: string;
    questioningMode: string;
    questioningModeDesc: string;
    aiLearning: string;
    aiLearningDesc: string;
    noFeedback: string;
    needMoreFeedback: string;
    improving: string;
    stable: string;
    declining: string;
    evaluations: string;
    maintenance: string;
    maintenanceDesc: string;
    analyze: string;
    loading: string;
    data: string;
    exportDesc: string;
    export: string;
    exporting: string;
    exportSuccess: string;
    exportFailed: string;
    backups: string;
    backupsDesc: string;
    createBackup: string;
    backupCreated: string;
    backupFailed: string;
    restoreBackup: string;
    restoreConfirm: string;
    restoreSuccess: string;
    restoreFailed: string;
    confirm: string;
    noBackups: string;
    contextFiles: string;
    contextFilesDesc: string;
    noContextFiles: string;
    addFile: string;
    contextFilesHint: string;
    updates: string;
    updatesDesc: string;
    checkUpdates: string;
    checking: string;
    upToDate: string;
    changelog: string;
    changelogDesc: string;
    theme: string;
    themeDesc: string;
    themeLight: string;
    themeDark: string;
    themeSystem: string;
    appSettings: string;
    aiSettings: string;
    providers: string;
    customProviders: string;
    addProvider: string;
    editProvider: string;
    deleteProvider: string;
    deleteProviderConfirm: string;
    providerName: string;
    endpointURL: string;
    endpointHint: string;
    defaultModel: string;
    apiKeyOptional: string;
    apiKeyHintLocal: string;
    providerConfigured: string;
    providerNotConfigured: string;
    noCustomProviders: string;
    providerAdded: string;
    providerDeleted: string;
    saveProvider: string;
    testConnection: string;
    testing: string;
    connectionSuccess: string;
    healthErrorAuth: string;
    healthErrorRateLimit: string;
    healthErrorTimeout: string;
    healthErrorNetwork: string;
    healthErrorUnknown: string;
    groqDescription: string;
    geminiDescription: string;
    openaiDescription: string;
    geminiRecommended: string;
  };

  // -- Severity Labels ----------------------------------------------
  severity: {
    P0: string;
    P1: string;
    P2: string;
    P3: string;
    P4: string;
  };

  severityFull: {
    P0: string;
    P1: string;
    P2: string;
    P3: string;
    P4: string;
  };

  // -- Priority Labels ----------------------------------------------
  priority: {
    Haute: string;
    Moyenne: string;
    Faible: string;
  };

  // -- Effort Labels ------------------------------------------------
  effort: {
    XS: string;
    S: string;
    M: string;
    L: string;
    XL: string;
  };

  effortShort: {
    XS: string;
    S: string;
    M: string;
    L: string;
    XL: string;
  };

  // -- Type Labels (legacy fallback) --------------------------------
  types: {
    BUG: string;
    CT: string;
    LT: string;
    AUTRE: string;
  };

  // -- Confirmations ------------------------------------------------
  confirm: {
    unsavedChanges: string;
    deleteItem: string;
    applySuggestions: string;
    removeProject: string;
    quitWithoutSaving: string;
    quitWithoutSavingDesc: string;
    quitWithoutSavingHome: string;
    quit: string;
  };

  // -- Validation ---------------------------------------------------
  validation: {
    idRequired: string;
    idExists: string;
    titleRequired: string;
    typeExists: string;
    minOneType: string;
  };

  // -- Placeholders -------------------------------------------------
  placeholder: {
    title: string;
    description: string;
    userStory: string;
    search: string;
    spec: string;
    dependency: string;
    constraint: string;
    searchTicket: string;
    addElement: string;
    reproductionStep: string;
    detailedDescription: string;
    criterion: string;
  };

  // -- Errors -------------------------------------------------------
  error: {
    fileNotFound: string;
    permissionDenied: string;
    parseError: string;
    saveError: string;
    tauriRequired: string;
    apiConfigMissing: string;
    unknown: string;
    generationFailed: string;
    analysisError: string;
    deletionFailed: string;
    archivingFailed: string;
    restorationFailed: string;
    purgeFailed: string;
    refinementError: string;
    correctionError: string;
    relationLoadError: string;
    relationAddError: string;
    relationDeleteError: string;
    folderOpenError: string;
    projectLoadError: string;
    fileCreationError: string;
    updateCheckError: string;
    updateInstallError: string;
    saveFailed: string;
    questioningStartError: string;
    questioningConversationError: string;
    clipboardError: string;
    importFailed: string;
    noFileOpen: string;
  };

  // -- Editor Fields ------------------------------------------------
  editor: {
    create: string;
    edit: string;
    id: string;
    title: string;
    type: string;
    severity: string;
    priority: string;
    effort: string;
    component: string;
    module: string;
    description: string;
    userStory: string;
    specs: string;
    reproduction: string;
    criteria: string;
    dependencies: string;
    constraints: string;
    screens: string;
    screenshots: string;
    addCriterion: string;
    removeCriterion: string;
    creationModeAI: string;
    creationModeTemplates: string;
    creationModeManual: string;
    cancelGeneration: string;
    newTicket: string;
    createWithAI: string;
    newItem: string;
    editItem: string;
    modeSelection: string;
    aiModeDesc: string;
    reviewDesc: string;
    editDesc: string;
    noCriteria: string;
    addFirstCriterion: string;
    generateDirectly: string;
    generateTicket: string;
    reproductionSteps: string;
    general: string;
    details: string;
    captures: string;
    notDefined: string;
    notDefinedF: string;
    affectedComponent: string;
    relatedModule: string;
    verifyBeforeCreate: string;
    lastModification: string;
    saving: string;
    errorPrefix: string;
  };

  // -- Actions ------------------------------------------------------
  action: {
    add: string;
    edit: string;
    delete: string;
    save: string;
    cancel: string;
    close: string;
    generate: string;
    regenerate: string;
    apply: string;
    undo: string;
    redo: string;
    duplicate: string;
    moveUp: string;
    moveDown: string;
    refresh: string;
    openFile: string;
    loadStored: string;
    refine: string;
    import: string;
  };

  // -- Dashboard ----------------------------------------------------
  dashboard: {
    title: string;
    totalItems: string;
    byType: string;
    bySeverity: string;
    byPriority: string;
    byEffort: string;
    completionRate: string;
    recentActivity: string;
  };

  // -- AI -----------------------------------------------------------
  ai: {
    generate: string;
    generating: string;
    suggestions: string;
    apply: string;
    reject: string;
    refine: string;
    noSuggestions: string;
    error: string;
    questioningTitle: string;
    answerPlaceholder: string;
    send: string;
    skip: string;
    describeIdea: string;
    describeIdeaDesc: string;
    generateWith: string;
    createManually: string;
    aiMode: string;
    refineWith: string;
    refineTitle: string;
    refining: string;
    refineAnalyzing: string;
    additionalInstructions: string;
    currentItem: string;
    proposedChanges: string;
    noSignificantChanges: string;
    acceptChanges: string;
    retry: string;
    instructionExamples: string;
    recapTitle: string;
    recapQuestion: string;
    readyToGenerate: string;
    analyzing: string;
    confidence: string;
    correct: string;
    attachedCaptures: string;
    pasteHint: string;
    examples: string;
    promptPlaceholder: string;
    exampleBug: string;
    exampleFeature: string;
    exampleApi: string;
    configureApiKey: string;
    describeWhatToCreate: string;
    progressAnalyzing: string;
    progressGenerating: string;
    progressFinalizing: string;
    generationFailed: string;
    generationCancelled: string;
  };

  // -- Palette ------------------------------------------------------
  palette: {
    title: string;
    placeholder: string;
    noResults: string;
    recentItems: string;
    categories: {
      item: string;
      command: string;
      view: string;
      ai: string;
      recent: string;
    };
    nlCreate: string;
    nlView: string;
    nlNoMatch: string;
  };

  // -- Chat IA ------------------------------------------------------
  chat: {
    title: string;
    placeholder: string;
    send: string;
    clear: string;
    clearConfirm: string;
    emptyState: string;
    errorGeneric: string;
    errorNoKey: string;
    insights: string;
    actionConfirm: string;
    actionFailed: string;
    suggestedPrompts: {
      bugsOverview: string;
      priorities: string;
      effortSummary: string;
      blockers: string;
      noCriteria: string;
    };
  };

  // -- Quick Capture ------------------------------------------------
  capture: {
    title: string;
    titlePlaceholder: string;
    typePlaceholder: string;
    priorityPlaceholder: string;
    submit: string;
    cancel: string;
    created: string;
    clickToClose: string;
  };

  // -- Bulk Import Wizard --------------------------------------------
  bulkImport: {
    title: string;
    // Step labels
    stepInput: string;
    stepProcessing: string;
    stepReview: string;
    stepConfirm: string;
    // Input step
    inputPlaceholder: string;
    inputHint: string;
    imageUploadLabel: string;
    imageUploadHint: string;
    imageUploadDragActive: string;
    imageProviderWarning: string;
    // Processing step
    processingTitle: string;
    processingDescription: string;
    processingProgress: string;
    cancelExtraction: string;
    // Review step
    reviewTitle: string;
    reviewDescription: string;
    selectAll: string;
    deselectAll: string;
    selectedCount: string;
    confidenceLabel: string;
    lowConfidence: string;
    // Confirm step
    confirmTitle: string;
    confirmDescription: string;
    confirmAutoRoute: string;
    confirmButton: string;
    creating: string;
    created: string;
    // Errors
    errorEmpty: string;
    errorNoText: string;
    errorFailed: string;
    // Action buttons
    extract: string;
    back: string;
    next: string;
  };

  // -- Onboarding ---------------------------------------------------
  onboarding: {
    welcome: {
      title: string;
      description: string;
    };
    theme: {
      title: string;
      description: string;
      light: string;
      dark: string;
      system: string;
    };
    language: {
      title: string;
      description: string;
    };
    aiSetup: {
      title: string;
      description: string;
      providerLabel: string;
      apiKeyLabel: string;
      apiKeyPlaceholder: string;
      showKey: string;
      hideKey: string;
      recommended: string;
      freeTier: string;
      freeTierNote: string;
      geminiDesc: string;
      groqDesc: string;
      openaiDesc: string;
      getApiKey: string;
      skipForNow: string;
      saveAndContinue: string;
      saved: string;
      configureInSettings: string;
    };
    gsdInfo: {
      title: string;
      description: string;
      feature1Title: string;
      feature1Desc: string;
      feature2Title: string;
      feature2Desc: string;
      feature3Title: string;
      feature3Desc: string;
      activateInSettings: string;
    };
    shortcuts: {
      title: string;
      description: string;
    };
    ready: {
      title: string;
      description: string;
      cta: string;
    };
    navigation: {
      next: string;
      back: string;
      skip: string;
      stepOf: string;
    };
  };

  // -- Saved Views --------------------------------------------------
  views: {
    title: string;
    all: string;
    criticalBugs: string;
    inProgress: string;
    toDo: string;
    saveView: string;
    savedViews: string;
    defaultViews: string;
    viewNamePlaceholder: string;
    deleteView: string;
    applyView: string;
    noSavedViews: string;
  };

  // -- Feature Tooltips ---------------------------------------------
  featureTooltips: {
    commandPalette: string;
    chatPanel: string;
    inlineEdit: string;
    dragDrop: string;
  };

  // -- Quick Actions ------------------------------------------------
  quickActions: {
    delete: string;
    deleteConfirmTitle: string;
    deleteConfirmMessage: string;
    validate: string;
    validateToast: string;
    unvalidate: string;
    unvalidateToast: string;
    export: string;
    exportToast: string;
    archive: string;
    archiveToast: string;
  };

  // -- Markdown -----------------------------------------------------
  markdown: {
    raw: string;
    rendered: string;
    toggle: string;
  };

  // -- Archive ------------------------------------------------------
  archive: {
    tab: string;
    title: string;
    emptyState: string;
    archivedAt: string;
    restore: string;
    deletePermanently: string;
    restoreConfirm: string;
    deleteConfirm: string;
    searchPlaceholder: string;
    itemCount: string;
    purge: string;
    purgeConfirm: string;
    purgeSuccess: string;
  };

  // -- GSD Integration ----------------------------------------------
  gsd: {
    title: string;
    description: string;
    enabled: string;
    disabled: string;
    level: string;
    levelEssential: string;
    levelEssentialDesc: string;
    levelComplete: string;
    levelCompleteDesc: string;
    detectedFiles: string;
    noFilesDetected: string;
    noPlanningDir: string;
    tokenBudget: string;
  };

  // -- Relations ----------------------------------------------------
  relations: {
    title: string;
    add: string;
    loading: string;
    deleteRelation: string;
    noRelations: string;
    noTicketFound: string;
    searchPlaceholder: string;
  };

  // -- Empty States -------------------------------------------------
  empty: {
    noItems: string;
    noTickets: string;
    noData: string;
    noRelations: string;
    noWhatsNew: string;
    noFileFound: string;
    none: string;
    noneF: string;
  };

  // -- Templates ----------------------------------------------------
  templates: {
    createFromTemplate: string;
    createEmpty: string;
    chooseOrCreate: string;
    emptyFormDesc: string;
    bugReportDesc: string;
    featureRequestDesc: string;
    technicalDebtDesc: string;
  };

  // -- Maintenance --------------------------------------------------
  maintenance: {
    title: string;
    analyzeTitle: string;
    analyzeDesc: string;
    startAnalysis: string;
    analysisError: string;
    noProblems: string;
    noProblemsDesc: string;
    correctionError: string;
    analyzing: string;
    analyzingDesc: string;
    problems: string;
    fix: string;
    fixing: string;
    fixApply: string;
    fixReady: string;
    fixReadyDesc: string;
    applied: string;
    location: string;
    correction: string;
  };

  // -- Shortcuts ----------------------------------------------------
  shortcuts: {
    newItem: string;
    search: string;
    closePanel: string;
    navigateUp: string;
    navigateDown: string;
    commandPalette: string;
    chatPanel: string;
    quickCapture: string;
    bulkImport: string;
    showHelp: string;
    editItem: string;
    deleteItem: string;
    archiveItem: string;
    undo: string;
    redo: string;
    selectAll: string;
    cyclePriority: string;
    cycleEffort: string;
    viewKanban: string;
    viewList: string;
    viewGraph: string;
    viewDashboard: string;
    categories: {
      navigation: string;
      editing: string;
      quickActions: string;
      display: string;
    };
    deleteKey: string;
    backspaceKey: string;
    enterKey: string;
    spaceKey: string;
  };

  // -- Welcome ------------------------------------------------------
  welcome: {
    newProject: string;
    openFolder: string;
    openAnotherFile: string;
    openFile: string;
    projectNotFound: string;
    showLess: string;
    showMore: string;
    removeFromList: string;
    fileCreationError: string;
    recentProjects: string;
    backlogManager: string;
    backlogManagerDesc: string;
    emptyStateDesc: string;
    emptyStateHint: string;
    notFoundDesc: string;
    customizeTypes: string;
    newTicketflowProject: string;
    noFileFoundInFolder: string;
    filePreview: string;
    fileCreatedAt: string;
    createProject: string;
    notFound: string;
    openNewProject: string;
    favorites: string;
    addToFavorites: string;
    removeFromFavorites: string;
  };

  // -- Export -------------------------------------------------------
  export: {
    title: string;
    copy: string;
    copied: string;
    copyToClipboard: string;
    copyFailed: string;
    closeExport: string;
  };

  // -- Filter -------------------------------------------------------
  filter: {
    byType: string;
    byLabel: string;
  };

  // -- What's New ---------------------------------------------------
  whatsNew: {
    title: string;
    noNews: string;
  };

  // -- Type Config --------------------------------------------------
  typeConfig: {
    title: string;
    configure: string;
    configureDesc: string;
    autoSaved: string;
    clickToEdit: string;
    codeNotEditable: string;
    typeName: string;
    configureTicketTypes: string;
  };

  // -- Bulk ---------------------------------------------------------
  bulk: {
    deleteSelected: string;
    archiveSelected: string;
    selectedCount: string;
    deselectAll: string;
    noPriority: string;
    noEffort: string;
  };

  // -- Update -------------------------------------------------------
  update: {
    available: string;
    downloading: string;
    installing: string;
    installError: string;
    checkError: string;
  };

  // -- Detail Panel -------------------------------------------------
  detail: {
    completed: string;
    editButton: string;
    archiveButton: string;
    deleteButton: string;
    refineWithAI: string;
    exportTicket: string;
    closePanel: string;
    progress: string;
    criteriaCompleted: string;
  };

  // -- Screenshot ---------------------------------------------------
  screenshot: {
    title: string;
    permissionRequired: string;
    permissionDesc: string;
    authorize: string;
    authorizing: string;
    dropImages: string;
    pasteHint: string;
    deleteCapture: string;
    notAvailable: string;
    notAvailableDesc: string;
    saving: string;
    importButton: string;
  };

  // -- Common -------------------------------------------------------
  common: {
    yes: string;
    no: string;
    ok: string;
    items: string;
    item: string;
    noItems: string;
    loadingDots: string;
    project: string;
    projects: string;
    parameters: string;
    version: string;
    news: string;
    configureTypes: string;
    confirm: string;
    restoring: string;
    deleteCapture: string;
    aiAnalysis: string;
    createNewItem: string;
  };

  // -- AI Analysis Panel --------------------------------------------
  aiAnalysis: {
    itemsToAnalyze: string;
    refreshAnalysis: string;
    smartAnalysis: string;
    smartAnalysisDesc: string;
    analyzingWait: string;
    retry: string;
    cachedResults: string;
    analyzedAt: string;
    blockingBugs: string;
    highPriority: string;
    moreItems: string;
    clearAnalysis: string;
    analyzeWithAI: string;
    analyzing: string;
    analyzingProgress: string;
    justNow: string;
    minutesAgo: string;
    hoursAgo: string;
  };

  // -- AI Feedback Widget -------------------------------------------
  aiFeedback: {
    thankYou: string;
    rateGeneration: string;
    starLabel: string;
    improvePlaceholder: string;
    submit: string;
  };

  // -- Provider Toggle ----------------------------------------------
  providerToggle: {
    use: string;
    notConfigured: string;
  };

  // -- AI Errors (for non-React code) -------------------------------
  aiErrors: {
    apiKeyNotConfigured: string;
    rateLimitReached: string;
    invalidApiKey: string;
    accessDenied: string;
    invalidResponse: string;
    invalidResponseFormat: string;
    correctedFileInvalid: string;
    correctionError: string;
    noValidResult: string;
    noItemsToAnalyze: string;
    unknownError: string;
    noDbToBackup: string;
    customTypeDesc: string;
    screenshotsAttached: string;
    truncatedContent: string;
    providerNoVision: string;
    tokenLimitExceeded: string;
    bulkExtractionEmpty: string;
    bulkExtractionFailed: string;
  };
}
