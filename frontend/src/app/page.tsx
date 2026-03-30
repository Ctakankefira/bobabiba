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
  avatarUrl?: string | null;
  services: Service[];
  photos: Photo[];
};

type ViewerProfile = {
  id: string;
  username?: string | null;
  isAdmin?: boolean;
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

function getMasterAvatar(master: Master) {
  return master.avatarUrl ?? master.photos[0]?.url ?? null;
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
  const [isAdmin, setIsAdmin] = useState(false);


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

        setRolePickerOpen(true);

        const adminResponse = await fetch("/api/admin/access", {
          headers: {
            Authorization: `Bearer ${authData.access_token}`,
          },
        });

        if (adminResponse.ok) {
          const adminData = (await adminResponse.json()) as { allowed?: boolean };
          setIsAdmin(Boolean(adminData.allowed));
        }
      } catch {
        setAuthToken(null);
        setViewerProfile(null);
        setIsAdmin(false);
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
      setRolePickerOpen(false);
    } catch {
      setError("Не удалось сохранить выбранную роль");
    } finally {
      setRoleSaving(false);
    }
  }

  function reopenRolePicker() {
    if (!viewerProfile) {
      return;
    }

    setRolePickerOpen(true);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-4 sm:px-6 sm:py-6">
      {rolePickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm">
          <section className="w-full max-w-xl rounded-[32px] border border-[var(--line)] bg-[var(--surface-strong)] p-6 shadow-lg sm:p-8">
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
            {isAdmin || viewerProfile?.isAdmin ? (
              <a
                href="/admin"
                className="rounded-full border border-[var(--line)] bg-white/80 px-5 py-3 text-sm font-medium transition hover:bg-white"
              >
                РђРґРјРёРЅ-РїР°РЅРµР»СЊ
              </a>
            ) : null}
            </div>
          </section>
        </div>
      ) : null}

      <section className="glass fade-up overflow-hidden rounded-[32px]">
        <div className="grid gap-8 px-5 py-6 sm:px-8 sm:py-8 lg:grid-cols-[1.35fr_0.9fr] lg:px-10">
          <div className="space-y-6">
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
                className="inline-flex min-w-[190px] items-center justify-center rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white shadow-lg shadow-orange-200 transition hover:opacity-90"
              >
                {viewerProfile?.role === "MASTER" ? "Открыть профиль мастера" : "Открыть профиль клиента"}
              </a>
              {viewerProfile ? (
                <button
                  type="button"
                  onClick={reopenRolePicker}
                  className="rounded-full border border-[var(--line)] bg-white/80 px-4 py-2 text-sm transition hover:bg-white"
                >
                  Сменить роль
                </button>
              ) : null}
              {viewerProfile?.role === "MASTER" ? (
                <a
                  href="/cabinet"
                  className="rounded-full border border-[var(--line)] bg-white/80 px-4 py-2 text-sm transition hover:bg-white"
                >
                  Заполнить анкету мастера
                </a>
              ) : null}
              {isAdmin ? (
                <a
                  href="/admin"
                  className="rounded-full border border-[var(--line)] bg-white/80 px-4 py-2 text-sm transition hover:bg-white"
                >
                  Админ-панель
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
                  <div className="mt-6 flex items-end gap-4">
                    {getMasterAvatar(master) ? (
                      <img
                        src={getMasterAvatar(master)!}
                        alt={master.name}
                        className="h-20 w-20 rounded-3xl border border-white/25 object-cover shadow-lg"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-white/25 bg-white/15 text-2xl font-semibold">
                        {master.name.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div>
                    <h2 className="text-2xl font-semibold">{master.name}</h2>
                    <p className="mt-2 text-sm text-white/80">
                      {master.description || "Профиль мастера скоро будет дополнен."}
                    </p>
                    </div>
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
                  <a
                    href={`/masters/${master.id}`}
                    className="inline-flex w-full items-center justify-center rounded-full bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white transition hover:opacity-90"
                  >
                    Открыть профиль
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
