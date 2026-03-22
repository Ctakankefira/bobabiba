"use client";

import { ChangeEvent, FormEvent, useState, useEffect } from "react";

type ViewerProfile = {
  id: string;
  displayName?: string | null;
  username?: string | null;
  age?: number | null;
  clientRatingAverage?: number | null;
  role: "CLIENT" | "MASTER";
};

type Service = {
  id: string;
  name: string;
  price: number;
  duration: number;
  description?: string | null;
};

type ServiceUnit = "minutes" | "hours" | "days";

type LocalService = {
  id: string;
  name: string;
  price: number;
  duration: number;
  description?: string | null;
};

type ServiceDraft = {
  name: string;
  price: string;
  durationValue: string;
  durationUnit: ServiceUnit;
  description: string;
};

type LocalPhoto = {
  id: string;
  url: string;
  alt: string;
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
  service: Service;
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
  avatarUrl?: string | null;
  services: Service[];
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
        initDataUnsafe?: { user?: { first_name?: string } };
      };
    };
  }
}

const ROLE_CHOICE_PREFIX = "role-choice:";
const MASTER_CATEGORIES = ["Барберы", "Маникюр", "Брови", "Массаж", "Тату"];

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" }) : "Не указано";

const bookingClientName = (booking: Booking) => booking.client.displayName || booking.client.username || "Клиент";

const bookingStatusLabel = (status: Booking["status"]) =>
  ({ PENDING: "Новая заявка", CONFIRMED: "В работе", CANCELLED: "Отменена", COMPLETED: "Завершена" })[status];

const masterAvatar = (master: MasterProfile | null) => master?.avatarUrl ?? master?.photos[0]?.url ?? null;

const createEmptyServiceDraft = (): ServiceDraft => ({
  name: "",
  price: "",
  durationValue: "",
  durationUnit: "minutes",
  description: "",
});

const convertDraftDurationToMinutes = (value: string, unit: ServiceUnit) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 0;
  }

  if (unit === "days") {
    return numericValue * 24 * 60;
  }

  if (unit === "hours") {
    return numericValue * 60;
  }

  return numericValue;
};

const convertMinutesToDraft = (minutes: number): Pick<ServiceDraft, "durationValue" | "durationUnit"> => {
  if (minutes > 0 && minutes % (24 * 60) === 0) {
    return { durationValue: String(minutes / (24 * 60)), durationUnit: "days" };
  }

  if (minutes > 0 && minutes % 60 === 0) {
    return { durationValue: String(minutes / 60), durationUnit: "hours" };
  }

  return { durationValue: String(minutes), durationUnit: "minutes" };
};

const formatServiceDuration = (minutes: number) => {
  if (minutes > 0 && minutes % (24 * 60) === 0) {
    const days = minutes / (24 * 60);
    return `${days} ${days === 1 ? "день" : days < 5 ? "дня" : "дней"}`;
  }

  if (minutes > 0 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} ${hours === 1 ? "час" : hours < 5 ? "часа" : "часов"}`;
  }

  return `${minutes} мин`;
};

export default function CabinetPage() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [viewer, setViewer] = useState<ViewerProfile | null>(null);
  const [master, setMaster] = useState<MasterProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profileEdit, setProfileEdit] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileAge, setProfileAge] = useState("");
  const [masterTab, setMasterTab] = useState<"overview" | "services" | "gallery" | "stats">("overview");
  const [masterEditing, setMasterEditing] = useState(false);
  const [masterSaving, setMasterSaving] = useState(false);
  const [masterAvatarDraft, setMasterAvatarDraft] = useState("");
  const [masterServices, setMasterServices] = useState<LocalService[]>([]);
  const [masterGallery, setMasterGallery] = useState<LocalPhoto[]>([]);
  const [serviceDraft, setServiceDraft] = useState<ServiceDraft>(createEmptyServiceDraft());
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [masterForm, setMasterForm] = useState({
    name: "",
    description: "",
    category: MASTER_CATEGORIES[0],
    priceMin: "",
    priceMax: "",
  });
  const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [clientRateBookingId, setClientRateBookingId] = useState<string | null>(null);
  const [clientRateValue, setClientRateValue] = useState(5);
  const [clientRateComment, setClientRateComment] = useState("");
  const [clientRateSaving, setClientRateSaving] = useState(false);

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

        if (bookingsRes.ok) {
          setBookings((await bookingsRes.json()) as Booking[]);
        }

        if (profile.role === "MASTER") {
          const masterRes = await fetch("/api/masters/me", {
            headers: { Authorization: `Bearer ${auth.access_token}` },
          });
          if (masterRes.ok) {
            const data = (await masterRes.json()) as MasterProfile | null;
            if (data) {
              setMaster(data);
              setMasterAvatarDraft(data.avatarUrl ?? "");
              setMasterForm({
                name: data.name ?? "",
                description: data.description ?? "",
                category: data.category || MASTER_CATEGORIES[0],
                priceMin: data.priceMin?.toString() ?? "",
                priceMax: data.priceMax?.toString() ?? "",
              });
              setMasterGallery(
                data.photos.map((photo) => ({
                  id: photo.id,
                  url: photo.url,
                  alt: photo.alt ?? "",
                })),
              );
              setMasterServices(
                data.services.map((service) => ({
                  id: service.id,
                  name: service.name,
                  price: service.price,
                  duration: service.duration,
                  description: service.description ?? "",
                })),
              );
            }
          }
        }
      } catch (bootstrapError) {
        setError(bootstrapError instanceof Error ? bootstrapError.message : "Ошибка загрузки кабинета");
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  useEffect(() => {
    const pendingReview = bookings.find((booking) => booking.status === "COMPLETED" && !booking.review);
    if (viewer?.role === "CLIENT" && pendingReview && !reviewBookingId) {
      setReviewBookingId(pendingReview.id);
      setReviewRating(5);
      setReviewComment("");
    }
  }, [bookings, reviewBookingId, viewer?.role]);

  const syncBooking = (updated: Booking) => {
    setBookings((current) => current.map((booking) => (booking.id === updated.id ? updated : booking)));
    setMaster((current) =>
      current
        ? { ...current, bookings: current.bookings.map((booking) => (booking.id === updated.id ? updated : booking)) }
        : current,
    );
  };

  const newRequests = bookings.filter((booking) => booking.status === "PENDING");
  const statsColumns = [
    { title: "Новые заявки", items: bookings.filter((booking) => booking.status === "PENDING") },
    { title: "В работе", items: bookings.filter((booking) => booking.status === "CONFIRMED") },
    { title: "Завершенные", items: bookings.filter((booking) => booking.status === "COMPLETED") },
  ];

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
      setMessage("Личный профиль обновлен.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить профиль");
    } finally {
      setProfileSaving(false);
    }
  }

  async function persistMasterProfile(servicesOverride?: LocalService[], photosOverride?: LocalPhoto[]) {
    if (!authToken) return;
    setMasterSaving(true);
    setMessage(null);
    setError(null);
    const servicesToSave = servicesOverride ?? masterServices;
    const photosToSave = photosOverride ?? masterGallery;
    try {
      const res = await fetch("/api/masters/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          name: masterForm.name,
          avatarUrl: masterAvatarDraft,
          description: masterForm.description,
          category: masterForm.category,
          priceMin: masterForm.priceMin ? Number(masterForm.priceMin) : undefined,
          priceMax: masterForm.priceMax ? Number(masterForm.priceMax) : undefined,
          photos: photosToSave.map((photo) => ({
            url: photo.url,
            alt: photo.alt || undefined,
          })),
          services: servicesToSave.map((service) => ({
            name: service.name,
            price: service.price,
            duration: service.duration,
            description: service.description || undefined,
          })),
        }),
      });
      const data = (await res.json()) as MasterProfile & { error?: string };
      if (!res.ok) throw new Error(data.error || "Не удалось сохранить профиль мастера");
      setMaster(data);
      setMasterAvatarDraft(data.avatarUrl ?? "");
      setMasterGallery(
        data.photos.map((photo) => ({
          id: photo.id,
          url: photo.url,
          alt: photo.alt ?? "",
        })),
      );
      setBookings(data.bookings ?? bookings);
      setMasterServices(
        data.services.map((service) => ({
          id: service.id,
          name: service.name,
          price: service.price,
          duration: service.duration,
          description: service.description ?? "",
        })),
      );
      setMasterEditing(false);
      setMessage(masterTab === "services" ? "Услуги обновлены." : "Профиль мастера обновлен.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить профиль мастера");
    } finally {
      setMasterSaving(false);
    }
  }

  async function saveMaster(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await persistMasterProfile();
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
      syncBooking(data);
      setMessage("Статус записи обновлен.");
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Не удалось обновить статус");
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
      syncBooking(data);
      setClientRateBookingId(null);
      setClientRateValue(5);
      setClientRateComment("");
      setMessage("Оценка клиента сохранена.");
    } catch (rateError) {
      setError(rateError instanceof Error ? rateError.message : "Не удалось сохранить оценку клиента");
    } finally {
      setClientRateSaving(false);
    }
  }

  function resetServiceEditor() {
    setServiceDraft(createEmptyServiceDraft());
    setEditingServiceId(null);
  }

  function editService(service: LocalService) {
    const duration = convertMinutesToDraft(service.duration);
    setServiceDraft({
      name: service.name,
      price: String(service.price),
      durationValue: duration.durationValue,
      durationUnit: duration.durationUnit,
      description: service.description ?? "",
    });
    setEditingServiceId(service.id);
  }

  function removeService(serviceId: string) {
    setMasterServices((current) => current.filter((service) => service.id !== serviceId));
    if (editingServiceId === serviceId) {
      resetServiceEditor();
    }
  }

  function handleMasterAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Можно выбрать только изображение для аватарки");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setMasterAvatarDraft(reader.result);
        setMessage(null);
        setError(null);
      }
    };
    reader.readAsDataURL(file);
  }

  function handleGalleryUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) {
      return;
    }

    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) {
      setError("Для галереи можно выбрать только изображения");
      return;
    }

    Promise.all(
      imageFiles.map(
        (file) =>
          new Promise<LocalPhoto>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === "string") {
                resolve({
                  id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  url: reader.result,
                  alt: file.name.replace(/\.[^.]+$/, ""),
                });
              } else {
                reject(new Error("Не удалось прочитать изображение"));
              }
            };
            reader.onerror = () => reject(new Error("Не удалось прочитать изображение"));
            reader.readAsDataURL(file);
          }),
      ),
    )
      .then((photos) => {
        setMasterGallery((current) => [...current, ...photos]);
        setError(null);
        setMessage(null);
      })
      .catch((uploadError) => {
        setError(uploadError instanceof Error ? uploadError.message : "Не удалось загрузить фото");
      });
  }

  function updateGalleryPhotoAlt(photoId: string, alt: string) {
    setMasterGallery((current) => current.map((photo) => (photo.id === photoId ? { ...photo, alt } : photo)));
  }

  function removeGalleryPhoto(photoId: string) {
    setMasterGallery((current) => current.filter((photo) => photo.id !== photoId));
  }

  function moveGalleryPhoto(photoId: string, direction: "left" | "right") {
    setMasterGallery((current) => {
      const index = current.findIndex((photo) => photo.id === photoId);
      if (index === -1) {
        return current;
      }

      const nextIndex = direction === "left" ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [photo] = next.splice(index, 1);
      next.splice(nextIndex, 0, photo);
      return next;
    });
  }

  async function submitServiceDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const duration = convertDraftDurationToMinutes(serviceDraft.durationValue, serviceDraft.durationUnit);
    const price = Number(serviceDraft.price);

    if (!serviceDraft.name.trim()) {
      setError("Укажите название услуги");
      return;
    }

    if (!Number.isFinite(price) || price <= 0) {
      setError("Укажите корректную цену услуги");
      return;
    }

    if (!Number.isFinite(duration) || duration <= 0) {
      setError("Укажите корректную длительность услуги");
      return;
    }

    setError(null);
    setMessage(null);

    const normalizedService: LocalService = {
      id: editingServiceId ?? `service-${Date.now()}`,
      name: serviceDraft.name.trim(),
      price,
      duration,
      description: serviceDraft.description.trim() || "",
    };

    const nextServices = editingServiceId
      ? masterServices.map((service) => (service.id === editingServiceId ? normalizedService : service))
      : [...masterServices, normalizedService];

    setMasterServices(nextServices);

    try {
      await persistMasterProfile(nextServices);
      resetServiceEditor();
    } catch {
      // handled in persistMasterProfile
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
      syncBooking(data);
      setReviewBookingId(null);
      setReviewRating(5);
      setReviewComment("");
      setMessage("Спасибо! Ваш отзыв сохранен.");
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Не удалось отправить отзыв");
    } finally {
      setReviewSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl px-4 py-6 sm:px-6">
        <div className="glass h-96 w-full animate-pulse rounded-[32px]" />
      </main>
    );
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
            <div className="mt-5 flex gap-3">
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
          <button type="button" onClick={() => (window.location.href = "/")} className="rounded-full bg-[var(--foreground)] px-4 py-2 text-sm text-white">
            Выйти в каталог
          </button>
          <button type="button" onClick={() => { if (viewer) window.localStorage.removeItem(`${ROLE_CHOICE_PREFIX}${viewer.id}`); window.location.href = "/?pickRole=1"; }} className="rounded-full border border-[var(--line)] bg-white/80 px-4 py-2 text-sm">
            Сменить роль
          </button>
          <button type="button" onClick={() => setProfileEdit((current) => !current)} className="rounded-full border border-[var(--line)] bg-white/80 px-4 py-2 text-sm">
            {profileEdit ? "Скрыть личный профиль" : "Изменить личный профиль"}
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
              <button type="button" onClick={() => setMasterTab("overview")} className={`rounded-full px-4 py-2 text-sm ${masterTab === "overview" ? "bg-[var(--accent)] text-white" : "border border-[var(--line)] bg-white/80"}`}>Профиль мастера</button>
              <button type="button" onClick={() => setMasterTab("services")} className={`rounded-full px-4 py-2 text-sm ${masterTab === "services" ? "bg-[var(--accent)] text-white" : "border border-[var(--line)] bg-white/80"}`}>Услуги</button>
              <button type="button" onClick={() => setMasterTab("gallery")} className={`rounded-full px-4 py-2 text-sm ${masterTab === "gallery" ? "bg-[var(--accent)] text-white" : "border border-[var(--line)] bg-white/80"}`}>Галерея</button>
              <button type="button" onClick={() => setMasterTab("stats")} className={`rounded-full px-4 py-2 text-sm ${masterTab === "stats" ? "bg-[var(--accent)] text-white" : "border border-[var(--line)] bg-white/80"}`}>Статистика</button>
            </div>

            {masterTab === "overview" ? (
              <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
                <section className="rounded-[28px] border border-[var(--line)] bg-white/65 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Профиль мастера</p>
                      <div className="mt-3 flex items-center gap-4">
                        {masterAvatar(master) ? (
                          <img
                            src={masterAvatar(master)!}
                            alt={master?.name || "Мастер"}
                            className="h-20 w-20 rounded-3xl border border-[var(--line)] object-cover shadow-lg"
                          />
                        ) : (
                          <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-[var(--line)] bg-white/80 text-2xl font-semibold">
                            {(master?.name || viewer?.displayName || "М").slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <h2 className="text-2xl font-semibold">{master?.name || "Профиль мастера"}</h2>
                      </div>
                    </div>
                    <button type="button" onClick={() => setMasterEditing((current) => !current)} className="rounded-full border border-[var(--line)] bg-white/80 px-4 py-2 text-sm">
                      {masterEditing ? "Скрыть редактирование" : "Изменить профиль"}
                    </button>
                  </div>

                  {masterEditing ? (
                    <form className="mt-6 space-y-4" onSubmit={saveMaster}>
                      <div className="rounded-3xl border border-[var(--line)] bg-white/80 p-5">
                        <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Аватар мастера</p>
                        <div className="mt-4 flex flex-wrap items-center gap-4">
                          {masterAvatarDraft ? (
                            <img
                              src={masterAvatarDraft}
                              alt={master?.name || "Аватар мастера"}
                              className="h-24 w-24 rounded-3xl border border-[var(--line)] object-cover shadow-lg"
                            />
                          ) : (
                            <div className="flex h-24 w-24 items-center justify-center rounded-3xl border border-[var(--line)] bg-white text-3xl font-semibold">
                              {(masterForm.name || viewer?.displayName || "М").slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div className="space-y-3">
                            <label className="inline-flex cursor-pointer items-center rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm">
                              Выбрать фото
                              <input type="file" accept="image/*" onChange={handleMasterAvatarChange} className="hidden" />
                            </label>
                            {masterAvatarDraft ? (
                              <button
                                type="button"
                                onClick={() => setMasterAvatarDraft("")}
                                className="block rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm"
                              >
                                Убрать фото
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <input value={masterForm.name} onChange={(event) => setMasterForm((current) => ({ ...current, name: event.target.value }))} placeholder="Имя мастера" className="w-full rounded-2xl border border-[var(--line)] bg-white/85 px-4 py-3 outline-none" />
                      <div className="grid gap-4 md:grid-cols-3">
                        <select value={masterForm.category} onChange={(event) => setMasterForm((current) => ({ ...current, category: event.target.value }))} className="rounded-2xl border border-[var(--line)] bg-white/85 px-4 py-3 outline-none">
                          {MASTER_CATEGORIES.map((category) => (
                            <option key={category} value={category}>{category}</option>
                          ))}
                        </select>
                        <input type="number" min={0} value={masterForm.priceMin} onChange={(event) => setMasterForm((current) => ({ ...current, priceMin: event.target.value }))} placeholder="Цена от" className="rounded-2xl border border-[var(--line)] bg-white/85 px-4 py-3 outline-none" />
                        <input type="number" min={0} value={masterForm.priceMax} onChange={(event) => setMasterForm((current) => ({ ...current, priceMax: event.target.value }))} placeholder="Цена до" className="rounded-2xl border border-[var(--line)] bg-white/85 px-4 py-3 outline-none" />
                      </div>
                      <textarea value={masterForm.description} onChange={(event) => setMasterForm((current) => ({ ...current, description: event.target.value }))} placeholder="Описание" className="min-h-32 w-full rounded-2xl border border-[var(--line)] bg-white/85 px-4 py-3 outline-none" />
                      <button type="submit" disabled={masterSaving} className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white disabled:opacity-60">{masterSaving ? "Сохраняю..." : "Сохранить профиль мастера"}</button>
                    </form>
                  ) : (
                    <div className="mt-6 grid gap-4">
                      <article className="rounded-3xl border border-[var(--line)] bg-white/80 p-5"><p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Имя</p><p className="mt-3 text-2xl font-semibold">{master?.name || "Не заполнено"}</p></article>
                      <article className="rounded-3xl border border-[var(--line)] bg-white/80 p-5"><p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Категория</p><p className="mt-3 text-xl font-medium">{master?.category || "Не выбрана"}</p></article>
                      <article className="rounded-3xl border border-[var(--line)] bg-white/80 p-5"><p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Бюджет</p><p className="mt-3 text-xl font-medium">{master?.priceMin ?? "—"} - {master?.priceMax ?? "—"} ₽</p></article>
                      <article className="rounded-3xl border border-[var(--line)] bg-white/80 p-5"><p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Описание</p><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{master?.description || "Пока без описания."}</p></article>
                    </div>
                  )}
                </section>

                <section className="rounded-[28px] border border-[var(--line)] bg-white/65 p-5">
                  <div className="flex items-center justify-between gap-3"><div><p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Заявки</p><h2 className="mt-3 text-2xl font-semibold">Новые заявки</h2></div><span className="rounded-full border border-[var(--line)] bg-white/80 px-3 py-1 text-xs text-[var(--muted)]">{newRequests.length}</span></div>
                  <div className="mt-6 space-y-4">
                    {newRequests.length === 0 ? <article className="rounded-3xl border border-dashed border-[var(--line)] bg-white/75 p-5 text-sm text-[var(--muted)]">Новых заявок пока нет.</article> : newRequests.map((booking) => (
                      <article key={booking.id} className="rounded-3xl border border-[var(--line)] bg-white/85 p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="text-lg font-semibold">{booking.service.name}</h3>
                            <p className="mt-2 text-sm text-[var(--muted)]">Клиент: {bookingClientName(booking)}</p>
                            <p className="mt-1 text-sm text-[var(--muted)]">Запись на: {formatDate(booking.date)}</p>
                            {booking.notes ? <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{booking.notes}</p> : null}
                          </div>
                          <span className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">{bookingStatusLabel(booking.status)}</span>
                        </div>
                        <div className="mt-5 flex flex-wrap gap-3">
                          <button type="button" onClick={() => updateStatus(booking.id, "CONFIRMED")} className="rounded-full border border-[var(--line)] bg-white/80 px-4 py-2 text-sm">Взять в работу</button>
                          <button type="button" onClick={() => updateStatus(booking.id, "CANCELLED")} className="rounded-full border border-[var(--line)] bg-white/80 px-4 py-2 text-sm">Отменить</button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            ) : null}

            {masterTab === "services" ? (
              <section className="rounded-[28px] border border-[var(--line)] bg-white/65 p-5">
                <div className="flex items-center justify-between gap-4"><div><p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Услуги</p><h2 className="mt-3 text-2xl font-semibold">Управление услугами</h2></div><span className="rounded-full border border-[var(--line)] bg-white/80 px-3 py-1 text-xs text-[var(--muted)]">{masterServices.length} услуг</span></div>
                <form className="mt-6 grid gap-4 rounded-[28px] border border-[var(--line)] bg-white/80 p-5" onSubmit={submitServiceDraft}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-sm text-[var(--muted)]">Название услуги</span>
                      <input
                        value={serviceDraft.name}
                        onChange={(event) => setServiceDraft((current) => ({ ...current, name: event.target.value }))}
                        placeholder="Например, Классический массаж"
                        className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 outline-none"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm text-[var(--muted)]">Цена</span>
                      <input
                        type="number"
                        min={0}
                        value={serviceDraft.price}
                        onChange={(event) => setServiceDraft((current) => ({ ...current, price: event.target.value }))}
                        placeholder="1500"
                        className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 outline-none"
                      />
                    </label>
                  </div>
                  <div className="grid gap-4 md:grid-cols-[1fr_220px]">
                    <label className="grid gap-2">
                      <span className="text-sm text-[var(--muted)]">Длительность</span>
                      <input
                        type="number"
                        min={1}
                        value={serviceDraft.durationValue}
                        onChange={(event) => setServiceDraft((current) => ({ ...current, durationValue: event.target.value }))}
                        placeholder="60"
                        className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 outline-none"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm text-[var(--muted)]">Единица</span>
                      <select
                        value={serviceDraft.durationUnit}
                        onChange={(event) => setServiceDraft((current) => ({ ...current, durationUnit: event.target.value as ServiceUnit }))}
                        className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 outline-none"
                      >
                        <option value="minutes">Минуты</option>
                        <option value="hours">Часы</option>
                        <option value="days">Дни</option>
                      </select>
                    </label>
                  </div>
                  <label className="grid gap-2">
                    <span className="text-sm text-[var(--muted)]">Описание услуги</span>
                    <textarea
                      value={serviceDraft.description}
                      onChange={(event) => setServiceDraft((current) => ({ ...current, description: event.target.value }))}
                      placeholder="Коротко опишите, что входит в услугу"
                      className="min-h-24 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 outline-none"
                    />
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <button type="submit" disabled={masterSaving} className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white disabled:opacity-60">
                      {masterSaving ? "Сохраняю..." : editingServiceId ? "Сохранить изменения" : "Добавить услугу"}
                    </button>
                    {editingServiceId ? (
                      <button type="button" onClick={resetServiceEditor} className="rounded-full border border-[var(--line)] bg-white px-5 py-3 text-sm">
                        Отменить редактирование
                      </button>
                    ) : null}
                  </div>
                </form>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {masterServices.length === 0 ? (
                    <article className="rounded-3xl border border-dashed border-[var(--line)] bg-white/75 p-5 text-sm text-[var(--muted)]">
                      Пока нет ни одной услуги. Добавьте первую через форму выше.
                    </article>
                  ) : (
                    masterServices.map((service) => (
                      <article key={service.id} className="rounded-3xl border border-[var(--line)] bg-white/85 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold">{service.name}</h3>
                            <p className="mt-2 text-sm text-[var(--muted)]">{service.price.toLocaleString("ru-RU")} ₽</p>
                            <p className="mt-1 text-sm text-[var(--muted)]">{formatServiceDuration(service.duration)}</p>
                          </div>
                          <div className="flex flex-col gap-2">
                            <button type="button" onClick={() => editService(service)} className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm">
                              Редактировать
                            </button>
                            <button type="button" onClick={() => removeService(service.id)} className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm text-red-600">
                              Удалить
                            </button>
                          </div>
                        </div>
                        {service.description ? <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{service.description}</p> : null}
                      </article>
                    ))
                  )}
                </div>
              </section>
            ) : null}

            {masterTab === "gallery" ? (
              <section className="rounded-[28px] border border-[var(--line)] bg-white/65 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Галерея</p>
                    <h2 className="mt-3 text-2xl font-semibold">Фотографии работ</h2>
                  </div>
                  <span className="rounded-full border border-[var(--line)] bg-white/80 px-3 py-1 text-xs text-[var(--muted)]">{masterGallery.length} фото</span>
                </div>

                <div className="mt-6 rounded-[28px] border border-[var(--line)] bg-white/80 p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white">
                      Добавить фото
                      <input type="file" accept="image/*" multiple onChange={handleGalleryUpload} className="hidden" />
                    </label>
                    <button
                      type="button"
                      onClick={() => persistMasterProfile(undefined, masterGallery)}
                      disabled={masterSaving}
                      className="rounded-full border border-[var(--line)] bg-white px-5 py-3 text-sm disabled:opacity-60"
                    >
                      {masterSaving ? "Сохраняю..." : "Сохранить галерею"}
                    </button>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {masterGallery.length === 0 ? (
                    <article className="rounded-3xl border border-dashed border-[var(--line)] bg-white/75 p-5 text-sm text-[var(--muted)]">
                      Пока нет фотографий. Загрузите первые снимки, чтобы клиенты видели ваши работы.
                    </article>
                  ) : (
                    masterGallery.map((photo, index) => (
                      <article key={photo.id} className="rounded-3xl border border-[var(--line)] bg-white/85 p-4">
                        <img src={photo.url} alt={photo.alt || `Фото ${index + 1}`} className="h-48 w-full rounded-3xl object-cover" />
                        <div className="mt-4 space-y-3">
                          <input
                            value={photo.alt}
                            onChange={(event) => updateGalleryPhotoAlt(photo.id, event.target.value)}
                            placeholder="Подпись к фото"
                            className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none"
                          />
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => moveGalleryPhoto(photo.id, "left")} disabled={index === 0} className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm disabled:opacity-40">
                              Сдвинуть влево
                            </button>
                            <button type="button" onClick={() => moveGalleryPhoto(photo.id, "right")} disabled={index === masterGallery.length - 1} className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm disabled:opacity-40">
                              Сдвинуть вправо
                            </button>
                            <button type="button" onClick={() => removeGalleryPhoto(photo.id)} className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm text-red-600">
                              Удалить
                            </button>
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            ) : null}

            {masterTab === "stats" ? (
              <section className="rounded-[28px] border border-[var(--line)] bg-white/65 p-5">
                <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Статистика</p>
                <h2 className="mt-3 text-2xl font-semibold">Работа по заявкам</h2>
                <div className="mt-6 grid gap-5 lg:grid-cols-3">
                  {statsColumns.map((column) => (
                    <div key={column.title} className="rounded-3xl border border-[var(--line)] bg-white/80 p-4">
                      <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-semibold">{column.title}</h3><span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--muted)]">{column.items.length}</span></div>
                      <div className="mt-4 space-y-3">
                        {column.items.length === 0 ? <article className="rounded-3xl border border-dashed border-[var(--line)] bg-white/75 p-4 text-sm text-[var(--muted)]">Пока пусто.</article> : column.items.map((booking) => (
                          <article key={booking.id} className="rounded-3xl border border-[var(--line)] bg-white/85 p-4 text-sm">
                            <h4 className="font-semibold">{booking.service.name}</h4>
                            <p className="mt-2 text-[var(--muted)]">Клиент: {bookingClientName(booking)}</p>
                            <p className="mt-1 text-[var(--muted)]">Создана: {formatDate(booking.date)}</p>
                            <p className="mt-1 text-[var(--muted)]">Взята в работу: {formatDate(booking.acceptedAt)}</p>
                            <p className="mt-1 text-[var(--muted)]">Завершена: {formatDate(booking.completedAt)}</p>
                            {booking.clientRating ? <p className="mt-2 text-[var(--muted)]">Оценка клиента: {booking.clientRating}/5</p> : null}
                            {booking.status === "CONFIRMED" ? <button type="button" onClick={() => updateStatus(booking.id, "COMPLETED")} className="mt-4 rounded-full border border-[var(--line)] bg-white/80 px-4 py-2 text-sm">Завершить услугу</button> : null}
                            {booking.status === "COMPLETED" && booking.clientRating == null ? <button type="button" onClick={() => setClientRateBookingId(booking.id)} className="mt-4 rounded-full border border-[var(--line)] bg-white/80 px-4 py-2 text-sm">Оценить клиента</button> : null}
                          </article>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-[28px] border border-[var(--line)] bg-white/65 p-5">
              <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Мой профиль</p>
              <div className="mt-5 space-y-4">
                <article className="rounded-3xl border border-[var(--line)] bg-white/80 p-5"><p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Имя</p><p className="mt-3 text-2xl font-semibold">{viewer?.displayName || "Не заполнено"}</p></article>
                <article className="rounded-3xl border border-[var(--line)] bg-white/80 p-5"><p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Возраст</p><p className="mt-3 text-2xl font-semibold">{viewer?.age ?? "—"}</p></article>
                <article className="rounded-3xl border border-[var(--line)] bg-white/80 p-5"><p className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">Рейтинг клиента</p><p className="mt-3 text-2xl font-semibold">{viewer?.clientRatingAverage?.toFixed(1) ?? "0.0"} ★</p></article>
              </div>
            </section>
            <section className="rounded-[28px] border border-[var(--line)] bg-white/65 p-5">
              <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Мои записи</p>
              <div className="mt-5 space-y-4">
                {bookings.length === 0 ? <article className="rounded-3xl border border-dashed border-[var(--line)] bg-white/75 p-5 text-sm text-[var(--muted)]">У вас пока нет записей.</article> : bookings.map((booking) => (
                  <article key={booking.id} className="rounded-3xl border border-[var(--line)] bg-white/85 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold">{booking.master.name}</h3>
                        <p className="mt-2 text-sm text-[var(--muted)]">Услуга: {booking.service.name}</p>
                        <p className="mt-1 text-sm text-[var(--muted)]">Дата: {formatDate(booking.date)}</p>
                      </div>
                      <span className="text-xs uppercase tracking-[0.24em] text-[var(--muted)]">{bookingStatusLabel(booking.status)}</span>
                    </div>
                    {booking.notes ? <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{booking.notes}</p> : null}
                    {booking.status === "COMPLETED" && !booking.review ? <button type="button" onClick={() => setReviewBookingId(booking.id)} className="mt-4 rounded-full border border-[var(--line)] bg-white/80 px-4 py-2 text-sm">Оценить мастера</button> : null}
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
