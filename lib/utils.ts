import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parses dates from Google Sheets, handling DD/MM/YYYY and other common formats.
 */
export function parseSheetDate(dateStr: string | Date | null | undefined): Date | null {
  if (!dateStr || dateStr === "-" || dateStr === "—" || dateStr === "Invalid Date") return null;
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
  
  // Try standard parsing
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;

  // Try parsing DD/MM/YYYY
  const dateTimeParts = dateStr.includes(", ") ? dateStr.split(", ") : dateStr.split(" ");
  const dateParts = dateTimeParts[0].split("/");
  if (dateParts.length === 3) {
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const year = parseInt(dateParts[2], 10);

    let hours = 0, mins = 0, secs = 0;
    if (dateTimeParts[1]) {
      const timeParts = dateTimeParts[1].split(":");
      if (timeParts.length >= 2) {
        hours = parseInt(timeParts[0], 10);
        mins = parseInt(timeParts[1], 10);
        if (timeParts[2]) secs = parseInt(timeParts[2], 10);

        if (dateTimeParts[1].toLowerCase().includes("pm") && hours < 12) hours += 12;
        if (dateTimeParts[1].toLowerCase().includes("am") && hours === 12) hours = 0;
      }
    }

    const parsed = new Date(year, month, day, hours, mins, secs);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/**
 * Formats a date to DD/MM/YYYY for display.
 */
export function formatDate(date?: Date | string | null): string {
  if (!date || date === "-" || date === "—") return "";
  const d = date instanceof Date ? date : parseSheetDate(date);
  if (!d || isNaN(d.getTime())) return typeof date === 'string' ? date : "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy}`;
}
/**
 * Generates a timestamp compatible with FMS sheets (YYYY-MM-DD HH:mm:ss).
 */
export function getFmsTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
/**
 * Checks if a warranty expiry date is within one month from today.
 */
export function isWarrantyExpiringSoon(expiryDate: string | Date | null | undefined): boolean {
  if (!expiryDate || expiryDate === "-" || expiryDate === "—") return false;
  try {
    const d = expiryDate instanceof Date ? expiryDate : parseSheetDate(expiryDate);
    if (!d || isNaN(d.getTime())) return false;
    const today = new Date();
    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(today.getMonth() + 1);
    return d <= oneMonthFromNow;
  } catch (e) {
    return false;
  }
}
