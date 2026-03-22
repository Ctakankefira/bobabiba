"use client";

import { useEffect, useMemo, useState } from "react";

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

type Master = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  priceMin: number | null;
  priceMax: number | null;
  rating: number;
  services: Service[];
  photos: Photo[];
};

type ViewerProfile = {
  id: string;
  username?: string | null;
  role: "CLIENT" | "MASTER";
  master?: { id: string } | null;
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

const categories = ["Все", "Барберы", "Маникюр", "Брови", "Массаж", "Тату"];

function formatPrice(master: Master) {
  if (master.priceMin && master.priceMax) {
    return `${master.priceMin.toLocaleString("ru-RU")} - ${master.priceMax.toLocaleString("ru-RU")} ₽`;
  }

  if (master.priceMin) {
    return `от ${master.priceMin.toLocaleString("ru-RU")} ₽`;
  }

  return "Цена по запросу";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function Home() {
  const [masters, setMasters] = useState<Master[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("Все");
  const [viewerName, setViewerName] = useState("Гость");
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [viewerProfile, setViewerProfile] = useState<ViewerProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const [roleSaving, setRoleSaving] = useState(false);

  const [selectedMaster, setSelectedMaster] = useState<Master | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");
  const [bookingMessage, setBookingMessage] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSaving, setBookingSaving] = useState(false);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    webApp?.ready();
    webApp?.expand();

    const firstName = webApp?.initDataUnsafe?.user?.first_name;
    if (firstName) {
      setViewerName(firstName);
    }
  }, []);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    const initData = webApp?.initData;

    async function bootstrapViewer() {
      if (!initData) {
        setAuthLoading(false);
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
          throw new Error("Auth failed");
        }

        const authData = (await authResponse.json()) as {
          access_token: string;
        };

        setAuthToken(authData.access_token);

        const profileResponse = await fetch("/api/users/profile", {
          headers: {
            Authorization: `Bearer ${authData.access_token}`,
          },
        });

        if (!profileResponse.ok) {
          throw new Error("Profile load failed");
        }

        const profile = (await profileResponse.json()) as ViewerProfile;
        setViewerProfile(profile);

        const roleChoiceKey = `role-choice:${profile.id}`;
        const hasRoleChoice = window.localStorage.getItem(roleChoiceKey);
        if (!hasRoleChoice) {
          setRolePickerOpen(true);
        }
      } catch {
        setAuthToken(null);
        setViewerProfile(null);
      } finally {
        setAuthLoading(false);
      }
    }

    bootstrapViewer();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadMasters() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedCategory !== "Все") {
        params.set("category", selectedCategory);
      }

      try {
        const response = await fetch(`/api/masters?${params.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Не удалось загрузить каталог");
        }

        const data = (await response.json()) as Master[];
        setMasters(data);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Неизвестная ошибка");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadMasters();

    return () => controller.abort();
  }, [selectedCategory]);

  const stats = useMemo(
    () => [
      { label: "Мастеров", value: String(masters.length) },
      {
        label: "Категорий",
        value: String(new Set(masters.map((master) => master.category)).size || 0),
      },
      {
        label: "Средний рейтинг",
        value:
          masters.length > 0
            ? (
                masters.reduce((sum, master) => sum + master.rating, 0) / masters.length
              ).toFixed(1)
            : "0.0",
      },
    ],
    [masters],
  );

  async function chooseRole(role: "CLIENT" | "MASTER") {
    if (!authToken || !viewerProfile) {
      return;
    }

    setRoleSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/users/role", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ role }),
      });

      if (!response.ok) {
        throw new Error("Role update failed");
      }

      const updatedProfile = (await response.json()) as ViewerProfile;
      setViewerProfile(updatedProfile);
      window.localStorage.setItem(`role-choice:${updatedProfile.id}`, role);
      setRolePickerOpen(false);
    } catch {
      setError("Не удалось сохранить выбранную роль");
    } finally {
      setRoleSaving(false);
    }
  }

  function openBooking(master: Master) {
    setSelectedMaster(master);
    setSelectedServiceId(master.services[0]?.id ?? "");
    setBookingDate("");
    setBookingNotes("");
    setBookingMessage(null);
    setBookingError(null);
  }

  async function submitBooking() {
    if (!authToken || !selectedMaster || !selectedServiceId || !bookingDate) {
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
          masterId: selectedMaster.id,
          serviceId: selectedServiceId,
          date: bookingDate,
          notes: bookingNotes || undefined,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Не удалось создать запись");
      }

      setBookingMessage("Запись создана. Проверь кабинет клиента для статуса.");
      setTimeout(() => {
        setSelectedMaster(null);
      }, 1200);
    } catch (submitError) {
      setBookingError(submitError instanceof Error ? submitError.message : "Не удалось создать запись");
    } finally {
      setBookingSaving(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-4 sm:px-6 sm:py-6">
      {rolePickerOpen ? (
        <section className="mb-6 rounded-[32px] border border-[var(--line)] bg-[var(--surface-strong)] p-6 shadow-lg">
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Вход</p>
          <h2 className="mt-3 text-2xl font-semibold">Кто ты в приложении?</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            Выбери роль на старте. Клиент будет искать мастеров и записываться, а мастер
            сможет заполнить свою анкету и принимать заявки.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => chooseRole("CLIENT")}
              disabled={roleSaving}
              className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white transition disabled:opacity-60"
            >
              {roleSaving ? "Сохраняю..." : "Я клиент"}
            </button>
            <button
              type="button"
              onClick={() => chooseRole("MASTER")}
              disabled={roleSaving}
              className="rounded-full border border-[var(--line)] bg-white/80 px-5 py-3 text-sm font-medium transition disabled:opacity-60"
            >
              {roleSaving ? "Сохраняю..." : "Я мастер"}
            </button>
          </div>
        </section>
      ) : null}

      {selectedMaster ? (
        <section className="mb-6 rounded-[32px] border border-[var(--line)] bg-[var(--surface-strong)] p-6 shadow-lg">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Booking</p>
              <h2 className="mt-3 text-2xl font-semibold">Запись к {selectedMaster.name}</h2>
            </div>
            <button
              type="button"
              onClick={() => setSelectedMaster(null)}
              className="rounded-full border border-[var(--line)] px-4 py-2 text-sm"
            >
              Закрыть
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm text-[var(--muted)]">Услуга</span>
              <select
                value={selectedServiceId}
                onChange={(event) => setSelectedServiceId(event.target.value)}
                className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
              >
                {selectedMaster.services.map((service) => (
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
                className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
              />
            </label>
          </div>

          <label className="mt-4 grid gap-2">
            <span className="text-sm text-[var(--muted)]">Комментарий</span>
            <textarea
              value={bookingNotes}
              onChange={(event) => setBookingNotes(event.target.value)}
              className="min-h-24 rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
              placeholder="Например: нужен утренний слот или есть пожелания по услуге."
            />
          </label>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={submitBooking}
              disabled={bookingSaving || !bookingDate || !selectedServiceId}
              className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white transition disabled:opacity-60"
            >
              {bookingSaving ? "Создаю запись..." : "Записаться"}
            </button>
            {bookingMessage ? <p className="text-sm text-green-700">{bookingMessage}</p> : null}
            {bookingError ? <p className="text-sm text-red-600">{bookingError}</p> : null}
          </div>
        </section>
      ) : null}

      <section className="glass fade-up overflow-hidden rounded-[32px]">
        <div className="grid gap-8 px-5 py-6 sm:px-8 sm:py-8 lg:grid-cols-[1.35fr_0.9fr] lg:px-10">
          <div className="space-y-6">
            <div className="inline-flex items-center rounded-full border border-[var(--line)] bg-white/60 px-4 py-2 text-sm text-[var(--muted)]">
              Telegram Mini App
            </div>
            <div className="space-y-4">
              <p className="text-sm uppercase tracking-[0.28em] text-[var(--muted)]">
                {viewerName}, подбор мастеров рядом
              </p>
              {authLoading ? null : viewerProfile ? (
                <div className="inline-flex items-center rounded-full border border-[var(--line)] bg-white/60 px-4 py-2 text-sm text-[var(--muted)]">
                  Роль: {viewerProfile.role === "MASTER" ? "мастер" : "клиент"}
                </div>
              ) : null}
              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
                Маркетплейс мастеров с быстрым входом через Telegram
              </h1>
              <p className="max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
                Смотри каталог, сравнивай цены и собирай живой сервис: мастер заполняет
                анкету, клиент выбирает исполнителя и записывается прямо внутри Mini App.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="/cabinet"
                className="rounded-full bg-[var(--foreground)] px-4 py-2 text-sm text-white transition hover:opacity-90"
              >
                Личный кабинет
              </a>
              {viewerProfile?.role === "MASTER" ? (
                <a
                  href="/cabinet"
                  className="rounded-full border border-[var(--line)] bg-white/80 px-4 py-2 text-sm transition hover:bg-white"
                >
                  Заполнить анкету мастера
                </a>
              ) : null}
              {categories.map((category) => {
                const active = category === selectedCategory;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory(category)}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      active
                        ? "bg-[var(--accent)] text-white shadow-lg shadow-orange-200"
                        : "border border-[var(--line)] bg-white/70 text-[var(--foreground)] hover:bg-white"
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {stats.map((stat, index) => (
              <article
                key={stat.label}
                className="rounded-[24px] border border-[var(--line)] bg-[var(--surface-strong)] p-5 fade-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="text-3xl font-semibold">{stat.value}</div>
                <div className="mt-2 text-sm text-[var(--muted)]">{stat.label}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="glass h-72 animate-pulse rounded-[28px]" />
            ))}
          </div>
        ) : error ? (
          <div className="glass rounded-[28px] p-8 text-center">
            <h2 className="text-2xl font-semibold">Каталог пока недоступен</h2>
            <p className="mt-3 text-[var(--muted)]">{error}</p>
          </div>
        ) : masters.length === 0 ? (
          <div className="glass rounded-[28px] p-8 text-center">
            <h2 className="text-2xl font-semibold">Мастеров пока нет</h2>
            <p className="mt-3 text-[var(--muted)]">
              Добавьте записи в базу или заполните анкету мастера, и каталог сразу начнёт
              наполняться.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {masters.map((master, index) => (
              <article
                key={master.id}
                className="glass fade-up overflow-hidden rounded-[28px]"
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <div className="h-44 bg-[linear-gradient(135deg,#f6c39d_0%,#f4a361_48%,#cf5f2e_100%)] p-5 text-white">
                  <div className="flex items-start justify-between gap-4">
                    <span className="rounded-full bg-white/20 px-3 py-1 text-xs uppercase tracking-[0.2em]">
                      {master.category}
                    </span>
                    <span className="rounded-full bg-white/20 px-3 py-1 text-sm">
                      {master.rating.toFixed(1)} ★
                    </span>
                  </div>
                  <div className="mt-12">
                    <h2 className="text-2xl font-semibold">{master.name}</h2>
                    <p className="mt-2 text-sm text-white/80">
                      {master.description || "Профиль мастера скоро будет дополнен."}
                    </p>
                  </div>
                </div>
                <div className="space-y-5 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--muted)]">Бюджет</span>
                    <strong>{formatPrice(master)}</strong>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm text-[var(--muted)]">Услуги</div>
                    {master.services.length > 0 ? (
                      <ul className="space-y-2">
                        {master.services.slice(0, 3).map((service) => (
                          <li
                            key={service.id}
                            className="flex items-center justify-between rounded-2xl bg-white/70 px-3 py-2 text-sm"
                          >
                            <span>{service.name}</span>
                            <span className="text-[var(--muted)]">{service.duration} мин</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="rounded-2xl bg-white/70 px-3 py-2 text-sm text-[var(--muted)]">
                        Услуги пока не добавлены.
                      </p>
                    )}
                  </div>
                  {viewerProfile?.role === "CLIENT" && master.services.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => openBooking(master)}
                      className="w-full rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white transition hover:opacity-90"
                    >
                      Записаться
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
