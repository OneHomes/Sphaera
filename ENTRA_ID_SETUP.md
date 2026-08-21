# Setting Up Microsoft Entra ID Sign-In for Sphaera

This connects the "Sign in with Microsoft" button to your organization's
real Microsoft identity (Entra ID) — the same mechanism used by TaskFlow.

## 1. Register the app in Azure

1. Go to **portal.azure.com** → search **"Microsoft Entra ID"**.
2. Left menu → **App registrations** → **New registration**.
3. Fill in:
   - **Name**: `Sphaera` (or `Sphaera - Dev` / `Sphaera - Prod` if you want
     separate registrations per environment)
   - **Supported account types**: "Accounts in this organizational directory
     only (One Homes only — Single tenant)"
   - **Redirect URI**: choose **Web**, and enter:
     - Local dev: `http://localhost:3000/api/auth/callback/azure-ad`
     - Production (once deployed): `https://<your-app-name>.azurewebsites.net/api/auth/callback/azure-ad`
     (you can add both — multiple redirect URIs are allowed)
4. Click **Register**.

## 2. Collect the three values you need

On the app's **Overview** page, copy:
- **Application (client) ID** → this is `AZURE_AD_CLIENT_ID`
- **Directory (tenant) ID** → this is `AZURE_AD_TENANT_ID`

Then go to **Certificates & secrets** → **New client secret** → give it a
description and expiry → copy the **Value** immediately (it's hidden after
you leave the page) → this is `AZURE_AD_CLIENT_SECRET`.

## 3. Set API permissions (usually already fine by default)

Under **API permissions**, you should already have:
- `Microsoft Graph` → `User.Read` (delegated)

This is enough for sign-in + basic profile. Add more later only if a
specific feature needs Graph data (e.g. M365 calendar/mail reading per
PRD's Microsoft 365/Graph integration — that's a separate, larger permission
set for later).

## 4. Fill in your local env file

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` with the three values from step 2, plus:
```
NEXTAUTH_SECRET=<run: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
```

## 5. Test it

```bash
npm run dev
```

Go to `http://localhost:3000/sign-in`, click **Sign in with Microsoft** —
it should redirect to the real Microsoft login page, ask you to sign in
with your One Homes account, then bounce back to `/command` signed in.

## 6. When deploying to Azure Web App

In the Web App's **Configuration → Application settings**, add the same
four environment variables (`AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`,
`AZURE_AD_TENANT_ID`, `NEXTAUTH_SECRET`), and set `NEXTAUTH_URL` to your
real production URL. Also add the production redirect URI back in the App
Registration (step 1) if you didn't already.

## What this does NOT do yet

This only gets someone signed in and identifies who they are (their Entra ID
object ID is attached to the session in `lib/auth.ts`). It does **not** yet:
- Enforce role-based access control (PF02) — that needs a role/permission
  table mapped to Entra ID users/groups, built in a later module.
- Restrict which One Homes users can sign in beyond "anyone in the tenant" —
  tighten this later via Enterprise Applications → assignment required, or
  Entra ID security groups, once pilot user list is confirmed.
