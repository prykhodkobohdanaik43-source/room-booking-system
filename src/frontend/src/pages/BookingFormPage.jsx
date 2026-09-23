import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.js';
import { Alert } from '../components/Alert.jsx';
import { Field } from '../components/Field.jsx';
import { addDays, formatDay, toIsoDay } from '../format.js';
import { useAsync } from '../useAsync.js';

const HORIZON_DAYS = 28;
const WARNING_DELAY_MS = 300;

const isoDayIn = (days) => toIsoDay(addDays(new Date(), days));
const pad = (n) => String(n).padStart(2, '0');
const toTime = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
const toDate = (day, time) => new Date(`${day}T${time}`);

// Пропонована пара «дата, початок, завершення»: найближча повна година; пізно ввечері — завтра о 10:00
export function defaultSlot(now = new Date()) {
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  if (next.getHours() < 8 || next.getDate() !== now.getDate() || next.getHours() >= 21) {
    const tomorrow = addDays(now, 1);
    tomorrow.setHours(10, 0, 0, 0);
    return { date: toIsoDay(tomorrow), startTime: '10:00', endTime: '11:00' };
  }
  return { date: toIsoDay(next), startTime: toTime(next), endTime: `${pad(next.getHours() + 1)}:00` };
}

// null, поки поля форми не дають коректних дати й часу (наприклад, користувач ще друкує)
function toRequest(form) {
  const start = toDate(form.date, form.startTime);
  const end = toDate(form.date, form.endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return {
    roomId: form.roomId,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    participantsCount: Number(form.participantsCount),
  };
}

function initialForm({ booking, roomId }) {
  if (booking) {
    const start = new Date(booking.startTime);
    return {
      roomId: booking.roomId,
      date: toIsoDay(start),
      startTime: toTime(start),
      endTime: toTime(new Date(booking.endTime)),
      participantsCount: booking.participantsCount,
    };
  }
  return { roomId, ...defaultSlot(), participantsCount: 2 };
}

// Завантажує кімнати (і бронь для редагування), а саму форму показує, коли дані вже є
export function BookingFormPage() {
  const { api } = useAuth();
  const { id: editingId } = useParams();
  const [params] = useSearchParams();

  const { data, error, loading } = useAsync(async () => {
    const [rooms, mine] = await Promise.all([api.rooms(), editingId ? api.myBookings() : Promise.resolve([])]);
    return { rooms, booking: mine.find((item) => item.id === editingId) ?? null };
  }, [api, editingId]);

  if (loading) return <p className="state">Завантаження…</p>;
  if (error) return <Alert error={error} />;
  if (editingId && !data.booking) return <Alert>Бронь не знайдено або її вже не можна редагувати</Alert>;

  return (
    <BookingForm
      rooms={data.rooms}
      booking={data.booking}
      initialRoomId={params.get('roomId') ?? ''}
      key={editingId ?? 'new'}
    />
  );
}

// ФВ-04, ФВ-05 — створення; ФВ-07 — редагування; ФВ-24 — серія; ФВ-30 — попередження.
// Перевірки накладення і місткості лишаються на сервері: форма лише показує його відповідь.
function BookingForm({ rooms, booking, initialRoomId }) {
  const { api } = useAuth();
  const navigate = useNavigate();
  const isEdit = Boolean(booking);

  const [form, setForm] = useState(() => initialForm({ booking, roomId: initialRoomId }));
  const [repeat, setRepeat] = useState(false);
  const [weeks, setWeeks] = useState(4);
  const [warnings, setWarnings] = useState([]);
  const [error, setError] = useState(null);
  const [seriesResult, setSeriesResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  // ФВ-30: після кожної зміни полів питаємо сервер, чи не вільна менша кімната; бронювання це не блокує
  const warningRequest = useMemo(() => (isEdit || !form.roomId ? null : toRequest(form)), [isEdit, form]);
  useEffect(() => {
    if (!warningRequest) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      api
        .bookingWarnings(warningRequest)
        .then((result) => !cancelled && setWarnings(result.warnings))
        .catch(() => !cancelled && setWarnings([]));
    }, WARNING_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [api, warningRequest]);

  async function submit(event) {
    event.preventDefault();
    const request = toRequest(form);
    if (!request) return;
    setBusy(true);
    setError(null);
    try {
      if (isEdit) {
        await api.updateBooking(booking.id, request);
        navigate('/my');
      } else if (repeat) {
        const result = await api.createBookingSeries({ ...request, weeks: Number(weeks) });
        if (result.skipped.length === 0) navigate('/my');
        else setSeriesResult(result);
      } else {
        await api.createBooking(request);
        navigate('/my');
      }
    } catch (bookingError) {
      setError(bookingError);
    } finally {
      setBusy(false);
    }
  }

  if (seriesResult) return <SeriesSummary result={seriesResult} weeks={Number(weeks)} />;

  return (
    <section>
      <h1 className="page-title">{isEdit ? 'Редагування броні' : 'Нова бронь'}</h1>
      <form className="form" onSubmit={submit}>
        <Field label="Кімната">
          <select value={form.roomId} onChange={set('roomId')} required>
            <option value="">Оберіть кімнату</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name} — до {room.capacity} осіб
              </option>
            ))}
          </select>
        </Field>
        <Field label="Дата" hint={`Не далі ніж на ${HORIZON_DAYS} днів наперед`}>
          <input type="date" value={form.date} min={isoDayIn(0)} max={isoDayIn(HORIZON_DAYS)} onChange={set('date')} />
        </Field>
        <div className="form__row">
          <Field label="Початок">
            <input type="time" value={form.startTime} onChange={set('startTime')} required />
          </Field>
          <Field label="Завершення">
            <input type="time" value={form.endTime} onChange={set('endTime')} required />
          </Field>
        </div>
        <Field label="Кількість учасників">
          <input type="number" min="1" value={form.participantsCount} onChange={set('participantsCount')} required />
        </Field>

        {!isEdit && (
          <div className="form__repeat">
            <label className="check">
              <input type="checkbox" checked={repeat} onChange={(event) => setRepeat(event.target.checked)} />
              Повторювати щотижня
            </label>
            {repeat && (
              <Field label="Кількість тижнів">
                <select value={weeks} onChange={(event) => setWeeks(event.target.value)}>
                  {[2, 3, 4, 5].map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
        )}

        {warnings.map((warning) => (
          <p key={warning.code} className="notice" role="status">
            {warning.message}
          </p>
        ))}
        <Alert error={error} />
        {error?.code === 'SERIES_EMPTY' && <SkippedWeeks skipped={error.details?.skipped ?? []} />}
        <button type="submit" disabled={busy}>
          {busy ? 'Зберігаємо…' : isEdit ? 'Зберегти зміни' : 'Забронювати'}
        </button>
      </form>
    </section>
  );
}

function SkippedWeeks({ skipped }) {
  return (
    <ul className="skipped">
      {skipped.map((item) => (
        <li key={item.week}>
          Тиждень {item.week} ({formatDay(item.startTime)}): {item.reason}
        </li>
      ))}
    </ul>
  );
}

// ФВ-24: система повідомляє, які саме тижні пропущено через накладення
function SeriesSummary({ result, weeks }) {
  return (
    <section>
      <h1 className="page-title">Серію створено частково</h1>
      <p role="status">
        Створено {result.created.length} з {weeks} броней. Пропущено тижні, на які кімната вже зайнята:
      </p>
      <SkippedWeeks skipped={result.skipped} />
      <Link className="cta" to="/my">
        До моїх броней
      </Link>
    </section>
  );
}
