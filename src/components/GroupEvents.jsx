import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import socket from "../socket";
import { API_BASE_URL } from "../config";
import { localDateValue, localTimeValue, validateLocalEventDateTime } from "../utils/groupEventDate";

const API = API_BASE_URL;
const blankForm = { title: "", description: "", date: "", time: "", location: "" };

function localDateTime(value) {
    const date = new Date(value);
    const offset = date.getTimezoneOffset() * 60000;
    const localValue = new Date(date.getTime() - offset).toISOString();
    return { date: localValue.slice(0, 10), time: localValue.slice(11, 16) };
}

function formatDate(value) {
    return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function GroupEvents({ group, userId }) {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [editingOriginalTimestamp, setEditingOriginalTimestamp] = useState(null);
    const [form, setForm] = useState(blankForm);
    const [saving, setSaving] = useState(false);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const clock = window.setInterval(() => setNow(Date.now()), 15000);
        return () => window.clearInterval(clock);
    }, []);

    const loadEvents = useCallback(async () => {
        setLoading(true);
        try {
            setError("");
            const response = await axios.get(`${API}/groups/${group._id}/events`);
            setEvents(response.data.events || []);
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Events could not be loaded.");
        } finally {
            setLoading(false);
        }
    }, [group._id]);

    useEffect(() => {
        const initialLoad = window.setTimeout(loadEvents, 0);
        const handleUpdate = (data) => {
            if (data.groupId === group._id) loadEvents();
        };
        socket.on("groupEvent:updated", handleUpdate);
        return () => {
            window.clearTimeout(initialLoad);
            socket.off("groupEvent:updated", handleUpdate);
        };
    }, [group._id, loadEvents]);

    const saveEvent = async (event) => {
        event.preventDefault();
        const validation = validateLocalEventDateTime(form.date, form.time, now, editingOriginalTimestamp);
        if (validation.error) return setError(validation.error);
        const preservesOriginalMinute = editingOriginalTimestamp != null &&
            Math.floor(validation.date.getTime() / 60000) === Math.floor(editingOriginalTimestamp / 60000);
        setSaving(true);
        setError("");
        try {
            const payload = {
                title: form.title,
                description: form.description,
                location: form.location,
                startsAt: new Date(preservesOriginalMinute ? editingOriginalTimestamp : validation.date.getTime()).toISOString()
            };
            if (editingId) {
                await axios.put(`${API}/groups/${group._id}/events/${editingId}`, payload);
                setNotice("Event updated.");
            } else {
                await axios.post(`${API}/groups/${group._id}/events`, payload);
                setNotice("Event created.");
            }
            setForm(blankForm);
            setEditingId(null);
            setEditingOriginalTimestamp(null);
            await loadEvents();
        } catch (requestError) {
            setError(requestError.response?.data?.message || requestError.message || "Event could not be saved.");
        } finally {
            setSaving(false);
        }
    };

    const respond = async (eventId, response) => {
        setError("");
        try {
            await axios.put(`${API}/groups/${group._id}/events/${eventId}/rsvp`, { response });
            setNotice("Your RSVP was updated.");
            await loadEvents();
        } catch (requestError) {
            setError(requestError.response?.data?.message || "RSVP could not be saved.");
        }
    };

    const cancelEvent = async (eventId) => {
        if (!window.confirm("Cancel this event? Group members will see that it was cancelled.")) return;
        setError("");
        try {
            await axios.post(`${API}/groups/${group._id}/events/${eventId}/cancel`);
            setNotice("Event cancelled.");
            await loadEvents();
        } catch (requestError) {
            setError(requestError.response?.data?.message || "Event could not be cancelled.");
        }
    };

    const beginEdit = (event) => {
        setEditingId(event._id);
        setEditingOriginalTimestamp(new Date(event.startsAt).getTime());
        setForm({ title: event.title, description: event.description || "", ...localDateTime(event.startsAt), location: event.location || "" });
    };

    const today = localDateValue(new Date(now));
    const originalLocalDate = editingOriginalTimestamp == null
        ? null
        : localDateTime(editingOriginalTimestamp).date;
    const dateMinimum = editingOriginalTimestamp != null && editingOriginalTimestamp < now
        ? originalLocalDate
        : today;

    const ordered = [...events].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    const sections = [
        ["Upcoming", ordered.filter((event) => !event.cancelled && new Date(event.startsAt).getTime() >= now)],
        ["Past", ordered.filter((event) => !event.cancelled && new Date(event.startsAt).getTime() < now)],
        ["Cancelled", ordered.filter((event) => event.cancelled)]
    ];

    return <section className="cs-info-section cs-group-events">
        <h3>Group events</h3>
        <form onSubmit={saveEvent} className="cs-event-form">
            <strong>{editingId ? "Edit event" : "Create event"}</strong>
            <input id="event-title" name="title" aria-label="Event title" placeholder="Event title" maxLength={120} required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <textarea id="event-description" name="description" aria-label="Event description" placeholder="Description" maxLength={2000} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <label>Date<input id="event-date" name="date" aria-label="Event date" type="date" required min={dateMinimum} value={form.date} onChange={(e) => { setForm({ ...form, date: e.target.value }); e.currentTarget.blur(); }} /></label>
            <label>Time<input id="event-time" name="time" aria-label="Event time" type="time" required min={form.date === today && !(editingOriginalTimestamp != null && editingOriginalTimestamp < now && form.date === originalLocalDate) ? localTimeValue(new Date(now)) : undefined} value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></label>
            <input id="event-location" name="location" aria-label="Location" placeholder="Location (optional)" maxLength={200} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <div className="cs-event-actions"><button type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Create event"}</button>{editingId && <button type="button" onClick={() => { setEditingId(null); setEditingOriginalTimestamp(null); setForm(blankForm); }}>Discard</button>}</div>
        </form>
        {error && <p role="alert" className="cs-event-error">{error}</p>}
        {notice && <p role="status" className="cs-event-notice">{notice}</p>}
        {loading ? <p>Loading events…</p> : sections.map(([label, list]) => <div key={label} className="cs-event-list">
            <h4>{label}</h4>
            {list.length === 0 && label === "Upcoming" && events.length === 0 ? <p>No events yet. Create one for your group.</p> : list.map((event) => {
                const attendees = event.attendees || { going: [], notGoing: [], maybe: [] };
                const ownResponse = Object.entries(attendees).find(([, people]) => people.some((person) => String(person.userId) === String(userId)))?.[0];
                const isCreator = String(event.createdBy) === String(userId);
                return <article key={event._id} className="cs-event-card">
                    <div className="cs-event-card-heading"><strong>{event.title}</strong>{event.cancelled && <span>Cancelled</span>}</div>
                    <time>{formatDate(event.startsAt)}</time>
                    {event.location && <p><b>Location:</b> {event.location}</p>}
                    {event.description && <p>{event.description}</p>}
                    {(["going", "maybe", "notGoing"]).map((key) => <details key={key}>
                        <summary>{key === "notGoing" ? "Not going" : key[0].toUpperCase() + key.slice(1)} · {attendees[key]?.length || 0}</summary>
                        <p>{attendees[key]?.length ? attendees[key].map((person) => person.username).join(", ") : "No responses"}</p>
                    </details>)}
                    {!event.cancelled && <div className="cs-event-actions cs-rsvp-actions">{[["going", "Going"], ["notGoing", "Not going"], ["maybe", "Maybe"]].map(([value, labelText]) => <button key={value} type="button" aria-pressed={ownResponse === value} onClick={() => respond(event._id, value)}>{labelText}</button>)}</div>}
                    {isCreator && !event.cancelled && <div className="cs-event-actions"><button type="button" onClick={() => beginEdit(event)}>Edit</button><button type="button" onClick={() => cancelEvent(event._id)}>Cancel event</button></div>}
                </article>;
            })}
            {label !== "Upcoming" && list.length === 0 && <p>No {label.toLowerCase()} events.</p>}
        </div>)}
    </section>;
}
