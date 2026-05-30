'use client'

import { AlertTriangle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type {
  R,
  PaletteEntry,
  PlanningDensity,
  InterventionIntervenant,
  WeekDay,
} from '@/components/planning/shared/types'

// ===================================================================
// SoloAgendaView — Vague 3 (29/05/2026)
// ===================================================================
// Vue agenda : 7 (ou 5) colonnes-jours, sans matrice intervenants.
// Pensée pour le mode AE/EI où il n'y a qu'un seul intervenant
// principal. Les interventions sont triées par heure_debut croissante
// dans chaque colonne.
//
// Drag & drop :
//   - drag d'une intervention existante depuis une colonne → autre
//     colonne (changement de date, intervenant inchangé) ;
//   - drag d'un chip intervenant (barre toolbar) → ouverture du modal
//     pré-rempli avec date + intervenant.
//
// Cellule (case) = colonne complète du jour scrollable verticalement.
// Avatar mini en bas à droite de chaque carte pour rappeler quel
// intervenant porte cette intervention (utile dès qu'il y a 2+
// intervenants actifs : sous-traitants, dirigeant, etc.).
// ===================================================================

export type SoloAgendaIntervention = R

export type SoloAgendaProps = {
  /** 5 ou 7 jours de la semaine courante. */
  days: WeekDay[]
  /** Map(`dateStr` → liste interventions du jour, triées par heure). */
  interventionsByDay: Map<string, R[]>
  /** Map(intervenant_id → entrée palette pour la couleur). */
  colorMap: Map<string, PaletteEntry>
  /** Map(intervenant_id → record intervenant) pour récupérer prénom/nom. */
  intervenantMap: Map<string, R>
  /** Map(intervention_id → liaisons multi-intervenants). */
  interventionIntervenantsMap: Map<string, InterventionIntervenant[]>
  /** Set des intervention_id en conflit horaire. */
  conflicts: Set<string>
  /** Densité globale du planning. */
  density: PlanningDensity
  /** ID intervention actuellement draggée (visual). */
  draggedId: string | null
  /** ID cellule où l'utilisateur survole pendant le drag (visual). */
  dragOverCell: string | null
  setDragOverCell: (key: string | null) => void

  // ── Handlers ───────────────────────────────────────────────────
  /** Ouvre le panneau détail droit. */
  onOpenPanel: (intervention: R) => void
  /** Ouvre le modal pré-rempli pour création (date + intervenant). */
  onOpenModal: (dateStr?: string, intervenantId?: string) => void
  /** Démarre un drag (intervention + intervenant porteur). */
  onDragStart: (id: string, fromIvId?: string) => void
  /** Fin de drag (cleanup). */
  onDragEnd: () => void
  /** Drop d'une intervention sur (intervenant, date). */
  onDrop: (intervenantId: string, dateStr: string) => void
  /** Affiche un toast utilisateur. */
  showToast: (msg: string) => void

  // ── Helpers visuels passés depuis la page (factorisés) ────────
  /** Heure début formatée pour une intervention ("8h00", "13h00"...). */
  shortTime: (t: string) => string
  /** Libellé créneau lisible ("Demi-journée matin"…). */
  creneauLabel: (c: string) => string
  /** Nom du client à afficher pour l'intervention. */
  clNameFromIntervention: (rec: R) => string
  /** Métadonnées icône+couleur du type d'intervention. */
  getTypeInterventionMeta: (
    type: string | null | undefined
  ) => { icon: LucideIcon; label: string; color: string } | null
  /** Pastille statut. */
  getStatutPastilleColor: (statut: string) => string
  /** Liste des statuts (label+color). */
  statuts: { value: string; label: string; color: string }[]
  /** Horaires par défaut entreprise (pour fallback heure). */
  horaires: { debutMatin: string; finMatin: string; debutAm: string; finAm: string }
  /** Initials helper. */
  initials: (name: string) => string

  /** ID du self-intervenant Solo (pour le défaut du drop). */
  selfIntervenantId: string | null
  /** showWeekend pour bloquer drop weekend si désactivé. */
  showWeekend: boolean
  /** Si au moins 2 intervenants actifs sur le mois courant. */
  hasMultipleIntervenants: boolean
  /** Toggle "Voir par intervenant" (passe temporairement en matrice). */
  onSwitchToMatrix?: () => void
}

export default function SoloAgendaView(props: SoloAgendaProps) {
  const {
    days,
    interventionsByDay,
    colorMap,
    intervenantMap,
    interventionIntervenantsMap,
    conflicts,
    density,
    draggedId,
    dragOverCell,
    setDragOverCell,
    onOpenPanel,
    onOpenModal,
    onDragStart,
    onDragEnd,
    onDrop,
    showToast,
    shortTime,
    creneauLabel,
    clNameFromIntervention,
    getTypeInterventionMeta,
    getStatutPastilleColor,
    statuts,
    horaires,
    initials,
    selfIntervenantId,
    showWeekend,
    hasMultipleIntervenants,
    onSwitchToMatrix,
  } = props

  const isCompact = density === 'compact'

  // Hauteur minimale d'une colonne — confort = +généreux pour effet agenda.
  const columnMinHeightClass = isCompact ? 'min-h-[300px]' : 'min-h-[480px]'
  const cardPaddingClass = isCompact ? 'px-2 py-1.5' : 'px-3 py-2'
  const cardGapClass = isCompact ? 'gap-1' : 'gap-1.5'
  const titreLineClass = isCompact
    ? 'hidden'
    : 'text-[12px] font-medium opacity-75 mt-0.5 line-clamp-2 leading-snug'
  const clientLineFontClass = isCompact ? 'text-[11px]' : 'text-[13px]'

  return (
    <div className="bg-white border border-[#e6ecf2] rounded-2xl overflow-hidden shadow-sm">
      {/* Toolbar interne minimal : seulement le bouton "Voir par intervenant"
          si pertinent (≥2 intervenants actifs sur le mois). Le reste de la
          toolbar (navigation, densité, etc.) reste géré par la page. */}
      {hasMultipleIntervenants && onSwitchToMatrix && (
        <div className="px-4 py-2 border-b border-[#e6ecf2] flex items-center justify-end bg-[#fafbfd]">
          <button
            type="button"
            onClick={onSwitchToMatrix}
            className="text-[11px] font-semibold text-[#5ab4e0] hover:text-[#2d8bc9] underline-offset-2 hover:underline transition-all"
            title="Basculer temporairement vers la vue matrice (par intervenant)"
          >
            Voir par intervenant
          </button>
        </div>
      )}

      {/* Headers jours (sticky) */}
      <div
        className={`grid ${
          showWeekend ? 'grid-cols-7' : 'grid-cols-5'
        } border-b-2 border-b-[#d0d7e2]`}
      >
        {days.map(day => (
          <div
            key={day.dateStr}
            className={`px-2 py-2 text-center border-r border-[#e6ecf2] last:border-r-0 ${
              day.isToday
                ? 'bg-[#5ab4e0]/[.04]'
                : day.isWeekend
                ? 'bg-[#fafbfd]'
                : ''
            }`}
          >
            <div
              className={`text-[10px] font-bold uppercase tracking-wider ${
                day.isToday
                  ? 'text-[#5ab4e0]'
                  : day.isWeekend
                  ? 'text-[#94a3b8]'
                  : 'text-[#7b8ba3]'
              }`}
            >
              {day.label} {day.date.getDate()}
            </div>
            {day.isWeekend && (
              <div className="text-[8px] text-[#c0cad8] font-medium mt-0.5">Weekend</div>
            )}
          </div>
        ))}
      </div>

      {/* Colonnes-jours scrollables */}
      <div className={`grid ${showWeekend ? 'grid-cols-7' : 'grid-cols-5'}`}>
        {days.map(day => {
          const dayList = interventionsByDay.get(day.dateStr) ?? []
          const cellKey = `agenda__${day.dateStr}`
          const isDragOver = dragOverCell === cellKey
          const isEmpty = dayList.length === 0

          return (
            <div
              key={day.dateStr}
              className={`${columnMinHeightClass} px-1.5 py-2 border-r border-[#e6ecf2] last:border-r-0 transition-all ${
                day.isToday
                  ? 'bg-[#5ab4e0]/[.02]'
                  : day.isWeekend
                  ? 'bg-[#fafbfd]'
                  : isEmpty
                  ? 'bg-gray-50/40'
                  : ''
              } ${
                isDragOver
                  ? 'outline-2 outline-dashed outline-[#5ab4e0] outline-offset-[-2px] bg-[#5ab4e0]/10'
                  : ''
              }`}
              onDragOver={e => {
                e.preventDefault()
                setDragOverCell(cellKey)
              }}
              onDragLeave={() => setDragOverCell(null)}
              onDrop={e => {
                e.preventDefault()
                setDragOverCell(null)
                // Drop d'un chip intervenant depuis la toolbar → ouvre modal
                const droppedIvId = e.dataTransfer.getData('text/intervenant')
                if (droppedIvId) {
                  // Bloc weekend si désactivé
                  if (!showWeekend && day.isWeekend) {
                    showToast('Activez le mode 7 jours pour planifier sur samedi/dimanche')
                    return
                  }
                  onOpenModal(day.dateStr, droppedIvId)
                  return
                }
                // Drop d'une intervention existante : on garde l'intervenant
                // d'origine (selfIntervenantId en mode Solo), seule la date change.
                if (!showWeekend && day.isWeekend) {
                  showToast('Activez le mode 7 jours pour planifier sur samedi/dimanche')
                  return
                }
                const targetIv = selfIntervenantId ?? ''
                if (targetIv) onDrop(targetIv, day.dateStr)
              }}
            >
              <div className={`flex flex-col ${cardGapClass}`}>
                {dayList.map(item => {
                  const rec = item as R
                  const recId = rec.id as string
                  const isConflict = conflicts.has(recId)
                  const isDragged = draggedId === recId
                  const statut = statuts.find(s => s.value === rec.statut)
                  const isCreneau = (rec.creneau as string) === 'creneau'
                  const heureDebut = (rec.heure_debut as string) || horaires.debutMatin
                  const heureFin = (rec.heure_fin as string) || horaires.finAm
                  const timeDisplay = isCreneau
                    ? `${shortTime(heureDebut)}-${shortTime(heureFin)}`
                    : ''

                  const typeMeta = getTypeInterventionMeta(rec.type_intervention as string)
                  const TypeIcon = typeMeta?.icon ?? null
                  const clientName = clNameFromIntervention(rec)
                  const titreRaw = String(rec.titre ?? rec.description_travaux ?? '').trim()

                  // V2.3 : 1er intervenant à afficher dans l'avatar coin bas droit
                  // (tous les intervenants sont au même niveau).
                  const liaisons = interventionIntervenantsMap.get(recId) ?? []
                  const primaryIvId =
                    liaisons[0]?.id ??
                    (rec.intervenant_id as string | undefined) ??
                    null
                  const primaryIvRec = primaryIvId
                    ? (intervenantMap.get(primaryIvId) as R | undefined)
                    : undefined
                  const primaryIvColor = primaryIvId ? colorMap.get(primaryIvId) : undefined
                  const primaryIvName = primaryIvRec
                    ? primaryIvRec.is_self === true
                      ? 'Vous'
                      : `${primaryIvRec.prenom ?? ''} ${primaryIvRec.nom ?? ''}`.trim()
                    : ''
                  const nbExtra = Math.max(0, liaisons.length - 1)

                  const color = primaryIvColor ?? colorMap.get(rec.intervenant_id as string)

                  // Tooltip riche
                  const tooltipParts: string[] = []
                  if (isCreneau) tooltipParts.push(timeDisplay)
                  else tooltipParts.push(creneauLabel(rec.creneau as string))
                  if (clientName) tooltipParts.push(clientName)
                  if (titreRaw) tooltipParts.push(titreRaw)
                  if (typeMeta) tooltipParts.push(typeMeta.label)
                  const tooltip = isConflict
                    ? 'Conflit : cet intervenant a une autre intervention sur le même créneau'
                    : tooltipParts.join(' · ')

                  return (
                    <div
                      key={recId}
                      draggable
                      onDragStart={() => onDragStart(recId, primaryIvId ?? undefined)}
                      onDragEnd={onDragEnd}
                      onClick={() => onOpenPanel(rec)}
                      className={`relative ${cardPaddingClass} rounded-lg cursor-grab active:cursor-grabbing transition-all border-l-[3px] leading-normal ${
                        color?.bg ?? 'bg-[#eef7fc]'
                      } ${color?.border ?? 'border-l-[#5ab4e0]'} ${
                        color?.text ?? 'text-[#1a6fb5]'
                      } ${isDragged ? 'opacity-30' : ''} ${
                        isConflict
                          ? 'ring-2 ring-[#ef4444] shadow-[0_0_0_2px_rgba(239,68,68,0.15)]'
                          : ''
                      } hover:shadow-md hover:scale-[1.01]`}
                      title={tooltip}
                    >
                      {/* Badge conflit */}
                      {isConflict && (
                        <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1 bg-[#ef4444] text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shadow-md animate-pulse">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Conflit</span>
                        </div>
                      )}

                      {/* Icône type intervention */}
                      {TypeIcon && (
                        <span
                          className="absolute top-1.5 right-1.5 opacity-60"
                          aria-label={typeMeta?.label}
                        >
                          <TypeIcon className="w-3 h-3" />
                        </span>
                      )}

                      {/* Badge +N intervenants supplémentaires */}
                      {nbExtra > 0 && (
                        <span
                          className={`absolute ${
                            TypeIcon ? 'top-1.5 right-6' : 'top-1.5 right-1.5'
                          } inline-flex items-center gap-0.5 bg-white/70 backdrop-blur-sm text-[#0f1a3a] text-[9px] font-extrabold px-1 py-0.5 rounded-full shadow-sm`}
                          title={`${liaisons.length} intervenants sur cette intervention`}
                          aria-label={`${nbExtra} intervenant${nbExtra > 1 ? 's' : ''} supplémentaire${nbExtra > 1 ? 's' : ''}`}
                        >
                          +{nbExtra}
                        </span>
                      )}

                      {/* Ligne 1 : heure (créneau perso) ou libellé créneau */}
                      {isCreneau ? (
                        <div
                          className={`${
                            isCompact ? 'text-[10px]' : 'text-[12px]'
                          } font-extrabold text-[#0f1a3a] leading-tight`}
                        >
                          {timeDisplay}
                        </div>
                      ) : (
                        <div
                          className={`${
                            isCompact ? 'text-[9px]' : 'text-[10px]'
                          } font-bold uppercase tracking-wide opacity-70`}
                        >
                          {creneauLabel(rec.creneau as string)}
                        </div>
                      )}

                      {/* Ligne 2 : client + pastille statut */}
                      {clientName && (
                        <div className="flex items-center gap-1 mt-0.5">
                          {statut && (
                            <span
                              className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${getStatutPastilleColor(
                                rec.statut as string
                              )}`}
                              aria-label={`Statut : ${statut.label}`}
                            />
                          )}
                          <span className={`font-bold ${clientLineFontClass} truncate`}>
                            {clientName}
                          </span>
                        </div>
                      )}

                      {/* Ligne 3 : titre */}
                      {titreRaw && (
                        <div className={titreLineClass} title={titreRaw}>
                          {titreRaw}
                        </div>
                      )}

                      {/* Avatar mini intervenant en bas à droite (24×24) — Vague 3 / V2.3 */}
                      {primaryIvName && (
                        <div
                          className="absolute bottom-1 right-1 flex items-center gap-0.5"
                          title={primaryIvName}
                        >
                          <span
                            className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[8px] font-extrabold text-white shadow-sm ring-1 ring-white"
                            style={{ background: primaryIvColor?.hex ?? '#5ab4e0' }}
                            aria-label={`Intervenant : ${primaryIvName}`}
                          >
                            {initials(primaryIvName)}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Bouton "+" en bas pour ajouter une intervention */}
                <button
                  type="button"
                  onClick={() => {
                    if (!showWeekend && day.isWeekend) {
                      showToast('Activez le mode 7 jours pour planifier sur samedi/dimanche')
                      return
                    }
                    onOpenModal(day.dateStr, selfIntervenantId ?? undefined)
                  }}
                  className="w-full h-7 mt-1 border border-dashed border-[#5ab4e0]/30 rounded text-[#5ab4e0] text-sm flex items-center justify-center opacity-60 hover:opacity-100 hover:bg-[#5ab4e0]/[.06] hover:border-[#5ab4e0] transition-all"
                  aria-label={`Ajouter une intervention le ${day.label} ${day.date.getDate()}`}
                >
                  +
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
