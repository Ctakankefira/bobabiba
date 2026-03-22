"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type ViewerProfile = {
  id: string;
  username?: string | null;
  role: "CLIENT" | "MASTER";
  master?: { id: string } | null;
};

type Service = {
  id: string;
  name: string;
  price: number;
  duration: number;
};

type Photo = {
  id: string;
  url: string;
  alt: string | null;
};

type Booking = {
  id: string;
  date: string;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
  notes: string | null;
  clientRating?: number | null;
  clientRatingComment?: string | null;
  service: {
    id: string;
    name: string;
    price: number;
    duration: number;
  };
  master: {
    id: string;
    name: string;
  };
  client: {
    id: string;
    username?: string | null;
  };
  review?: {
    id: string;
    rating: number;
    comment?: string | null;
  } | null;
};

type MasterProfile = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  priceMin: number | null;
  priceMax: number | null;
  services: Service[];
  photos: Photo[];
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

function parseServices(input: string) {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((row) => {
      const [name, price, duration, description] = row.split("|").map((part) => part.trim());
      return {
        name,
        price: Number(price),
        duration: Number(duration),
        description: description || undefined,
      };
    });
}

function parsePhotos(input: string) {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((row) => {
      const [url, alt] = row.split("|").map((part) => part.trim());
      return {
        url,
        alt: alt || undefined,
      };
    });
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const ROLE_CHOICE_PREFIX = "role-choice:";

export default function CabinetPage() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [viewerProfile, setViewerProfile] = useState<ViewerProfile | null>(null);
  const [masterProfile, setMasterProfile] = useState<MasterProfile | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [servicesInput, setServicesInput] = useState("");
  const [photosInput, setPhotosInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [ratingSavingId, setRatingSavingId] = useState<string | null>(null);
  const [reviewBookingId, setReviewBookingId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);

  const examples = useMemo(
    () => ({
      services: "Стрижка|1500|60|Мужская стрижка\nБритье|900|30|Опасная бритва",
      photos: "https://example.com/photo-1.jpg|Фото профиля\nhttps://example.com/photo-2.jpg|Рабочее место",
    }),
    [],
  );

  function leaveCabinet() {
    window.location.href = "/";
  }

  function changeRole() {
    if (viewerProfile) {
      window.localStorage.removeItem(`${ROLE_CHOICE_PREFIX}${viewerProfile.id}`);
    }
    window.location.href = "/?pickRole=1";
  }

  const activeBookings = bookings.filter((booking) =>
    ["PENDING", "CONFIRMED"].includes(booking.status),
  );
  const historyBookings = bookings.filter((booking) =>
    ["CANCELLED", "COMPLETED"].includes(booking.status),
  );
  const pendingClientReview = bookings.find(
    (booking) => booking.status === "COMPLETED" && !booking.review,
  );

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    webApp?.ready();
    webApp?.expand();

    const initData = webApp?.initData;

    async function bootstrap() {
      if (!initData) {
        setLoading(false);
        return;
      }

      try {
        const authResponse = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ initData }),
        });

        if (!authResponse.ok) {
          throw new Error("Не удалось авторизоваться");
        }

        const authData = (await authResponse.json()) as { access_token: string };
        setAuthToken(authData.access_token);

        const profileResponse = await fetch("/api/users/profile", {
          headers: {
            Authorization: `Bearer ${authData.access_token}`,
          },
        });

        if (!profileResponse.ok) {
          throw new Error("Не удалось загрузить профиль");
        }

        const profile = (await profileResponse.json()) as ViewerProfile;
        setViewerProfile(profile);

        const bookingsResponse = await fetch("/api/bookings", {
          headers: {
            Authorization: `Bearer ${authData.access_token}`,
          },
        });

        if (bookingsResponse.ok) {
          const bookingsData = (await bookingsResponse.json()) as Booking[];
          setBookings(bookingsData);
        }

        if (profile.role === "MASTER") {
          const masterResponse = await fetch("/api/masters/me", {
            headers: {
              Authorization: `Bearer ${authData.access_token}`,
            },
          });

          if (masterResponse.ok) {
            const masterData = (await masterResponse.json()) as MasterProfile | null;
            if (masterData) {
              setMasterProfile(masterData);
              setName(masterData.name ?? "");
              setDescription(masterData.description ?? "");
              setCategory(masterData.category ?? "");
              setPriceMin(masterData.priceMin?.toString() ?? "");
              setPriceMax(masterData.priceMax?.toString() ?? "");
              setServicesInput(
                masterData.services
                  .map((service) =>
                    [service.name, service.price, service.duration, ""].join("|"),
                  )
                  .join("\n"),
              );
              setPhotosInput(
                masterData.photos
                  .map((photo) => [photo.url, photo.alt ?? ""].join("|"))
                  .join("\n"),
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
    if (viewerProfile?.role === "CLIENT" && pendingClientReview && !reviewBookingId) {
      setReviewBookingId(pendingClientReview.id);
      setReviewRating(5);
      setReviewComment("");
    }
  }, [pendingClientReview, reviewBookingId, viewerProfile?.role]);

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authToken) return;

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/masters/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name,
          description,
          category,
          priceMin: priceMin ? Number(priceMin) : undefined,
          priceMax: priceMax ? Number(priceMax) : undefined,
          services: parseServices(servicesInput),
          photos: parsePhotos(photosInput),
        }),
      });

      const data = (await response.json()) as MasterProfile & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Не удалось сохранить анкету");
      }

      setMasterProfile(data);
      setBookings(data.bookings ?? bookings);
      setMessage("Анкета мастера сохранена.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить анкету");
    } finally {
      setSaving(false);
    }
  }

  async function updateBookingStatus(bookingId: string, status: "CONFIRMED" | "CANCELLED" | "COMPLETED") {
    if (!authToken) return;

    try {
      const response = await fetch(`/api/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ status }),
      });

      const data = (await response.json()) as Booking & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Не удалось обновить статус");
      }

      setBookings((current) => current.map((booking) => (booking.id === bookingId ? data : booking)));
      setMasterProfile((current) =>
        current
          ? {
              ...current,
              bookings: current.bookings.map((booking) => (booking.id === bookingId ? data : booking)),
            }
          : current,
      );
      setMessage("Статус записи обновлён.");
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Не удалось обновить статус");
    }
  }

  async function rateClient(bookingId: string, rating: number) {
    if (!authToken) return;

    setRatingSavingId(bookingId);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/bookings/${bookingId}/client-rating`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ rating }),
      });

      const data = (await response.json()) as Booking & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Не удалось оценить клиента");
      }

      setBookings((current) => current.map((booking) => (booking.id === bookingId ? data : booking)));
      setMasterProfile((current) =>
        current
          ? {
              ...current,
              bookings: current.bookings.map((booking) => (booking.id === bookingId ? data : booking)),
            }
          : current,
      );
      setMessage("Оценка клиента сохранена.");
    } catch (ratingError) {
      setError(ratingError instanceof Error ? ratingError.message : "Не удалось оценить клиента");
    } finally {
      setRatingSavingId(null);
    }
  }

  async function submitMasterReview() {
    if (!authToken || !reviewBookingId) return;

    setReviewSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/bookings/${reviewBookingId}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          rating: reviewRating,
          comment: reviewComment || undefined,
        }),
      });

      const data = (await response.json()) as Booking & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Не удалось отправить отзыв");
      }

      setBookings((current) =>
        current.map((booking) => (booking.id === reviewBookingId ? data : booking)),
      );
      setReviewBookingId(null);
      setReviewComment("");
      setReviewRating(5);
      setMessage("Спасибо! Ваш отзыв сохранён и уже влияет на рейтинг мастера.");
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Не удалось отправить отзыв");
    } finally {
      setReviewSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-6">
        <div className="glass h-96 animate-pulse rounded-[32px]" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-6">
      {viewerProfile?.role === "CLIENT" && reviewBookingId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
          <section className="w-full max-w-2xl rounded-[32px] border border-[var(--line)] bg-[var(--surface-strong)] p-6 shadow-lg sm:p-8">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Отзыв</p>
            <h2 className="mt-3 text-3xl font-semibold">Как прошла услуга?</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              Поставьте оценку мастеру и при желании напишите отзыв. Он появится в профиле мастера.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setReviewRating(value)}
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    reviewRating === value
                      ? "bg-[var(--accent)] text-white shadow-lg shadow-orange-200"
                      : "border border-[var(--line)] bg-white/80"
                  }`}
                >
                  {value} ★
                </button>
              ))}
            </div>

            <label className="mt-5 grid gap-2">
              <span className="text-sm text-[var(--muted)]">Отзыв</span>
              <textarea
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                className="min-h-28 rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
                placeholder="Расскажите, что понравилось, чтобы другие клиенты лучше понимали стиль мастера."
              />
            </label>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={submitMasterReview}
                disabled={reviewSaving}
                className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white transition disabled:opacity-60"
              >
                {reviewSaving ? "Сохраняю отзыв..." : "Отправить отзыв"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <section className="glass rounded-[32px] p-6 sm:p-8">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Cabinet</p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">
          {viewerProfile?.role === "MASTER" ? "Кабинет мастера" : "Кабинет клиента"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)] sm:text-base">
          {viewerProfile?.username ? `Ваш username: @${viewerProfile.username}` : "Профиль загружен через Telegram."}
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={leaveCabinet}
            className="rounded-full bg-[var(--foreground)] px-4 py-2 text-sm text-white transition hover:opacity-90"
          >
            Выйти в каталог
          </button>
          <button
            type="button"
            onClick={changeRole}
            className="rounded-full border border-[var(--line)] bg-white/80 px-4 py-2 text-sm transition hover:bg-white"
          >
            Сменить роль
          </button>
        </div>

        {message ? <p className="mt-4 text-sm text-green-700">{message}</p> : null}
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        {viewerProfile?.role === "MASTER" ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.9fr]">
            <form className="grid gap-4" onSubmit={handleSaveProfile}>
              <label className="grid gap-2">
                <span className="text-sm text-[var(--muted)]">Имя</span>
                <input
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="grid gap-2">
                  <span className="text-sm text-[var(--muted)]">Категория</span>
                  <input
                    required
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm text-[var(--muted)]">Цена от</span>
                  <input
                    value={priceMin}
                    onChange={(event) => setPriceMin(event.target.value)}
                    className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm text-[var(--muted)]">Цена до</span>
                  <input
                    value={priceMax}
                    onChange={(event) => setPriceMax(event.target.value)}
                    className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
                  />
                </label>
              </div>

              <label className="grid gap-2">
                <span className="text-sm text-[var(--muted)]">Описание</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="min-h-28 rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-[var(--muted)]">Услуги</span>
                <textarea
                  value={servicesInput}
                  onChange={(event) => setServicesInput(event.target.value)}
                  className="min-h-32 rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 font-mono text-sm outline-none"
                  placeholder={examples.services}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-[var(--muted)]">Фотографии</span>
                <textarea
                  value={photosInput}
                  onChange={(event) => setPhotosInput(event.target.value)}
                  className="min-h-28 rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 font-mono text-sm outline-none"
                  placeholder={examples.photos}
                />
              </label>

              <button
                type="submit"
                disabled={saving}
                className="w-fit rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white transition disabled:opacity-60"
              >
                {saving ? "Сохраняю..." : masterProfile ? "Обновить профиль" : "Создать профиль"}
              </button>
            </form>

            <section className="rounded-[28px] border border-[var(--line)] bg-white/60 p-5">
              <h2 className="text-xl font-semibold">Мои записи</h2>
              <div className="mt-4 grid gap-3">
                {bookings.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">Пока никто не записался.</p>
                ) : (
                  bookings.map((booking) => (
                    <article key={booking.id} className="rounded-2xl bg-white/80 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <strong>{booking.service.name}</strong>
                        <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                          {booking.status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        Клиент: @{booking.client.username || "без username"}
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{formatDate(booking.date)}</p>
                      {booking.notes ? <p className="mt-2 text-sm">{booking.notes}</p> : null}
                      {booking.clientRating ? (
                        <p className="mt-2 text-sm text-[var(--muted)]">Оценка клиента: {booking.clientRating}/5</p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => updateBookingStatus(booking.id, "CONFIRMED")}
                          className="rounded-full border border-[var(--line)] px-3 py-2 text-xs"
                        >
                          Подтвердить
                        </button>
                        <button
                          type="button"
                          onClick={() => updateBookingStatus(booking.id, "CANCELLED")}
                          className="rounded-full border border-[var(--line)] px-3 py-2 text-xs"
                        >
                          Отменить
                        </button>
                        <button
                          type="button"
                          onClick={() => updateBookingStatus(booking.id, "COMPLETED")}
                          className="rounded-full border border-[var(--line)] px-3 py-2 text-xs"
                        >
                          Завершить
                        </button>
                      </div>
                      {booking.status === "COMPLETED" ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-[var(--muted)]">Оценить клиента:</span>
                          {[1, 2, 3, 4, 5].map((value) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => rateClient(booking.id, value)}
                              disabled={ratingSavingId === booking.id}
                              className={`rounded-full px-3 py-1 text-xs transition ${
                                booking.clientRating === value
                                  ? "bg-[var(--accent)] text-white"
                                  : "border border-[var(--line)] bg-white"
                              } disabled:opacity-60`}
                            >
                              {value}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <section className="rounded-[28px] border border-[var(--line)] bg-white/60 p-5">
              <h2 className="text-xl font-semibold">Мой профиль</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <article className="rounded-2xl bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Роль</p>
                  <p className="mt-2 text-lg font-semibold">Клиент</p>
                </article>
                <article className="rounded-2xl bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Username</p>
                  <p className="mt-2 text-lg font-semibold">
                    {viewerProfile?.username ? `@${viewerProfile.username}` : "Не указан"}
                  </p>
                </article>
                <article className="rounded-2xl bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Всего записей</p>
                  <p className="mt-2 text-lg font-semibold">{bookings.length}</p>
                </article>
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-[28px] border border-[var(--line)] bg-white/60 p-5">
              <h2 className="text-xl font-semibold">Текущие записи</h2>
              <div className="mt-4 grid gap-3">
                {activeBookings.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">
                    У вас пока нет активных записей. Откройте каталог на главной странице и запишитесь к мастеру.
                  </p>
                ) : (
                  activeBookings.map((booking) => (
                    <article key={booking.id} className="rounded-2xl bg-white/80 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <strong>{booking.master.name}</strong>
                        <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                          {booking.status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-[var(--muted)]">{booking.service.name}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{formatDate(booking.date)}</p>
                      {booking.notes ? <p className="mt-2 text-sm">{booking.notes}</p> : null}
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-[var(--line)] bg-white/60 p-5">
              <h2 className="text-xl font-semibold">История</h2>
              <div className="mt-4 grid gap-3">
                {historyBookings.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">Завершённые и отменённые записи появятся здесь.</p>
                ) : (
                  historyBookings.map((booking) => (
                    <article key={booking.id} className="rounded-2xl bg-white/80 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <strong>{booking.master.name}</strong>
                        <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                          {booking.status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-[var(--muted)]">{booking.service.name}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{formatDate(booking.date)}</p>
                      {booking.notes ? <p className="mt-2 text-sm">{booking.notes}</p> : null}
                    </article>
                  ))
                )}
              </div>
            </section>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
