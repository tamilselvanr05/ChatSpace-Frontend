import test from "node:test";
import assert from "node:assert/strict";
import { localDateValue, validateLocalEventDateTime } from "./groupEventDate.js";

test("local event date formatting uses the local calendar day", () => {
    assert.equal(localDateValue(new Date(2026, 0, 2, 23, 30)), "2026-01-02");
});

test("local event validation rejects past dates and past times today", () => {
    const now = new Date(2026, 9, 15, 12, 30, 45).getTime();
    assert.match(validateLocalEventDateTime("2026-10-14", "13:00", now).error, /past/);
    assert.match(validateLocalEventDateTime("2026-10-15", "12:30", now).error, /past/);
});

test("local event validation rejects invalid dates, times, and low years", () => {
    const now = new Date(2026, 0, 1).getTime();
    for (const [date, time] of [
        ["2026-02-30", "12:00"],
        ["0001-01-01", "12:00"],
        ["2027-01-01", "24:00"],
        ["2027-01-01", "12:60"],
        ["2027-1-01", "12:00"],
        ["2027-01-01", ""]
    ]) assert.ok(validateLocalEventDateTime(date, time, now).error);
});

test("local event validation accepts future dates and preserves an unchanged past event", () => {
    const now = new Date(2026, 9, 15, 12, 30).getTime();
    assert.equal(validateLocalEventDateTime("2026-10-16", "09:15", now).error, "");
    const past = new Date(2026, 9, 10, 9, 15).getTime();
    assert.equal(validateLocalEventDateTime("2026-10-10", "09:15", now, past).error, "");
    assert.match(validateLocalEventDateTime("2026-10-11", "09:15", now, past).error, /past/);
});
