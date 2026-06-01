# Operations Guide

This guide is for Event Administrators managing operations through the Amaze Reg Desk dashboard.

## 1. Global Branding
Navigate to the **Admin -> Branding & Settings** tab.
Here you can set the `App Name`, `Event Name`, `Logo Image URL`, and `Primary Theme Color`. Once saved, these immediately sync to the login, registration, and transfer pages.

## 2. Dynamic Form Builder
If your event requires specific attendee information (like "T-Shirt Size" or "Discord ID"):
1. Go to the **Form builder** tab.
2. Click **Add Field**.
3. Select the type (Text, Select, Checkbox, etc).
4. Save. This field will automatically appear on all On-Spot registration forms and Public Registration pages.

## 3. Public Features
In the **Branding & Settings** tab, you can toggle:
- `Enable Public Registrations`
- `Enable Public Ticket Transfers`

If public registrations are on, users can submit their details and upload a "Payment Proof" image. These fall into the **Verification Queue**.

## 4. Verification Queue
Registrations and Transfers from the public require manual staff approval.
1. Navigate to the **Verification Queue**.
2. Review the submitted data and the uploaded payment proof image.
3. Click **Approve** (activates their QR code) or **Reject** (deletes the request).

## 5. Volunteers & Roles
1. Go to **Users**.
2. Create **Categories** (e.g. "Security", "Catering"). Assign them specific station scopes (e.g. `entry`, `day-1-lunch`).
3. Create a **Volunteer User** and assign them to that category.
4. If a specific volunteer needs extra access, override their access by manually checking scopes in their profile.

## 6. Email Templating
QR Codes are sent to users via email. Configure the email template in **Branding & Settings**.
- You must include `{{qr_code_image}}` in the HTML body where you want the QR code to appear.
- Use double brackets for any other variable, including custom form fields: e.g. `{{name}}`, `{{college}}`, `{{discord_id}}`.

## 7. Scanning & Audit
Volunteers log in and open the **Scan QR Codes** tab. They select their station.
- If offline, scans process instantly and queue in the background.
- Scans respect **Scan Rules** (e.g. allowing only 1 scan for "food", or unlimited for "entry").
- You can watch scans happen live in the **Scan rules** tab via the **Recent Scans** audit log.
