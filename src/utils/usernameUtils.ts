import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Validates a username according to Instagram-style rules:
 * - 4 to 12 characters long
 * - Only lowercase letters, numbers, underscores (_), and dots (.)
 * - Cannot start or end with a dot on some platforms, but we'll accept just the basic regex here
 */
export function validateUsername(username: string): { isValid: boolean; error?: string } {
  if (!username) {
    return { isValid: false, error: "Username kiritilishi shart" };
  }
  
  if (username.length < 4 || username.length > 12) {
    return { isValid: false, error: "Username 4 dan 12 gacha belgidan iborat bo'lishi kerak" };
  }

  const validRegex = /^[a-z0-9_.]+$/;
  if (!validRegex.test(username)) {
    return { isValid: false, error: "Username faqat lotin harflari, raqamlar, pastki chiziq (_) va nuqta (.) dan iborat bo'lishi mumkin" };
  }

  return { isValid: true };
}

/**
 * Generates a base username from an email address, stripping invalid characters.
 */
export function generateBaseUsername(email: string): string {
  if (!email) return "user";
  
  const prefix = email.split('@')[0].toLowerCase();
  
  // Replace invalid characters with underscore, or remove them
  let base = prefix.replace(/[^a-z0-9_.]/g, '');
  
  if (base.length < 4) {
    base = base.padEnd(4, '0');
  } else if (base.length > 12) {
    base = base.substring(0, 12);
  }
  
  return base;
}

/**
 * Ensures the username is unique in the database. 
 * If the base username is taken, it appends a number until it finds a free one.
 */
export async function ensureUniqueUsername(supabase: SupabaseClient, base: string, excludeUserId?: string): Promise<string> {
  let finalUsername = base;
  let isUnique = false;
  let counter = 1;

  while (!isUnique) {
    const query = supabase.from('profiles').select('id').eq('username', finalUsername);
    if (excludeUserId) {
      query.neq('id', excludeUserId);
    }
    
    const { data } = await query.maybeSingle();
    
    if (!data) {
      // Username is free
      isUnique = true;
    } else {
      // Username is taken, try appending a number
      const suffix = String(counter);
      // Ensure we don't exceed 12 chars
      const newBaseLen = 12 - suffix.length;
      finalUsername = `${base.substring(0, newBaseLen)}${suffix}`;
      counter++;
    }
  }

  return finalUsername;
}
