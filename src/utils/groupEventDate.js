export function localDateValue(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${String(year).padStart(4, "0")}-${month}-${day}`;
}

export function localTimeValue(date = new Date()) {
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function validateLocalEventDateTime(dateValue, timeValue, now = Date.now(), allowPastTimestamp = null) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue || "");
    const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue || "");
    if (!match || !timeMatch) return { date: null, error: "Choose a valid date and time." };

    const [, yearText, monthText, dayText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);
    if (year < 1000 || month < 1 || month > 12 || hour > 23 || minute > 59) {
        return { date: null, error: "Choose a valid date and time." };
    }

    const date = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day ||
        date.getHours() !== hour || date.getMinutes() !== minute) {
        return { date: null, error: "Choose a valid date and time." };
    }
    const sameOriginalMinute = allowPastTimestamp != null &&
        Math.floor(date.getTime() / 60000) === Math.floor(allowPastTimestamp / 60000);
    if (date.getTime() < now && !sameOriginalMinute) {
        return { date: null, error: "Choose a date and time that is not in the past." };
    }
    return { date, error: "" };
}
