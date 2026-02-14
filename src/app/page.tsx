"use client";

import { useState } from 'react';

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;

const VIEWPORT_PRESETS = [
  { label: 'Desktop', w: 1920, h: 1080 },
  { label: 'Laptop', w: 1366, h: 768 },
  { label: 'Default', w: 1280, h: 720 },
  { label: 'Tablet', w: 768, h: 1024 },
  { label: 'Mobile', w: 390, h: 844 },
];

type ScraperResult = {
  siteUrl: string;
  pageTitle: string;
  screenshotUrl: string | null;
  viewport: { width: number; height: number };
  summary: string | null;
  importantContent: string[] | null;
};

export default function Home() {
  const [url, setUrl] = useState('');
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [result, setResult] = useState<ScraperResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function normalizeUrl(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    return `https://${trimmed}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fullUrl = normalizeUrl(url);
    if (!fullUrl) return;
    setError(null);
    setResult(null);
    setLoading(true);
    setLoadingStep('Opening page…');
    try {
      setTimeout(() => setLoadingStep('Capturing screenshot…'), 800);
      const r = await fetch('/api/scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl: fullUrl,
          viewportWidth: width,
          viewportHeight: height,
        }),
      });
      setLoadingStep('Analyzing content…');
      const text = await r.text();
      const data = text ? JSON.parse(text) : {};
      if (!r.ok) {
        setError(data?.error ?? data?.message ?? `HTTP ${r.status}`);
        return;
      }
      setResult(data as ScraperResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  }

  function applyPreset(w: number, h: number) {
    setWidth(w);
    setHeight(h);
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:max-w-3xl">
        <header className="mb-14 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-700/80 bg-zinc-900/80 px-4 py-1.5 text-xs font-medium text-zinc-400 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            AI-powered scraping
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            NzScraper
          </h1>
          <p className="mt-3 text-lg text-zinc-500">
            Enter a URL to capture a screenshot and get an AI summary with key takeaways
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8"
        >
          <div className="space-y-5">
            <div>
              <label htmlFor="url" className="mb-2 block text-sm font-medium text-zinc-300">
                Page URL
              </label>
              <input
                id="url"
                type="text"
                inputMode="url"
                autoComplete="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="example.com or https://example.com"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-3 text-white placeholder-zinc-500 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                required
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-zinc-300">Screenshot size</p>
              <div className="flex flex-wrap gap-2">
                {VIEWPORT_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyPreset(p.w, p.h)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      width === p.w && height === p.h
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400'
                        : 'border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex gap-3">
                <div className="flex-1">
                  <label htmlFor="width" className="sr-only">Width (px)</label>
                  <input
                    id="width"
                    type="number"
                    min={320}
                    max={3840}
                    value={width}
                    onChange={(e) => setWidth(Number(e.target.value) || DEFAULT_WIDTH)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <p className="mt-1 text-xs text-zinc-500">Width (px)</p>
                </div>
                <div className="flex-1">
                  <label htmlFor="height" className="sr-only">Height (px)</label>
                  <input
                    id="height"
                    type="number"
                    min={240}
                    max={2160}
                    value={height}
                    onChange={(e) => setHeight(Number(e.target.value) || DEFAULT_HEIGHT)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <p className="mt-1 text-xs text-zinc-500">Height (px)</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <button
              type="submit"
              disabled={loading || !url.trim().length}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 font-medium text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <svg
                    className="h-5 w-5 animate-spin text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>{loadingStep || 'Processing…'}</span>
                </>
              ) : (
                'Scrape & summarize'
              )}
            </button>
          </div>
        </form>

        {error && (
          <div
            className="mt-6 flex items-start gap-3 rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-red-200"
            role="alert"
          >
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
            </svg>
            <p>{error}</p>
          </div>
        )}

        {result && (
          <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900/50 shadow-2xl shadow-black/20 backdrop-blur sm:mt-14 result-card">
            <div className="border-b border-zinc-800 p-6 sm:p-8">
              <h2 className="text-lg font-semibold text-white">Result</h2>
              <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Page title</p>
                  <p className="mt-0.5 font-medium text-white">{result.pageTitle}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Viewport</p>
                  <p className="mt-0.5 text-zinc-300">
                    {result.viewport.width} × {result.viewport.height}
                  </p>
                </div>
                <a
                  href={result.siteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-sm text-emerald-400 hover:text-emerald-300 hover:underline"
                >
                  {result.siteUrl}
                </a>
              </div>
            </div>

            {result.screenshotUrl && (
              <div className="border-b border-zinc-800 p-6 sm:p-8">
                <h3 className="mb-3 text-sm font-medium text-zinc-400">Screenshot</h3>
                <a
                  href={result.screenshotUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-xl border border-zinc-700/80 ring-emerald-500/50 transition focus:outline-none focus:ring-2"
                >
                  <img
                    src={result.screenshotUrl}
                    alt={`Screenshot of ${result.pageTitle}`}
                    className="w-full object-contain"
                  />
                </a>
              </div>
            )}

            {result.summary && (
              <div className="border-b border-zinc-800 p-6 sm:p-8">
                <h3 className="mb-3 text-sm font-medium text-zinc-400">Summary</h3>
                <p className="leading-relaxed text-zinc-200">{result.summary}</p>
              </div>
            )}

            {result.importantContent && result.importantContent.length > 0 && (
              <div className="p-6 sm:p-8">
                <h3 className="mb-3 text-sm font-medium text-zinc-400">Key points</h3>
                <ul className="space-y-2.5">
                  {result.importantContent.map((item, i) => (
                    <li key={i} className="flex gap-3 text-zinc-200">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/90" aria-hidden />
                      <span className="leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
