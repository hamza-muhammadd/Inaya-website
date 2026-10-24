# Google Tag Manager and the GA4 data layer

## How to connect

1. Admin, Settings, SEO and analytics, Analytics card.
2. Provider: choose Google Tag Manager.
3. Paste the container ID from Tag Manager (it looks like GTM-ABC1234) and save.

That is all. The data layer switches on by itself the moment Tag Manager is connected. There is no second switch.

## What the site sends

All events follow GA4 names. Each one carries page_location, page_path, page_title and language.

| Event | When |
| --- | --- |
| page_view | A page opens |
| view_item | A program page opens. Includes the program as an item in the ecommerce object |
| form_start | A visitor starts the assessment form |
| generate_lead | The assessment form or the contact form is submitted |
| whatsapp_click | A WhatsApp button is pressed |
| assessment_cta_click | A Book Assessment button is pressed |
| user_engagement and engaged_30s | The visitor has spent 30 seconds on the page (only while the tab is visible), once per page |

The site has no shopping cart or online payment yet, so add_to_cart, view_cart, begin_checkout and purchase are not sent automatically. When you build a payment step, send them with one line: `Inaya.dl("purchase", { ecommerce: { transaction_id: "T1", value: 50, currency: "USD", items: [ ... ] } })`. The data layer is cleared of old ecommerce data before each ecommerce event, as Google recommends.

## Privacy

1. Visitors are asked first. Nothing is loaded or pushed before they press Accept. If they decline, the queued events are thrown away and the choice is remembered.
2. Do Not Track is respected.
3. The student area (/learn) and the admin area never load analytics.
4. No names, emails or phone numbers are sent.

## In Tag Manager

Create a GA4 configuration tag, then GA4 event tags with Custom Event triggers using the names above. Use the Preview mode of Tag Manager to watch events arrive.

## Tested

17 browser checks: consent first, queue and flush, GA4 item shape, the 30 second event firing once, decline, remembered choice, Do Not Track, student area, lead events, and no personal details. Not tested: a real Tag Manager container on your live site.
