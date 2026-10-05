# Deploy ขึ้น Vercel

ระบบนี้ deploy เป็น **2 โปรเจคบน Vercel จาก repo เดียวกัน** + ฐานข้อมูล PostgreSQL + บริการส่งอีเมล

```
Browser ──▶ tracker-web (Vercel, Next.js) ──HTTPS + API_TOKEN──▶ tracker-api (Vercel, Fastify) ──▶ PostgreSQL (Neon/Supabase)
                                                                        └──▶ SMTP (Resend ฯลฯ)
```

> ทุกอย่างควรอยู่ **ภูมิภาคเดียวกัน** (ตั้งไว้แล้วเป็น Singapore `sin1` ใน `apps/*/vercel.json`) — เพราะทุกหน้าเรียก web → api → database ต่อกัน

## ก่อนเริ่ม

- [ ] โค้ดอยู่บน GitHub (`git init` → push)
- [ ] บัญชี Vercel ที่เชื่อม GitHub แล้ว
- [ ] `npm run typecheck && npm run lint && npm test` ผ่านในเครื่อง

> **ไฟล์ env สำเร็จรูป**: `apps/api/.env.vercel` และ `apps/web/.env.vercel` (ไม่ถูก commit) มีทุกตัวแปรที่ต้องใช้ และใส่ `API_TOKEN` ที่ตรงกันไว้แล้ว — กรอกค่าที่ว่าง → ลบบรรทัดที่ไม่ใช้ → copy ทั้งไฟล์ไปวางที่ **Settings → Environment Variables** ของแต่ละโปรเจค
> (ถ้ายังไม่มีไฟล์นี้ ให้สร้างจากตัวอย่างใน `.env.example` ที่ root)

## 1. ฐานข้อมูล PostgreSQL

เลือกอย่างใดอย่างหนึ่ง และเลือก region **Singapore (ap-southeast-1)**

| | `DATABASE_URL` (ใช้ตอนรัน — pooled) | `DIRECT_URL` (ใช้ตอน migrate — direct) |
|---|---|---|
| **Neon** (มีใน Vercel Marketplace) | Connection string ที่เปิด *Connection pooling* (host มี `-pooler`) | ปิด pooling |
| **Supabase** | Connect → *Transaction pooler* (port 6543) | Connect → *Session pooler* (port 5432) |

> **Neon ผ่าน Vercel Marketplace** (แนะนำ): ติดตั้งที่โปรเจค **API** → Vercel ใส่ `DATABASE_URL` (pooled) และ `DATABASE_URL_UNPOOLED` (direct) ให้อัตโนมัติ — ระบบใช้ `DATABASE_URL_UNPOOLED` สำหรับ migration ได้เลย ไม่ต้องตั้ง `DIRECT_URL` เอง
> ถ้าเปิด **Preview branching** (แต่ละ preview ได้ฐานข้อมูลสำเนาของตัวเอง) ให้ตั้ง `RUN_MIGRATIONS=1` เฉพาะ environment **Preview** เพื่อให้ preview ได้ schema ล่าสุดด้วย

ฐานข้อมูลต้องใช้ TimeZone = UTC (ค่าเริ่มต้นของ Neon/Supabase อยู่แล้ว — API จะเตือนใน log ถ้าไม่ใช่)

## 2. บริการส่งอีเมล (SMTP)

ตอนพัฒนาใช้ Mailpit แต่ production ต้องใช้ของจริง เช่น

- **Resend** (แนะนำ): เพิ่มโดเมนและยืนยัน DNS → สร้าง API key → `SMTP_URL=smtps://resend:<API_KEY>@smtp.resend.com:465`, `MAIL_FROM="Project Tracker <no-reply@โดเมนของคุณ>"`
- **Gmail**: เปิด 2FA → สร้าง App Password → `SMTP_URL=smtps://you%40gmail.com:<APP_PASSWORD>@smtp.gmail.com:465` (ส่งได้จำกัดต่อวัน เหมาะกับใช้ส่วนตัว)

> ถ้ารหัสมีอักขระพิเศษ ต้อง URL-encode (เช่น `@` → `%40`)

## 2.1 เข้าสู่ระบบด้วย Google (ไม่บังคับ)

1. [Google Cloud Console](https://console.cloud.google.com/) → สร้าง/เลือกโปรเจค → **APIs & Services → OAuth consent screen** → ตั้งชื่อแอป, อีเมลติดต่อ, scope แค่ `openid` และ `email` → **Publish app** (ถ้ายังเป็น *Testing* จะเข้าได้เฉพาะ test users ที่เพิ่มไว้)
2. **Credentials → Create credentials → OAuth client ID** → ชนิด **Web application**
3. **Authorized redirect URIs** ใส่ `<APP_URL>/auth/google/callback` เช่น `https://tracker-web.vercel.app/auth/google/callback` (ใส่ `http://localhost:3000/auth/google/callback` เพิ่มได้ถ้าจะใช้ client เดียวกันตอนพัฒนา)
4. นำ Client ID / Client secret ไปใส่ `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` ที่โปรเจค **API** (web ไม่ต้องตั้งอะไรเพิ่ม)

> ถ้าเปลี่ยนโดเมนของ web ต้องเพิ่ม redirect URI ใหม่ใน Google ด้วย — ไม่งั้น Google จะขึ้น `redirect_uri_mismatch`
> บัญชีที่มีอยู่แล้ว (สมัครด้วยอีเมลเดียวกัน) จะถูกผูกกับ Google อัตโนมัติ · บัญชีที่สร้างจาก Google ไม่มีรหัสผ่าน — ตั้งได้ผ่าน "ลืมรหัสผ่าน"

## 3. สร้าง API_TOKEN

```bash
node -e "console.log(crypto.randomBytes(32).toString('hex'))"
```

ใช้ค่าเดียวกันทั้ง 2 โปรเจค — เป็นกุญแจระหว่าง web กับ api (API ปฏิเสธการเริ่มทำงานถ้าไม่ได้ตั้งหรือสั้นกว่า 32 ตัว)

## 4. โปรเจค API (`tracker-api`)

Vercel → **Add New → Project** → เลือก repo

| ตั้งค่า | ค่า |
|---|---|
| Root Directory | `apps/api` |
| Framework Preset | **Other** — `apps/api/vercel.json` ตั้ง `"framework": null` ไว้แล้ว ซึ่งจะ override ค่าในหน้า Settings |
| Build Command | มาจาก `apps/api/vercel.json` → `npm run vercel-build` (generate Prisma, migrate เฉพาะ production, bundle API) |
| Node.js Version | 24.x |

**Environment Variables** (Production และ Preview):

| ชื่อ | ค่า |
|---|---|
| `DATABASE_URL` | pooled URL จากขั้น 1 (Neon integration ใส่ให้เอง) |
| `DIRECT_URL` | direct URL จากขั้น 1 — ไม่ต้องใส่ถ้ามี `DATABASE_URL_UNPOOLED` จาก Neon integration |
| `DB_POOL_MAX` | `5` (ลดได้ถ้า plan ฐานข้อมูลจำกัด connection) |
| `API_TOKEN` | จากขั้น 3 |
| `APP_URL` | URL ของ web เช่น `https://tracker-web.vercel.app` (ถ้ายังไม่รู้ ใส่ชั่วคราวแล้วแก้ในขั้น 6) |
| `SMTP_URL`, `MAIL_FROM` | จากขั้น 2 |
| `APP_TIMEZONE` | `Asia/Bangkok` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | (ไม่บังคับ) จากขั้น 2.1 — ไม่ใส่ = ไม่มีปุ่ม Google |
> **วิธี build ของ API**: `scripts/vercel-build.mjs` ใช้ esbuild รวม `src/server.ts` และ `@tracker/shared` เป็นไฟล์เดียว แล้วเขียนออกเป็น `.vercel/output` ([Build Output API](https://vercel.com/docs/build-output-api)) Vercel จะ deploy ไฟล์นั้นตรงๆ โดยไม่ compile TypeScript เอง (ถ้าให้ Vercel compile เอง import ที่ลงท้าย `.ts` และ `@tracker/shared` จะหาไม่เจอ ทุก request ได้ 500 `ERR_MODULE_NOT_FOUND`) จึง**ไม่ต้องตั้ง** `VERCEL_EXPERIMENTAL_BACKENDS` และถ้าเคยตั้งไว้ให้ลบออก ใน build log ต้องเห็นบรรทัด `Wrote .vercel/output`

กด Deploy → ตอน production deploy จะ `prisma migrate deploy` ให้เอง (preview deploy จะข้าม เพื่อไม่แตะฐานข้อมูลจริง)

ตรวจ: เปิด `https://<api>.vercel.app/health` ต้องได้ `{"ok":true,"db":"up"}`

## 5. โปรเจค Web (`tracker-web`)

**Add New → Project** → repo เดิม

| ตั้งค่า | ค่า |
|---|---|
| Root Directory | `apps/web` |
| Framework Preset | Next.js |

**Environment Variables:**

| ชื่อ | ค่า |
|---|---|
| `API_URL` | URL ของ API จากขั้น 4 เช่น `https://tracker-api.vercel.app` |
| `API_TOKEN` | ค่าเดียวกับขั้น 3 |
| `APP_TIMEZONE` | `Asia/Bangkok` |

## 6. เชื่อมสองฝั่ง

1. ถ้า `APP_URL` ของ API ยังเป็นค่าชั่วคราว → แก้เป็น URL จริงของ web → **Redeploy** โปรเจค API
2. (ถ้าใช้โดเมนของตัวเอง) ตั้งโดเมนที่โปรเจค web แล้วแก้ `APP_URL` ให้ตรง

## 7. ตรวจหลัง deploy

- [ ] `/health` ของ API ตอบ `db: "up"`
- [ ] เปิด web → ถูกพาไป `/login`
- [ ] สมัคร → ได้อีเมลยืนยันจริง → กดลิงก์ → เข้าแดชบอร์ด
- [ ] สร้างโปรเจค / อัปเดตความคืบหน้า / ออกจากระบบ
- [ ] ลืมรหัสผ่าน → ได้อีเมล → ตั้งรหัสใหม่ได้
- [ ] (ถ้าเปิด Google) กด "ดำเนินการต่อด้วย Google" → เลือกบัญชี → เข้าแดชบอร์ด
- [ ] เรียก API ตรงๆ โดยไม่มี token ต้องได้ 401

## ย้ายข้อมูลจากเครื่อง

ในเครื่อง: หน้า **ข้อมูล → ดาวน์โหลดไฟล์สำรอง** → บน production สมัคร/เข้าสู่ระบบ → หน้า **ข้อมูล → กู้คืน** (ไฟล์ไม่เกิน 3.5 MB)

## กู้ข้อมูลที่ถูกลบ (Neon)

ถ้าข้อมูลของบัญชีหนึ่งหายไป (เช่น เผลอลบ หรือกู้คืน File ผิด) และไม่มี File สำรอง:

1. Neon Console → Project → **Branches** → **Create branch** → เลือก **Past point in time** เป็นเวลาก่อนข้อมูลหาย → Create (ย้อนได้ตามระยะ history ของแพ็กเกจ — ยิ่งเร็วยิ่งดี)
2. คัดลอก connection string ของ branch ใหม่ และของฐานข้อมูลหลัก (production)
3. ในเครื่อง ที่โฟลเดอร์หลักของ repo — รันแบบดูก่อน (ไม่เขียนอะไร):
   ```bash
   RECOVER_FROM="<branch url>" RECOVER_TO="<production url>" npm run db:recover -w @tracker/api -- --email you@example.com
   ```
4. ถ้ารายการ Project ที่จะกู้ถูกต้อง เติม `--apply` ต่อท้ายแล้วรันอีกครั้ง
5. ลบ branch ใน Neon เมื่อเสร็จ

สคริปต์**เพิ่มอย่างเดียว** — คัดลอก Project (พร้อมงานและประวัติ) ที่มีใน branch แต่ไม่มีใน production ไม่แก้หรือลบข้อมูลปัจจุบัน และรันซ้ำได้ปลอดภัย

## ข้อควรรู้

- **Preview deployments**: ถ้าเปิด *Vercel Authentication* (Deployment Protection) ไว้ที่โปรเจค API, web ฉบับ preview จะเรียก API ฉบับ preview ไม่ได้ — ปล่อยให้ preview ของ web ชี้ไปที่ API production หรือใช้ *Protection Bypass for Automation*. API ปลอดภัยด้วย `API_TOKEN` อยู่แล้ว
- **Rate limit** เก็บในตาราง `rate_limits` ของ Postgres จึงใช้ได้แม้ Vercel มีหลาย instance — เสริมด้วย *Vercel Firewall → Rate Limiting* ได้
- **Migrations ใหม่**: แก้ `apps/api/prisma/schema.prisma` → `npm run db:migrate` ในเครื่อง → commit โฟลเดอร์ `prisma/migrations` → production deploy จะ apply ให้
- **ขีดจำกัดของ Vercel**: request body ไม่เกิน 4.5 MB (ตั้ง limit ระบบไว้ 4 MB แล้ว)
- **Log**: Vercel → โปรเจค → Logs (API log เป็น JSON และบอกเหตุผลเมื่อไม่ได้ส่งอีเมล)
