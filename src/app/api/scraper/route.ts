import chromium from '@sparticuz/chromium-min';
import puppeteer, { type Browser } from 'puppeteer-core';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const maxDuration = 20;

export async function POST(request: Request) {
  const { siteUrl } = await request.json();

  const S3_CHROMIUM_URL = 'https://ershad-web.s3.me-south-1.amazonaws.com/chromium-v126.0.0-pack.tar';
  const useLocalChrome = !!process.env.CHROME_EXECUTABLE_PATH;
  const browserlessUrl = process.env.BROWSERLESS_URL ?? process.env.CHROME_REMOTE_WS_URL;

  // Only use a value that is a real https/http URL (never a Windows path - package would treat C:\ as protocol "c:" and fail)
  let chromiumPackUrl: string | null = null;
  const raw = process.env.CHROMIUM_PACK_URL ?? S3_CHROMIUM_URL;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') chromiumPackUrl = raw;
  } catch {
    // not a valid URL
  }
  if (!chromiumPackUrl) chromiumPackUrl = S3_CHROMIUM_URL;

  let browser: Browser;

  if (browserlessUrl) {
    const wsUrl = browserlessUrl.startsWith('ws') ? browserlessUrl : browserlessUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
    browser = await puppeteer.connect({ browserWSEndpoint: wsUrl });
  } else if (useLocalChrome) {
    browser = await puppeteer.launch({
      args: puppeteer.defaultArgs(),
      defaultViewport: chromium.defaultViewport,
      executablePath: process.env.CHROME_EXECUTABLE_PATH,
      headless: chromium.headless,
    });
  } else {
    // chromiumPackUrl is always a valid https/http URL here (never a Windows path)
    const executablePath = await chromium.executablePath(chromiumPackUrl);
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
    });
  }

  const page = await browser.newPage();
  await page.goto(siteUrl);
  const pageTitle = await page.title();
  const screenshot = await page.screenshot();
  if (browserlessUrl) browser.disconnect();
  else await browser.close();

  const resource = await new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream({}, function (error: unknown, result: unknown) {
      if (error) {
        reject(error);
        return;
      }
      resolve(result);
    })
    .end(screenshot);
  });

  return Response.json({
    siteUrl,
    pageTitle,
    resource
  })
}