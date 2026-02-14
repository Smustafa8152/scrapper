# Deploy scraper on Vercel – step by step

Chromium cannot run inside Vercel (missing system libs like `libnss3`). Use a **remote browser** (Browserless) so the API runs on Vercel and the browser runs elsewhere.

---

## Option A: Vercel + Browserless (recommended)

### 1. Get a Browserless token
- Go to [browserless.io](https://www.browserless.io).
- Sign up and open the dashboard.
- Copy your **API token** (or create one). Free tier has a limited number of sessions.

### 2. Set the WebSocket URL in Vercel
- In Vercel: your project → **Settings** → **Environment Variables**.
- Add:
  - **Name:** `BROWSERLESS_URL`
  - **Value:** `wss://production-sfo.browserless.io?token=YOUR_TOKEN`  
    (replace `YOUR_TOKEN` with your real token; use another region like `production-lon` or `production-ams` if you prefer)
- Save and apply to **Production** (and Preview if you use it).

### 3. Set Cloudinary env vars (if not already)
- In the same **Environment Variables** section, ensure you have:
  - `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
  - `NEXT_PUBLIC_CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`

### 4. Deploy
- Push to your repo or run `vercel --prod`.
- After deploy, call your API (e.g. `POST /api/scraper` with `{ "siteUrl": "https://example.com" }`).

### 5. Local development
- Either set `CHROME_EXECUTABLE_PATH` to your local Chrome (e.g. `C:\Program Files\Google\Chrome\Application\chrome.exe`) and run without Browserless,
- Or set `BROWSERLESS_URL` locally too and use the same remote browser.

---

## Option B: AWS Lambda + your S3 Chromium .tar

Use this only if you want to run Chromium on Lambda (not on Vercel).

### 1. Upload Chromium .tar to S3
- Keep your `chromium-v126.0.0-pack.tar` (or similar) in a bucket.
- Note the public URL, e.g. `https://your-bucket.s3.region.amazonaws.com/chromium-v126.0.0-pack.tar`.

### 2. Create a Lambda layer with shared libraries (step by step)

You need a Lambda layer that provides `libnss3.so`, `libnspr4.so`, and `libsqlite3.so` so Chromium can load. Build it on **Amazon Linux 2** (same as Lambda) so the libraries are compatible. Easiest way: use Docker.

**Using a Windows EC2?** Yes. Install **Docker Desktop** on the Windows EC2, then follow the same steps below. Docker runs an Amazon Linux 2 container, so the `.so` files will be correct for Lambda. When you’re done, copy `chromium-libs-layer.zip` off the EC2 (e.g. via RDP, or upload it to S3 from the EC2) and create the layer in the AWS Console (Step 2.6). You cannot build the layer directly on Windows (no Linux `.so` files); the Docker container is what gives you the right binaries.

#### Step 2.1 – Install Docker (if you don’t have it)
- Windows: [Docker Desktop](https://docs.docker.com/desktop/install/windows-install/).
- Mac: [Docker Desktop](https://docs.docker.com/desktop/install/mac-install/).
- Make sure Docker is running.

#### Step 2.2 – Create a build folder
On your machine (PowerShell or bash):
```bash
mkdir chromium-libs-layer
cd chromium-libs-layer
```

#### Step 2.3 – Run Amazon Linux 2 in Docker and install packages
From your `chromium-libs-layer` folder, start a container that uses Amazon Linux 2 and mounts that folder as `/out`:

- **PowerShell:**  
  `docker run --rm -it -v "${PWD}:/out" amazonlinux:2 /bin/bash`
- **Cmd:**  
  `docker run --rm -it -v "%cd%:/out" amazonlinux:2 /bin/bash`
- **Mac/Linux:**  
  `docker run --rm -it -v "$(pwd):/out" amazonlinux:2 /bin/bash`

Inside the container, run:
```bash
yum update -y
yum install -y zip

# Packages that provide libnss3, libnspr4, libsqlite3 and their deps
yum install -y nss nspr nss-util nss-softokn-freebl sqlite
```

#### Step 2.4 – Copy the .so files into a `lib` folder
Still inside the same container:
```bash
mkdir -p /out/lib
cp -L /usr/lib64/libnss3.so    /out/lib/ 2>/dev/null || true
cp -L /usr/lib64/libnssutil3.so /out/lib/ 2>/dev/null || true
cp -L /usr/lib64/libnspr4.so    /out/lib/ 2>/dev/null || true
cp -L /usr/lib64/libplc4.so     /out/lib/ 2>/dev/null || true
cp -L /usr/lib64/libplds4.so    /out/lib/ 2>/dev/null || true
cp -L /usr/lib64/libsqlite3.so  /out/lib/ 2>/dev/null || true
cp -L /usr/lib64/libfreebl3.so  /out/lib/ 2>/dev/null || true
cp -L /usr/lib64/libsoftokn3.so /out/lib/ 2>/dev/null || true
```

*(`-L` copies the real file if something is a symlink.)*

Create the zip **inside the container** (so you don’t need `zip` on Windows) and write it to `/out`:
```bash
cd /out
zip -r chromium-libs-layer.zip lib
```
Then exit:
```bash
exit
```

#### Step 2.5 – Check the zip (on your machine)
Back in your `chromium-libs-layer` folder you should see `chromium-libs-layer.zip`. The zip must contain a top-level **`lib`** folder (`lib/libnss3.so`, etc.) so Lambda gets `/opt/lib/*.so`. Lambda adds `/opt/lib` to `LD_LIBRARY_PATH`, so Chromium will find the libraries.

*(If you prefer to zip on Windows: install 7-Zip or use “Compress to Zip” on the `lib` folder, and name the archive `chromium-libs-layer.zip`. The zip must contain a `lib` folder at the top level.)*

#### Step 2.6 – Create the layer in AWS
- Open **AWS Console** → **Lambda** → **Layers** → **Create layer**.
- **Name:** e.g. `chromium-libs`.
- **Upload** your `chromium-libs-layer.zip`.
- **Compatible runtimes:** e.g. Node.js 18.x, Node.js 20.x (match your function).
- **Compatible architectures:** x86_64 or arm64 (match your function).
- Click **Create**.

#### Step 2.7 – Attach the layer to your function
- Go to your Lambda function → **Configuration** → **Layers** → **Add a layer**.
- Choose **Custom layers**, pick the layer you created (e.g. `chromium-libs`), pick the version, then **Add**.

After this, your function will have `/opt/lib` (with the `.so` files) in `LD_LIBRARY_PATH`, so Chromium can load them.

### 3. Configure the Lambda function
- Set env var: `CHROMIUM_PACK_URL` = your S3 .tar URL.
- Attach the layer from step 2.
- Use Node 20.x (or 22.x), memory ≥ 1024 MB, timeout ≥ 30 s.

### 4. Deploy your app to Lambda
- Build and deploy your Next.js API (e.g. with Serverless, SST, or a custom Lambda handler) so the function runs in Lambda and uses `CHROMIUM_PACK_URL`.

---

## Summary

| Where you deploy | What to do |
|------------------|------------|
| **Vercel**       | Set `BROWSERLESS_URL` (Option A). Do **not** use S3 .tar on Vercel; it will still fail with `libnss3`. |
| **Lambda**       | Set `CHROMIUM_PACK_URL` to your S3 .tar and add a layer with `libnss3` / `libnspr4` / `libsqlite3` (Option B). |
