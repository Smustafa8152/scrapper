"use client";

// Why use client here? I could have dumped this into its own client component,
// but this is simpler for the sake of the example!

import { useState } from 'react';

export default function Home() {
  const [result, setResults]   = useState<object>();

  async function handleOnClick() {
    try {
      const r = await fetch('/api/scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl: 'https://spacejelly.dev'
        })
      });
      const text = await r.text();
      const results = text ? JSON.parse(text) : { error: `HTTP ${r.status}` };
      if (!r.ok) setResults({ error: results?.message ?? results?.error ?? results, status: r.status });
      else setResults(results);
    } catch (e) {
      setResults({ error: e instanceof Error ? e.message : 'Request failed' });
    }
  }

  return (
    <main className="hero bg-base-200 min-h-screen">
      <div className="hero-content text-center">
        <div className="max-w-xl">
          <h1 className="text-5xl font-bold mb-8">Let&apos;s scrape something!</h1>
          <p className="mb-2">
            Click the button to test out your new scraper.
          </p>
          <p className="text-sm text-zinc-700 italic mb-6">
            Psst. Make sure you <a className="text-blue-500 underline" href="https://spacejelly.dev" target="_blank">build it first</a>!
          </p>
          <p className="mb-6">
            <button className="btn btn-primary" onClick={handleOnClick}>Get Started</button>
          </p>
          {result && (
            <div className="grid">
              <pre className="bg-zinc-200 text-left py-4 px-5 rounded overflow-x-scroll">
                <code>{JSON.stringify(result, undefined, 2)}</code>
              </pre>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}