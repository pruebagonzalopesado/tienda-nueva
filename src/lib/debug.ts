// Utilidades de depuración y logging seguro
export const isDev = import.meta.env.DEV;

export function sanitizeForLog(value: string, maxVisible = 8): string {
  if (!value || value.length <= maxVisible) return '***';
  return value.substring(0, maxVisible) + '***';
}
