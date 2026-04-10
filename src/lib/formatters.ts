export const formatTime = (timeStr: string) => {
    if (!timeStr || timeStr === "--:--" || timeStr === "---") return timeStr;
    try {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    } catch {
        return timeStr;
    }
};

export const formatMonthYear = (monthStr: string) => {
    if (!monthStr || !monthStr.includes('-')) return monthStr;
    try {
        const [year, month] = monthStr.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } catch {
        return monthStr;
    }
};

export const formatDate = (timestamp: any) => {
    if (!timestamp) return '---';
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return '---';
    }
};
