/**
 * BIDI RULE — Terminal-voice & identifier strings:
 * Protocol tokens, file names, agent identifiers, version numbers, and status
 * codes (e.g. "STATUS: DELIVERED ✓", "TLS 1.3", "secure_channel.sh") stay
 * English-LTR in both locales and are wrapped in a .bidi-ltr island when
 * rendered inside an RTL context.  Human-readable sentences localize fully.
 * Examples of what stays LTR:   "NODE_CONFIGURATION", "TRANSMIT", "STATUS: DELIVERED ✓"
 * Examples of what localizes:   form labels, section descriptions, human confirmations.
 */

export type CaseStudyIconKey = 'podcast' | 'dashboard' | 'globe' | 'map' | 'book' | 'controls' | 'credits' | 'link' | 'palette' | 'dice';

export interface CaseStudyContent {
  id: string;
  title: string;
  description: string;
  impact: string;
  tags: string[];
  icon: CaseStudyIconKey;
  tier?: 'featured' | 'compact';
  details?: {
    challenge: string;
    solution: string;
    architecture: string[];
    githubUrl?: string;
    liveUrl?: string;
  };
}

export interface SkillGroupContent {
  category: string;
  items: string[];
}

export interface AssistantSeedMessage {
  type: 'system' | 'agent';
  content: string;
  agentName?: string;
}

export interface AppDictionary {
  locale: {
    code: 'en' | 'he';
    direction: 'ltr' | 'rtl';
  };
  a11y: {
    openMenu: string;
    closeMenu: string;
    closeDialog: string;
    chatInput: string;
    sendMessage: string;
    openChat: string;
    themeToggle: string;
    skipToContent: string;
  };
  meta: {
    title: string;
    description: string;
  };
  navigation: {
    eyebrow: string;
    links: {
      practice: string;
      showcase: string;
    };
    contactCta: string;
  };
  hero: {
    name: string;
    rotatingWords: string[];
    statusLabels: string[];
    titlePrefix: string;
    subtitle: string;
    primaryCta: string;
    secondaryCta: string;
  };
  practice: {
    sectionMarker: string;
    title: string;
  };
  showcase: {
    sectionMarker: string;
    title: string;
    description: string;
    compactTitle: string;
    compactDescription: string;
    hint: string;
    orchestratorLabel: string;
    shippingLabel: string;
    drawerTitle: string;
    fields: {
      nodeId: string;
      status: string;
      deployed: string;
      projectName: string;
      description: string;
      challenge: string;
      solution: string;
      impact: string;
      dependencies: string;
    };
    actions: {
      liveSite: string;
      github: string;
    };
  };
  dossier: {
    sectionMarker: string;
    sectionLabel: string;
    availability: string;
    titleLines: [string, string];
    titleHighlight: string;
    description: string;
    stackLines: Array<{
      tag: string;
      stack: string;
    }>;
    resumeCta: string;
    resumeFile: string;
    resumeDownloadName: string;
    contact: {
      emailLabel: string;
      githubLabel: string;
      linkedinLabel: string;
      emailUrl: string;
      githubUrl: string;
      linkedinUrl: string;
    };
    terminalFileName: string;
    securityLabel: string;
    initLines: string[];
    progressLabels: {
      encrypting: string;
      transmitting: string;
      encryptingHint: string;
      transmittingHint: string;
    };
    success: {
      delivered: string;
      eta: string;
      title: string;
      description: string;
    };
    form: {
      nameLabel: string;
      emailLabel: string;
      messageLabel: string;
      namePlaceholder: string;
      emailPlaceholder: string;
      messagePlaceholder: string;
      submitLabel: string;
      errorPrefix: string;
      errors: {
        invalid_name: string;
        invalid_email: string;
        message_too_long: string;
        not_configured: string;
        send_failed: string;
        rate_limited: string;
        unknown: string;
      };
    };
  };
  assistant: {
    title: string;
    matrixTitle: string;
    quickPrompts: string[];
    initialMessages: AssistantSeedMessage[];
    clearedMessage: string;
    helpMessage: string;
    downloadMessage: string;
    matrixMessage: string;
    /** Transient status line shown only while waiting for the first streamed chunk. */
    analyzingMessage: string;
    /** Agent-bubble fallback when the portfolio-chat API fails or is unreachable. */
    errorMessage: string;
    /** Agent-bubble message when the per-IP rate limit trips (HTTP 429). */
    rateLimitMessage: string;
    /** System-line notice shown once per conversation when the API served the
     * answer from the fallback model (primary's daily quota exhausted). */
    fallbackNotice: string;
    /** Screen-reader-only announcement while an answer is being generated. */
    srThinking: string;
    /** aria-label for the stop-generation button shown while an answer streams. */
    stopLabel: string;
    inputPlaceholder: string;
    matrixInputPlaceholder: string;
    agentNames: {
      portfolio: string;
    };
    intentKeywords: {
      commands: {
        clear: string[];
        help: string[];
        download: string[];
        matrix: string[];
      };
    };
  };
  footer: {
    copyrightTemplate: string;
  };
  /** Owner contact constants — same shape used in Dossier & Footer chips */
  ownerContact: {
    email: string;
    /** https://github.com/NehoraiHadad */
    githubUrl: string;
    /** TODO: confirm LinkedIn slug — currently a placeholder */
    linkedinUrl: string;
  };
  caseStudies: CaseStudyContent[];
  skills: SkillGroupContent[];
  /** Private admin app (admin.nehoraihadad.com). Not shown on the public site. */
  admin: AdminDictionary;
}

export interface AdminDictionary {
  appName: string;
  nav: {
    dashboard: string;
    clients: string;
    quotes: string;
    settings: string;
  };
  topbar: {
    openMenu: string;
    closeMenu: string;
    account: string;
    logout: string;
    language: string;
  };
  login: {
    title: string;
    subtitle: string;
    googleButton: string;
    deniedTitle: string;
    deniedBody: string;
    backToSite: string;
  };
  dashboard: {
    title: string;
    subtitle: string;
    statDrafts: string;
    statSent: string;
    statApproved: string;
    quickNewQuote: string;
    recentQuotes: string;
    emptyHint: string;
  };
  clients: {
    title: string;
    subtitle: string;
    empty: string;
    newClient: string;
    editClient: string;
    addClient: string;
    searchPlaceholder: string;
    fieldName: string;
    fieldCompany: string;
    fieldEmail: string;
    fieldPhone: string;
    fieldTaxId: string;
    fieldAddress: string;
    fieldNotes: string;
    save: string;
    cancel: string;
    delete: string;
    deleteConfirm: string;
    created: string;
    updated: string;
    deleted: string;
    quoteHistory: string;
    noQuotesForClient: string;
    quoteCount: string;
    backToClients: string;
    selectClient: string;
    saveAsClient: string;
    noClients: string;
  };
  quotes: {
    title: string;
    subtitle: string;
    newQuote: string;
    empty: string;
    emptyCta: string;
    colNumber: string;
    colClient: string;
    colStatus: string;
    colTotal: string;
    colUpdated: string;
    untitled: string;
  };
  settings: {
    title: string;
    subtitle: string;
    brandSection: string;
    brandSectionHint: string;
    brandName: string;
    brandTagline: string;
    brandEmail: string;
    brandPhone: string;
    brandAddress: string;
    brandLogo: string;
    brandLogoHint: string;
    save: string;
    saved: string;
    comingSoon: string;
    comingSoonItems: string[];
    tokens: {
      heading: string;
      description: string;
      labelPlaceholder: string;
      createButton: string;
      revealWarning: string;
      copyButton: string;
      copied: string;
      dismiss: string;
      revoke: string;
      revoked: string;
      never: string;
      createdLabel: string;
      lastUsedLabel: string;
      emptyState: string;
      createError: string;
    };
  };
  status: {
    draft: string;
    sent: string;
    approved: string;
    rejected: string;
    expired: string;
  };
  builder: {
    newTitle: string;
    editTitle: string;
    sectionClient: string;
    sectionQuote: string;
    sectionItems: string;
    clientName: string;
    clientCompany: string;
    clientEmail: string;
    clientPhone: string;
    clientTaxId: string;
    clientAddress: string;
    quoteNumber: string;
    projectTitle: string;
    projectDescription: string;
    terms: string;
    validUntil: string;
    language: string;
    currency: string;
    quoteStatus: string;
    vatRate: string;
    itemDescription: string;
    itemQty: string;
    itemUnitPrice: string;
    itemDiscount: string;
    itemVat: string;
    itemLineTotal: string;
    addItem: string;
    removeItem: string;
    optional: string;
    noItems: string;
  };
  totals: {
    subtotal: string;
    discount: string;
    vat: string;
    total: string;
  };
  preview: {
    title: string;
    quoteFor: string;
    from: string;
    validUntil: string;
    project: string;
    details: string;
    terms: string;
    termsPlaceholder: string;
    quoteNumber: string;
    date: string;
    logoPlaceholder: string;
    thankYou: string;
  };
  actions: {
    saveDraft: string;
    preview: string;
    edit: string;
    downloadPdf: string;
    sendToClient: string;
    sendToClientFuture: string;
    back: string;
    delete: string;
    cancel: string;
    shareLinkLabel: string;
    copyLink: string;
    linkCopied: string;
    shareError: string;
    /** Channel-aware share: send via WhatsApp */
    shareWhatsapp: string;
    /** Channel-aware share: send via email */
    shareEmail: string;
    /** WhatsApp message prefix — component appends the URL */
    shareWhatsappText: string;
    /** Email subject — component replaces {number} with the quote number */
    shareEmailSubject: string;
    /** Email body prefix — component appends the URL */
    shareEmailBody: string;
  };
  publicQuote: {
    approve: string;
    reject: string;
    approveConfirm: string;
    rejectConfirm: string;
    processing: string;
    pendingTitle: string;
    pendingBody: string;
    approvedTitle: string;
    approvedBody: string;
    rejectedTitle: string;
    rejectedBody: string;
    expiredTitle: string;
    expiredBody: string;
    errorBody: string;
    /** Lead text for the soft contact line shown below the Approve button. */
    undecidedPrompt: string;
  };
}
