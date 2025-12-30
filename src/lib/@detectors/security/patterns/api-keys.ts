/**
 * @module lib/@detectors/security/patterns/api-keys
 * @description API key patterns for cloud providers and services
 */

import type { SecretPattern } from '../types';
import { calculateEntropy } from '../validators';

// ============================================================================
// CLOUD PROVIDERS
// ============================================================================

/** AWS Access Key ID - Format: AKIA[0-9A-Z]{16} */
export const AWS_ACCESS_KEY: SecretPattern = {
  type: 'aws-access-key',
  pattern: /\bAKIA[0-9A-Z]{16}\b/,
  severity: 'critical',
  baseConfidence: 95,
  description: 'AWS Access Key ID',
};

/** AWS Secret Access Key - Format: 40 character base64-ish string */
export const AWS_SECRET_KEY: SecretPattern = {
  type: 'aws-secret-key',
  pattern: /\b[A-Za-z0-9/+=]{40}\b/,
  severity: 'critical',
  baseConfidence: 60,
  description: 'AWS Secret Access Key',
  validate: (_val, context) => {
    const name = context?.variableName?.toLowerCase() ?? '';
    return (
      name.includes('aws') ||
      name.includes('secret') ||
      name.includes('access_key') ||
      name.includes('accesskey')
    );
  },
};

/** GCP API Key - Format: AIza[0-9A-Za-z-_]{35} */
export const GCP_API_KEY: SecretPattern = {
  type: 'gcp-api-key',
  pattern: /\bAIza[0-9A-Za-z_-]{35}\b/,
  severity: 'critical',
  baseConfidence: 95,
  description: 'Google Cloud API Key',
};

/** GCP Service Account Key (JSON key file content) */
export const GCP_SERVICE_ACCOUNT: SecretPattern = {
  type: 'gcp-service-account',
  pattern: /"type"\s*:\s*"service_account"/,
  severity: 'critical',
  baseConfidence: 90,
  description: 'GCP Service Account credentials',
};

/** Azure Subscription Key - Format: 32 character hex string */
export const AZURE_SUBSCRIPTION_KEY: SecretPattern = {
  type: 'azure-subscription-key',
  pattern: /\b[a-f0-9]{32}\b/i,
  severity: 'high',
  baseConfidence: 40,
  description: 'Azure Subscription Key',
  validate: (_val, context) => {
    const name = context?.variableName?.toLowerCase() ?? '';
    return name.includes('azure') || name.includes('subscription') || name.includes('cognitive');
  },
};

/** Azure Connection String - Format: AccountKey=...;AccountName=... */
export const AZURE_CONNECTION_STRING: SecretPattern = {
  type: 'azure-connection-string',
  pattern: /AccountKey=[A-Za-z0-9+/=]{86,88}/,
  severity: 'critical',
  baseConfidence: 95,
  description: 'Azure Storage Connection String',
};

// ============================================================================
// PAYMENT PROVIDERS
// ============================================================================

/** Stripe API Key (Live) - Format: sk_live_[a-zA-Z0-9]{24,} */
export const STRIPE_LIVE_KEY: SecretPattern = {
  type: 'stripe-key',
  pattern: /\bsk_live_[a-zA-Z0-9]{24,}\b/,
  severity: 'critical',
  baseConfidence: 99,
  description: 'Stripe Live Secret Key',
};

/** Stripe API Key (Test) - lower severity */
export const STRIPE_TEST_KEY: SecretPattern = {
  type: 'stripe-key',
  pattern: /\bsk_test_[a-zA-Z0-9]{24,}\b/,
  severity: 'medium',
  baseConfidence: 95,
  description: 'Stripe Test Secret Key',
};

/** Stripe Restricted Key - Format: rk_live_[a-zA-Z0-9]{24,} */
export const STRIPE_RESTRICTED_KEY: SecretPattern = {
  type: 'stripe-restricted-key',
  pattern: /\brk_live_[a-zA-Z0-9]{24,}\b/,
  severity: 'critical',
  baseConfidence: 99,
  description: 'Stripe Restricted Key',
};

// ============================================================================
// VERSION CONTROL
// ============================================================================

/** GitHub Personal Access Token (Classic) - Format: ghp_[a-zA-Z0-9]{36} */
export const GITHUB_PAT: SecretPattern = {
  type: 'github-token',
  pattern: /\bghp_[a-zA-Z0-9]{36}\b/,
  severity: 'critical',
  baseConfidence: 99,
  description: 'GitHub Personal Access Token',
};

/** GitHub OAuth Access Token - Format: gho_[a-zA-Z0-9]{36} */
export const GITHUB_OAUTH: SecretPattern = {
  type: 'github-oauth',
  pattern: /\bgho_[a-zA-Z0-9]{36}\b/,
  severity: 'critical',
  baseConfidence: 99,
  description: 'GitHub OAuth Access Token',
};

/** GitHub App Token - Format: ghu_/ghs_[a-zA-Z0-9]{36} */
export const GITHUB_APP_TOKEN: SecretPattern = {
  type: 'github-app-token',
  pattern: /\b(ghu|ghs)_[a-zA-Z0-9]{36}\b/,
  severity: 'critical',
  baseConfidence: 99,
  description: 'GitHub App Token',
};

/** GitHub Fine-grained PAT - Format: github_pat_[...] */
export const GITHUB_FINE_GRAINED_PAT: SecretPattern = {
  type: 'github-token',
  pattern: /\bgithub_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}\b/,
  severity: 'critical',
  baseConfidence: 99,
  description: 'GitHub Fine-grained Personal Access Token',
};

/** GitLab Personal Access Token - Format: glpat-[a-zA-Z0-9_-]{20} */
export const GITLAB_TOKEN: SecretPattern = {
  type: 'gitlab-token',
  pattern: /\bglpat-[a-zA-Z0-9_-]{20,}\b/,
  severity: 'critical',
  baseConfidence: 99,
  description: 'GitLab Personal Access Token',
};

// ============================================================================
// PACKAGE REGISTRIES
// ============================================================================

/** NPM Access Token - Format: npm_[a-zA-Z0-9]{36} */
export const NPM_TOKEN: SecretPattern = {
  type: 'npm-token',
  pattern: /\bnpm_[a-zA-Z0-9]{36}\b/,
  severity: 'critical',
  baseConfidence: 99,
  description: 'NPM Access Token',
};

/** PyPI API Token - Format: pypi-[a-zA-Z0-9_-]{100,} */
export const PYPI_TOKEN: SecretPattern = {
  type: 'pypi-token',
  pattern: /\bpypi-[a-zA-Z0-9_-]{100,}\b/,
  severity: 'critical',
  baseConfidence: 99,
  description: 'PyPI API Token',
};

// ============================================================================
// AI/ML PROVIDERS
// ============================================================================

/** OpenAI API Key - Format: sk-[...]T3BlbkFJ[...] */
export const OPENAI_KEY: SecretPattern = {
  type: 'openai-key',
  pattern: /\bsk-[a-zA-Z0-9]{20,}T3BlbkFJ[a-zA-Z0-9]{20,}\b/,
  severity: 'critical',
  baseConfidence: 99,
  description: 'OpenAI API Key',
};

/** OpenAI API Key (new format) - Format: sk-proj-[a-zA-Z0-9_-]{48,} */
export const OPENAI_PROJECT_KEY: SecretPattern = {
  type: 'openai-key',
  pattern: /\bsk-proj-[a-zA-Z0-9_-]{48,}\b/,
  severity: 'critical',
  baseConfidence: 99,
  description: 'OpenAI Project API Key',
};

/** Anthropic API Key - Format: sk-ant-[a-zA-Z0-9_-]{90,} */
export const ANTHROPIC_KEY: SecretPattern = {
  type: 'anthropic-key',
  pattern: /\bsk-ant-[a-zA-Z0-9_-]{90,}\b/,
  severity: 'critical',
  baseConfidence: 99,
  description: 'Anthropic API Key',
};

// ============================================================================
// COMMUNICATION SERVICES
// ============================================================================

/** Twilio API Key - Format: SK[a-f0-9]{32} */
export const TWILIO_KEY: SecretPattern = {
  type: 'twilio-key',
  pattern: /\bSK[a-f0-9]{32}\b/,
  severity: 'critical',
  baseConfidence: 95,
  description: 'Twilio API Key',
};

/** SendGrid API Key - Format: SG\.[...]\.[...] */
export const SENDGRID_KEY: SecretPattern = {
  type: 'sendgrid-key',
  pattern: /\bSG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}\b/,
  severity: 'critical',
  baseConfidence: 99,
  description: 'SendGrid API Key',
};

/** Mailgun API Key - Format: key-[a-f0-9]{32} */
export const MAILGUN_KEY: SecretPattern = {
  type: 'mailgun-key',
  pattern: /\bkey-[a-f0-9]{32}\b/,
  severity: 'critical',
  baseConfidence: 95,
  description: 'Mailgun API Key',
};

// ============================================================================
// MESSAGING PLATFORMS
// ============================================================================

/** Slack Bot Token - Format: xoxb-[...]-[...]-[...] */
export const SLACK_BOT_TOKEN: SecretPattern = {
  type: 'slack-token',
  pattern: /\bxoxb-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}\b/,
  severity: 'critical',
  baseConfidence: 99,
  description: 'Slack Bot Token',
};

/** Slack User Token - Format: xoxp-[...]-[...]-[...]-[...] */
export const SLACK_USER_TOKEN: SecretPattern = {
  type: 'slack-token',
  pattern: /\bxoxp-[0-9]{10,13}-[0-9]{10,13}-[0-9]{10,13}-[a-f0-9]{32}\b/,
  severity: 'critical',
  baseConfidence: 99,
  description: 'Slack User Token',
};

/** Slack Webhook URL */
export const SLACK_WEBHOOK: SecretPattern = {
  type: 'slack-webhook',
  pattern: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[a-zA-Z0-9]+/,
  severity: 'high',
  baseConfidence: 99,
  description: 'Slack Webhook URL',
};

/** Discord Bot Token - Format: [MN][...]\.[...]\.[...] */
export const DISCORD_TOKEN: SecretPattern = {
  type: 'discord-token',
  pattern: /\b[MN][A-Za-z0-9]{23,}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,}\b/,
  severity: 'critical',
  baseConfidence: 90,
  description: 'Discord Bot Token',
};

/** Discord Webhook URL */
export const DISCORD_WEBHOOK: SecretPattern = {
  type: 'discord-webhook',
  pattern: /https:\/\/discord(?:app)?\.com\/api\/webhooks\/[0-9]+\/[A-Za-z0-9_-]+/,
  severity: 'high',
  baseConfidence: 99,
  description: 'Discord Webhook URL',
};

/** Telegram Bot Token - Format: [0-9]{9,10}:[a-zA-Z0-9_-]{35} */
export const TELEGRAM_TOKEN: SecretPattern = {
  type: 'telegram-token',
  pattern: /\b[0-9]{9,10}:[a-zA-Z0-9_-]{35}\b/,
  severity: 'critical',
  baseConfidence: 85,
  description: 'Telegram Bot Token',
  validate: (_val, context) => {
    const name = context?.variableName?.toLowerCase() ?? '';
    return name.includes('telegram') || name.includes('bot') || name.includes('token');
  },
};

// ============================================================================
// BACKEND SERVICES
// ============================================================================

/** Firebase API Key - Format: AIza[0-9A-Za-z_-]{35} */
export const FIREBASE_KEY: SecretPattern = {
  type: 'firebase-key',
  pattern: /\bAIza[0-9A-Za-z_-]{35}\b/,
  severity: 'high',
  baseConfidence: 90,
  description: 'Firebase API Key',
};

/** Supabase API Key (JWT) */
export const SUPABASE_KEY: SecretPattern = {
  type: 'supabase-key',
  pattern: /\beyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/,
  severity: 'high',
  baseConfidence: 75,
  description: 'Supabase API Key (JWT)',
  validate: (_val, context) => {
    const name = context?.variableName?.toLowerCase() ?? '';
    return name.includes('supabase') || name.includes('anon') || name.includes('service_role');
  },
};

/** Algolia Admin API Key - Format: [a-f0-9]{32} */
export const ALGOLIA_KEY: SecretPattern = {
  type: 'algolia-key',
  pattern: /\b[a-f0-9]{32}\b/,
  severity: 'high',
  baseConfidence: 40,
  description: 'Algolia API Key',
  validate: (_val, context) => {
    const name = context?.variableName?.toLowerCase() ?? '';
    return name.includes('algolia') || name.includes('admin_key') || name.includes('search_key');
  },
};

// ============================================================================
// MAPS & GEOLOCATION
// ============================================================================

/** Mapbox Access Token - Format: pk.[a-zA-Z0-9_-]{60,} */
export const MAPBOX_TOKEN: SecretPattern = {
  type: 'mapbox-token',
  pattern: /\bpk\.[a-zA-Z0-9_-]{60,}\b/,
  severity: 'high',
  baseConfidence: 95,
  description: 'Mapbox Access Token',
};

// ============================================================================
// MONITORING & OBSERVABILITY
// ============================================================================

/** Sentry DSN - Format: https://[...]@[...].ingest.sentry.io/[...] */
export const SENTRY_DSN: SecretPattern = {
  type: 'sentry-dsn',
  pattern: /https:\/\/[a-f0-9]+@[a-z0-9]+\.ingest\.sentry\.io\/[0-9]+/,
  severity: 'medium',
  baseConfidence: 99,
  description: 'Sentry DSN',
};

/** Datadog API Key - Format: [a-f0-9]{32} */
export const DATADOG_KEY: SecretPattern = {
  type: 'datadog-key',
  pattern: /\b[a-f0-9]{32}\b/,
  severity: 'high',
  baseConfidence: 40,
  description: 'Datadog API Key',
  validate: (_val, context) => {
    const name = context?.variableName?.toLowerCase() ?? '';
    return name.includes('datadog') || name.includes('dd_api');
  },
};

// ============================================================================
// HOSTING PROVIDERS
// ============================================================================

/** Heroku API Key (UUID) - Format: [0-9a-f]{8}-[...]-[...] */
export const HEROKU_KEY: SecretPattern = {
  type: 'heroku-key',
  pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/,
  severity: 'high',
  baseConfidence: 40,
  description: 'Heroku API Key (UUID)',
  validate: (_val, context) => {
    const name = context?.variableName?.toLowerCase() ?? '';
    return name.includes('heroku') || name.includes('api_key');
  },
};

/** Vercel Token - Format: vercel_[a-zA-Z0-9]{24} */
export const VERCEL_TOKEN: SecretPattern = {
  type: 'vercel-token',
  pattern: /\bvercel_[a-zA-Z0-9]{24,}\b/,
  severity: 'critical',
  baseConfidence: 99,
  description: 'Vercel Token',
};

/** Netlify Token - Format: [a-zA-Z0-9_-]{40,} */
export const NETLIFY_TOKEN: SecretPattern = {
  type: 'netlify-token',
  pattern: /\b[a-zA-Z0-9_-]{40,}\b/,
  severity: 'high',
  baseConfidence: 40,
  description: 'Netlify Token',
  validate: (_val, context) => {
    const name = context?.variableName?.toLowerCase() ?? '';
    return name.includes('netlify');
  },
};

/** Cloudflare API Key - Format: [a-f0-9]{37} */
export const CLOUDFLARE_KEY: SecretPattern = {
  type: 'cloudflare-key',
  pattern: /\b[a-f0-9]{37}\b/,
  severity: 'critical',
  baseConfidence: 60,
  description: 'Cloudflare API Key',
  validate: (_val, context) => {
    const name = context?.variableName?.toLowerCase() ?? '';
    return name.includes('cloudflare') || name.includes('cf_');
  },
};

/** DigitalOcean Token - Format: dop_v1_[a-f0-9]{64} */
export const DIGITALOCEAN_TOKEN: SecretPattern = {
  type: 'digitalocean-token',
  pattern: /\bdop_v1_[a-f0-9]{64}\b/,
  severity: 'critical',
  baseConfidence: 99,
  description: 'DigitalOcean Personal Access Token',
};

// ============================================================================
// GENERIC API KEY
// ============================================================================

/** Generic API Key pattern (requires context) */
export const GENERIC_API_KEY: SecretPattern = {
  type: 'api-key-generic',
  pattern: /\b[a-zA-Z0-9_-]{32,64}\b/,
  severity: 'medium',
  baseConfidence: 30,
  description: 'Generic API Key',
  validate: (inputVal, context) => {
    const name = context?.variableName?.toLowerCase() ?? '';
    const hasApiKeyContext =
      name.includes('api') ||
      name.includes('key') ||
      name.includes('secret') ||
      name.includes('token') ||
      name.includes('auth');

    if (!hasApiKeyContext) return false;

    const entropy = calculateEntropy(inputVal);
    const threshold = context?.entropyThreshold ?? 3.5;
    return entropy >= threshold;
  },
};

// ============================================================================
// EXPORT ALL API KEY PATTERNS
// ============================================================================

export const API_KEY_PATTERNS: SecretPattern[] = [
  // Cloud providers
  AWS_ACCESS_KEY,
  GCP_API_KEY,
  GCP_SERVICE_ACCOUNT,
  AZURE_CONNECTION_STRING,
  // Payment
  STRIPE_LIVE_KEY,
  STRIPE_TEST_KEY,
  STRIPE_RESTRICTED_KEY,
  // Version control
  GITHUB_FINE_GRAINED_PAT,
  GITHUB_PAT,
  GITHUB_OAUTH,
  GITHUB_APP_TOKEN,
  GITLAB_TOKEN,
  // Package registries
  NPM_TOKEN,
  PYPI_TOKEN,
  // AI/ML
  OPENAI_KEY,
  OPENAI_PROJECT_KEY,
  ANTHROPIC_KEY,
  // Communication
  TWILIO_KEY,
  SENDGRID_KEY,
  MAILGUN_KEY,
  // Messaging
  SLACK_BOT_TOKEN,
  SLACK_USER_TOKEN,
  SLACK_WEBHOOK,
  DISCORD_TOKEN,
  DISCORD_WEBHOOK,
  // Backend
  FIREBASE_KEY,
  MAPBOX_TOKEN,
  SENTRY_DSN,
  DIGITALOCEAN_TOKEN,
  VERCEL_TOKEN,
];

export const CONTEXT_DEPENDENT_API_KEYS: SecretPattern[] = [
  TELEGRAM_TOKEN,
  AWS_SECRET_KEY,
  AZURE_SUBSCRIPTION_KEY,
  ALGOLIA_KEY,
  DATADOG_KEY,
  HEROKU_KEY,
  NETLIFY_TOKEN,
  CLOUDFLARE_KEY,
  SUPABASE_KEY,
  GENERIC_API_KEY,
];
