import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

function constantTimeEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    if (bufA.length !== bufB.length) {
      // Still do a comparison to avoid timing leak on length
      timingSafeEqual(bufA, bufA)
      return false
    }
    return timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const expectedToken = process.env.PREVIEW_TOKEN
  const previewEmail = process.env.PREVIEW_EMAIL

  if (!expectedToken || !previewEmail) {
    return NextResponse.json({ error: 'Configuration serveur manquante' }, { status: 500 })
  }

  if (!token || !constantTimeEqual(token, expectedToken)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: 'Configuration serveur manquante' }, { status: 500 })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Génère le magic link et l'envoie par email — ne jamais exposer l'action_link en redirect
  const { error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: previewEmail,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://nexartis.fr'}/auth/callback?next=/dashboard`,
    },
  })

  if (error) {
    return NextResponse.json(
      { error: 'Impossible de générer le lien' },
      { status: 500 },
    )
  }

  // Le lien est envoyé par email à PREVIEW_EMAIL — ne pas le retourner dans la réponse
  return NextResponse.json({
    success: true,
    message: `Lien de connexion envoyé à ${previewEmail}. Vérifiez votre boîte mail.`,
  })
}
