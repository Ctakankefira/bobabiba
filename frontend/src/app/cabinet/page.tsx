"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type ViewerProfile = {
  id: string;
  displayName?: string | null;
  username?: string | null;
  age?: number | null;
  clientRatingAverage?: number | null;
  role: "CLIENT" | "MASTER";
  master?: { id: string } | null;
};

type Booking = {
  id: string;
  date: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  notes: string | null;
  clientRating?: number | null;
  clientRatingComment?: string | null;
  acceptedAt?: string | null;
  completedAt?: string | null;
  service: { id: string; name: string; price: number; duration: number };
  master: { id: string; name: string };
  client: { id: string; displayName?: string | null; username?: string | null };
  review?: { id: string; rating: number; comment?: string | null } | null;
};

type MasterProfile = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  priceMin: number | null;
  priceMax: number | null;
  services: Array<{ id: string; name: string; price: number; duration: number }>;
  photos: Array<{ id: string; url: string; alt: string | null }>;
  bookings: Booking[];
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        initData?: string;
        initDataUnsafe?: {
          user?: {
            first_name?: string;
          };
        };
      };
    };
  }
}

const ROLE_CHOICE_PREFIX = "role-choice:";

const fDate = (v?: string | null) =>
  v
    ? new Date(v).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" })
    : "Не указано";

const clientName = (b: Booking) => b.client.displayName || b.client.username || "Клиент";

const statusLabel = (s: Booking["status"]) =>
  ({ PENDING: "Новая заявка", CONFIRMED: "В работе", CANCELLED: "Отменена", COMPLETED: "Завершена" })[s];

const parseServices = (input: string) =>
  input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((row) => {
      const [name, price, duration, description] = row.split("|").map((part) => part.trim());
      return { name, price: Number(price), duration: Number(duration), description: description || undefined };
    });

const parsePhotos = (input: string) =>
  input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((row) => {
      const [url, alt] = row.split("|").map((part) => part.trim());
      return { url, alt: alt || undefined };
    });

export default function CabinetPage() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [viewer, setViewer] = useState<ViewerProfile | null>(null);
  const [master, setMaster] = useState<MasterProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profileEdit, setProfileEdit] = useState(false);
  const [masterView, setMasterView] = useState<"overview" | "edit" | "stats">("overview");
  const [profileName, setProfileName] = useState("");
  const [profileAge, setProfileAge] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [masterForm, setMasterForm] = useState({
    name: "",
    description: "",
    category: "",
    priceMin: "",
    priceMax: "",
    services: "",
    photos: "",
  });
  const [masterSaving, setMasterSaving] = useState(false);
  const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [clientRateBookingId, setClientRateBookingId] = useState<string | null>(null);
  const [clientRateValue, setClientRateValue] = useState(5);
  const [clientRateComment, setClientRateComment] = useState("");
  const [clientRateSaving, setClientRateSaving] = useState(false);

  const examples = useMemo(
    () => ({
      services: "Стрижка|1500|60|Мужская стрижка\nБритье|900|30|Опасная бритва",
      photos: "https://example.com/photo-1.jpg|Фото профиля\nhttps://example.com/photo-2.jpg|Рабочее место",
    }),
    [],
  );

  useEffect(() => {
    window.Telegram?.WebApp?.ready();
    window.Telegram?.WebApp?.expand();
    const initData = window.Telegram?.WebApp?.initData;

    async function bootstrap() {
      if (!initData) {
        setLoading(false);
        return;
      }
      try {
        const authRes = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData }),
        });
        if (!authRes.ok) throw new Error("Не удалось авторизоваться");
        const auth = (await authRes.json()) as { access_token: string };
        setAuthToken(auth.access_token);

        const [profileRes, bookingsRes] = await Promise.all([
          fetch("/api/users/profile", { headers: { Authorization: `Bearer ${auth.access_token}` } }),
          fetch("/api/bookings", { headers: { Authorization: `Bearer ${auth.access_token}` } }),
        ]);
        if (!profileRes.ok) throw new Error("Не удалось загрузить профиль");
        const profile = (await profileRes.json()) as ViewerProfile;
        setViewer(profile);
        setProfileName(profile.displayName ?? "");
        setProfileAge(profile.age?.toString() ?? "");
        setProfileEdit(!profile.displayName);
        if (bookingsRes.ok) setBookings((await bookingsRes.json()) as Booking[]);

        if (profile.role === "MASTER") {
          const masterRes = await fetch("/api/masters/me", {
            headers: { Authorization: `Bearer ${auth.access_token}` },
          });
          if (masterRes.ok) {
            const data = (await masterRes.json()) as MasterProfile | null;
            if (data) {
              setMaster(data);
              setMasterForm({
                name: data.name ?? "",
                description: data.description ?? "",
                category: data.category ?? "",
                priceMin: data.priceMin?.toString() ?? "",
                priceMax: data.priceMax?.toString() ?? "",
                services: data.services.map((s) => [s.name, s.price, s.duration, ""].join("|")).join("\n"),
                photos: data.photos.map((p) => [p.url, p.alt ?? ""].join("|")).join("\n"),
              });
            }
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка загрузки кабинета");
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  const active = bookings.filter((b) => ["PENDING", "CONFIRMED"].includes(b.status));
  const history = bookings.filter((b) => ["CANCELLED", "COMPLETED"].includes(b.status));
  const pendingReview = bookings.find((b) => b.status === "COMPLETED" && !b.review);
  const stats = {
    pending: bookings.filter((b) => b.status === "PENDING"),
    progress: bookings.filter((b) => b.status === "CONFIRMED"),
    done: bookings.filter((b) => b.status === "COMPLETED"),
  };

  useEffect(() => {
    if (viewer?.role === "CLIENT" && pendingReview && !reviewBookingId) {
      setReviewBookingId(pendingReview.id);
      setReviewRating(5);
      setReviewComment("");
    }
  }, [pendingReview, reviewBookingId, viewer?.role]);

  const updateBooking = (next: Booking) => {
    setBookings((current) => current.map((b) => (b.id === next.id ? next : b)));
    setMaster((current) =>
      current ? { ...current, bookings: current.bookings.map((b) => (b.id === next.id ? next : b)) } : current,
    );
  };

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authToken) return;
    setProfileSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ displayName: profileName.trim(), age: profileAge ? Number(profileAge) : null }),
      });
      const data = (await res.json()) as ViewerProfile & { error?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось сохранить профиль");
      setViewer(data);
      setProfileEdit(false);
      setMessage("Личный профиль обновлён.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить профиль");
    } finally {
      setProfileSaving(false);
    }
  }

  async function saveMaster(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authToken) return;
    setMasterSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/masters/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          name: masterForm.name,
          description: masterForm.description,
          category: masterForm.category,
          priceMin: masterForm.priceMin ? Number(masterForm.priceMin) : undefined,
          priceMax: masterForm.priceMax ? Number(masterForm.priceMax) : undefined,
          services: parseServices(masterForm.services),
          photos: parsePhotos(masterForm.photos),
        }),
      });
      const data = (await res.json()) as MasterProfile & { error?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось сохранить профиль мастера");
      setMaster(data);
      setBookings(data.bookings ?? bookings);
      setMasterView("overview");
      setMessage("Профиль мастера обновлён.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить профиль мастера");
    } finally {
      setMasterSaving(false);
    }
  }

  function leaveCabinet() {
    window.location.href = "/";
  }

  function changeRole() {
    if (viewer) {
      window.localStorage.removeItem(`${ROLE_CHOICE_PREFIX}${viewer.id}`);
    }
    window.location.href = "/?pickRole=1";
  }

  async function updateStatus(bookingId: string, status: "CONFIRMED" | "CANCELLED" | "COMPLETED") {
    if (!authToken) return;
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ status }),
      });
      const data = (await res.json()) as Booking & { error?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось обновить статус");
      updateBooking(data);
      setMessage("Статус записи обновлён.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось обновить статус");
    }
  }

  async function submitClientRating() {
    if (!authToken || !clientRateBookingId) return;
    setClientRateSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${clientRateBookingId}/client-rating`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ rating: clientRateValue, comment: clientRateComment || undefined }),
      });
      const data = (await res.json()) as Booking & { error?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось сохранить оценку клиента");
      updateBooking(data);
      setClientRateBookingId(null);
      setClientRateComment("");
      setClientRateValue(5);
      setMessage("Оценка клиента сохранена.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить оценку клиента");
    } finally {
      setClientRateSaving(false);
    }
  }

  async function submitReview() {
    if (!authToken || !reviewBookingId) return;
    setReviewSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${reviewBookingId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ rating: reviewRating, comment: reviewComment || undefined }),
      });
      const data = (await res.json()) as Booking & { error?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось отправить отзыв");
      updateBooking(data);
      setReviewBookingId(null);
      setReviewComment("");
      setReviewRating(5);
      setMessage("Спасибо! Ваш отзыв сохранён.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отправить отзыв");
    } finally {
      setReviewSaving(false);
    }
  }

  if (loading) {
    return <main className="mx-auto flex min-h-screen w-full max-w-6xl px-4 py-6 sm:px-6"><div className="glass h-96 w-full animate-pulse rounded-[32px]" /></main>;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6">
      {reviewBookingId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
          <section className="w-full max-w-2xl rounded-[32px] border border-[var(--line)] bg-[var(--surface-strong)] p-6 shadow-lg sm:p-8">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Отзыв</p>
            <h2 className="mt-3 text-3xl font-semibold">Как прошла услуга?</h2>
            <div className="mt-6 flex flex-wrap gap-3">
              {[1, 2, 3, 4, 5].map((value) => (
                <button key={value} type="button" onClick={() => setReviewRating(value)} className={`rounded-full px-4 py-2 text-sm ${reviewRating === value ? "bg-[var(--accent)] text-white" : "border border-[var(--line)] bg-white/80"}`}>
                  {value} ★
                </button>
              ))}
            </div>
            <textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} className="mt-5 min-h-28 w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none" placeholder="Напишите пару слов о мастере" />
            <button type="button" onClick={submitReview} disabled={reviewSaving} className="mt-5 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white disabled:opacity-60">
              {reviewSaving ? "Сохраняю..." : "Отправить отзыв"}
            </button>
          </section>
        </div>
      ) : null}

      {clientRateBookingId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
          <section className="w-full max-w-2xl rounded-[32px] border border-[var(--line)] bg-[var(--surface-strong)] p-6 shadow-lg sm:p-8">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Оценка клиента</p>
            <h2 className="mt-3 text-3xl font-semibold">Как всё прошло?</h2>
            <div className="mt-6 flex flex-wrap gap-3">
              {[1, 2, 3, 4, 5].map((value) => (
                <button key={value} type="button" onClick={() => setClientRateValue(value)} className={`rounded-full px-4 py-2 text-sm ${clientRateValue === value ? "bg-[var(--accent)] text-white" : "border border-[var(--line)] bg-white/80"}`}>
                  {value} ★
                </button>
              ))}
            </div>
            <textarea value={clientRateComment} onChange={(event) => setClientRateComment(event.target.value)} className="mt-5 min-h-28 w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none" placeholder="Комментарий мастера о клиенте" />
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={submitClientRating} disabled={clientRateSaving} className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white disabled:opacity-60">
                {clientRateSaving ? "Сохраняю..." : "Сохранить оценку"}
              </button>
              <button type="button" onClick={() => setClientRateBookingId(null)} className="rounded-full border border-[var(--line)] bg-white/80 px-5 py-3 text-sm">
                Закрыть
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <section className="glass rounded-[32px] p-6 sm:p-8">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Cabinet</p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{viewer?.role === "MASTER" ? "Кабинет мастера" : "Кабинет клиента"}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          {viewer?.displayName ? `Профиль: ${viewer.displayName}${viewer.username ? ` • @${viewer.username}` : ""}` : "Заполните имя и возраст в личном профиле."}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={leaveCabinet} className="rounded-full bg-[var(--foreground)] px-4 py-2 text-sm text-white">Выйти в каталог</button>
          <button type="button" onClick={changeRole} className="rounded-full border border-[var(--line)] bg-white/80 px-4 py-2 text-sm">Сменить роль</button>
          <button type="button" onClick={() => setProfileEdit((current) => !current)} className="rounded-full border border-[var(--line)] bg-white/80 px-4 py-2 text-sm">
            {profileEdit ? "Скрыть редактирование" : "Изменить личный профиль"}
          </button>
        </div>
        {message ? <p className="mt-4 text-sm text-green-700">{message}</p> : null}
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        {profileEdit ? (
          <form className="mt-6 grid gap-4 rounded-[28px] border border-[var(--line)] bg-white/60 p-5" onSubmit={saveProfile}>
            <div className="grid gap-4 md:grid-cols-2">
              <input required value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Имя в приложении" className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none" />
              <input type="number" min={18} max={100} value={profileAge} onChange={(event) => setProfileAge(event.target.value)} placeholder="Возраст" className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none" />
            </div>
            <button type="submit" disabled={profileSaving} className="w-fit rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white disabled:opacity-60">
              {profileSaving ? "Сохраняю..." : "Сохранить личный профиль"}
            </button>
          </form>
        ) : null}

        {viewer?.role === "MASTER" ? (
          <div className="mt-8 space-y-6">
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => setMasterView("overview")} className={`rounded-full px-4 py-2 text-sm ${masterView === "overview" ? "bg-[var(--accent)] text-white" : "border border-[var(--line)] bg-white/80"}`}>Профиль мастера</button>
              <button type="button" onClick={() => setMasterView("edit")} className={`rounded-full px-4 py-2 text-sm ${masterView === "edit" ? "bg-[var(--accent)] text-white" : "border border-[var(--line)] bg-white/80"}`}>Изменить профиль</button>
              <button type="button" onClick={() => setMasterView("stats")} className={`rounded-full px-4 py-2 text-sm ${masterView === "stats" ? "bg-[var(--accent)] text-white" : "border border-[var(--line)] bg-white/80"}`}>Статистика</button>
            </div>

            {masterView === "edit" ? (
              <form className="grid gap-4 rounded-[28px] border border-[var(--line)] bg-white/60 p-5" onSubmit={saveMaster}>
                <input required value={masterForm.name} onChange={(event) => setMasterForm((c) => ({ ...c, name: event.target.value }))} placeholder="Имя мастера" className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none" />
                <div className="grid gap-4 md:grid-cols-3">
                  <input required value={masterForm.category} onChange={(event) => setMasterForm((c) => ({ ...c, category: event.target.value }))} placeholder="Категория" className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none" />
                  <input value={masterForm.priceMin} onChange={(event) => setMasterForm((c) => ({ ...c, priceMin: event.target.value }))} placeholder="Цена от" className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none" />
                  <input value={masterForm.priceMax} onChange={(event) => setMasterForm((c) => ({ ...c, priceMax: event.target.value }))} placeholder="Цена до" className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none" />
                </div>
                <textarea value={masterForm.description} onChange={(event) => setMasterForm((c) => ({ ...c, description: event.target.value }))} placeholder="Описание" className="min-h-28 rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none" />
                <textarea value={masterForm.services} onChange={(event) => setMasterForm((c) => ({ ...c, services: event.target.value }))} placeholder={examples.services} className="min-h-32 rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 font-mono text-sm outline-none" />
                <textarea value={masterForm.photos} onChange={(event) => setMasterForm((c) => ({ ...c, photos: event.target.value }))} placeholder={examples.photos} className="min-h-28 rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 font-mono text-sm outline-none" />
                <button type="submit" disabled={masterSaving} className="w-fit rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white disabled:opacity-60">
                  {masterSaving ? "Сохраняю..." : "Сохранить профиль мастера"}
                </button>
              </form>
            ) : null}

            {masterView === "overview" ? (
              <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
                <section className="rounded-[28px] border border-[var(--line)] bg-white/60 p-5">
                  <h2 className="text-xl font-semibold">Профиль мастера</h2>
                  <div className="mt-4 grid gap-3">
                    <article className="rounded-2xl bg-white/80 p-4"><p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Имя</p><p className="mt-2 text-lg font-semibold">{master?.name || "Не заполнено"}</p></article>
                    <article className="rounded-2xl bg-white/80 p-4"><p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Категория</p><p className="mt-2 text-lg font-semibold">{master?.category || "Не заполнено"}</p></article>
                    <article className="rounded-2xl bg-white/80 p-4"><p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Услуг</p><p className="mt-2 text-lg font-semibold">{master?.services.length || 0}</p></article>
                  </div>
                </section>
                <section className="rounded-[28px] border border-[var(--line)] bg-white/60 p-5">
                  <h2 className="text-xl font-semibold">Заявки</h2>
                  <div className="mt-4 grid gap-3">
                    {bookings.length === 0 ? <p className="text-sm text-[var(--muted)]">Пока никто не записался.</p> : bookings.map((booking) => (
                      <article key={booking.id} className="rounded-2xl bg-white/80 p-4">
                        <div className="flex items-center justify-between gap-3"><strong>{booking.service.name}</strong><span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{statusLabel(booking.status)}</span></div>
                        <p className="mt-2 text-sm text-[var(--muted)]">Клиент: {clientName(booking)}</p>
                        <p className="mt-1 text-sm text-[var(--muted)]">Запись на: {fDate(booking.date)}</p>
                        {booking.notes ? <p className="mt-2 text-sm">{booking.notes}</p> : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {booking.status === "PENDING" ? <button type="button" onClick={() => updateStatus(booking.id, "CONFIRMED")} className="rounded-full border border-[var(--line)] px-3 py-2 text-xs">Взять в работу</button> : null}
                          {booking.status === "CONFIRMED" ? <button type="button" onClick={() => updateStatus(booking.id, "COMPLETED")} className="rounded-full border border-[var(--line)] px-3 py-2 text-xs">Завершить</button> : null}
                          {!["CANCELLED", "COMPLETED"].includes(booking.status) ? <button type="button" onClick={() => updateStatus(booking.id, "CANCELLED")} className="rounded-full border border-[var(--line)] px-3 py-2 text-xs">Отменить</button> : null}
                          {booking.status === "COMPLETED" && !booking.clientRating ? <button type="button" onClick={() => { setClientRateBookingId(booking.id); setClientRateValue(5); setClientRateComment(""); }} className="rounded-full bg-[var(--accent)] px-3 py-2 text-xs text-white">Оценить клиента</button> : null}
                        </div>
                        {booking.clientRating ? <p className="mt-3 text-sm text-[var(--muted)]">Оценка клиента: {booking.clientRating}/5{booking.clientRatingComment ? ` • ${booking.clientRatingComment}` : ""}</p> : null}
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            ) : null}

            {masterView === "stats" ? (
              <section className="rounded-[28px] border border-[var(--line)] bg-white/60 p-5">
                <h2 className="text-xl font-semibold">Статистика по заказам</h2>
                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  {[{ title: "Новые заявки", items: stats.pending }, { title: "В работе", items: stats.progress }, { title: "Завершённые", items: stats.done }].map((column) => (
                    <section key={column.title} className="rounded-2xl bg-white/80 p-4">
                      <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-semibold">{column.title}</h3><span className="rounded-full bg-[var(--surface)] px-3 py-1 text-xs text-[var(--muted)]">{column.items.length}</span></div>
                      <div className="mt-4 grid gap-3">
                        {column.items.length === 0 ? <p className="text-sm text-[var(--muted)]">Пока пусто.</p> : column.items.map((booking) => (
                          <article key={booking.id} className="rounded-2xl border border-[var(--line)] bg-white p-4">
                            <strong>{clientName(booking)}</strong>
                            <p className="mt-2 text-sm text-[var(--muted)]">{booking.service.name}</p>
                            <p className="mt-1 text-sm text-[var(--muted)]">Заказан слот: {fDate(booking.date)}</p>
                            <p className="mt-1 text-sm text-[var(--muted)]">Взято в работу: {fDate(booking.acceptedAt)}</p>
                            <p className="mt-1 text-sm text-[var(--muted)]">Завершено: {fDate(booking.completedAt)}</p>
                          </article>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <section className="rounded-[28px] border border-[var(--line)] bg-white/60 p-5">
              <h2 className="text-xl font-semibold">Мой профиль</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <article className="rounded-2xl bg-white/80 p-4"><p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Имя</p><p className="mt-2 text-lg font-semibold">{viewer?.displayName || "Не заполнено"}</p></article>
                <article className="rounded-2xl bg-white/80 p-4"><p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Возраст</p><p className="mt-2 text-lg font-semibold">{viewer?.age ?? "Не указан"}</p></article>
                <article className="rounded-2xl bg-white/80 p-4"><p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Рейтинг клиента</p><p className="mt-2 text-lg font-semibold">{(viewer?.clientRatingAverage ?? 0).toFixed(1)} / 5</p></article>
                <article className="rounded-2xl bg-white/80 p-4"><p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Всего записей</p><p className="mt-2 text-lg font-semibold">{bookings.length}</p></article>
              </div>
            </section>
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-[28px] border border-[var(--line)] bg-white/60 p-5">
                <h2 className="text-xl font-semibold">Текущие записи</h2>
                <div className="mt-4 grid gap-3">
                  {active.length === 0 ? <p className="text-sm text-[var(--muted)]">У вас пока нет активных записей.</p> : active.map((booking) => (
                    <article key={booking.id} className="rounded-2xl bg-white/80 p-4">
                      <div className="flex items-center justify-between gap-3"><strong>{booking.master.name}</strong><span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{statusLabel(booking.status)}</span></div>
                      <p className="mt-2 text-sm text-[var(--muted)]">{booking.service.name}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{fDate(booking.date)}</p>
                    </article>
                  ))}
                </div>
              </section>
              <section className="rounded-[28px] border border-[var(--line)] bg-white/60 p-5">
                <h2 className="text-xl font-semibold">История</h2>
                <div className="mt-4 grid gap-3">
                  {history.length === 0 ? <p className="text-sm text-[var(--muted)]">Завершённые и отменённые записи появятся здесь.</p> : history.map((booking) => (
                    <article key={booking.id} className="rounded-2xl bg-white/80 p-4">
                      <div className="flex items-center justify-between gap-3"><strong>{booking.master.name}</strong><span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{statusLabel(booking.status)}</span></div>
                      <p className="mt-2 text-sm text-[var(--muted)]">{booking.service.name}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{fDate(booking.date)}</p>
                      {booking.review ? <p className="mt-2 text-sm text-[var(--muted)]">Ваш отзыв: {booking.review.rating}/5{booking.review.comment ? ` • ${booking.review.comment}` : ""}</p> : null}
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
