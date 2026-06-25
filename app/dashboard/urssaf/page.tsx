import { redirect } from 'next/navigation'

// L'aide URSSAF a ete integree aux Calculatrices (plus d'onglet dedie).
// On redirige les anciens liens / favoris vers la page Calculatrices,
// ou la calculatrice "URSSAF (a declarer)" est affichee par defaut.
export default function UrssafRedirect() {
  redirect('/dashboard/calculatrice')
}
