const rangeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** Parses a Postgres `date` (YYYY-MM-DD) as a UTC calendar day. */
export function parseDate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

/** "Apr 2 – 6, 2027", "Apr 30 – May 3, 2027", "Dec 30, 2027 – Jan 2, 2028" */
export function formatDateRange(start: string, end: string) {
  return rangeFormatter.formatRange(parseDate(start), parseDate(end));
}

export function tripLengthInDays(start: string, end: string) {
  const ms = parseDate(end).getTime() - parseDate(start).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

/** Every calendar day of a trip, inclusive, as YYYY-MM-DD. */
export function tripDays(start: string, end: string) {
  const days: string[] = [];
  const cursor = parseDate(start);
  const last = parseDate(end).getTime();
  while (cursor.getTime() <= last && days.length <= 366) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export function addDays(date: string, days: number) {
  const value = parseDate(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** "Sat, Apr 3" */
export function formatDay(date: string) {
  return dayFormatter.format(parseDate(date));
}

const longDayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** "Saturday, April 3, 2027" */
export function formatLongDay(date: string) {
  return longDayFormatter.format(parseDate(date));
}

/** Today in the browser's time zone. Only call on the client, after hydration. */
export function localISODate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

/** Minutes since midnight for a Postgres `time`, or null when it is not a clock time. */
export function clockMinutes(value: string) {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Adds minutes to a clock time and wraps within the same day. */
export function addMinutesToTime(value: string, minutes: number) {
  const start = clockMinutes(value);
  if (start == null) return null;
  const total = (start + minutes) % (24 * 60);
  const wrapped = total < 0 ? total + 24 * 60 : total;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

/** "9:30 AM" from a Postgres `time` ("09:30:00"). */
export function formatTime(value: string) {
  const [hours = 0, minutes = 0] = value.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour = hours % 12 || 12;
  return `${hour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

/** "1h 30m", "45m", "2h" */
export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h}h` : "", m ? `${m}m` : ""].filter(Boolean).join(" ") || "0m";
}

const moneyFormatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(amount: number, currency: string, options?: { compact?: boolean }) {
  const key = `${currency}|${options?.compact ?? false}`;
  let formatter = moneyFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: options?.compact ? "compact" : "standard",
      maximumFractionDigits: options?.compact ? 1 : undefined,
    });
    moneyFormatters.set(key, formatter);
  }
  return formatter.format(amount);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function initials(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}
