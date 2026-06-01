# Amaze Reg Desk: Comprehensive User Manual

Welcome to the Amaze Reg Desk! This platform is designed to handle massive college event registrations seamlessly, combining a powerful backend dashboard with a flexible, offline-ready mobile scanner for your volunteers. 

This manual is divided into two core sections: **Admin Operations** (for event organizers) and **Volunteer Operations** (for the staff on the ground).

---

## 1. Admin Operations

As an Admin, you have access to the full dashboard, allowing you to control everything from event branding to global access rules.

### 1.1 Branding & White-Labeling
Amaze Reg Desk is fully white-labeled. You can customize the entire look and feel of the platform before your attendees even see it.
1. Navigate to the **Admin Desk** -> **Branding & Settings** tab.
2. Set your **App Name** (e.g., "Amaze Reg Desk") and **Event Name** (e.g., "Discover 2026").
3. Paste a **Logo Image URL** (this will appear on the login and public registration pages).
4. Pick a **Primary Theme Color**. The entire application UI will instantly shift to match your brand color.
5. **Public Features**: You can instantly disable "Public Registrations" and "Public Ticket Transfers" with a single click. When disabled, the buttons vanish from the login page, locking down your event.

### 1.2 Dynamic Form Builder
Need to ask attendees for their T-Shirt size, dietary restrictions, or Discord ID? 
1. Navigate to the **Form builder** tab.
2. Click **Add Field**.
3. You can create `Text`, `Number`, `Select` (dropdown), or `Checkbox` fields.
4. Mark them as **Required** or choose to **Show in List** (which makes them visible in the main data tables).
5. These custom fields automatically inject themselves into your Public Registration forms and Admin On-Spot Registration forms!

### 1.3 Managing Attendees & Verifications
Attendees enter your system in three ways:
* **Bulk Excel Import**: Go to the **Registrations** tab to upload a `.xlsx` file. The system will automatically map headers to your Form Fields.
* **On-Spot Registration**: Add walk-ins directly from the dashboard.
* **Public Registrations**: If enabled, attendees can register themselves and upload "Payment Proof".
  - Public registrations go to the **Verification Queue**.
  - As an admin, open the Verification Queue to review the attendee details and their uploaded payment screenshot. 
  - Click **Approve** to authorize them, or **Reject** to discard their submission.

### 1.4 Ticket Transfers
If an attendee can no longer make it, they can use the "Self-Applied Ticket Transfer" feature from the public login page.
1. They enter their Original Ticket UUID and the recipient's details.
2. They upload a transfer fee payment proof (if applicable).
3. The request hits your **Verification Queue**, marked specifically as a `Ticket Transfer`.
4. Approving the transfer will logically reassign the ticket to the new recipient.

### 1.5 Generating & Dispatching QR Codes
QR codes are encrypted to prevent data scraping.
1. Navigate to **QR delivery**.
2. Click **Generate Missing QR Codes** to create secure payloads for all verified attendees who don't have one yet.
3. Your **Email Subject** and **Email Body** can be configured in the **Branding & Settings** tab.
   - *Crucial*: You **must** include `{{qr_code_image}}` in your email body template! This renders the secure inline attachment.
   - You can also use dynamic variables like `{{name}}` or `{{T-Shirt Size}}`.
4. Click **Send Unsent Emails** to dispatch them via your configured SMTP server. 
5. If SMTP fails, you can download a **CSV Export** to mail them via Mailchimp or another bulk sender.

### 1.6 Real-Time Monitoring & Rules
- **Dashboard**: Watch live metrics of registrations, QR dispatches, and check-ins.
- **Scan Rules**: Create rules for your stations. For example, create a `food` station and set `Allow Multiple Scans` to `False`. If a student tries to scan twice at the food counter, the system will reject the second scan.
- **Audit Log**: In the Scan Rules tab, the **Recent Scans** panel streams live, real-time logs of every single scan happening across the entire campus, showing exactly who was accepted or denied, and by which volunteer.

---

## 2. Access Management (RBAC)

Amaze Reg Desk utilizes a highly granular access control system for your staff.

### 2.1 User Categories (Role Templates)
Instead of assigning permissions to volunteers one by one, create Categories.
1. Navigate to **Users** -> **Manage Categories**.
2. Create a Category named `Catering Team`.
3. Under **Station Scopes**, assign them only to the `day-1-lunch` and `day-2-lunch` stations.
4. Give the category a distinct color (e.g., Orange).

### 2.2 Volunteers and Overrides
1. When creating a Volunteer account, you assign them to the `Catering Team` category.
2. They will automatically inherit the `day-1-lunch` and `day-2-lunch` scopes. 
3. **Overrides**: If you have a specific volunteer who needs to scan for `Catering` AND `Entry`, you can edit their user profile and check the `entry` scope. Checking manual scopes *overrides* their category defaults, giving you perfect pinpoint control.

---

## 3. Volunteer Operations

As a Volunteer on the ground, your job is fast, simple, and resilient to bad Wi-Fi.

### 3.1 PWA Installation (The App)
You don't need to download anything from the App Store. 
1. Open the event link on your phone (Safari for iOS, Chrome for Android).
2. Log in using your assigned Volunteer credentials.
3. Tap the browser's "Share" button (iOS) or menu (Android) and select **"Add to Home Screen"**.
4. The Amaze Reg Desk will now appear as a native app on your phone.

### 3.2 Scanning QR Codes
1. Open the app and navigate to **Scan QR Codes**.
2. Select your Station Context (you will only see stations you have been authorized for by the Admins).
3. Point your camera at an attendee's QR code.
4. The screen will instantly flash **Green (Accepted)** or **Red (Denied)** with the reason (e.g., "Already scanned at this station").

### 3.3 Offline Mode Capabilities
College campuses have notoriously bad cell reception. Amaze Reg Desk was built specifically for this.
- If you lose internet connection, the scanner will **continue to work**. 
- It evaluates the encrypted QR payloads locally and queues the scans in your phone's memory.
- When you reconnect to Wi-Fi, a background process automatically pushes all your queued scans to the main server. No data is ever lost.

### 3.4 Additional Volunteer Duties
Depending on your station scopes, Admins may also grant you access to:
- **Attendee Database**: Look up attendees manually if their phone dies.
- **Verification Queue**: Help clear out pending public registrations.
- **On-Spot Registration**: Register walk-ins directly from your tablet.
