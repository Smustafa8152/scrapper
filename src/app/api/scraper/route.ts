import { GoogleGenAI } from '@google/genai';
import chromium from '@sparticuz/chromium-min';
import puppeteer, { type Browser } from 'puppeteer-core';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const maxDuration = 60;

type ScraperBody = {
  siteUrl: string;
  viewportWidth?: number;
  viewportHeight?: number;
};

export async function POST(request: Request) {
  const body = (await request.json()) as ScraperBody;
  const { siteUrl, viewportWidth = 1280, viewportHeight = 720 } = body;

  const S3_CHROMIUM_URL = 'https://ershad-web.s3.me-south-1.amazonaws.com/chromium-v126.0.0-pack.tar';
  const useLocalChrome = !!process.env.CHROME_EXECUTABLE_PATH;
  const browserlessUrl = process.env.BROWSERLESS_URL ?? process.env.CHROME_REMOTE_WS_URL;

  let chromiumPackUrl: string | null = null;
  const raw = process.env.CHROMIUM_PACK_URL ?? S3_CHROMIUM_URL;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') chromiumPackUrl = raw;
  } catch {
    // ignore
  }
  if (!chromiumPackUrl) chromiumPackUrl = S3_CHROMIUM_URL;

  let browser: Browser;

  if (browserlessUrl) {
    const wsUrl = browserlessUrl.startsWith('ws') ? browserlessUrl : browserlessUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
    browser = await puppeteer.connect({ browserWSEndpoint: wsUrl });
  } else if (useLocalChrome) {
    browser = await puppeteer.launch({
      args: puppeteer.defaultArgs(),
      defaultViewport: { width: viewportWidth, height: viewportHeight },
      executablePath: process.env.CHROME_EXECUTABLE_PATH,
      headless: chromium.headless,
    });
  } else {
    const executablePath = await chromium.executablePath(chromiumPackUrl);
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: viewportWidth, height: viewportHeight },
      executablePath,
      headless: chromium.headless,
    });
  }

  const page = await browser.newPage();
  await page.setViewport({ width: viewportWidth, height: viewportHeight });
  await page.goto(siteUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  const pageTitle = await page.title();

  const pageText = await page.evaluate(() => {
    const main = document.querySelector('main') ?? document.querySelector('article') ?? document.body;
    return (main?.innerText ?? document.body?.innerText ?? '').slice(0, 50000);
  });

  const screenshot = await page.screenshot({ type: 'png' });
  if (browserlessUrl) browser.disconnect();
  else await browser.close();

  const screenshotBuffer = Buffer.isBuffer(screenshot) ? screenshot : Buffer.from(screenshot as unknown as ArrayBuffer);

  const resource = await new Promise<{ secure_url?: string }>((resolve, reject) => {
    cloudinary.uploader.upload_stream({}, (error: unknown, result: unknown) => {
      if (error) {
        reject(error);
        return;
      }
      resolve((result as { secure_url?: string }) ?? {});
    }).end(screenshotBuffer);
  });

  let summary = '';
  let importantContent: string[] = [];
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && pageText.trim()) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const prompt = `You are summarizing a web page. Extract a short summary and the most important points.

Page title: ${pageTitle}

Text content (excerpt):
${pageText.slice(0, 30000)}

Respond with ONLY a valid JSON object (no markdown, no code block) with exactly these keys:
- "summary": string (2-4 sentences)
- "importantContent": array of strings (bullet-worthy important points, max 15 items)`;
      const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      const text = (res as { text?: string })?.text?.trim() ?? '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { summary?: string; importantContent?: string[] };
        summary = parsed.summary ?? '';
        importantContent = Array.isArray(parsed.importantContent) ? parsed.importantContent : [];
      }
    } catch (e) {
      summary = `(Summary unavailable: ${e instanceof Error ? e.message : 'Gemini error'})`;
    }
  }

  return Response.json({
    siteUrl,
    pageTitle,
    screenshotUrl: resource.secure_url ?? null,
    viewport: { width: viewportWidth, height: viewportHeight },
    summary: summary || null,
    importantContent: importantContent.length ? importantContent : null,
  });
}
