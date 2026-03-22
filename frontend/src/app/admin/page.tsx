"use client";

import { FormEvent, useMemo, useState } from "react";

type CreateMasterPayload = {
  telegramId: string;
  name: string;
  description?: string;
  category: string;
  priceMin?: number;
  priceMax?: number;
  services?: Array<{
    name: string;
    description?: string;
    price: number;
    duration: number;
  }>;
  photos?: Array<{
    url: string;
    alt?: string;
  }>;
};

function parseServices(input: string): CreateMasterPayload["services"] {
  const rows = input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (rows.length === 0) {
    return [];
  }

  return rows.map((row) => {
    const [name, price, duration, description] = row.split("|").map((part) => part.trim());

    return {
      name,
      price: Number(price),
      duration: Number(duration),
      description: description || undefined,
    };
  });
}

function parsePhotos(input: string): CreateMasterPayload["photos"] {
  const rows = input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (rows.length === 0) {
    return [];
  }

  return rows.map((row) => {
    const [url, alt] = row.split("|").map((part) => part.trim());
    return {
      url,
      alt: alt || undefined,
    };
  });
}

export default function AdminPage() {
  const [telegramId, setTelegramId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [servicesInput, setServicesInput] = useState("");
  const [photosInput, setPhotosInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const examples = useMemo(
    () => ({
      services: "Стрижка|1500|60|Мужская стрижка\nБритье|900|30|Опасная бритва",
      photos: "https://example.com/photo-1.jpg|Фото профиля\nhttps://example.com/photo-2.jpg|Рабочее место",
    }),
    [],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    const payload: CreateMasterPayload = {
      telegramId,
      name,
      description: description || undefined,
      category,
      priceMin: priceMin ? Number(priceMin) : undefined,
      priceMax: priceMax ? Number(priceMax) : undefined,
      services: parseServices(servicesInput),
      photos: parsePhotos(photosInput),
    };

    try {
      const response = await fetch("/api/admin/masters", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { error?: string; name?: string };
      if (!response.ok) {
        throw new Error(Array.isArray(data.error) ? data.error.join(", ") : data.error || "Не удалось создать мастера");
      }

      setMessage(`Мастер ${data.name ?? name} успешно добавлен.`);
      setTelegramId("");
      setName("");
      setDescription("");
      setCategory("");
      setPriceMin("");
      setPriceMax("");
      setServicesInput("");
      setPhotosInput("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Не удалось создать мастера");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 py-6 sm:px-6">
      <section className="glass rounded-[32px] p-6 sm:p-8">
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted)]">Admin</p>
          <h1 className="text-3xl font-semibold sm:text-4xl">Добавление мастеров</h1>
          <p className="max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">
            Здесь можно создать пользователя-мастера, сразу добавить услуги и фотографии. Telegram ID
            должен быть реальным ID пользователя Telegram.
          </p>
        </div>

        <form className="mt-8 grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm text-[var(--muted)]">Telegram ID</span>
              <input
                required
                value={telegramId}
                onChange={(event) => setTelegramId(event.target.value)}
                className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
                placeholder="123456789"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-[var(--muted)]">Имя мастера</span>
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
                placeholder="Алина Смирнова"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-2">
              <span className="text-sm text-[var(--muted)]">Категория</span>
              <input
                required
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
                placeholder="Маникюр"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-[var(--muted)]">Цена от</span>
              <input
                value={priceMin}
                onChange={(event) => setPriceMin(event.target.value)}
                className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
                placeholder="1500"
                inputMode="decimal"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-[var(--muted)]">Цена до</span>
              <input
                value={priceMax}
                onChange={(event) => setPriceMax(event.target.value)}
                className="rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
                placeholder="3000"
                inputMode="decimal"
              />
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-sm text-[var(--muted)]">Описание</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-28 rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none"
              placeholder="Опытный мастер с плотной записью и сильным портфолио."
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
            <span className="text-xs text-[var(--muted)]">
              Одна услуга на строку: `Название|Цена|Длительность в минутах|Описание`
            </span>
          </label>

          <label className="grid gap-2">
            <span className="text-sm text-[var(--muted)]">Фотографии</span>
            <textarea
              value={photosInput}
              onChange={(event) => setPhotosInput(event.target.value)}
              className="min-h-28 rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 font-mono text-sm outline-none"
              placeholder={examples.photos}
            />
            <span className="text-xs text-[var(--muted)]">
              Одна фотография на строку: `URL|Alt`
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Сохраняю..." : "Добавить мастера"}
            </button>

            {message ? <p className="text-sm text-green-700">{message}</p> : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
        </form>
      </section>
    </main>
  );
}
