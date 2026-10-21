/**
 * Centralized String Table for Sanctum Desktop UI.
 * Ensures i18n-readiness and eliminates ad-hoc hardcoded strings (docs/design/MICROCOPY.md).
 */

export const STRINGS = {
  // Navigation
  nav_chat: 'Chat',
  nav_models: 'Models',
  nav_packs: 'Packs',
  nav_settings: 'Settings',

  // Actions
  action_new_chat: 'New Chat',
  action_send: 'Send',
  action_stop: 'Stop',
  action_copy: 'Copy',
  action_retry: 'Retry',
  action_delete: 'Delete',
  action_undo: 'Undo',
  action_load_pack: 'Load Pack',
  action_unload_pack: 'Unload',
  action_export_json: 'Export Settings (JSON)',
  action_import_json: 'Import Settings (JSON)',
  action_save: 'Save',
  action_cancel: 'Cancel',

  // Platform Assurance
  tier_verified_containment: 'verified kernel containment',
  tier_not_verified: 'not verified (unconfined host process)',
  engine_ready: 'Engine Ready',
  engine_busy: 'Engine Busy',
  engine_offline: 'Engine Offline',

  // Status & Telemetry
  hardware_ram_usage: 'RAM',
  hardware_threads: 'Threads',
  hardware_context: 'Context',

  // Empty States & Placeholders
  search_sessions_placeholder: 'Search sessions...',
  composer_placeholder: 'Send a message... (Shift+Enter for new line)',
  empty_chat_title: 'Sanctum Desktop',
  empty_chat_subtitle: 'Offline local AI workspace. Select an installed model to begin.',
  empty_chat_hint: 'Type a message below or press Ctrl+K to navigate.',
  command_palette_placeholder: 'Type a command, session, or setting name...',

  // Modals & Panels
  panel_models_title: 'Model Configuration',
  panel_packs_title: 'Modality Packs',
  panel_settings_title: 'Settings & Customisation',
  tab_general: 'General',
  tab_models: 'Models',
  tab_privacy: 'Privacy & Security',

  // Error Messages
  error_panel_crashed: 'This panel encountered an unexpected error.',
  error_action_retry: 'Reload Panel',
} as const;

export type StringKey = keyof typeof STRINGS;

export function t(key: StringKey): string {
  return STRINGS[key] || key;
}
