"use client";

import { useEffect, useState } from "react";

type Service = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  duration: number;
};

type Photo = {
  id: string;
  url: string;
  alt: string | null;
};

type Review = {
  id: string;
  rating: number;
  comment?: string | null;
  client: {
    username?: string | null;
  };
  booking: {
    service: {
      name: string;
    };
  };
};

type Master = {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  priceMin?: number | null;
  priceMax?: number | null;
  rating: number;
  services: Service[];
  photos: Photo[];
  reviews: Review[];
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

function formatPrice(master: Master) {
  if (master.priceMin && master.priceMax) {
    return `${master.priceMin.toLocaleString("ru-RU")} - ${master.priceMax.toLocaleString("ru-RU")} ₽`;
  }

  if (master.priceMin) {
    return `от ${master.priceMin.toLocaleString("ru-RU")} ₽`;
  }

  return "Цена по запросу";
}

export default function MasterProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [master, setMaster] = useState<Master | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");
  const [bookingSaving, setBookingSaving] = useState(false);
  const [bookingMessage, setBookingMessage] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  useEffect(() => {
    window.Telegram?.WebApp?.ready();
    window.Telegram?.WebApp?.expand();

    async function bootstrap() {
      const { id } = await params;

      try {
        const masterResponse = await fetch(`/api/masters/${id}`);
        const masterData = (await masterResponse.json()) as Master & { error?: string };
        if (!masterResponse.ok) {
          throw new Error(masterData.error || "Не удалось загрузить профиль мастера");
        }

        setMaster(masterData);
        setSelectedServiceId(masterData.services[0]?.id ?? "");

        const initData = window.Telegram?.WebApp?.initData;
        if (initData) {
          const authResponse = await fetch("/api/auth/telegram", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ initData }),
          });

          if (authResponse.ok) {
            const authData = (await authResponse.json()) as { access_token: string };
            setAuthToken(authData.access_token);
          }
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить мастера");
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, [params]);

  async function submitBooking() {
    if (!authToken || !master || !selectedServiceId || !bookingDate) {
      return;
    }

    const normalizedDate = new Date(bookingDate);
    if (Number.isNaN(normalizedDate.getTime())) {
      setBookingError("Укажите корректную дату и время");
      return;
    }

    setBookingSaving(true);
    setBookingMessage(null);
    setBookingError(null);

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          masterId: master.id,
          serviceId: selectedServiceId,
          date: normalizedDate.toISOString(),
          notes: bookingNotes || undefined,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Не удалось создать запись");
      }

      setBookingMessage("Запись отправлена мастеру. Следите за статусом в личном кабинете.");
      setBookingNotes("");
      setBookingDate("");
    } catch (submitError) {
      setBookingError(submitError instanceof Error ? submitError.message : "Не удалось создать запись");
    } finally {
      setBookingSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-6">
        <div className="glass h-96 animate-pulse rounded-[32px]" />
      </main>
    );
  }

  if (!master) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-6">
        <section className="glass rounded-[32px] p-8">
          <h1 className="text-2xl font-semibold">Профиль мастера недоступен</h1>
          <p className="mt-3 text-[var(--muted)]">{error || "Не удалось найти мастера."}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-6">
      <section className="glass overflow-hidden rounded-[32px]">
        <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">{master.category}</p>
            <h1 className="mt-4 text-4xl font-semibold">{master.name}</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
              {master.description || "Мастер пока не добавил подробное описание."}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <span className="rounded-full bg-white/80 px-4 py-2 text-sm">
                Рейтинг: {master.rating.toFixed(1)}
              </span>
              <span className="rounded-full bg-white/80 px-4 py-2 text-sm">{formatPrice(master)}</span>
            </div>
          </div>

          <section className="rounded-[28px] border border-[var(--line)] bg-white/70 p-5">
            <h2 className="text-xl font-semibold">Записаться</h2>
            <div className="mt-4 grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm text-[var(--muted)]">Услуга</span>
                <select
                  value={selectedServiceId}
                  onChange={(event) => setSelectedServiceId(event.target.value)}
                  className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
                >
                  {master.services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} • {service.price.toLocaleString("ru-RU")} ₽ • {service.duration} мин
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-[var(--muted)]">Дата и время</span>
                <input
                  type="datetime-local"
                  value={bookingDate}
                  onChange={(event) => setBookingDate(event.target.value)}
                  min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
                    .toISOString()
                    .slice(0, 16)}
                  className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm text-[var(--muted)]">Комментарий</span>
                <textarea
                  value={bookingNotes}
                  onChange={(event) => setBookingNotes(event.target.value)}
                  className="min-h-24 rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
                />
              </label>

              <button
                type="button"
                onClick={submitBooking}
                disabled={!authToken || bookingSaving || !selectedServiceId || !bookingDate}
                className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white transition disabled:opacity-60"
              >
                {bookingSaving ? "Отправляю запись..." : "Записаться к мастеру"}
              </button>

              {!authToken ? (
                <p className="text-sm text-[var(--muted)]">Откройте профиль внутри Telegram, чтобы записаться.</p>
              ) : null}
              {bookingMessage ? <p className="text-sm text-green-700">{bookingMessage}</p> : null}
              {bookingError ? <p className="text-sm text-red-600">{bookingError}</p> : null}
            </div>
          </section>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-[28px] border border-[var(--line)] bg-white/60 p-5">
          <h2 className="text-xl font-semibold">Услуги</h2>
          <div className="mt-4 grid gap-3">
            {master.services.map((service) => (
              <article key={service.id} className="rounded-2xl bg-white/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <strong>{service.name}</strong>
                  <span className="text-sm text-[var(--muted)]">{service.duration} мин</span>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {service.description || "Описание услуги пока не заполнено."}
                </p>
                <p className="mt-3 text-sm font-medium">{service.price.toLocaleString("ru-RU")} ₽</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-[var(--line)] bg-white/60 p-5">
          <h2 className="text-xl font-semibold">Отзывы клиентов</h2>
          <div className="mt-4 grid gap-3">
            {master.reviews.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Пока нет отзывов. Первый отзыв появится после завершённой услуги.</p>
            ) : (
              master.reviews.map((review) => (
                <article key={review.id} className="rounded-2xl bg-white/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <strong>@{review.client.username || "клиент"}</strong>
                    <span className="text-sm text-[var(--muted)]">{review.rating}/5</span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted)]">{review.booking.service.name}</p>
                  {review.comment ? <p className="mt-3 text-sm">{review.comment}</p> : null}
                </article>
              ))
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
