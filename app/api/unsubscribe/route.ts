// app/api/unsubscribe/route.ts
// Desinscription des emails marketing Nexartis (lien signe, sans authentification).
// GET  : ouvre une page de confirmation et enregistre l'opt-out.
// POST : "one-click unsubscribe" (RFC 8058) declenche par certains clients mail.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyUnsubscribe } from '@/lib/email'

export const runtime = 'nodejs'

async function optOut(email: string): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  await supabase
    .from('email_optouts')
    .upsert({ email: email.trim().toLowerCase() }, { onConflict: 'email' })
}

function htmlPage(title: string, message: string): NextResponse {
  const body = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f6f9;margin:0;padding:48px 16px;"><div style="max-width:480px;margin:0 auto;background:#fff;border-radius:14px;padding:36px 32px;box-shadow:0 4px 18px rgba(15,26,58,.08);text-align:center;"><div style="font-size:22px;font-weight:800;color:#0f1a3a;letter-spacing:-.01em;margin-bottom:14px;">NEX<span style="color:#e87a2a;">A</span>RTIS</div><p style="color:#475569;line-height:1.65;font-size:15px;margin:0;">${message}</p></div></body></html>`
  return new NextResponse(body, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export async function GET(req: NextRequest) {
  const e = req.nextUrl.searchParams.get('e') || ''
  const s = req.nextUrl.searchParams.get('s') || ''
  const email = verifyUnsubscribe(e, s)
  if (!email) {
    return htmlPage(
      'Lien invalide',
      "Ce lien de désinscription est invalide ou incomplet. Si vous souhaitez ne plus recevoir nos emails d'information, écrivez-nous à contact.nexartis@gmail.com.",
    )
  }
  try {
    await optOut(email)
  } catch (err) {
    console.error('[unsubscribe] echec opt-out:', (err as Error).message)
    return htmlPage(
      'Erreur',
      "Une erreur est survenue. Réessayez plus tard ou écrivez à contact.nexartis@gmail.com pour être désinscrit.",
    )
  }
  return htmlPage(
    'Désinscription confirmée',
    "C'est fait : vous ne recevrez plus les emails d'information de Nexartis. Vous continuerez à recevoir les emails liés à votre compte (factures, sécurité, abonnement).",
  )
}

export async function POST(req: NextRequest) {
  const e = req.nextUrl.searchParams.get('e') || ''
  const s = req.nextUrl.searchParams.get('s') || ''
  const email = verifyUnsubscribe(e, s)
  if (email) {
    try {
      await optOut(email)
    } catch (err) {
      console.error('[unsubscribe] echec opt-out (POST):', (err as Error).message)
    }
  }
  return new NextResponse(null, { status: 200 })
}
