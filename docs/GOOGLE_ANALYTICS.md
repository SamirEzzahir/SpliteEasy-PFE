# Google Analytics setup

1. In Google Analytics, open **Admin → Data streams → Web stream**, and copy the
   GA4 **Measurement ID** (`G-XXXXXXXXXX`).
2. In SplitEasy, open **Admin → Settings → Google Analytics**, paste it into
   **Measurement ID**, and click **Save changes**. Requires `manage_settings`.
3. In the Google web stream, keep **Enhanced measurement → Page views → Page
   changes based on browser history events** enabled. This tracks Next.js page
   navigation as well as the first page load, without adding code per page.
4. Open the app in a fresh tab and check Google's Realtime/DebugView report.
   Browser tracking blockers can prevent collection.

The ID is stored in platform settings and published to the global frontend tag;
there is no rebuild or database migration needed when changing it. Clearing the
ID disables tracking. Existing visitor tabs pick up changes after reloading.
No custom user IDs, balances, expense details or chat events are sent by the app.
Google's normal page/URL and enhanced measurement collection still applies.

Reference: [Google's page-view measurement guide](https://developers.google.com/analytics/devguides/collection/ga4/views).
