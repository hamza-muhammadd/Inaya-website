# Automatic translation

You write the website in English only. Visitors who pick Bangla, Arabic or another enabled language see a translation that is made automatically and cached.

## How it works

1. A visitor opens a page in, say, Bangla. The page is drawn in English first.
2. Fixed interface text (menus, buttons, form labels, error messages) is replaced from the reviewed dictionary in js/i18n-dict.js. This is instant and needs no network.
3. Every other piece of text, such as program names, descriptions, FAQ and new pages, is hashed. The browser asks the database table translations for finished translations with that hash. A copy is kept in the browser for 6 hours.
4. For anything not found, the browser calls the Edge Function translate. The function checks that the text really exists on the site, translates it with the provider, stores it in translations and returns it.
5. The text on the page is swapped for the translation. If anything fails, the English stays. Nothing is shown to the visitor about the failure.

## Why edited English never shows an old translation

A translation is stored under a hash of the exact English text. If you change the English, the hash changes, so the old translation is never found again and a new one is created on the next visit (or in the background right after you publish). "Remove unused" in Settings deletes old rows.

## Quran and religious wording

Arabic script is replaced by placeholders before the text reaches the provider and put back unchanged afterwards, so verses are never rewritten. A glossary keeps Quran, Tajweed, Sunnah, Hadith, Surah, Ayah, Salah, Wudu, Dua and the academy name consistent. Settings, Automatic translation, Review translations lets an administrator replace any wording. Overrides are never overwritten by the machine. Religious explanations should be read by a knowledgeable person before they are relied on.

## Order of precedence for one piece of text

1. Section translation typed by hand in the page editor (Translations box)
2. Administrator override (Review translations)
3. Built-in dictionary (Bangla, Arabic fixed interface text)
4. Machine translation from the cache or the provider
5. English

## Setup

1. Run sql/009_auto_translation.sql in the Supabase SQL editor.
2. Deploy the function from the project folder: supabase functions deploy translate
3. Add one provider key as a secret:
   supabase secrets set ANTHROPIC_API_KEY=your_key
   or, for Google Cloud Translation: supabase secrets set TRANSLATE_PROVIDER=google GOOGLE_TRANSLATE_API_KEY=your_key
   Optional: supabase secrets set ANTHROPIC_MODEL=model_name
4. In Admin, Settings, Automatic translation, choose the extra languages and save. Press Translate everything now once.

The key lives only in the function. It is never in the website code.

## Security

Visitors can read finished translations only. Only the function (service role) writes machine translations. Staff actions (warm up, retry, purge, status) require a signed in user whose role can write, and purge requires an administrator. The function refuses any text that is not on the site, limits request size, retries once on provider errors and shares one provider call between identical simultaneous requests.

## Tests

node tests/translate_core.test.mjs runs the real function code against an in-memory database and a fake provider. node tests/autotrans.js and node tests/admintrans.js run the browser flows. Regenerate the allowed interface text with node tests/gen_ui_strings.js after editing js/i18n-dict.js.
