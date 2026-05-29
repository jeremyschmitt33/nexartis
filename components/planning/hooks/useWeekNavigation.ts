'use client'

import { useState, useMemo, useCallback } from 'react'
import type { WeekDay } from '@/components/planning/shared/types'

// Format YYYY-MM-DD en LOCAL (pas UTC) pour éviter le bug timezone
// qui faisait apparaître les dates avec un jour de décalage.
function fmtISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function isSameDay(d1: Date, d2: Date): boolean {
  return fmtISO(d1) === fmtISO(d2)
}

const DAY_LABELS_WEEK = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

/**
 * Navigation semaine commune aux 2 vues planning.
 *
 *   weekStart        : date du lundi de la semaine courante
 *   days             : 5 ou 7 jours (selon showWeekend) à afficher
 *   prevWeek/nextWeek/goToday : navigation
 *   goToWeek(date)   : place la semaine sur le lundi de cette date
 */
export function useWeekNavigation(showWeekend: boolean): {
  weekStart: Date
  setWeekStart: (d: Date) => void
  days: WeekDay[]
  prevWeek: () => void
  nextWeek: () => void
  goToday: () => void
  goToWeek: (d: Date) => void
} {
  const [weekStart, setWeekStartRaw] = useState<Date>(() => getMonday(new Date()))

  const setWeekStart = useCallback((d: Date) => {
    setWeekStartRaw(getMonday(d))
  }, [])

  const prevWeek = useCallback(() => {
    setWeekStartRaw(prev => {
      const d = new Date(prev)
      d.setDate(d.getDate() - 7)
      return getMonday(d)
    })
  }, [])

  const nextWeek = useCallback(() => {
    setWeekStartRaw(prev => {
      const d = new Date(prev)
      d.setDate(d.getDate() + 7)
      return getMonday(d)
    })
  }, [])

  const goToday = useCallback(() => {
    setWeekStartRaw(getMonday(new Date()))
  }, [])

  const goToWeek = useCallback((d: Date) => {
    setWeekStartRaw(getMonday(d))
  }, [])

  const days = useMemo<WeekDay[]>(() => {
    const numDays = showWeekend ? 7 : 5
    const today = new Date()
    const list: WeekDay[] = []
    for (let i = 0; i < numDays; i++) {
      const date = new Date(weekStart)
      date.setDate(date.getDate() + i)
      list.push({
        label: DAY_LABELS_WEEK[i],
        date,
        dateStr: fmtISO(date),
        isToday: isSameDay(date, today),
        isWeekend: i >= 5,
      })
    }
    return list
  }, [weekStart, showWeekend])

  return { weekStart, setWeekStart, days, prevWeek, nextWeek, goToday, goToWeek }
}
