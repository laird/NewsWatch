# NewsWatch Admin Guide

## Access

**URL:** [https://newswatch.popk.in/admin.html](https://newswatch.popk.in/admin.html)  
**Password:** `newswatch2024`

## Features

### 1. 🤖 AI Guidance Editor

The Guidance Editor allows you to control the AI's focus when analyzing news stories.

- **View Current Guidance:** The text area shows the instructions currently being used by the AI.
- **Edit & Save:** Modify the text to shift focus (e.g., "Ignore crypto," "Focus on SaaS"). Click **💾 Save Guidance** to apply changes immediately.
- **Last Updated:** Shows when the guidance was last modified.

### 2. 📧 Newsletter Testing

Generate and send a test newsletter to verified test users.

- **Trigger Newsletter:** Click **⚡ Generate & Send Test Newsletter**.
- **Process:**
  1. Fetches top stories from the last 24 hours.
  2. Generates the newsletter HTML with the *current* AI guidance included.
  3. Sends the email to all users marked as `is_test_user`.
  4. Saves an archive of the test newsletter.

### 3. 📚 Recent Newsletter Archives

View a history of generated newsletters.

- **List:** Shows the last 10 newsletters (both production and test).
- **Details:** Displays date, recipient count, and story count.
- **View:** Click **View →** to open the full web version of the newsletter.
