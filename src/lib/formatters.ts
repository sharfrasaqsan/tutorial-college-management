export const formatTime = (timeStr: string) => {
  if (!timeStr || timeStr === "--:--" || timeStr === "---") return timeStr;
  try {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const ampm = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
  } catch {
    return timeStr;
  }
};

export const formatMonthYear = (monthStr: string) => {
  if (!monthStr || !monthStr.includes("-")) return monthStr;
  try {
    const [year, month] = monthStr.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  } catch {
    return monthStr;
  }
};

export const formatDate = (timestamp: any) => {
  if (!timestamp) return "---";
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "---";
  }
};

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

export const getPaymentCycleKey = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

export const getLegacyMonthName = (date: Date = new Date()) => {
  return MONTHS[date.getMonth()];
};

export const isPaymentInCycle = (
  paymentMonth?: string,
  date: Date = new Date(),
) => {
  if (!paymentMonth) return false;
  const normalized = paymentMonth.trim().toLowerCase();
  return (
    normalized === getPaymentCycleKey(date) ||
    normalized === getLegacyMonthName(date)
  );
};

export const formatPaymentMonth = (paymentMonth?: string) => {
  if (!paymentMonth) return "N/A";

  const normalized = paymentMonth.trim().toLowerCase();
  if (/^\d{4}-\d{2}$/.test(normalized)) {
    const [year, month] = normalized.split("-");
    const idx = Number(month) - 1;
    if (idx >= 0 && idx < MONTHS.length) {
      const monthName = MONTHS[idx];
      return `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${year}`;
    }
  }

  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
};
