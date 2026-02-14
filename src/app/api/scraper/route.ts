import chromium from '@sparticuz/chromium-min';
import puppeteer from 'puppeteer-core';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const maxDuration = 20;

export async function POST(request: Request) {
  const { siteUrl } = await request.json();

  const isServerless =
    !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
    !!process.env.AWS_EXECUTION_ENV ||
    !!process.env.VERCEL;
  const isLocal = !!process.env.CHROME_EXECUTABLE_PATH;

  let executablePath: string;
  if (process.env.CHROME_EXECUTABLE_PATH) {
    executablePath = process.env.CHROME_EXECUTABLE_PATH;
  } else if (isServerless) {
    executablePath = await chromium.executablePath(
      'https://ershad-web.s3.me-south-1.amazonaws.com/chromium-v126.0.0-pack.tar'
    );
  } else {
    throw new Error(
      'For local development, set CHROME_EXECUTABLE_PATH to your Chrome/Chromium executable (e.g. "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe")'
    );
  }

  const browser = await puppeteer.launch({
    args: isLocal ? puppeteer.defaultArgs() : chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath,
    headless: chromium.headless,
  });

  const page = await browser.newPage();
  await page.goto(siteUrl);
  const pageTitle = await page.title();
  const screenshot = await page.screenshot();
  await browser.close();

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