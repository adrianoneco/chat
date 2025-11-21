/**
 * Utility functions for phone number handling
 */

/**
 * Normalize WhatsApp JID to clean phone number
 * Removes @s.whatsapp.net or @c.us suffix
 */
export function normalizePhoneNumber(jid: string | undefined): string | undefined {
  if (!jid) return undefined;
  return jid.replace(/@s\.whatsapp\.net|@c\.us/g, '');
}

/**
 * Validate and clean contact name
 * Falls back to phone number if name is invalid
 * - Trims whitespace
 * - Removes control characters
 * - Limits to 255 characters
 */
export function normalizeContactName(name: string | undefined | null, phoneNumber: string): string {
  if (name && typeof name === 'string') {
    // Trim and remove control characters
    const cleaned = name.trim().replace(/[\x00-\x1F\x7F-\x9F]/g, '');
    
    // Return cleaned name if valid, otherwise fallback to phone number
    if (cleaned.length > 0) {
      // Limit to 255 characters
      return cleaned.substring(0, 255);
    }
  }
  
  return phoneNumber;
}
