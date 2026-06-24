"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useDevis, useFactures, usePlanning, useChantiers, useClients, useIntervenants, useEntreprise, useChantierNotes, LoadingSkeleton } from "@/lib/hooks";
import { createClient } from "@/lib/supabase/client";
import { InfoBanner, HelpTooltip } from "@/components/ui/v4";
import RappelsSection from "@/components/dashboard/RappelsSection";
import DecennaleBanner from "@/components/dashboard/DecennaleBanner";
import DoublonsAlert from "@/components/dashboard/DoublonsAlert";

// Type pour un rappel artisan (note privée datée à afficher dans "À faire")
interface ArtisanReminder {
  noteId: string
  interventionId: string
  texte: string
  dateIntervention: string  // YYYY-MM-DD
  isToday: boolean
  isTomorrow: boolean
  chantierId?: string | null
  clientName?: string
}
// EmptyDashboard supprimé — on affiche toujours le vrai dashboard

/* ───────────────────────────── Helpers ───────────────────────────── */

function formatEuro(n: number) {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " €";
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `il y a ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days}j`;
  return `il y a ${Math.floor(days / 7)} sem`;
}

/* Animated number counter */
function AnimatedNumber({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    const start = ref.current ?? 0;
    const startTime = performance.now();
    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (value - start) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    ref.current = value;
  }, [value, duration]);

  return <>{display.toLocaleString("fr-FR")}</>;
}

/* ───────────────────────────── Page ───────────────────────────── */

export default function DashboardPage() {
  const router = useRouter();
  const { data: factures, loading: fLoading } = useFactures();
  const { data: devis, loading: dLoading } = useDevis();
  const { data: planning, loading: pLoading } = usePlanning();
  const { data: chantiers } = useChantiers();
  const { data: clients } = useClients();
  const { data: intervenants } = useIntervenants();
  const { entreprise } = useEntreprise();
  const { data: chantierNotes } = useChantierNotes();
  const entrepriseNom = (entreprise?.nom as string) || '';
  const [mounted, setMounted] = useState(false);

  // === Rappels artisan privés (notes type 'note_artisan' pour aujourd'hui ou demain) ===
  const [artisanReminders, setArtisanReminders] = useState<ArtisanReminder[]>([]);

  useEffect(() => {
    if (!planning || planning.length === 0) {
      setArtisanReminders([]);
      return;
    }
    // Filtrer les interventions de J et J+1 (en LOCAL, pas UTC)
    const fmtISOLocal = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayKey = fmtISOLocal(today);
    const tomorrowKey = fmtISOLocal(tomorrow);

    const ivsConcernees = (planning as Record<string, unknown>[]).filter(p => {
      const dd = (p.date_debut as string | null)?.split('T')[0];
      return dd === todayKey || dd === tomorrowKey;
    });
    if (ivsConcernees.length === 0) {
      setArtisanReminders([]);
      return;
    }

    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const ids = ivsConcernees.map(iv => iv.id as string);
      const { data: notes } = await supabase
        .from('intervention_notes_client')
        .select('id, intervention_id, texte, type')
        .in('intervention_id', ids)
        .eq('type', 'note_artisan');
      if (cancelled) return;

      const ivMap = new Map<string, Record<string, unknown>>();
      ivsConcernees.forEach(iv => ivMap.set(iv.id as string, iv));
      const reminders: ArtisanReminder[] = (notes ?? []).map(n => {
        const iv = ivMap.get(n.intervention_id) || {};
        const dateRaw = ((iv.date_debut as string | undefined) || '').split('T')[0];
        const cId = iv.client_id as string | undefined;
        const cl = cId ? (clients as Record<string, unknown>[] | undefined)?.find(c => c.id === cId) : null;
        const cName = cl ? `${cl.prenom ?? ''} ${cl.nom ?? ''}`.trim() : '';
        return {
          noteId: n.id,
          interventionId: n.intervention_id,
          texte: n.texte,
          dateIntervention: dateRaw,
          isToday: dateRaw === todayKey,
          isTomorrow: dateRaw === tomorrowKey,
          chantierId: (iv.chantier_id as string | null) ?? null,
          clientName: cName,
        };
      })
      // Aujourd'hui d'abord, puis demain
      .sort((a, b) => (a.isToday === b.isToday ? 0 : a.isToday ? -1 : 1));
      setArtisanReminders(reminders);
    })();
    return () => { cancelled = true; };
  }, [planning, clients]);

  /* ── Profil incomplet : champs obligatoires manquants ── */
  const champsObligatoires: { champ: string; label: string }[] = [
    { champ: 'nom', label: 'Nom de l\'entreprise' },
    { champ: 'siret', label: 'SIRET' },
    { champ: 'forme_juridique', label: 'Forme juridique' },
    { champ: 'adresse', label: 'Adresse' },
    { champ: 'code_postal', label: 'Code postal' },
    { champ: 'ville', label: 'Ville' },
    { champ: 'telephone', label: 'Téléphone' },
    { champ: 'email', label: 'Email' },
    { champ: 'assurance_nom', label: 'Nom de l\'assureur décennale' },
    { champ: 'decennale_numero', label: 'N° de police décennale' },
    { champ: 'assurance_zone', label: 'Zone couverte décennale' },
  ];
  const champsManquants = entreprise
    ? champsObligatoires.filter(c => {
        const val = (entreprise as Record<string, unknown>)[c.champ];
        return !val || String(val).trim() === '';
      })
    : [];
  const profilIncomplet = entreprise && champsManquants.length > 0;

  useEffect(() => { setMounted(true); }, []);

  const loading = fLoading || dLoading || pLoading;

  /* ── Computed metrics ── */
  const facturesPayees = factures.filter((f: Record<string, unknown>) => f.statut === 'payee');
  const caFacture = factures.reduce((sum: number, f: Record<string, unknown>) => sum + Number(f.montant_ttc || 0), 0);
  const caEncaisse = facturesPayees.reduce((sum: number, f: Record<string, unknown>) => sum + Number(f.montant_ttc || 0), 0);
  const resteAEncaisser = caFacture - caEncaisse;
  const facturesImpayees = factures.filter((f: Record<string, unknown>) => f.statut === 'en_retard' || f.statut === 'envoyee');
  const devisEnCours = devis.filter((d: Record<string, unknown>) => d.statut === 'envoye' || d.statut === 'brouillon');
  const devisEnCoursMontant = devisEnCours.reduce((sum: number, d: Record<string, unknown>) => sum + Number(d.montant_ht || 0), 0);
  // Devis acceptés (statut 'signe') — utilisés pour la stat "Conversion" et "À planifier"
  const devisSignes = devis.filter((d: Record<string, unknown>) => d.statut === 'signe');
  const devisSignesMontantTTC = devisSignes.reduce((sum: number, d: Record<string, unknown>) => sum + Number(d.montant_ttc || 0), 0);
  const tauxConversion = devis.length > 0
    ? Math.round((devisSignes.length / devis.length) * 100)
    : 0;

  /* ── Client name resolver ── */
  const clientName = (id: unknown) => {
    const c = clients.find((c: Record<string, unknown>) => c.id === id) as Record<string, unknown> | undefined;
    if (!c) return '';
    return c.prenom ? `${c.prenom} ${c.nom}` : String(c.nom || '');
  };

  /* ── Planning sur 7 jours glissants (aujourd'hui → J+6) ──
   * Avant on filtrait juste la semaine ISO en cours (lun→ven), ce qui faisait
   * disparaître les interventions de la semaine prochaine quand on consultait
   * le dashboard un vendredi. Maintenant on regarde les 7 prochains jours
   * peu importe le jour de la semaine, ce qui colle mieux à l'usage artisan.
   * ⚠️ fmtISOLocal pour éviter le bug timezone classique. */
  const now = new Date();
  const today0 = new Date(now); today0.setHours(0, 0, 0, 0);
  const fmtISOLocal = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // monday/friday gardés pour la sous-info "Semaine du X au Y mois" (compat affichage)
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(23, 59, 59, 999);

  const dayShortLabels = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const dayFullLabelsArr = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

  // 7 jours glissants à partir d'aujourd'hui
  const next7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today0);
    d.setDate(today0.getDate() + i);
    return d;
  });

  const planningByDay = next7Days.map((dayDate) => {
    const dayKey = fmtISOLocal(dayDate);
    const dowIdx = (dayDate.getDay() + 6) % 7; // Lun=0, ..., Dim=6
    const entries = (planning as Record<string, unknown>[]).filter(p =>
      String(p.date_debut ?? '').startsWith(dayKey)
    );
    const isToday = dayDate.toDateString() === now.toDateString();
    const dateStr = dayDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    return {
      day: dayShortLabels[dowIdx],
      fullDay: dayFullLabelsArr[dowIdx],
      entries,
      isToday,
      dateStr,
    };
  });

  // Only show days that have events OR today (cap à 5 jours pour ne pas saturer)
  const visibleDays = planningByDay
    .filter(d => d.entries.length > 0 || d.isToday)
    .slice(0, 5);

  const planningEventColors = ['#5ab4e0', '#e87a2a', '#22c55e', '#7c3aed', '#d4a017'];

  /* ── Chart data ── */
  const monthLabels = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  const currentYear = new Date().getFullYear();
  const chartData = monthLabels.map((label, monthIdx) => {
    const monthFactures = factures.filter((f: Record<string, unknown>) => {
      const d = new Date(f.date_emission as string);
      return d.getFullYear() === currentYear && d.getMonth() === monthIdx;
    });
    const facture = monthFactures.reduce((s: number, f: Record<string, unknown>) => s + Number(f.montant_ttc || 0), 0);
    const encaisse = monthFactures.filter((f: Record<string, unknown>) => f.statut === 'payee')
      .reduce((s: number, f: Record<string, unknown>) => s + Number(f.montant_ttc || 0), 0);
    return { month: label, facture, encaisse };
  });
  const maxChartValue = Math.max(...chartData.map((d) => d.facture), 1);
  const yMax = Math.ceil(maxChartValue / 5000) * 5000 || 5000;

  /* ── À faire (todo items) ── */
  type TodoItem = {
    title: string;
    desc: string;
    amount: string;
    dotColor: string;
    amountColor: string;
    tag: string;
    tagBg: string;
    tagColor: string;
    href?: string;         // navigation clic sur la ligne
    actionHref?: string;   // navigation clic sur le bouton tag
  };
  const todoItems: TodoItem[] = [];

  // ── Rappels artisan privés (notes type 'note_artisan') — TOUJOURS EN PREMIER ──
  // Ces rappels (ex: "Appeler le client la veille") sont les choses que l'artisan
  // a notées pour lui-même. On les remonte en haut du widget "À faire" pour qu'il
  // n'oublie pas le jour J ou la veille.
  for (const r of artisanReminders) {
    const dayLabel = r.isToday ? "Aujourd'hui" : 'Demain';
    const cName = r.clientName ? ` · ${r.clientName}` : '';
    todoItems.push({
      title: `🔔 ${dayLabel} — ${r.texte}`,
      desc: `Rappel privé${cName}`,
      amount: '',
      dotColor: '#7c3aed',
      amountColor: '#7c3aed',
      tag: r.isToday ? 'Aujourd\'hui' : 'Demain',
      tagBg: '#f3e8ff',
      tagColor: '#7c3aed',
      href: r.chantierId ? `/dashboard/chantiers/${r.chantierId}` : '/dashboard/planning',
      actionHref: r.chantierId ? `/dashboard/chantiers/${r.chantierId}` : '/dashboard/planning',
    });
  }

  // Helper : extraire l'email depuis notes_client "Nom | Adresse | CP Ville | Tel | email@..."
  const extractEmail = (notesClient: unknown): string => {
    if (!notesClient) return '';
    return String(notesClient).split(' | ').reverse().find(p => p.includes('@'))?.trim() || '';
  };

  // Devis acceptes (signes) sans aucune intervention planifiee -- priorite 1
  // NOTE: mis EN PREMIER pour garantir la visibilite meme quand il y a beaucoup d'autres items
  const devisAcceptesAPlanifier = devis.filter((d: Record<string, unknown>) => {
    if (d.statut !== 'signe') return false
    const hasPlanningForDevis = planning.some((p: Record<string, unknown>) => p.devis_id === d.id)
    const hasPlanningForChantier = d.chantier_id
      ? planning.some((p: Record<string, unknown>) => p.chantier_id === d.chantier_id)
      : false
    return !hasPlanningForDevis && !hasPlanningForChantier
  })
  for (const d of devisAcceptesAPlanifier) {
    const cName = clientName(d.client_id) || (d.notes_client as string)?.split(' | ')[0] || ''
    todoItems.push({
      title: `Devis ${d.numero} -- accepte`,
      desc: `${cName} · a planifier`,
      amount: d.montant_ttc ? formatEuro(Number(d.montant_ttc)) : '',
      dotColor: '#10b981', amountColor: '#10b981',
      tag: 'Planifier', tagBg: '#ecfdf5', tagColor: '#059669',
      href: d.chantier_id ? `/dashboard/chantiers/${d.chantier_id}` : `/dashboard/devis/${d.id}`,
      actionHref: d.chantier_id
        ? `/dashboard/planning?chantier_id=${d.chantier_id}&devis_id=${d.id}`
        : `/dashboard/chantiers/nouveau?devis_id=${d.id}`,
    })
  }

  // Factures en retard
  const facturesEnRetard = factures.filter((f: Record<string, unknown>) => f.statut === 'en_retard');
  for (const f of facturesEnRetard) {
    const cName = clientName(f.client_id) || (f.client_nom as string) || '';
    const echeance = f.date_echeance ? new Date(f.date_echeance as string) : null;
    const joursRetard = echeance ? Math.floor((Date.now() - echeance.getTime()) / 86400000) : 0;
    todoItems.push({
      title: `Facture ${f.numero} — en retard`,
      desc: `${cName}${joursRetard > 0 ? ` · échue depuis ${joursRetard}j` : ''}`,
      amount: f.montant_ttc ? formatEuro(Number(f.montant_ttc)) : '',
      dotColor: '#ef4444', amountColor: '#ef4444',
      tag: 'Voir', tagBg: '#fef2f2', tagColor: '#ef4444',
      href: `/dashboard/factures/${f.id}`,
      actionHref: `/dashboard/factures/${f.id}`,
    });
  }

  // Factures envoyées (bientôt dues)
  const facturesEnvoyees = factures.filter((f: Record<string, unknown>) => f.statut === 'envoyee');
  for (const f of facturesEnvoyees) {
    const cName = clientName(f.client_id) || (f.client_nom as string) || '';
    const echeance = f.date_echeance ? new Date(f.date_echeance as string) : null;
    const joursRestants = echeance ? Math.ceil((echeance.getTime() - Date.now()) / 86400000) : 0;
    todoItems.push({
      title: `Facture ${f.numero} — bientôt due`,
      desc: `${cName}${joursRestants > 0 ? ` · échéance dans ${joursRestants}j` : ''}`,
      amount: f.montant_ttc ? formatEuro(Number(f.montant_ttc)) : '',
      dotColor: '#e87a2a', amountColor: '#e87a2a',
      tag: 'À relancer', tagBg: '#fff7ed', tagColor: '#e87a2a',
      href: `/dashboard/factures/${f.id}`,
      actionHref: `/dashboard/factures/${f.id}`,
    });
  }

  // Devis envoyés depuis 5+ jours sans réponse (pas les récents)
  const CINQ_JOURS_MS = 5 * 24 * 60 * 60 * 1000;
  const devisEnvoyesAnciensRaw = devis.filter((d: Record<string, unknown>) => {
    if (d.statut !== 'envoye') return false;
    const dateValidite = d.date_validite ? new Date(d.date_validite as string) : null;
    // Exclure si la date de validité est dépassée (seront dans "Expirés")
    if (dateValidite && dateValidite < now) return false;
    const envoyeDepuis = Date.now() - new Date(d.updated_at as string || d.created_at as string).getTime();
    return envoyeDepuis >= CINQ_JOURS_MS;
  });
  for (const d of devisEnvoyesAnciensRaw) {
    const cName = clientName(d.client_id) || (d.notes_client as string)?.split(' | ')[0] || '';
    const email = extractEmail(d.notes_client);
    const joursSansReponse = Math.floor((Date.now() - new Date(d.updated_at as string || d.created_at as string).getTime()) / 86400000);
    todoItems.push({
      title: `Devis ${d.numero} — sans réponse`,
      desc: `${cName} · envoyé il y a ${joursSansReponse}j`,
      amount: d.montant_ttc ? formatEuro(Number(d.montant_ttc)) : '',
      dotColor: '#5ab4e0', amountColor: '#5ab4e0',
      tag: 'Relancer', tagBg: '#eff6ff', tagColor: '#2563eb',
      href: `/dashboard/devis/${d.id}`,
      actionHref: `/dashboard/devis/${d.id}?relance=1${email ? `&email=${encodeURIComponent(email)}` : ''}`,
    });
  }

  // Devis refusés (à renégocier)
  const devisRefuses = devis.filter((d: Record<string, unknown>) => d.statut === 'refuse');
  for (const d of devisRefuses) {
    const cName = clientName(d.client_id) || (d.notes_client as string)?.split(' | ')[0] || '';
    todoItems.push({
      title: `Devis ${d.numero} — refusé`,
      desc: `${cName} · à renégocier`,
      amount: d.montant_ttc ? formatEuro(Number(d.montant_ttc)) : '',
      dotColor: '#ef4444', amountColor: '#ef4444',
      tag: 'Renégocier', tagBg: '#fef2f2', tagColor: '#ef4444',
      href: `/dashboard/devis/${d.id}`,
      actionHref: `/dashboard/devis/${d.id}`,
    });
  }

  // Devis expirés (date_validite dépassée et statut envoye)
  const devisExpiresRaw = devis.filter((d: Record<string, unknown>) => {
    if (d.statut !== 'envoye' && d.statut !== 'expire') return false;
    const dateValidite = d.date_validite ? new Date(d.date_validite as string) : null;
    return dateValidite && dateValidite < now;
  });
  for (const d of devisExpiresRaw) {
    const cName = clientName(d.client_id) || (d.notes_client as string)?.split(' | ')[0] || '';
    const email = extractEmail(d.notes_client);
    const joursExpire = d.date_validite ? Math.floor((Date.now() - new Date(d.date_validite as string).getTime()) / 86400000) : 0;
    todoItems.push({
      title: `Devis ${d.numero} — expiré`,
      desc: `${cName} · expiré il y a ${joursExpire}j`,
      amount: d.montant_ttc ? formatEuro(Number(d.montant_ttc)) : '',
      dotColor: '#f97316', amountColor: '#f97316',
      tag: 'Relancer', tagBg: '#fff7ed', tagColor: '#ea580c',
      href: `/dashboard/devis/${d.id}`,
      actionHref: `/dashboard/devis/${d.id}?relance=1${email ? `&email=${encodeURIComponent(email)}` : ''}`,
    });
  }

  // Interventions planning du jour ou en retard
  const todayStr = now.toISOString().split('T')[0]
  const planningUrgent = planning.filter((p: Record<string, unknown>) => {
    const dateDebut = p.date_debut ? (p.date_debut as string).split('T')[0] : null
    if (!dateDebut) return false
    const statut = p.statut as string
    if (statut === 'termine' || statut === 'annule') return false
    return dateDebut <= todayStr
  })
  for (const p of planningUrgent.slice(0, 3)) {
    const dateDebut = (p.date_debut as string).split('T')[0]
    const isToday = dateDebut === todayStr
    const joursRetard = isToday ? 0 : Math.floor((now.getTime() - new Date(dateDebut).getTime()) / 86400000)
    todoItems.push({
      title: `${p.titre || 'Intervention'} — ${isToday ? "aujourd'hui" : `en retard de ${joursRetard}j`}`,
      desc: p.description ? String(p.description).slice(0, 50) : 'Intervention planifiée',
      amount: '',
      dotColor: isToday ? '#8b5cf6' : '#ef4444', amountColor: isToday ? '#8b5cf6' : '#ef4444',
      tag: isToday ? "Aujourd'hui" : 'En retard', tagBg: isToday ? '#f5f3ff' : '#fef2f2', tagColor: isToday ? '#7c3aed' : '#ef4444',
      href: `/dashboard/planning`,
      actionHref: `/dashboard/planning`,
    })
  }

  // Conflits planning — detection heure par heure (A.start < B.end && B.start < A.end)
  const t2mDash = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0) }
  const recRangeDash = (rec: Record<string, unknown>): [number, number] => {
    const c = rec.creneau as string
    if (c === 'journee') return [t2mDash('08:00'), t2mDash('17:00')]
    if (c === 'matin') return [t2mDash('08:00'), t2mDash('12:00')]
    if (c === 'apres_midi') return [t2mDash('13:00'), t2mDash('17:00')]
    return [t2mDash((rec.heure_debut as string) || '08:00'), t2mDash((rec.heure_fin as string) || '17:00')]
  }
  const conflictDays = new Map<string, Record<string, unknown>[]>()
  for (const p of planning) {
    const rec = p as Record<string, unknown>
    const statut = rec.statut as string
    if (statut === 'termine' || statut === 'annule') continue
    if (!rec.intervenant_id) continue
    const key = `${rec.intervenant_id}__${(rec.date_debut as string)?.split('T')[0]}`
    if (!conflictDays.has(key)) conflictDays.set(key, [])
    conflictDays.get(key)!.push(rec)
  }
  const conflictingIds = new Set<string>()
  conflictDays.forEach((items) => {
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const [aStart, aEnd] = recRangeDash(items[i])
        const [bStart, bEnd] = recRangeDash(items[j])
        if (aStart < bEnd && bStart < aEnd) {
          conflictingIds.add(items[i].id as string)
          conflictingIds.add(items[j].id as string)
        }
      }
    }
  })
  const conflitsPlanningCount = conflictingIds.size
  if (conflitsPlanningCount > 0) {
    todoItems.unshift({
      title: 'Conflits dans le planning',
      desc: `${conflitsPlanningCount} intervention${conflitsPlanningCount > 1 ? 's' : ''} qui se chevauchent`,
      amount: '',
      dotColor: '#ef4444', amountColor: '#ef4444',
      tag: 'Resoudre', tagBg: '#fef2f2', tagColor: '#dc2626',
      href: '/dashboard/planning?filter=conflict',
      actionHref: '/dashboard/planning?filter=conflict',
    })
  }

  // Notes/rappels/tâches des chantiers (toutes catégories non cochées).
  // Auparavant on excluait 'info' mais ça empêchait les notes du type
  // "le client sera absent demain" de remonter sur l'accueil. Maintenant
  // on remonte TOUTES les notes non faites (limité à 5 pour pas saturer).
  const notesActives = chantierNotes.filter((n: Record<string, unknown>) => n.fait !== true)
  const noteCatConfig: Record<string, { tag: string; dot: string; tagBg: string; tagColor: string }> = {
    urgent: { tag: 'Urgent', dot: '#ef4444', tagBg: '#fef2f2', tagColor: '#ef4444' },
    rappel: { tag: 'À faire', dot: '#e87a2a', tagBg: '#fff7ed', tagColor: '#ea580c' },
    materiel: { tag: 'Matériel', dot: '#8b5cf6', tagBg: '#f5f3ff', tagColor: '#7c3aed' },
    appel: { tag: 'Appel', dot: '#3b82f6', tagBg: '#eff6ff', tagColor: '#2563eb' },
    demain: { tag: 'Demain', dot: '#f59e0b', tagBg: '#fffbeb', tagColor: '#b45309' },
    info: { tag: 'Note', dot: '#5ab4e0', tagBg: '#e8f4fb', tagColor: '#1a6fb5' },
  }
  for (const n of notesActives.slice(0, 5)) {
    const chantier = chantiers.find((c: Record<string, unknown>) => c.id === n.chantier_id) as Record<string, unknown> | undefined
    const chantierTitre = chantier ? String(chantier.titre || 'Chantier') : 'Chantier'
    const cat = noteCatConfig[n.categorie as string] || noteCatConfig.info
    todoItems.push({
      title: `${n.categorie === 'urgent' ? '⚠️ ' : n.categorie === 'demain' ? '🔔 ' : ''}${String(n.texte || n.contenu || '').slice(0, 60)}`,
      desc: chantierTitre,
      amount: '',
      dotColor: cat.dot, amountColor: cat.dot,
      tag: cat.tag, tagBg: cat.tagBg, tagColor: cat.tagColor,
      href: `/dashboard/chantiers/${n.chantier_id}`,
      actionHref: `/dashboard/chantiers/${n.chantier_id}`,
    })
  }

  /* ── Recent activity ── */
  type ActivityItem = { icon: 'paid' | 'sent' | 'doc'; desc: string; detail: string; amount: string; time: string; dotColor: string };
  const activityData: ActivityItem[] = [];
  const sortedDevis = [...devis].sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
    new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()
  ).slice(0, 4);
  const sortedFactures = [...factures].sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
    new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()
  ).slice(0, 4);

  for (const d of sortedDevis) {
    const statusLabel = d.statut === 'signe' ? 'signé' : d.statut === 'envoye' ? 'envoyé' : 'créé';
    const cName = clientName(d.client_id) || (d.notes_client as string)?.split(' | ')[0] || '';
    const dotColor = d.statut === 'signe' ? '#22c55e' : d.statut === 'envoye' ? '#5ab4e0' : '#7c3aed';
    activityData.push({
      icon: "doc", desc: cName,
      detail: `Devis ${d.numero} · ${statusLabel}`, amount: d.montant_ttc ? formatEuro(Number(d.montant_ttc)) : '',
      time: timeAgo(d.created_at as string), dotColor,
    });
  }
  for (const f of sortedFactures) {
    const statusLabel = f.statut === 'payee' ? 'payée' : 'envoyée';
    const cName = clientName(f.client_id) || (f.client_nom as string) || '';
    const dotColor = f.statut === 'payee' ? '#22c55e' : '#5ab4e0';
    activityData.push({
      icon: f.statut === 'payee' ? "paid" : "sent", desc: cName,
      detail: `Facture ${f.numero} · ${statusLabel}`, amount: f.montant_ttc ? formatEuro(Number(f.montant_ttc)) : '',
      time: timeAgo(f.created_at as string), dotColor,
    });
  }
  activityData.sort((a, b) => {
    const parse = (t: string) => { const m = t.match(/(\d+)/); return m ? parseInt(m[1]) : 999; };
    return parse(a.time) - parse(b.time);
  });

  /* ── Empty / Loading ── */
  // hasData supprimé — plus besoin de conditionner l'affichage

  if (loading) {
    return (
      <div className="max-w-[1360px] mx-auto px-4 py-5 sm:px-9 sm:py-8">
        <div className="mb-8 space-y-3">
          <div className="h-4 w-48 bg-[#e2e8f0] rounded-lg animate-pulse" />
          <div className="h-10 w-72 bg-[#e2e8f0] rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-[18px] mb-5 sm:mb-7">
          {[0,1,2,3].map(i => (
            <div key={i} className="h-28 sm:h-40 bg-[#e2e8f0] rounded-[20px] animate-pulse" style={{animationDelay: `${i * 100}ms`}} />
          ))}
        </div>
        <LoadingSkeleton rows={6} />
      </div>
    );
  }

  // Plus de page "Bienvenue" — on affiche le dashboard même vide (KPIs à 0 + bannière profil incomplet)

  /* ── Stagger animation ── */
  const stagger = (i: number) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(14px)',
    transition: `all 0.55s cubic-bezier(0.22, 1, 0.36, 1) ${i * 0.06}s`,
  });

  /* ── KPI data ── */
  type Kpi = {
    label: string
    value: number
    unit: string
    sub: string
    color: string
    barWidth: string
    valueColor?: string
    help?: string
  }
  const kpis: Kpi[] = [
    {
      label: 'CA Facturé',
      value: caFacture,
      unit: '€',
      sub: `TTC · ${new Date().toLocaleDateString('fr-FR', {month:'long', year:'numeric'})}`,
      color: '#5ab4e0',
      barWidth: '100%',
      help: 'Total TTC facturé (toutes factures envoyées ou payées). Inclut les factures en attente de règlement.',
    },
    {
      label: 'Encaissé',
      value: caEncaisse,
      unit: '€',
      sub: 'TTC réglé',
      color: '#22c55e',
      barWidth: caFacture > 0 ? `${Math.min((caEncaisse / caFacture) * 100, 100)}%` : '0%',
      help: 'Total des paiements réellement reçus (factures au statut "payée").',
    },
    {
      label: 'À encaisser',
      value: resteAEncaisser,
      unit: '€',
      sub: `${facturesImpayees.length} facture${facturesImpayees.length > 1 ? 's' : ''} en attente`,
      color: '#e87a2a',
      barWidth: caFacture > 0 ? `${Math.min((resteAEncaisser / caFacture) * 100, 100)}%` : '0%',
      valueColor: '#e87a2a',
      help: 'Factures envoyées mais pas encore réglées par vos clients (en attente de paiement).',
    },
    {
      label: 'Conversion',
      value: tauxConversion,
      unit: '%',
      // Affiche le nombre de devis acceptés et leur valeur (TTC) plutôt que les devis en cours
      sub: devisSignes.length > 0
        ? `${devisSignes.length} accepté${devisSignes.length > 1 ? 's' : ''} · ${formatEuro(devisSignesMontantTTC)} TTC`
        : `${devisEnCours.length} en attente · ${formatEuro(devisEnCoursMontant)} HT`,
      color: '#7c3aed',
      barWidth: `${tauxConversion}%`,
      help: 'Pourcentage de devis signés par rapport au total des devis créés. Mesure votre taux de transformation commercial.',
    },
  ];

  return (
    <div className="min-h-screen" style={{background: '#f6f8fb'}}>
      <div className="max-w-[1360px] mx-auto px-4 py-5 sm:px-6 sm:py-8 lg:px-9 lg:py-9">

        {/* V4 : bannière "Profil entreprise incomplet" via InfoBanner warn.
            Affiche les champs obligatoires manquants + CTA vers /parametres. */}
        {profilIncomplet && (
          <div className="mb-6" style={stagger(0)}>
            <InfoBanner
              variant="warn"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              }
            >
              <p className="font-hanken font-bold text-[15px] text-amber-900 mb-1">
                Profil entreprise incomplet
              </p>
              <p className="font-hanken text-sm text-amber-800 mb-3">
                Vos devis et factures ne sont pas conformes à la loi tant que ces informations ne sont pas renseignées.
                Risque d&apos;amende jusqu&apos;à <strong>75 000 €</strong>.
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {champsManquants.map(c => (
                  <span key={c.champ} className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-hanken text-xs font-semibold">
                    {c.label}
                  </span>
                ))}
              </div>
              <Link
                href="/dashboard/parametres"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl
                           bg-gradient-to-br from-[#ff7a1a] to-[#ff9d4d] text-white
                           font-hanken font-bold text-sm
                           shadow-[0_4px_12px_rgba(255,122,26,0.25)]
                           hover:-translate-y-0.5 hover:brightness-105 transition-all duration-200"
              >
                Compléter mon profil
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
            </InfoBanner>
          </div>
        )}

        {/* V2 10/06/2026 : bandeau decennale (etat absente / warning / urgente / expiree).
            Le composant gere lui-meme son affichage selon decennale_date_fin. */}
        <DecennaleBanner dateFin={(entreprise?.decennale_date_fin as string | null | undefined) ?? null} />

        {/* Alerte discrete : prestations qui se ressemblent dans le catalogue.
            Le composant ne rend rien (ni marge) s'il n'y a aucun doublon. */}
        <DoublonsAlert />

        {/* ═══════════════════ GREETING ═══════════════════ */}
        <div style={stagger(0)} className="mb-5 sm:mb-9 flex items-end justify-between flex-wrap gap-3 sm:gap-5">
          <div>
            {/* V4 : ligne date avec petit point orange pour l'accent visuel */}
            <p className="font-hanken text-[12px] font-bold tracking-[0.08em] uppercase mb-2 flex items-center gap-2" style={{color: '#6b7280'}}>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#ff7a1a]" aria-hidden="true" />
              <span className="font-spline-mono">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </p>
            <h1 className="font-hanken font-extrabold leading-[1.2] text-2xl sm:text-[34px]" style={{letterSpacing: '-0.025em'}}>
              <span className="inline-block" style={{
                background: 'linear-gradient(135deg, #0f1a3a 0%, #1f2d5e 60%, #ff7a1a 130%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                opacity: mounted ? 1 : 0,
                transform: mounted ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.97)',
                transition: 'all 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.3s',
              }}>{entrepriseNom}</span>
            </h1>
          </div>
          {/* V3.0e.2 : grandes cartes pleine largeur sur mobile (acces direct depuis
              l'accueil sans passer par le menu), layout compact sur desktop. */}
          <div className="grid grid-cols-2 gap-2.5 w-full sm:flex sm:w-auto sm:gap-2.5">
            <Link href="/dashboard/devis/nouveau"
              aria-label="Créer un nouveau devis"
              className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 rounded-2xl sm:rounded-[14px] text-white font-hanken font-bold transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97] h-[72px] sm:h-12 sm:w-[170px] text-[13px] sm:text-sm"
              style={{background: '#0f1a3a', boxShadow: '0 8px 24px -10px rgba(15,26,58,0.35)'}}>
              <svg width="22" height="22" className="sm:w-[15px] sm:h-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>Nouveau devis</span>
            </Link>
            <Link href="/dashboard/factures/nouveau"
              aria-label="Créer une nouvelle facture"
              className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 rounded-2xl sm:rounded-[14px] text-white font-hanken font-bold transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97] h-[72px] sm:h-12 sm:w-[170px] text-[13px] sm:text-sm"
              style={{background: 'linear-gradient(135deg, #ff7a1a, #ff9d4d)', boxShadow: '0 8px 20px rgba(255,122,26,0.35), inset 0 1px 0 rgba(255,255,255,0.25)'}}>
              <svg width="22" height="22" className="sm:w-[15px] sm:h-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nouvelle facture
            </Link>
          </div>
        </div>

        {/* ═══════════════════ KPI BENTO ═══════════════════ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-[18px] mb-5 sm:mb-7" role="region" aria-label="Indicateurs clés">
          {kpis.map((kpi, i) => (
            <div
              key={kpi.label}
              style={stagger(i + 1)}
              className="relative overflow-hidden rounded-[20px] border transition-all duration-300 hover:-translate-y-0.5 group"
            >
              {/* V4 : fond carte + bordure subtile + ombre douce signature V4 (inline pour Tailwind purge) */}
              <div className="absolute inset-0" style={{
                background: '#ffffff',
                border: '1px solid rgba(15,26,58,0.06)',
                borderRadius: '20px',
                boxShadow: '0 8px 24px rgba(15,26,58,0.06), 0 1px 4px rgba(15,26,58,0.04)',
              }} />

              {/* Decorative circle */}
              <div
                className="absolute -top-5 -right-5 w-[100px] h-[100px] rounded-full transition-all duration-400 opacity-[0.12] group-hover:opacity-[0.22] group-hover:scale-[1.15]"
                style={{background: kpi.color}}
              />

              <div className="relative p-3 sm:p-5 lg:p-7">
                {/* Label with dot */}
                <div className="flex items-center gap-1.5 sm:gap-2.5 mb-2 sm:mb-5">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background: kpi.color}} />
                  <span className="font-hanken text-[11px] sm:text-[13px] font-bold tracking-[0.01em]" style={{color: '#445068'}}>{kpi.label}</span>
                  {kpi.help && (
                    <HelpTooltip label={`Aide ${kpi.label}`} content={kpi.help} />
                  )}
                </div>

                {/* Big value */}
                <p className="font-hanken font-extrabold leading-none mb-1 sm:mb-1.5 text-[22px] sm:text-[32px] lg:text-[40px]" style={{
                  letterSpacing: '-0.04em',
                  fontVariantNumeric: 'tabular-nums',
                  color: kpi.valueColor || '#0f1a3a',
                }}>
                  <AnimatedNumber value={kpi.value} />
                  <span className="font-bold ml-0.5 text-sm sm:text-[18px] lg:text-[22px]" style={{color: '#7b8ba3'}}>{kpi.unit}</span>
                </p>

                {/* Sub text */}
                <p className="font-hanken text-[10px] sm:text-[13px] font-medium mb-2 sm:mb-[18px] truncate" style={{color: '#7b8ba3'}}>{kpi.sub}</p>

                {/* Progress bar with shimmer */}
                <div className="h-1 rounded-full overflow-hidden" style={{background: '#eef1f6'}}>
                  <div
                    className="h-full rounded-full overflow-hidden relative"
                    style={{
                      width: mounted ? kpi.barWidth : '0%',
                      background: kpi.color,
                      transition: `width 1.5s cubic-bezier(0.22, 1, 0.36, 1) ${0.5 + i * 0.15}s`,
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '50%',
                      height: '100%',
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                      animation: 'shimmer 2.5s ease-in-out infinite 1.5s',
                    }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ═══════════════════ ROW 2: À FAIRE + CHART ═══════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

          {/* ── À Faire ── */}
          <div
            style={{
              ...stagger(5),
              background: 'linear-gradient(135deg, #fffbf7 0%, #fff 40%)',
              borderColor: 'rgba(232,122,42,0.15)',
            }}
            className="rounded-[20px] border shadow-[0_1px_2px_rgba(15,26,58,0.02),0_4px_16px_rgba(15,26,58,0.045)] hover:shadow-[0_2px_6px_rgba(15,26,58,0.06),0_12px_32px_rgba(15,26,58,0.08)] transition-shadow duration-300"
          >
            <div className="p-4 sm:p-7">
              {/* Header */}
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <div>
                  <h2 className="font-hanken font-extrabold text-[18px] text-[#0f1a3a] tracking-[-0.025em]">À faire</h2>
                  <p className="font-hanken text-[13px] font-medium mt-0.5" style={{color: '#7b8ba3'}}>
                    Actions qui nécessitent votre attention
                  </p>
                </div>
                {todoItems.length > 0 && (
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-[10px]" style={{
                    background: 'rgba(239,68,68,0.08)',
                    color: '#ef4444',
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    {todoItems.length} action{todoItems.length > 1 ? 's' : ''}
                  </div>
                )}
              </div>

              {/* Todo list */}
              <div className="flex flex-col gap-[3px]">
                {todoItems.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{background: '#f1f5f9'}}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <p className="font-hanken text-sm font-medium" style={{color: '#7b8ba3'}}>Tout est à jour !</p>
                  </div>
                ) : (
                  todoItems.slice(0, 6).map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3.5 rounded-[14px] transition-all duration-150 hover:bg-white/80 cursor-pointer"
                      onClick={() => { if (item.href) router.push(item.href); }}
                      style={{
                        padding: '14px 16px',
                        opacity: mounted ? 1 : 0,
                        transform: mounted ? 'translateX(0)' : 'translateX(10px)',
                        transition: `all 0.45s cubic-bezier(0.22, 1, 0.36, 1) ${0.35 + i * 0.06}s`,
                      }}
                    >
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background: item.dotColor}} />
                      <div className="flex-1 min-w-0">
                        <p className="font-hanken text-sm font-bold truncate" style={{color: '#0f1a3a'}}>{item.title}</p>
                        <p className="font-hanken text-xs font-medium mt-0.5 truncate" style={{color: '#7b8ba3'}}>{item.desc}</p>
                      </div>
                      <div className="text-right flex-shrink-0" onClick={e => e.stopPropagation()}>
                        <p className="font-hanken font-extrabold text-[15px]" style={{
                          color: item.amountColor,
                          fontVariantNumeric: 'tabular-nums',
                          letterSpacing: '-0.02em',
                        }}>{item.amount}</p>
                        {item.actionHref ? (
                          <a
                            href={item.actionHref}
                            className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-[7px] mt-1 transition-opacity hover:opacity-80"
                            style={{ background: item.tagBg, color: item.tagColor }}
                            onClick={e => e.stopPropagation()}
                          >{item.tag}</a>
                        ) : (
                          <span className="inline-block text-[11px] font-bold px-2 py-0.5 rounded-[7px] mt-1" style={{
                            background: item.tagBg, color: item.tagColor,
                          }}>{item.tag}</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ── Graphique CA ── */}
          <div
            style={stagger(6)}
            className="rounded-[20px] border border-[#0f1a3a]/[0.06] bg-white shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)] hover:shadow-[0_12px_32px_rgba(15,26,58,0.08),_0_2px_6px_rgba(15,26,58,0.06)] transition-shadow duration-300"
          >
            <div className="p-4 sm:p-7">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <div>
                  <h2 className="font-hanken font-extrabold text-[18px] text-[#0f1a3a] tracking-[-0.025em]">Chiffre d&apos;affaires</h2>
                  <p className="font-hanken text-[13px] font-medium mt-0.5" style={{color: '#7b8ba3'}}>
                    12 mois · {currentYear}
                  </p>
                </div>
                <Link href="/dashboard/statistiques"
                  className="inline-flex items-center gap-1 font-hanken text-[13px] font-bold px-3.5 py-2.5 rounded-[10px] transition-all duration-200 hover:bg-[rgba(255,122,26,0.06)]"
                  style={{color: '#ff7a1a', minHeight: '44px'}}>
                  Statistiques
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
                </Link>
              </div>

              {/* Legend */}
              <div className="flex gap-5 mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded" style={{background: '#0f1a3a'}} />
                  <span className="font-hanken text-[13px] font-semibold" style={{color: '#445068'}}>Facturé</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded" style={{background: '#22c55e'}} />
                  <span className="font-hanken text-[13px] font-semibold" style={{color: '#445068'}}>Encaissé</span>
                </div>
              </div>

              {/* Chart bars */}
              <div className="flex items-end gap-2.5" style={{height: '210px'}} role="img" aria-label={`Graphique chiffre d'affaires ${currentYear}`}>
                {chartData.map((d, i) => {
                  const isCurrentMonth = i === new Date().getMonth();
                  const barH = maxChartValue > 0 ? Math.max((d.facture / yMax) * 100, 4) : 6;
                  const greenH = maxChartValue > 0 ? Math.max((d.encaisse / yMax) * 100, 0) : 0;
                  return (
                    <div key={d.month} className="flex-1 flex flex-col items-center group/bar relative cursor-default">
                      {/* Tooltip */}
                      <div className="absolute -top-[38px] left-1/2 -translate-x-1/2 opacity-0 group-hover/bar:opacity-100 scale-90 group-hover/bar:scale-100 transition-all duration-200 pointer-events-none z-10">
                        <div className="text-white text-xs font-bold px-3.5 py-[7px] rounded-[10px] whitespace-nowrap" style={{
                          background: '#0f1a3a',
                          boxShadow: '0 4px 16px rgba(15,26,58,0.3)',
                          letterSpacing: '-0.01em',
                        }}>
                          {d.facture > 0 ? formatEuro(d.facture) : '—'}
                        </div>
                      </div>
                      <div className="w-full flex items-end gap-[3px]" style={{height: '170px'}}>
                        <div
                          className="flex-1 transition-all duration-700 ease-out group-hover/bar:brightness-110"
                          style={{
                            height: mounted ? `${barH}%` : '0%',
                            transitionDelay: `${i * 35}ms`,
                            background: isCurrentMonth ? '#0f1a3a' : '#e4e9f0',
                            borderRadius: '6px 6px 2px 2px',
                          }}
                        />
                        <div
                          className="flex-1 transition-all duration-700 ease-out group-hover/bar:brightness-110"
                          style={{
                            height: mounted ? `${greenH}%` : '0%',
                            transitionDelay: `${80 + i * 35}ms`,
                            background: isCurrentMonth ? '#22c55e' : '#d1fae5',
                            borderRadius: '6px 6px 2px 2px',
                          }}
                        />
                      </div>
                      <span className="font-hanken text-xs font-semibold mt-3.5" style={{
                        color: isCurrentMonth ? '#0f1a3a' : '#a8b5c5',
                        fontWeight: isCurrentMonth ? 800 : 600,
                      }}>
                        {d.month}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════ ROW 2.5 : RAPPELS LIBRES ═══════════════════
            Widget "post-it" pour notes libres (Rappeler comptable, renouveler
            décennale, etc.). Composant défensif : si la table `rappels` n'a
            pas encore été migrée, il renvoie null et n'affiche rien. */}
        <div style={stagger(6.5)} className="mb-5">
          <RappelsSection />
        </div>

        {/* ═══════════════════ ROW 3: PLANNING + ACTIVITY ═══════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* ── Planning semaine (detailed) ── */}
          <div
            style={stagger(7)}
            className="rounded-[20px] border border-[#0f1a3a]/[0.06] bg-white shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)] hover:shadow-[0_12px_32px_rgba(15,26,58,0.08),_0_2px_6px_rgba(15,26,58,0.06)] transition-shadow duration-300"
          >
            <div className="p-4 sm:p-7">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <div>
                  <h2 className="font-hanken font-extrabold text-[18px] text-[#0f1a3a] tracking-[-0.025em]">Planning de la semaine</h2>
                  <p className="font-hanken text-[13px] font-medium mt-0.5" style={{color: '#7b8ba3'}}>
                    Semaine du {monday.getDate()} au {friday.getDate()} {monday.toLocaleDateString('fr-FR', {month: 'long'})}
                  </p>
                </div>
                <Link href="/dashboard/planning"
                  className="inline-flex items-center gap-1 font-hanken text-[13px] font-bold px-3.5 py-2.5 rounded-[10px] transition-all duration-200 hover:bg-[rgba(255,122,26,0.06)]"
                  style={{color: '#ff7a1a', minHeight: '44px'}}>
                  Tout voir
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
                </Link>
              </div>

              {/* Planning days */}
              <div>
                {visibleDays.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed rounded-[14px]" style={{borderColor: '#e8ecf1'}}>
                    <p className="font-hanken text-[13px] font-medium" style={{color: '#7b8ba3'}}>Aucune intervention cette semaine</p>
                  </div>
                ) : (
                  visibleDays.map((day, di) => (
                    <div key={day.day} className="mb-4 last:mb-0">
                      {/* Day header */}
                      <div className="flex items-center gap-2.5 mb-3">
                        <span className="font-hanken text-xs font-bold uppercase tracking-[0.06em] px-3.5 py-1.5 rounded-[10px]" style={{
                          background: day.isToday ? '#0f1a3a' : '#f0f3f7',
                          color: day.isToday ? '#fff' : '#7b8ba3',
                        }}>
                          {day.day}
                        </span>
                        <span className="font-hanken text-[13px] font-medium" style={{color: '#7b8ba3'}}>
                          {day.dateStr}{day.isToday ? ' (aujourd\'hui)' : ''}
                        </span>
                      </div>

                      {/* Events */}
                      {day.entries.length === 0 ? (
                        <div className="text-center py-5 border-2 border-dashed rounded-[14px] mb-2" style={{borderColor: '#e8ecf1'}}>
                          <span className="font-hanken text-[13px] font-medium" style={{color: '#a8b5c5'}}>Aucune intervention</span>
                        </div>
                      ) : (
                        day.entries.map((entry: Record<string, unknown>, ei: number) => {
                          const eventColor = planningEventColors[ei % planningEventColors.length];
                          const startDate = new Date(entry.date_debut as string);
                          const endDate = entry.date_fin ? new Date(entry.date_fin as string) : null;
                          const hour = startDate.toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'});
                          const durationMs = endDate ? endDate.getTime() - startDate.getTime() : 0;
                          const durationH = durationMs > 0 ? Math.round(durationMs / 3600000 * 10) / 10 : 0;
                          const durationStr = durationH > 0 ? `${durationH}h` : '';
                          const cName = clientName(entry.client_id);
                          const titre = String(entry.titre || '');
                          const adresse = String(entry.adresse || entry.lieu || '');

                          return (
                            <div
                              key={ei}
                              className="flex items-stretch gap-4 mb-2 rounded-[14px] border bg-white transition-all duration-200 hover:translate-x-[3px]"
                              style={{
                                padding: '16px 18px',
                                borderColor: '#e6ecf2',
                                opacity: mounted ? 1 : 0,
                                transform: mounted ? 'translateX(0)' : 'translateX(10px)',
                                transition: `all 0.45s cubic-bezier(0.22, 1, 0.36, 1) ${0.5 + di * 0.08 + ei * 0.05}s`,
                              }}
                            >
                              {/* Time */}
                              <div className="flex-shrink-0" style={{width: '58px'}}>
                                <p className="font-hanken font-extrabold text-[17px]" style={{
                                  color: '#0f1a3a',
                                  fontVariantNumeric: 'tabular-nums',
                                  letterSpacing: '-0.02em',
                                }}>{hour}</p>
                                {durationStr && (
                                  <p className="font-hanken text-[11px] font-semibold mt-0.5" style={{color: '#7b8ba3'}}>{durationStr}</p>
                                )}
                              </div>

                              {/* Color bar */}
                              <div className="w-[3px] rounded-full flex-shrink-0 self-stretch" style={{background: eventColor}} />

                              {/* Details */}
                              <div className="flex-1 min-w-0">
                                {cName && <p className="font-hanken text-[15px] font-bold" style={{color: '#0f1a3a'}}>{cName}</p>}
                                {titre && <p className="font-hanken text-[13px] mt-0.5" style={{color: '#445068'}}>{titre}</p>}
                                {adresse && (
                                  <p className="flex items-center gap-1.5 font-hanken text-xs mt-1.5" style={{color: '#7b8ba3'}}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a8b5c5" strokeWidth="2" className="flex-shrink-0" aria-hidden="true">
                                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                                    </svg>
                                    {adresse}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ── Activité récente ── */}
          <div
            style={stagger(8)}
            className="rounded-[20px] border border-[#0f1a3a]/[0.06] bg-white shadow-[0_8px_24px_rgba(15,26,58,0.06),_0_1px_4px_rgba(15,26,58,0.04)] hover:shadow-[0_12px_32px_rgba(15,26,58,0.08),_0_2px_6px_rgba(15,26,58,0.06)] transition-shadow duration-300"
          >
            <div className="p-4 sm:p-7">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="font-hanken font-extrabold text-[18px] text-[#0f1a3a] tracking-[-0.025em]">Activité récente</h2>
                <Link href="/dashboard/devis"
                  className="inline-flex items-center gap-1 font-hanken text-[13px] font-bold px-3.5 py-2.5 rounded-[10px] transition-all duration-200 hover:bg-[rgba(255,122,26,0.06)]"
                  style={{color: '#ff7a1a', minHeight: '44px'}}>
                  Tout voir
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
                </Link>
              </div>

              <div>
                {activityData.slice(0, 7).map((item, i) => {
                  const isPaid = item.icon === 'paid';
                  const isSent = item.icon === 'sent';
                  const iconColor = isPaid ? '#22c55e' : isSent ? '#5ab4e0' : '#7c3aed';
                  const iconBg = isPaid ? 'rgba(34,197,94,0.07)' : isSent ? 'rgba(90,180,224,0.07)' : 'rgba(124,58,237,0.07)';
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3.5 rounded-[14px] transition-colors duration-150 hover:bg-[#f8fafb] cursor-default"
                      style={{
                        padding: '13px 14px',
                        opacity: mounted ? 1 : 0,
                        transform: mounted ? 'translateX(0)' : 'translateX(10px)',
                        transition: `all 0.45s cubic-bezier(0.22, 1, 0.36, 1) ${0.52 + i * 0.05}s`,
                      }}
                    >
                      {/* Icon */}
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{background: iconBg}}
                      >
                        {isPaid ? (
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                        ) : isSent ? (
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                        ) : (
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16h12V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-hanken text-sm font-bold truncate" style={{color: '#0f1a3a'}}>
                          <span className="inline-block w-[7px] h-[7px] rounded-full mr-1.5 align-middle" style={{background: item.dotColor}} />
                          {item.desc || item.detail}
                        </p>
                        {item.desc && <p className="font-hanken text-xs font-medium truncate mt-0.5" style={{color: '#a8b5c5'}}>{item.detail}</p>}
                      </div>

                      {/* Amount + time */}
                      <div className="text-right flex-shrink-0 ml-2">
                        <p className="font-hanken font-extrabold text-[15px]" style={{
                          color: isPaid ? '#22c55e' : '#0f1a3a',
                          fontVariantNumeric: 'tabular-nums',
                          letterSpacing: '-0.02em',
                        }}>{item.amount}</p>
                        <p className="font-hanken text-[11px] font-medium mt-0.5" style={{color: '#a8b5c5'}}>{item.time}</p>
                      </div>
                    </div>
                  );
                })}
                {activityData.length === 0 && (
                  <div className="text-center py-10">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{background: '#f1f5f9'}}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" aria-hidden={true}><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" strokeLinecap="round" /></svg>
                    </div>
                    <p className="font-hanken text-sm font-medium" style={{color: '#7b8ba3'}}>Aucune activité récente</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Spacer bottom */}
        <div className="h-10" />
      </div>
    </div>
  );
}
