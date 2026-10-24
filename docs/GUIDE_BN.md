# ইনায়া কুরআন একাডেমি, সম্পূর্ণ সেটআপ ও ব্যবহার গাইড

এই গাইড ধাপে ধাপে করলে ওয়েবসাইট + Admin Panel চালু হবে, ইনশাআল্লাহ। কোডে হাত দিতে হবে না। শুধু `config.js` ফাইলে দুটো মান বসাতে হবে।

প্রজেক্টে কী আছে

| ফাইল | কাজ |
|---|---|
| `index.html`, `programs.html`, `program.html`, `assessment.html`, `about.html`, `contact.html`, `faq.html`, `privacy.html`, `terms.html`, `404.html` | পাবলিক HTML পেজ |
| `admin.html` | পুরো Admin Panel, একটাই পেজ (`/admin`) |
| `config.js` | আপনার Supabase URL ও anon key বসানোর জায়গা |
| `sql/schema.sql` | ডাটাবেসের সব টেবিল, নিরাপত্তা-নিয়ম ও শুরুর কনটেন্ট |
| `vercel.json` | Vercel সেটিংস (সুন্দর URL, সিকিউরিটি হেডার) |
| `css/`, `js/`, `assets/` | ডিজাইন, লজিক, লোগো ও ছবি |

---

## ধাপ ১, Supabase প্রজেক্ট বানান (প্রায় ১০ মিনিট)

1. https://supabase.com এ সাইন আপ করে New project খুলুন। নাম দিন `inaya`। একটা শক্ত Database Password দিন এবং কোথাও নিরাপদে লিখে রাখুন। Region বেছে নিন আপনার ছাত্রছাত্রীদের কাছাকাছি।
2. প্রজেক্ট তৈরি হলে বাঁ দিকে SQL Editor → New query খুলুন।
3. `sql/schema.sql` ফাইলের পুরো লেখা কপি করে পেস্ট করুন এবং Run চাপুন। "Success" দেখাতে হবে। চাইলে আবার রান করা যায়, কিছু নষ্ট হবে না।
4. Authentication → Users → Add user → Create new user এ আপনার ইমেইল ও শক্ত পাসওয়ার্ড দিন। "Auto Confirm User" টিক দিন।
5. এবার আপনাকে Admin বানাতে SQL Editor-এ এটা রান করুন (ইমেইল বদলে নিন):

```sql
insert into public.admin_users (user_id, email, role)
select id, email, 'owner' from auth.users where email = 'আপনার-ইমেইল@example.com'
on conflict (user_id) do nothing;
```

6. জরুরি নিরাপত্তা সেটিং: Authentication → Sign In / Providers → Email এ গিয়ে "Allow new users to sign up" বন্ধ (OFF) করুন। এতে বাইরের কেউ অ্যাকাউন্ট খুলতে পারবে না। নতুন স্টাফ যোগ করতে হলে আপনি Users থেকে নিজে যোগ করবেন।
7. Authentication → URL Configuration:
   - Site URL: `https://inayaquran.com`
   - Redirect URLs: `https://inayaquran.com/admin` এবং পরে Vercel-এর প্রিভিউ URL-ও যোগ করুন (যেমন `https://আপনার-প্রজেক্ট.vercel.app/admin`)। পাসওয়ার্ড রিসেট লিংক এতে কাজ করে।
8. Project Settings → API থেকে দুটো মান কপি করুন:
   - Project URL (যেমন `https://abcd1234.supabase.co`)
   - anon public key (লম্বা `eyJ...` কী)

> ⚠️ `service_role` কী কখনো কোথাও বসাবেন না, কাউকে দেবেন না। শুধু `anon public` কী ব্যবহার হবে। এটা ব্রাউজারে থাকা নিরাপদ, কারণ `schema.sql`-এর নিয়মগুলো ডেটা পাহারা দেয়।

## ধাপ ২, `config.js` পূরণ করুন

ফাইলটি খুলে দুটো ফাঁকা জায়গায় মান বসান:

```js
window.INAYA_CONFIG = {
  SUPABASE_URL: "https://abcd1234.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi..."
};
```

## ধাপ ৩, Vercel-এ ডিপ্লয় (প্রায় ১০ মিনিট)

পদ্ধতি ক (সহজ, GitHub দিয়ে):
1. GitHub-এ একটা নতুন private repository বানান (যেমন `inaya-website`)। এই ফোল্ডারের সব ফাইল সেখানে আপলোড করুন (Add file → Upload files)।
2. https://vercel.com এ GitHub দিয়ে লগইন করে Add New → Project খুলুন এবং ওই repository Import করুন।
3. সেটিংসে: Framework Preset = Other। Build Command ও Output Directory ফাঁকা রাখুন। এরপর Deploy চাপুন।
4. কিছুক্ষণে একটা `https://….vercel.app` লিংক পাবেন। এটাই আপনার প্রিভিউ (staging)।

পদ্ধতি খ (টার্মিনাল): ফোল্ডারে গিয়ে `npx vercel` চালান এবং প্রশ্নগুলোর উত্তর দিন। আপনার কম্পিউটারে Node.js থাকতে হবে।

প্রিভিউতে আগে পরীক্ষা করুন (নিচের "লঞ্চ চেকলিস্ট" দেখুন), তারপর ডোমেইন সংযুক্ত করুন।

## ধাপ ৪, ডোমেইন `inayaquran.com` যুক্ত করুন

> ⚠️ আগে ব্যাকআপ নিন। এই ডোমেইনে এখন কোনো সাইট চালু থাকলে তার ফাইল/কনটেন্ট ডাউনলোড করে রাখুন এবং বর্তমান DNS রেকর্ডের স্ক্রিনশট নিন। প্রিভিউ ঠিক আছে নিশ্চিত হওয়ার পরই ডোমেইন সরান।

1. Vercel → আপনার প্রজেক্ট → Settings → Domains → Add → `inayaquran.com` (এবং `www.inayaquran.com`)।
2. Vercel যে DNS রেকর্ড দেখাবে সেটা আপনার ডোমেইন রেজিস্ট্রারের DNS প্যানেলে বসান। সাধারণত root-এর জন্য `A` রেকর্ড `76.76.21.21` এবং `www`-এর জন্য `CNAME` রেকর্ড `cname.vercel-dns.com`। সঠিক মান Vercel-এর স্ক্রিনেই দেখাবে, সেটাই মানুন।
3. কয়েক মিনিট থেকে কয়েক ঘণ্টায় HTTPS সহ সাইট চালু হবে।

## ধাপ ৫, প্রথম লগইন ও প্রাথমিক সেটিংস

1. `https://inayaquran.com/admin` খুলে ধাপ ১-এর ইমেইল-পাসওয়ার্ডে ঢুকুন।
2. Settings এ এগুলো পূরণ করুন (কোনো তথ্য বানিয়ে দেবেন না, যেটা জানেন না সেটা ফাঁকা রাখুন):
   - WhatsApp নম্বর (দেশ-কোড সহ, শুধু অঙ্ক, যেমন `8801XXXXXXXXX`)। নম্বর না দিলে সাইটে WhatsApp বাটন দেখাবে না।
   - Contact email
   - Facebook / Instagram / Telegram / YouTube লিংক (`https://` দিয়ে শুরু)
   - চাইলে Response-time note, যদি সত্যিই সেটা বলা যায়
3. Save settings চাপুন। সাইটে সঙ্গে সঙ্গে আপডেট দেখা যাবে।

---

## দৈনন্দিন ব্যবহার: কোথায় কী করবেন

### সাইটের লেখা ও ছবি বদলানো (Website Content)
- Website Content → Pages → Edit sections (যেমন Home)।
- ডানে লাইভ প্রিভিউ (Desktop/Mobile) আছে। বাঁয়ে প্রতিটি সেকশনের ↑↓ (ক্রম), ⧉ (কপি), Hide/Show (লুকানো), 🗑 (মোছা), Edit ▼ (সম্পাদনা) আছে।
- নতুন সেকশন যোগ করতে নিচের তালিকা থেকে ধরন বেছে + Add section চাপুন। ধরনগুলো: হিরো, টেক্সট+ছবি, প্রোগ্রাম কার্ড, লেভেল তালিকা, সুবিধা, প্রক্রিয়া (ধাপ), পরিসংখ্যান, FAQ, প্রশংসাপত্র, শিক্ষক পরিচিতি, CTA, যোগাযোগ, গ্যালারি, রিচ টেক্সট।
- Save draft শুধু খসড়া রাখে, দর্শক পুরনো পাবলিশ করা সংস্করণই দেখে। Publish চাপলে লাইভ হয়। More… থেকে খসড়া বাতিল, ডিফল্ট লেআউটে ফেরা, বা পেজ আনপাবলিশ করা যায়।
- শিরোনামের কোনো শব্দ সোনালি করতে `*তারা*` দিন, যেমন `Made *Simple*`।
- লেখায়: খালি লাইন = নতুন অনুচ্ছেদ, `- ` দিয়ে বুলেট, `## ` দিয়ে উপশিরোনাম, `মোটা`, `[লেখা](https://লিংক)`। কোনো HTML বা JavaScript চলবে না। এটা ইচ্ছাকৃত নিরাপত্তা।
- Search & sharing (SEO) অংশের শিরোনাম/বর্ণনা Publish-এর সময় প্রযোজ্য হয়।
- সত্য তথ্য ছাড়া পরিসংখ্যান, প্রশংসাপত্র বা শিক্ষকের জীবনী যোগ করবেন না।

### FAQ
Website Content → FAQ এ প্রশ্ন, উত্তর, ক্যাটাগরি ও ক্রম (↑↓) নিয়ন্ত্রণ করুন।

### লোগো ও রঙ বদলানো
Settings → Brand এ লোগোর Choose / upload দিয়ে ছবি বেছে নিন বা আপলোড করুন (PNG/JPG/WebP/ICO, সর্বোচ্চ ৫MB)। Save settings চাপলে হেডার, ফুটার ও সব জায়গায় লোগো বদলে যাবে। রঙের জন্য রেডিমেড প্যালেট বা নিজের রঙ দিন। পড়ার অযোগ্য রঙ হলে সতর্কবার্তা আসবে।

### প্রোগ্রাম ও কারিকুলাম (Programs & Curriculum)
- তিনটি অফিসিয়াল প্রোগ্রাম ও ৯টি লেভেল আগে থেকেই আছে। সম্পাদনা, ক্রম পরিবর্তন, Draft / Published / Archived করা যায়।
- প্রোগ্রাম খুললে নিচে Levels, প্রতিটি লেভেলের Curriculum বাটনে প্রাইভেট মডিউল ও পাঠ লেখা যায়। এগুলো কখনো পাবলিক সাইটে আসে না। পুরো কারিকুলাম না থাকলেও সাইট চালু করা যায়।

### লিড (Leads & Inquiries)
- কেউ ফ্রি অ্যাসেসমেন্ট ফর্ম পূরণ করলে লিড হিসেবে এখানে আসে (কোড যেমন `IQA-1001`)। সার্চ, ফিল্টার, সাজানো, পেজিং আছে।
- লিডে ক্লিক করলে ডানে বিস্তারিত খোলে। সেখানে WhatsApp/Email বাটন, স্ট্যাটাস পরিবর্তন (প্রতিটি পরিবর্তন ইতিহাসে জমা থাকে), ফলো-আপের তারিখ, নিজের নামে নেওয়া, প্রাইভেট নোট, UTM উৎস আছে।
- Export CSV (শুধু Owner/Administrator) ফিল্টার করা লিডের তালিকা নামায়। ফাইলে ব্যক্তিগত তথ্য থাকে, তাই ব্যবহারের পর মুছে ফেলুন।
- Contact messages ট্যাবে যোগাযোগ ফর্মের বার্তা আছে। Overview-তে অপঠিত সংখ্যা দেখায়।

### অ্যাসেসমেন্ট (Assessments)
- ওয়েবসাইট ফর্ম (অভিভাবকের দেওয়া তথ্য) আর অ্যাসেসমেন্টারের মূল্যায়ন আলাদা। এখানে সাত দক্ষতা (হারাকাত ও শব্দ পড়া, সংযুক্ত অক্ষর, সুকুন, তানউইন, শাদ্দাহ, মাদ্দ, কুরআন পড়া) Strong / Developing / Needs Support / Not Yet Learned দিয়ে লেখা হয়।
- Not Yet Learned মানে "এখনো শেখানো হয়নি", এটা ভুল নয়।
- পর্যবেক্ষণ, অসুবিধা, প্রস্তাবিত লেভেল ও পরবর্তী লক্ষ্য লিখুন। সব প্রাইভেট।
- লিডের ডিটেইলস থেকে + Assessment record চাপলে ওই লিডের সঙ্গে যুক্ত হয়। সংরক্ষণের সময় চাইলে লিডের স্ট্যাটাস "Assessment Completed" হয়ে যায়।

### এনরোলমেন্ট (Enrollments)
- ধাপ: Enrollment Confirmed → Payment Pending → Payment Received → Teacher Assignment → Class Scheduling → ACTIVE।
- নিয়ম (সিস্টেম নিজেই আটকায়): "Payment Received"-এ পেমেন্ট নোট (আপনি কীভাবে যাচাই করলেন) লাগবে। "Class Scheduling"-এ শিক্ষক, "ACTIVE"-এ ক্লাসের সময়সূচি লাগবে।
- কার্ডের নম্বর বা পাসওয়ার্ড এখানে কখনো লিখবেন না। কোনো অনলাইন পেমেন্ট ইন্টিগ্রেশন নেই (বানানো হয়নি)।

### মিডিয়া লাইব্রেরি
ছবি আপলোড, নাম ও alt text (ছবির বর্ণনা) দেওয়া, কপি URL, Replace (একই ধরনের ফাইল দিয়ে বদল), Delete। যে ছবি সাইটে ব্যবহার হচ্ছে সেটা মুছতে দেবে না এবং কোথায় ব্যবহার হচ্ছে তা দেখাবে।

### Analytics ও মার্কেটিং ট্র্যাকিং
- ডিফল্ট: কুকি ও ব্যক্তিগত তথ্য ছাড়া শুধু গণনা: পেজ ভিউ, অ্যাসেসমেন্ট বাটন ক্লিক, ফর্ম শুরু/জমা, WhatsApp ক্লিক। এগুলো "মানুষের সংখ্যা" নয়। "Do Not Track" চালু থাকলে গোনা হয় না।
- ভিজিটর/সেশন/ট্রাফিক সোর্স দেখতে চাইলে Settings → Analytics এ Google Analytics 4 (Measurement ID `G-…`; দর্শকের সম্মতি চাওয়া হয়) অথবা Plausible (কুকি-মুক্ত) সংযুক্ত করুন। সংযুক্ত না থাকলে Admin-এ পরিষ্কার "Analytics not connected" লেখা থাকে।
- কোন বিজ্ঞাপন থেকে লিড এল জানতে পোস্টের লিংকে UTM দিন:
  - `https://inayaquran.com/?utm_source=facebook&utm_medium=social&utm_campaign=facebook_program_launch`
  - `https://inayaquran.com/assessment?utm_source=whatsapp&utm_medium=message&utm_campaign=whatsapp_program_launch`
  - `…utm_source=instagram&utm_medium=social&utm_campaign=instagram_program_launch`
- UTM লিডের সঙ্গে জমা হয়। Analytics পেজে ক্যাম্পেইন-ভিত্তিক তুলনা ও ফর্মুলাসহ হার দেখায়। WhatsApp বাটনে ক্লিক মানে কথোপকথন বা ভর্তি নয়, শুধু ক্লিক।

### নিজের WhatsApp ও নম্বর
Settings-এ নম্বর দিলে সব WhatsApp বাটন (প্রিফিল্ড বার্তাসহ) নিজে থেকে ঠিক হয়ে যায়। এই লিংক ব্যবহার করে ওয়েবসাইট আপনার WhatsApp বার্তা পড়তে পারে না। অটোমেটিক WhatsApp মেসেজ চাইলে ভবিষ্যতে Meta-র অফিসিয়াল WhatsApp Business Platform লাগবে (অনুমোদন ও খরচ আছে)। WhatsApp Web স্ক্র্যাপিং বা ব্যক্তিগত অ্যাকাউন্টের পাসওয়ার্ড দেওয়া কখনো করবেন না।

---

## নিরাপত্তা ও ব্যক্তিগত তথ্য

- কে কী করতে পারে: `owner`, `administrator`, `assessor` পরিবর্তন করতে পারে। `teacher` ও `readonly` শুধু দেখতে পারে (ডাটাবেস নিজেই লেখা আটকায়)। CSV ও মোছার বাটন শুধু owner/administrator দেখে। শুরুতে শুধু `owner` আছেন।
- নতুন স্টাফ যোগ করতে: Supabase Authentication → Users এ তার অ্যাকাউন্ট বানিয়ে SQL Editor-এ রান করুন:
  ```sql
  insert into public.admin_users (user_id, email, role)
  select id, email, 'assessor' from auth.users where email = 'staff@example.com';
  ```
  (role: `administrator`, `assessor`, `teacher`, `readonly`।)
- পাসওয়ার্ড ভুলে গেলে: `/admin` লগইনে "Forgot password?"। রিসেট লিংক ইমেইলে যাবে (ধাপ ১.৭-এর Redirect URL ঠিক থাকতে হবে)। বিকল্প: Supabase → Authentication → Users থেকে রিসেট।
- ৬০ মিনিট নিষ্ক্রিয় থাকলে Admin নিজে লগআউট হয়।
- তথ্য সংশোধন/মুছে ফেলার অনুরোধ এলে: (১) অনুরোধকারী আসল অভিভাবক/শিক্ষার্থী কি না নিশ্চিত হোন (আগে যে নম্বর/ইমেইল থেকে এসেছিল সেখান থেকে)। (২) Leads-এ খুঁজে লিড খুলুন। সংশোধনের জন্য নোটে লিখে Supabase-এ ঠিক করুন, মুছতে চাইলে Delete this lead (এতে সংশ্লিষ্ট অ্যাসেসমেন্ট ও এনরোলমেন্টও মুছে যায়)। (৩) অনুরোধ ও কাজের তারিখ নিজের রেকর্ডে লিখে রাখুন (ব্যক্তিগত তথ্য ছাড়া)। (৪) পরিচয়পত্রের ছবি বা কার্ড নম্বর চাইবেন না।
- ব্যাকআপ: Supabase Database → Backups দেখুন (ফ্রি প্ল্যানে স্বয়ংক্রিয় রিস্টোরযোগ্য ব্যাকআপ নেই; পেইড প্ল্যানে দৈনিক ব্যাকআপ আছে)। তাই অন্তত সপ্তাহে একবার Leads → Export CSV নিন এবং Supabase Table Editor থেকে `leads`, `assessments`, `enrollments` টেবিল CSV হিসেবে নামান। ফাইলগুলো পাসওয়ার্ড-সুরক্ষিত জায়গায় রাখুন। `sql/schema.sql` ও সাইটের ফাইল GitHub-এই নিরাপদ থাকে।
- স্প্যাম: ফর্মে লুকানো "হানিপট" ফিল্ড, একই যোগাযোগের ১০ মিনিটে ডুপ্লিকেট রোধ এবং প্রতি মিনিটে ফ্লাড-সীমা আছে। (CAPTCHA নেই। স্প্যাম বেশি এলে পরে Cloudflare Turnstile যোগ করা যাবে।)
- গোপনীয়তা নীতি ও শর্তাবলি আমি সাধারণ খসড়া লিখেছি। আইনি নির্ভুলতার দাবি নেই। চালুর আগে একজন যোগ্য ব্যক্তিকে দিয়ে দেখিয়ে নিন, তারপর Website Content থেকে সম্পাদনা করুন।

---

## লঞ্চ চেকলিস্ট (প্রিভিউ লিংকে করুন, তারপর ডোমেইনে)

1. [ ] `schema.sql` রান হয়েছে, Admin ইউজার বানানো ও `admin_users`-এ যোগ হয়েছে, "Allow new users to sign up" বন্ধ।
2. [ ] `config.js`-এ URL ও anon key বসানো, service_role কী কোথাও নেই।
3. [ ] `/admin` এ লগইন হয়। ভুল পাসওয়ার্ডে ঢোকা যায় না। লগআউট করে `/admin` খুললে শুধু লগইন ফর্ম দেখায়।
4. [ ] হোমে ছোট একটা বদল করে Save draft → সাইটে বদল নেই → Publish → সাইটে আছে।
5. [ ] ফ্রি অ্যাসেসমেন্ট ফর্ম নিজের নম্বরে পূরণ করুন → "Request received" → Leads-এ এসেছে → স্ট্যাটাস বদলে রিফ্রেশে ঠিক আছে।
6. [ ] Contact ফর্ম পরীক্ষা, বার্তা Contact messages-এ আছে।
7. [ ] Settings-এ WhatsApp নম্বর দিয়ে বাটনে চাপ দিলে সঠিক নম্বরে চ্যাট খোলে।
8. [ ] লোগো বদলে (আপলোড করে) সাইটে বদলেছে কি না দেখুন (পরীক্ষা শেষে আসল লোগোয় ফিরুন)।
9. [ ] মোবাইলে (আসল ফোনে) হোম, প্রোগ্রাম, ফর্ম দেখুন।
10. [ ] Privacy/Terms পেজ পড়ে সংশোধন করেছেন। কোনো ঠিকানা/ফি/যোগ্যতার দাবি বানানো নেই।
11. [ ] পুরনো সাইটের ব্যাকআপ ও DNS স্ক্রিনশট আছে। তারপর ডোমেইন যুক্ত করুন।
12. [ ] চালুর পর `https://inayaquran.com/sitemap.xml` ও `/robots.txt` খুলছে। Google Search Console-এ সাইটম্যাপ জমা দিন (ঐচ্ছিক)।

রোলব্যাক (সমস্যা হলে ফিরে যাওয়া): Vercel → প্রজেক্ট → Deployments → আগের ভালো ডিপ্লয়মেন্টের পাশে "⋯" → Promote to Production (Instant Rollback)। কনটেন্ট ভুল হলে Admin-এ পেজের More… → Discard draft বা আগের লেখা আবার বসিয়ে Publish করুন। ডোমেইন পুরোপুরি পুরনো সাইটে ফেরাতে DNS রেকর্ড আগের স্ক্রিনশট অনুযায়ী ফিরিয়ে দিন।

---

## কী টেস্ট হয়েছে, আর কী বাকি (সৎ হিসাব)

যা যাচাই হয়েছে (আমার পরিবেশে, নকল Supabase দিয়ে): সব পাবলিক পেজ ডেস্কটপ ও মোবাইলে খোলে, JS error নেই, আড়াআড়ি স্ক্রল নেই। Admin-এর ৯টি মডিউল (কারিকুলাম পেজসহ ১৪টি স্ক্রিন) ত্রুটি ছাড়া লোড হয়। কনটেন্ট এডিটরে প্রিভিউ আপডেট, ড্রাফট সেভ, পাবলিশ ও ভ্যালিডেশন কাজ করে। লিড স্ট্যাটাস বদল কাজ করে। অ্যাসেসমেন্ট ফর্ম ভ্যালিডেশন, প্রোগ্রাম প্রি-সিলেকশন, UTM সহ জমা ও সফল বার্তা কাজ করে।

যা আমি এখানে যাচাই করতে পারিনি (আপনার প্রজেক্টে আসল Supabase দিয়ে চেকলিস্টে করে নিন):
- `schema.sql` আসল Postgres/Supabase-এ চালানো হয়নি। পড়ে ও যুক্তি দিয়ে দুটো ভুল ঠিক করেছি। প্রথমবার রান করলে কোনো ত্রুটি এলে ত্রুটির লেখাটা আমাকে পাঠান।
- আসল লগইন, পাসওয়ার্ড রিসেট ইমেইল, ছবি আপলোড (Supabase Storage), RLS-এর বাস্তব আচরণ।
- Vercel-এ ডিপ্লয় এবং ডোমেইন: আমি ডিপ্লয় করিনি, তাই "ডিপ্লয় সফল" বলছি না।

যা বানানো হয়নি / সীমাবদ্ধতা:
- নতুন লিডের নোটিফিকেশন (ইমেইল/WhatsApp) নেই। আপাতত Admin-এ Overview দেখুন। পরে Supabase Database Webhook + ইমেইল সার্ভিস দিয়ে করা যাবে।
- প্রতি-পেজ আলাদা সোশ্যাল প্রিভিউ ছবি/শিরোনাম: WhatsApp/Facebook জাভাস্ক্রিপ্ট চালায় না, তাই তারা প্রতিটি HTML ফাইলের ভেতরের স্থির ট্যাগ পড়ে। Admin থেকে বদলানো SEO শিরোনাম/বর্ণনা Google-এর জন্য কাজ করে (Google JS চালায়), কিন্তু WhatsApp প্রিভিউ বদলাতে `assets/img/og-default.jpg` বদলে আবার ডিপ্লয় করতে হবে।
- সিস্টেম-ব্যাপী স্প্যাম সীমা আছে, কিন্তু CAPTCHA নেই।
- লিডে "assigned to" শুধু "আমি / অন্য স্টাফ" দেখায় (স্টাফের নামের তালিকা পরে যোগ হবে)।
- Teacher রোলের জন্য আলাদা সীমিত ভিউ নেই (আপাতত teacher/readonly সব লিড দেখতে পায়, তাই বাইরের কাউকে এই রোল দেবেন না)।
- সাইটে ইংরেজি ছাড়া বাংলা/আরবি ভাষার আলাদা সংস্করণ নেই। তবে বাংলা ও আরবি লেখা সঠিক ফন্টে দেখায়, আর আপনি Admin থেকে বাংলা লেখা বসাতে পারবেন।
- Program page-এর JSON-LD/স্ট্রাকচার্ড ডেটা শুধু প্রতিষ্ঠানের জন্য (হোমে)। কোর্সের মূল্য/সময়কাল বানানো হয়নি।
- ফি, সময়সূচি, শিক্ষকের যোগ্যতা, প্রশংসাপত্র বা পরিসংখ্যান কিছুই বানানো হয়নি। যা সাইটে আছে সবই আপনার ফ্লায়ারের লেখা বা সাধারণ বিবরণ।

বিস্তারিত বদল করতে চাইলে বা কোনো ধাপে আটকে গেলে ত্রুটির স্ক্রিনশট/লেখা পাঠান, সেখান থেকে এগোব, ইনশাআল্লাহ।


---

## অ্যাডমিন প্যানেলের নতুন মডিউল চালু করার ধাপ (Students, Classes, Finance, Attendance, Users)

Supabase → SQL Editor → New query-তে নিচের ফাইলগুলো এই ক্রমে, একটা একটা করে পেস্ট করে Run করুন (প্রতিটির পর "Success" দেখুন):

1. `sql/schema.sql` (আগেই চালানো থাকলে আবার দরকার নেই)
2. `sql/002_students.sql`, Students
3. `sql/003_classes.sql`, Teachers, Classes, Timetable
4. `sql/004_finance.sql`, Finance (শুধু owner/administrator দেখতে পাবে)
5. `sql/005_attendance.sql`, Attendance
6. `sql/006_users.sql`, Users & Access (শুধু owner)

নিয়ম:
- কোনো ফাইলে error এলে পরের ফাইল চালাবেন না। error-এর লেখা কপি করে আমাকে পাঠান।
- প্রতিটি ফাইল দুইবার চালালেও আগের ডেটা নষ্ট হয় না।
- নতুন কাউকে অ্যাক্সেস দিতে হলে আগে Supabase → Authentication → Users-এ তার লগইন বানান, তারপর অ্যাডমিন প্যানেলের Users & Access পেজে ইমেইল দিয়ে role দিন।
- Finance-এ কার্ড নম্বর বা পাসওয়ার্ড কখনো লিখবেন না। শুধু টাকা পাওয়ার পর রেকর্ড করবেন।

---

## Website Builder (নতুন), ব্যবহার

Admin → Website Builder → Pages → Create page → Add section → Choose/upload image → Preview → Save draft → Publish

1. আগে একবার Supabase → SQL Editor-এ `sql/007_website_builder.sql` চালান (staging-এ আগে পরীক্ষা করুন)। না চালালেও পেজ তৈরি/এডিট/পাবলিশ চলবে; মেনু, আর্কাইভ, টেমপ্লেট ও ড্রাফট-সেটিংস ৭নং মাইগ্রেশনের পর চালু হবে।
2. Create page: নাম ও URL (যেমন `summer-camp`) দিন, টেমপ্লেট বাছুন → Create and edit।
3. Add section: নিচের তালিকা থেকে ধরন বেছে + Add section। ↑ ↓ দিয়ে সাজান, ⧉ ডুপ্লিকেট, Hide/🗑 দিয়ে লুকান/মুছুন।
4. ছবি: Section-এ Choose / upload → Media Library থেকে বাছুন বা নতুন আপলোড করুন; Replace / Remove আছে।
5. Preview: ডানের লাইভ প্রিভিউ (Desktop/Mobile) বা উপরের Preview বাটনে নতুন ট্যাবে।
6. Save draft (সাইটে দেখা যায় না) → Publish (লাইভ)।
7. Page settings: শিরোনাম, URL পরিবর্তন, SEO, শেয়ার-ছবি, ওয়েবসাইট মেনুতে দেখানো।
8. More… → Save as template দিয়ে লেআউট সেভ করুন; পরে Create page-এ ব্যবহার করুন।
9. নতুন পেজ Vercel-এ লাইভ দেখাতে নতুন কোড (`page.html`, `vercel.json`, `js/`, `css/`, `admin.html`) ডিপ্লয় করতে হবে।

---

## এখন সব পাবলিক পেজ Website Builder থেকে এডিট করা যায়

Home, About, Privacy, Terms, Programs, FAQ, Contact, Assessment: এই ৮টা built-in পেজ Admin → Website Builder → Pages তালিকায় আছে।
- যে পেজের এখনো ডেটাবেজে রো নেই, তাতে "default layout" ব্যাজ দেখায়। Edit চাপলেই রো তৈরি হয়ে যায়, আর আগের লেআউট হুবহু খোলে।
- Programs পেজে "Programs in detail", FAQ পেজে "FAQ (all, by category)", Contact ও Assessment পেজে ফর্ম সেকশন আছে। ফর্ম সেকশন সরালে বা সাজালে পাবলিক পেজে ফর্মও সরে বা সাজে।
- ফর্ম থেকে আসা অনুরোধ আগের মতোই Leads & Inquiries-এ আসে।
- এই পেজগুলো unpublish, archive বা URL বদল করা যায় না, যাতে সাইট ভেঙে না যায়।
- প্রতিটা সেকশনে "Animation when this section appears" থেকে অ্যানিমেশন বাছা যায়।

## ভাষা পরিবর্তন (বাংলা, ইংরেজি, আরবি)

ওয়েবসাইটের উপরে ডান দিকে ভাষার বাটন আছে। সেখান থেকে English, বাংলা বা العربية বেছে নিলে পুরো সাইট সেই ভাষায় হয়ে যায়। আরবি বেছে নিলে লেখা ডান থেকে বাঁয়ে সাজে। পছন্দ করা ভাষা মনে থাকে।

"More languages" থেকে আরও ২৪টি ভাষা পাওয়া যায় (উর্দু, হিন্দি, তুর্কি, ফরাসি, ইন্দোনেশীয় ইত্যাদি)। এগুলো গুগল ট্রান্সলেটের মাধ্যমে চলে, তাই অনুবাদ স্বয়ংক্রিয়।

নিজের লেখা অনুবাদ যোগ করতে: Website Builder > পাতা খুলুন > কোনো সেকশন খুলুন > নিচে "Translations (Bangla, Arabic)"। ফাঁকা রাখলে ভেতরের অনুবাদ বা ইংরেজি লেখা দেখানো হয়।

## লোগো ও ব্র্যান্ড (এক ক্লিকে)

অ্যাডমিন প্যানেলের একদম উপরে লোগোতে ক্লিক করলে Settings এর Brand Identity অংশ খোলে (আলাদা কোনো পপআপ বা আলাদা পাতা নেই)। লোগো, উচ্চতা, ফুটার লোগো, ফেভিকন বদলে "Save settings" চাপুন। একই সেটিং থেকে ওয়েবসাইটের হেডার, ফুটার ও অ্যাডমিন প্যানেল তিন জায়গাতেই লোগো বদলে যায়।

## নতুন হোম ও আমাদের সম্পর্কে পাতা

হোম পাতা এখন ঘটনাক্রমে সাজানো: প্রথমে একাডেমি কী শেখায়, তারপর "আপনি কোথা থেকে শুরু করতে চান", প্রোগ্রাম ও স্তর, যোগাযোগের পর কী হয়, কীভাবে শেখানো হয়, সচরাচর প্রশ্ন এবং শেষে মূল্যায়ন বুক করার আমন্ত্রণ। কোনো সংখ্যা, সনদ বা প্রশংসাপত্র বানানো হয়নি।

যে পাতা আগে কখনো সম্পাদনা করা হয়নি, সেখানে নতুন নকশা নিজে থেকেই দেখা যায়। আপনি যে পাতা বদলেছেন, সেটা কখনো নিজে থেকে বদলায় না। বদলাতে চাইলে Website Builder এ পাতা খুলে "Use the new design" চাপুন, দেখে নিয়ে Publish করুন।

শিক্ষকদের সেকশন লুকানো অবস্থায় আছে। সত্যিকারের তথ্য ও ছবি পেলে সেকশন খুলে নাম, ভূমিকা ও পরিচয় লিখে "Show" করুন।

## Settings এখন ছয়টি ভাগে

Settings এ ওপরে ছয়টি ট্যাব আছে। সব একই পাতায়, একই "Save settings" বাটনে সেভ হয়, তাই এক ট্যাবে বদলে আরেক ট্যাবে গেলেও লেখা হারায় না।

1. General: একাডেমির নাম, ট্যাগলাইন, ইমেইল, WhatsApp, সোশ্যাল লিংক।
2. Brand Identity: লোগো, ফুটার লোগো, ফেভিকন, রং, ফন্ট এবং আগের লোগোতে ফেরার বাটন। ব্র্যান্ড বদলানোর জায়গা শুধু এটাই।
3. Language: স্বয়ংক্রিয় অনুবাদ চালু বা বন্ধ, অতিরিক্ত ভাষা, অনুবাদের অবস্থা, আবার চেষ্টা, Review translations।
4. Website: মেনু, বাটন, ফুটার, ফর্মের মেসেজ।
5. SEO and analytics: সার্চ ইঞ্জিনের ডিফল্ট লেখা, শেয়ার ছবি, অ্যানালিটিক্স।
6. Security and access: নিজের পাসওয়ার্ড বদলানো এবং Users and Access এর লিংক (শুধু owner এর জন্য)।

পুরনো "Brand Identity" মেনু সরানো হয়েছে। পুরনো লিংক বা বুকমার্ক নিজে থেকে নতুন জায়গায় নিয়ে যায়।

## প্রোগ্রামের Bangla ও Arabic লেখা নিজে ঠিক করা

Programs & Curriculum থেকে কোনো প্রোগ্রাম খুললে নিচে "Translations" কার্ড দেখা যায়। ইংরেজি লেখা আগে Save করুন। তারপর কার্ডে প্রতিটি লেখার নিচে Bangla ও Arabic ঘর আছে। ঘরে স্বয়ংক্রিয় অনুবাদ থাকলে সেটাই দেখায়। নিজের শব্দ লিখে "Save translations" চাপলে সেটাই ওয়েবসাইটে যায়, মেশিন আর সেটা বদলায় না। ঘর খালি করে Save করলে ওই ভাষা আবার স্বয়ংক্রিয় অনুবাদে ফেরে। এক ভাষার লেখা আরেক ভাষাকে বদলায় না। ইংরেজি লেখা বদলালে নতুন ইংরেজির জন্য নতুন অনুবাদ লাগে, পুরনো অনুবাদ আর মিলে না।

## প্রোগ্রাম মেনু

হেডারে "Programs" এর পাশের ছোট তীর বা মাউস নিলে তিনটি প্রোগ্রামের তালিকা খোলে। কিবোর্ডে Enter দিয়ে খোলা এবং Esc দিয়ে বন্ধ করা যায়।

## স্বয়ংক্রিয় অনুবাদ চালু করার ধাপ

আপনি শুধু ইংরেজিতে লিখবেন। দর্শক বাংলা, আরবি বা অন্য ভাষা বাছলে সাইট নিজে থেকে অনুবাদ করে দেখায় এবং অনুবাদ জমা রাখে। ইংরেজি লেখা বদলালে নতুন অনুবাদ তৈরি হয়, পুরনোটা আর দেখানো হয় না।

একবার এই ধাপগুলো করতে হবে:
1. Supabase এর SQL Editor এ `sql/009_auto_translation.sql` চালান।
2. Edge Function ডিপ্লয় করুন। কম্পিউটারে Supabase CLI থাকলে প্রজেক্ট ফোল্ডারে চালান: `supabase functions deploy translate`। CLI না থাকলে Supabase Dashboard এর Edge Functions থেকে নতুন ফাংশন "translate" বানিয়ে `supabase/functions/translate` ফোল্ডারের তিনটি ফাইল (`index.ts`, `core.js`, `ui_strings.js`) দিন।
3. অনুবাদের জন্য একটি চাবি (API key) দিন: `supabase secrets set ANTHROPIC_API_KEY=আপনার_চাবি`। Google AI Studio (Gemini) চাবি থাকলে `supabase secrets set GEMINI_API_KEY=আপনার_চাবি TRANSLATE_PROVIDER=gemini` দিন। Google Translate ব্যবহার করতে চাইলে `TRANSLATE_PROVIDER=google` ও `GOOGLE_TRANSLATE_API_KEY=...` দিন। চাবি শুধু ফাংশনের ভেতরে থাকে, ওয়েবসাইটের কোডে কখনো যায় না।
4. অ্যাডমিন > Settings > Automatic translation এ গিয়ে চাইলে আরও ভাষা টিক দিন, Save করুন, তারপর একবার "Translate everything now" চাপুন।

পরে: পাতা Publish করলে নিজে থেকে পেছনে অনুবাদ গরম হয়ে যায়। কোনো অনুবাদ ভুল মনে হলে "Review translations" এ গিয়ে নিজের শব্দ লিখে দিন, মেশিন সেটা আর বদলাবে না। কুরআনের আয়াত কখনো অনুবাদ বা বদল হয় না, আরবি লেখা যেমন আছে তেমনই থাকে। ধর্মীয় ব্যাখ্যার অনুবাদ কোনো জ্ঞানী মানুষকে দিয়ে একবার দেখিয়ে নিন।

## Learning Programs ar Student Progress (notun)

Puro guide English e ache: docs/LEARNING_PLATFORM.md. Choto kore Bangla te:

1. Supabase SQL Editor e age sql/010_learning_platform.sql, tarpor sql/011_seed_quranic_excellence.sql run korun.
2. Student sign-in function deploy: `npx supabase functions deploy student-account --use-api --project-ref AAPNAR_REF`
3. Puro website folder abar Vercel e upload korun.
4. Admin, Academy, Learning Programs e Quranic Excellence khulun. Eta sample content shoho draft. Porun, Arabic gulo apnader source theke mailiye nin, tarpor "I have reviewed it" ar "Publish" chapun.
5. Program er Students tab e student enrol korun. Tarpor Student Progress e student er profile khule "Student sign-in" theke email ar password din.
6. Student der kache /learn link din. Seikhane login kore lesson, quiz ar audio answer dite parbe.
7. Teacher Student Progress, Review queue theke written ar audio answer e number dibe.

## Google Tag Manager (notun)

Admin, Settings, SEO and analytics e Provider e "Google Tag Manager" nin, GTM-XXXXXXX container ID boshan, save korun. GTM connect korlei data layer nijei chalu hoy, alada kono switch nei. Visitor Accept na korle kichu pathay na. Student area ar admin e analytics load hoy na. Pura talika: docs/ANALYTICS_GTM.md
