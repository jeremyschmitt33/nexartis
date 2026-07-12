// ============================================================================
// Déclaration ambiante pour heic2any (conversion HEIC → JPEG côté navigateur).
// Le module est chargé UNIQUEMENT par import dynamique dans
// lib/banque/justificatifs.ts (fallback quand le navigateur ne décode pas le
// HEIC nativement). Cette déclaration permet à `tsc --noEmit` de passer même
// avant `npm install` ; le paquet est déclaré dans package.json.
// ============================================================================

declare module 'heic2any' {
  interface Heic2AnyOptions {
    blob: Blob
    toType?: string
    quality?: number
  }
  const heic2any: (options: Heic2AnyOptions) => Promise<Blob | Blob[]>
  export default heic2any
}
