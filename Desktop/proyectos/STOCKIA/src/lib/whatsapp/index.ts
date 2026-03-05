export { normalizeArPhone, isValidArPhone, formatPhoneDisplay } from './phoneAR'
export { renderTemplate, extractVariables, VARIABLE_GROUPS } from './templateEngine'
export type { TemplateContext, RenderResult, VarGroup } from './templateEngine'
export { buildWaLink, buildWebWaLink, openWhatsApp } from './waLink'
export {
  getTemplates,
  seedDefaultTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getSettings,
  updateSettings,
  logMessage,
  updateLogStatus,
  getMessageLogs,
  getTodayMessageCount,
} from './waService'
export type { WaTemplate, WaMessageLog, WaSettings } from './waService'
export { DEFAULT_TEMPLATES } from './defaultTemplates'
