'use client'
// hooks/useDominantColors.ts — V3.1
// Extrait les couleurs dominantes d'une image via Canvas API (0 dependance).
// Algo : echantillonnage des pixels, quantification cube RGB 32^3, comptage,
// classement par frequence, filtrage des couleurs trop proches du blanc/noir.

import { useEffect, useState } from 'react'

export interface DominantColor {
  hex: string
  rgb: [number, number, number]
  count: number
  luminance: number  // 0..1
  saturation: number // 0..1
}

interface UseDominantColorsReturn {
  colors: DominantColor[]
  loading: boolean
  error: string | null
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function getLuminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

function getSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === 0) return 0
  return (max - min) / max
}

function extractColors(img: HTMLImageElement, maxColors = 6): DominantColor[] {
  // Reduit l'image a 100x100 pour rapidite
  const SIZE = 100
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return []
  ctx.drawImage(img, 0, 0, SIZE, SIZE)
  const data = ctx.getImageData(0, 0, SIZE, SIZE).data

  // Quantification : groupes de 32 (donc 8x8x8 = 512 cubes max)
  const QUANT = 32
  const counts: Map<string, { r: number; g: number; b: number; count: number }> = new Map()

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]
    if (a < 200) continue // Pixel transparent : ignore

    // Filtrer extremes (blanc/noir purs)
    const lum = getLuminance(r, g, b)
    if (lum < 0.05 || lum > 0.95) continue
    const sat = getSaturation(r, g, b)
    if (sat < 0.1) continue // Couleur quasi-grise : ignore

    const qR = Math.floor(r / QUANT) * QUANT + QUANT / 2
    const qG = Math.floor(g / QUANT) * QUANT + QUANT / 2
    const qB = Math.floor(b / QUANT) * QUANT + QUANT / 2
    const key = `${qR}-${qG}-${qB}`
    const existing = counts.get(key)
    if (existing) {
      existing.count++
      existing.r += r
      existing.g += g
      existing.b += b
    } else {
      counts.set(key, { r, g, b, count: 1 })
    }
  }

  // Convertir en tableau et trier par frequence
  const list: DominantColor[] = []
  for (const v of Array.from(counts.values())) {
    const avgR = Math.round(v.r / v.count)
    const avgG = Math.round(v.g / v.count)
    const avgB = Math.round(v.b / v.count)
    list.push({
      hex: rgbToHex(avgR, avgG, avgB),
      rgb: [avgR, avgG, avgB],
      count: v.count,
      luminance: getLuminance(avgR, avgG, avgB),
      saturation: getSaturation(avgR, avgG, avgB),
    })
  }
  list.sort((a, b) => b.count - a.count)
  return list.slice(0, maxColors)
}

export function useDominantColors(imageSrc: string | null | undefined): UseDominantColorsReturn {
  const [colors, setColors] = useState<DominantColor[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!imageSrc) {
      setColors([])
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const result = extractColors(img)
        setColors(result)
      } catch (e) {
        setError(`Extraction des couleurs impossible : ${(e as Error).message}`)
        setColors([])
      } finally {
        setLoading(false)
      }
    }
    img.onerror = () => {
      setError('Image illisible')
      setLoading(false)
    }
    img.src = imageSrc
    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [imageSrc])

  return { colors, loading, error }
}
