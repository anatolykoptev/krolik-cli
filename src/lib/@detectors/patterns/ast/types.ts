/**
 * @module lib/@detectors/ast/types
 * @description Canonical types for AST-based detection functions
 */

// ============================================================================
// LINT DETECTION TYPES
// ============================================================================

/** Lint issue types detected by AST visitor */
export type LintIssueType = 'console' | 'debugger' | 'alert' | 'eval' | 'empty-catch';

/** Lint issue detected by AST visitor */
export interface LintDetection {
  type: LintIssueType;
  offset: number;
  method?: string; // For console.log, alert, etc.
}

// ============================================================================
// TYPE-SAFETY DETECTION TYPES
// ============================================================================

/** Type-safety issue types detected by AST visitor */
export type TypeSafetyIssueType =
  | 'any-annotation'
  | 'any-assertion'
  | 'non-null'
  | 'any-param'
  | 'any-array'
  | 'double-assertion';

/** Type-safety issue detected by AST visitor */
export interface TypeSafetyDetection {
  type: TypeSafetyIssueType;
  offset: number;
}

// ============================================================================
// SECURITY DETECTION TYPES
// ============================================================================

/** Security issue types detected by AST visitor */
export type SecurityIssueType = 'command-injection' | 'path-traversal';

/** Security issue detected by AST visitor */
export interface SecurityDetection {
  type: SecurityIssueType;
  offset: number;
  method?: string; // For execSync, spawn, path.join, etc.
}

// ============================================================================
// MODERNIZATION DETECTION TYPES
// ============================================================================

/** Modernization issue types detected by AST visitor */
export type ModernizationIssueType = 'require';

/** Modernization issue detected by AST visitor */
export interface ModernizationDetection {
  type: ModernizationIssueType;
  offset: number;
  method?: string; // 'require' or 'require.resolve'
}

// ============================================================================
// HARDCODED VALUE DETECTION TYPES
// ============================================================================

/** Hardcoded value types detected by AST visitor */
export type HardcodedType = 'number' | 'url' | 'color';

/** Hardcoded value detected by AST visitor */
export interface HardcodedDetection {
  type: HardcodedType;
  value: string | number;
  offset: number;
}

// ============================================================================
// RETURN TYPE DETECTION TYPES
// ============================================================================

/** Return type issue types detected by AST visitor */
export type ReturnTypeIssueType =
  | 'missing-return-type-function'
  | 'missing-return-type-arrow'
  | 'missing-return-type-expression'
  | 'missing-return-type-default';

/** Return type issue detected by AST visitor */
export interface ReturnTypeDetection {
  type: ReturnTypeIssueType;
  offset: number;
  functionName: string;
  isAsync: boolean;
}

// ============================================================================
// ENVIRONMENT CONFIG DETECTION TYPES
// ============================================================================

/** Environment config issue severity levels */
export type EnvConfigSeverity = 'critical' | 'warning' | 'info';

/** Environment config issue types detected by AST visitor */
export type EnvConfigIssueType =
  | 'env-url'
  | 'hardcoded-port'
  | 'database-hostname'
  | 'api-endpoint'
  | 'feature-flag'
  | 'timeout-value'
  | 'api-key'
  | 'secret';

/** Environment config issue detected by AST visitor */
export interface EnvConfigDetection {
  type: EnvConfigIssueType;
  severity: EnvConfigSeverity;
  value: string | number | boolean;
  offset: number;
  suggestedEnvVar?: string;
  message: string;
}

// ============================================================================
// VISITOR CONTEXT TYPES
// ============================================================================

/** Context for tracking parent nodes during traversal */
export interface DetectorContext {
  /** Whether we're at top-level scope */
  isTopLevel: boolean;
  /** Whether we're inside a const declaration */
  inConstDeclaration: boolean | undefined;
  /** Whether we're inside a computed member expression */
  inMemberExpression: boolean | undefined;
  /** Parent node type */
  parentType: string | undefined;
  /** Parent variable name (for feature flag detection) */
  parentVariableName?: string | undefined;
}

// ============================================================================
// SECRETS DETECTION TYPES
// ============================================================================

/** Secret severity levels */
export type SecretSeverity = 'critical' | 'high' | 'medium' | 'low';

/** Secret types that can be detected */
export type SecretType =
  // API Keys
  | 'aws-access-key'
  | 'aws-secret-key'
  | 'gcp-api-key'
  | 'gcp-service-account'
  | 'azure-subscription-key'
  | 'azure-connection-string'
  | 'stripe-key'
  | 'stripe-restricted-key'
  | 'github-token'
  | 'github-oauth'
  | 'github-app-token'
  | 'gitlab-token'
  | 'npm-token'
  | 'pypi-token'
  | 'openai-key'
  | 'anthropic-key'
  | 'twilio-key'
  | 'sendgrid-key'
  | 'mailgun-key'
  | 'slack-token'
  | 'slack-webhook'
  | 'discord-token'
  | 'discord-webhook'
  | 'telegram-token'
  | 'firebase-key'
  | 'supabase-key'
  | 'algolia-key'
  | 'mapbox-token'
  | 'sentry-dsn'
  | 'datadog-key'
  | 'newrelic-key'
  | 'heroku-key'
  | 'vercel-token'
  | 'netlify-token'
  | 'cloudflare-key'
  | 'digitalocean-token'
  | 'linode-token'
  // Private Keys
  | 'rsa-private-key'
  | 'ssh-private-key'
  | 'pgp-private-key'
  | 'ec-private-key'
  | 'openssh-private-key'
  | 'pkcs8-private-key'
  // Tokens
  | 'jwt-token'
  | 'oauth-token'
  | 'bearer-token'
  | 'basic-auth'
  | 'api-key-generic'
  // Database
  | 'postgres-connection'
  | 'mysql-connection'
  | 'mongodb-connection'
  | 'redis-connection'
  | 'database-password'
  // Passwords
  | 'password-assignment'
  | 'password-in-url'
  // Generic
  | 'high-entropy-string'
  | 'generic-secret';

/** Detection result for a secret */
export interface SecretDetection {
  type: SecretType;
  offset: number;
  severity: SecretSeverity;
  /** Confidence score 0-100 */
  confidence: number;
  /** Redacted preview of the secret (first/last few chars) */
  preview: string;
  /** Optional context about why this was flagged */
  context?: string;
}

/** Context for secret detection */
export interface SecretDetectorContext {
  /** Variable/property name if applicable */
  variableName?: string;
  /** Whether this is in a test file */
  isTestFile?: boolean;
  /** Whether to check entropy for generic patterns */
  checkEntropy?: boolean;
  /** Minimum entropy threshold (default: 3.5) */
  entropyThreshold?: number;
}

// ============================================================================
// DUPLICATE QUERY DETECTION TYPES
// ============================================================================

/** Query types that can be detected */
export type QueryType = 'prisma' | 'trpc';

/** Prisma operation types */
export type PrismaOperationType =
  | 'findMany'
  | 'findFirst'
  | 'findUnique'
  | 'findUniqueOrThrow'
  | 'findFirstOrThrow'
  | 'create'
  | 'createMany'
  | 'update'
  | 'updateMany'
  | 'delete'
  | 'deleteMany'
  | 'upsert'
  | 'count'
  | 'aggregate'
  | 'groupBy';

/** tRPC hook types */
export type TrpcHookType = 'useQuery' | 'useMutation' | 'useInfiniteQuery' | 'useSuspenseQuery';

/** Base query detection (common fields) */
interface QueryDetectionBase {
  /** Detection type */
  type: QueryType;
  /** SWC AST offset */
  offset: number;
  /** Structural fingerprint for deduplication */
  fingerprint: string;
}

/** Prisma query detection */
export interface PrismaQueryDetection extends QueryDetectionBase {
  type: 'prisma';
  /** Prisma model name (e.g., "user", "booking") */
  model: string;
  /** Operation (findMany, findUnique, etc.) */
  operation: PrismaOperationType;
  /** Normalized where clause structure */
  whereStructure: string;
  /** Normalized select/include structure */
  selectStructure: string;
  /** tRPC procedure name (if in router) */
  procedureName?: string | undefined;
  /** Router name (if in router file) */
  routerName?: string | undefined;
}

/** tRPC query hook detection */
export interface TrpcQueryDetection extends QueryDetectionBase {
  type: 'trpc';
  /** Full procedure path (e.g., "users.getById") */
  procedurePath: string;
  /** Router name */
  router: string;
  /** Procedure name */
  procedure: string;
  /** Hook type */
  hook: TrpcHookType;
  /** Normalized input structure */
  inputStructure: string;
  /** Component name where it's used */
  componentName?: string | undefined;
}

/** Union type for query detection */
export type QueryDetection = PrismaQueryDetection | TrpcQueryDetection;

/** Context for query detection */
export interface QueryDetectorContext {
  /** Current function/component name */
  functionName?: string;
  /** Current router name */
  routerName?: string;
  /** Current procedure name */
  procedureName?: string;
  /** Whether inside a tRPC router */
  inTrpcRouter?: boolean;
  /** Whether inside a React component */
  inReactComponent?: boolean;
}
