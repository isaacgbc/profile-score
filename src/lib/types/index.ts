// ─── Locale ───────────────────────────────────────────
export type Locale = "en" | "es";

// ─── Journey Steps ────────────────────────────────────
export type JourneyStep =
  | "landing"
  | "input"
  | "features"
  | "results"
  | "rewrite-studio"
  | "checkout";

export const JOURNEY_STEPS: JourneyStep[] = [
  "landing",
  "input",
  "features",
  "results",
  "rewrite-studio",
  "checkout",
];

// ─── Input Data ───────────────────────────────────────
export type InputMethod = "linkedin" | "cv" | "both";
export type TargetInputType = "url" | "pdf" | null;

export interface UserInput {
  method: InputMethod | null;
  linkedinUrl: string;
  linkedinText: string;
  cvFileName: string | null;
  cvText: string;
  jobDescription: string;
  targetAudience: string;
  objectiveMode: "job" | "objective";
  objectiveText: string;
  targetUrl: string;
  targetFileName: string | null;
  targetInputType: TargetInputType;
  email: string;
}

// ─── Source Types ─────────────────────────────────────
export type SourceType = "linkedin" | "cv";

// ─── Features ─────────────────────────────────────────
export type FeatureId =
  | "linkedin-audit"
  | "cv-rewrite"
  | "job-optimization"
  | "cover-letter";

export interface Feature {
  id: FeatureId;
  icon: string;
  includedInPlans: PlanId[];
}

// ─── Plans / Pricing ──────────────────────────────────
export type PlanId = "starter" | "recommended" | "pro" | "coach";
export type PlanInterval = "one-time" | "monthly";

export type ExportModuleId =
  | "results-summary"
  | "full-audit"
  | "updated-cv"
  | "cover-letter"
  | "linkedin-updates";

export interface ExportModule {
  id: ExportModuleId;
  includedInPlans: PlanId[];
}

export interface Plan {
  id: PlanId;
  price: number;
  interval: PlanInterval;
  features: FeatureId[];
  highlighted?: boolean;
  exportModules: ExportModuleId[];
}

// ─── Score / Results ──────────────────────────────────
export type ScoreTier = "poor" | "fair" | "good" | "excellent";

export interface ScoreSection {
  id: string;
  score: number;
  maxScore: number;
  tier: ScoreTier;
  locked: boolean;
  source: SourceType;
  explanation: string;
  improvementSuggestions: string[];
}

/** Per-entry rewrite for experience/education items */
export interface RewriteEntry {
  entryIndex: number;
  entryTitle: string;
  original: string;
  improvements: string;
  missingSuggestions: string[];
  rewritten: string;
}

export interface RewritePreview {
  sectionId: string;
  source: SourceType;
  original: string;
  improvements: string;
  missingSuggestions: string[];
  rewritten: string;
  locked: boolean;
  /** Per-entry rewrites for experience/education sections (optional, backward compat) */
  entries?: RewriteEntry[];
}

export interface CoverLetterResult {
  content: string;
  locked: boolean;
}

export interface ProfileResult {
  overallScore: number;
  maxScore: number;
  tier: ScoreTier;
  /** AI-generated holistic descriptor summarizing the profile across all sections */
  overallDescriptor?: string;
  linkedinSections: ScoreSection[];
  cvSections: ScoreSection[];
  linkedinRewrites: RewritePreview[];
  cvRewrites: RewritePreview[];
  coverLetter: CoverLetterResult | null;
}

// ─── Export Records ──────────────────────────────────
export type ExportStatus = "queued" | "processing" | "ready" | "failed";
export type ExportFormat = "pdf" | "json";
export type ExportLanguage = "en" | "es";

export interface ExportRecord {
  id: string;
  auditId: string;
  exportType: ExportModuleId;
  format: ExportFormat;
  language: ExportLanguage;
  status: ExportStatus;
  fileUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
}

// ─── Audit Records ───────────────────────────────────
export interface AuditRecord {
  id: string;
  results: ProfileResult;
  planId: PlanId | null;
  createdAt: string;
}

// ─── Prompt Records ──────────────────────────────────
export type PromptStatus = "draft" | "active" | "archived";

export interface PromptRecord {
  id: string;
  promptKey: string;
  version: number;
  locale: Locale;
  modelTarget: string | null;
  content: string;
  status: PromptStatus;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── App State ────────────────────────────────────────
export interface GenerationMetaClient {
  modelUsed: string;
  promptVersionsUsed: Record<string, number>;
  hasFallback: boolean;
  durationMs: number;
  /** Number of sections that fell back to mock data */
  fallbackCount: number;
  /** True when fallbackCount is high enough that results are unreliable */
  degraded: boolean;
  /** Categorized failure reasons for diagnostics */
  failureReasons: string[];
}

export interface AppState {
  currentStep: JourneyStep;
  userInput: UserInput;
  selectedFeatures: FeatureId[];
  selectedPlan: PlanId | null;
  results: ProfileResult | null;
  isAdmin: boolean;
  locale: Locale;
  exportLocale: Locale;
  showPricingModal: boolean;
  showEmailCaptureModal: boolean;
  userEmail: string;
  userImprovements: Record<string, string>;
  unlockAnimationTriggered: boolean;
  auditId: string | null;
  isGenerating: boolean;
  generationError: string | null;
  generationMeta: GenerationMetaClient | null;
}

// ─── Feature Flags ────────────────────────────────────
export interface FeatureFlags {
  paymentsEnabled: boolean;
  adminBypass: boolean;
}
