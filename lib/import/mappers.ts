export type SourceType = 'obat' | 'obat_comptable' | 'tolteck' | 'batappli' | 'henrri' | 'excel';

export type DataCategory =
  | 'clients'
  | 'devis'
  | 'factures'
  | 'devis_lignes'
  | 'facture_lignes'
  | 'chantiers'
  | 'prestations'
  | 'fournisseurs'
  | 'intervenants'
  | 'planning'
  | 'paiements'
  | 'achats';

export interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  transform?: (value: string) => unknown;
}

export interface CategoryConfig {
  possibleFileNames: string[];
  columnMappings: ColumnMapping[];
  requiredColumns: string[];
}

export interface SourceConfig {
  name: string;
  label: string;
  description: string;
  categories: Record<DataCategory, CategoryConfig>;
}

// ==================== TRANSFORM FUNCTIONS ====================

const parseFrenchDate = (value: string): string | null => {
  if (!value) return null;
  const dateMatch = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!dateMatch) return null;
  const [, day, month, year] = dateMatch;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const parseAmount = (value: string): number | null => {
  if (!value) return null;
  return parseFloat(value.toString().replace(/,/g, '.').trim());
};

const parseTVARate = (value: string): number | null => {
  if (!value) return null;
  const num = parseFloat(value.toString().replace(/,/g, '.').replace('%', '').trim());
  return isNaN(num) ? null : num;
};

const parsePercentage = (value: string): number | null => {
  if (!value) return null;
  const num = parseFloat(value.toString().replace(/,/g, '.').replace('%', '').trim());
  return isNaN(num) ? null : num;
};

const normalizeString = (value: string): string => value.trim();

// Normalise l'unite vers la liste AUTORISEE en base (contrainte CHECK :
// U, Fft, m², ml, h, kg, ens, lot, j). Toute valeur inconnue -> null : la
// colonne est nullable, l'import ne casse donc pas (au lieu de rejeter la ligne).
const mapUnite = (value: string): string | null => {
  const v = (value || '').toLowerCase().trim();
  if (!v) return null;
  const map: Record<string, string> = {
    'u': 'U', 'unité': 'U', 'unite': 'U', 'unités': 'U', 'unites': 'U',
    'article': 'U', 'articles': 'U', 'pièce': 'U', 'piece': 'U', 'pièces': 'U', 'pieces': 'U', 'pce': 'U', 'pc': 'U',
    'fft': 'Fft', 'ff': 'Fft', 'forfait': 'Fft', 'forfaitaire': 'Fft',
    'm²': 'm²', 'm2': 'm²', 'mètre carré': 'm²', 'metre carre': 'm²',
    'ml': 'ml', 'mètre linéaire': 'ml', 'metre lineaire': 'ml', 'mètre': 'ml', 'metre': 'ml', 'm': 'ml',
    'h': 'h', 'heure': 'h', 'heures': 'h', 'hr': 'h',
    'kg': 'kg', 'kilo': 'kg', 'kilogramme': 'kg',
    'ens': 'ens', 'ensemble': 'ens',
    'lot': 'lot', 'lots': 'lot',
    'j': 'j', 'jour': 'j', 'jours': 'j', 'journée': 'j', 'journee': 'j',
  };
  return map[v] || null;
};

// Normalise la categorie de prestation vers la liste AUTORISEE en base
// (fournitures, main_oeuvre, ouvrages, deplacements). Inconnue -> null (nullable).
const mapPrestationCategorie = (value: string): string | null => {
  const v = (value || '').toLowerCase().trim();
  if (!v) return null;
  if (['fournitures', 'fourniture', 'produit', 'produits', 'matériel', 'materiel', 'matériaux', 'materiaux', 'article', 'articles'].indexOf(v) !== -1) return 'fournitures';
  if (['main_oeuvre', "main d'oeuvre", "main d'œuvre", 'main-oeuvre', 'mo', 'service', 'services', 'prestation', 'prestations', 'pose', 'travaux'].indexOf(v) !== -1) return 'main_oeuvre';
  if (['ouvrages', 'ouvrage', 'forfait'].indexOf(v) !== -1) return 'ouvrages';
  if (['deplacements', 'deplacement', 'déplacement', 'déplacements', 'transport', 'trajet'].indexOf(v) !== -1) return 'deplacements';
  return null;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _detectClientType = (data: Record<string, string>): 'particulier' | 'professionnel' => {
  const raisonSociale = Object.values(data).some(v => v && v.length > 20);
  const siret = Object.values(data).some(v => /^\d{14}$/.test(v?.replace(/\s/g, '')));
  return siret || raisonSociale ? 'professionnel' : 'particulier';
};

const mapQuoteStatus = (source: string, sourceType: SourceType): string => {
  const status = source.toLowerCase().trim();

  const mappings: Record<SourceType, Record<string, string>> = {
    obat: {
      'brouillon': 'brouillon',
      'devis': 'brouillon',
      'envoyé': 'envoye',
      'envoye': 'envoye',
      'signé': 'signe',
      'signe': 'signe',
      'refusé': 'refuse',
      'refuse': 'refuse',
      'expiré': 'expire',
      'expire': 'expire',
      'facturé': 'facture',
      'facture': 'facture',
      'devis signé': 'signe',
      'devis en attente': 'envoye',
    },
    // obat_comptable utilise son propre parser (lib/import/obat-comptable.ts)
    // mais on garde un mapping minimal pour satisfaire TypeScript.
    obat_comptable: {
      'signé': 'signe',
      'envoyé': 'envoye',
      'refusé': 'refuse',
      'annulé': 'refuse',
    },
    tolteck: {
      'brouillon': 'brouillon',
      'en attente': 'envoye',
      'signé': 'signe',
      'refusé': 'refuse',
      'expiré': 'expire',
      'facturé': 'facture',
      'proposé': 'envoye',
      'accepté': 'signe',
    },
    batappli: {
      'brouillon': 'brouillon',
      'émis': 'envoye',
      'envoyé': 'envoye',
      'accepté': 'signe',
      'rejeté': 'refuse',
      'expiré': 'expire',
      'facturé': 'facture',
    },
    henrri: {
      'brouillon': 'brouillon',
      'envoyé': 'envoye',
      'signe': 'signe',
      'refuse': 'refuse',
      'expire': 'expire',
      'facture': 'facture',
    },
    excel: {
      'brouillon': 'brouillon',
      'envoye': 'envoye',
      'envoyé': 'envoye',
      'signe': 'signe',
      'signé': 'signe',
      'refuse': 'refuse',
      'refusé': 'refuse',
      'expire': 'expire',
      'expiré': 'expire',
      'facture': 'facture',
      'facturé': 'facture',
      'finalise': 'finalise',
      'finalisé': 'finalise',
    },
  };

  return mappings[sourceType][status] || 'brouillon';
};

const mapInvoiceStatus = (source: string, sourceType: SourceType): string => {
  const status = source.toLowerCase().trim();

  const mappings: Record<SourceType, Record<string, string>> = {
    obat: {
      'brouillon': 'brouillon',
      'envoyée': 'envoyee',
      'envoyee': 'envoyee',
      'payée': 'payee',
      'payee': 'payee',
      'partiellement payée': 'partiellement_payee',
      'partiellement payee': 'partiellement_payee',
      'en retard': 'en_retard',
      'retard': 'en_retard',
      'annulée': 'annulee',
      'annulee': 'annulee',
    },
    obat_comptable: {
      'payée': 'payee',
      'envoyée': 'envoyee',
      'finalisée': 'envoyee',
      'finalisé': 'envoyee',
      'annulée': 'annulee',
    },
    tolteck: {
      'brouillon': 'brouillon',
      'émise': 'envoyee',
      'envoyée': 'envoyee',
      'payée': 'payee',
      'partiellement payée': 'partiellement_payee',
      'impayée': 'en_retard',
      'annulée': 'annulee',
    },
    batappli: {
      'brouillon': 'brouillon',
      'émise': 'envoyee',
      'payée': 'payee',
      'partiellement payée': 'partiellement_payee',
      'impayée': 'en_retard',
      'annulée': 'annulee',
    },
    henrri: {
      'brouillon': 'brouillon',
      'envoyée': 'envoyee',
      'payée': 'payee',
      'partiellement payée': 'partiellement_payee',
      'impayée': 'en_retard',
      'annulée': 'annulee',
    },
    excel: {
      'brouillon': 'brouillon',
      'envoyee': 'envoyee',
      'envoyée': 'envoyee',
      'payee': 'payee',
      'payée': 'payee',
      'partiellement_payee': 'partiellement_payee',
      'partiellement payee': 'partiellement_payee',
      'partiellement payée': 'partiellement_payee',
      'en_retard': 'en_retard',
      'en retard': 'en_retard',
      'retard': 'en_retard',
      'annulee': 'annulee',
      'annulée': 'annulee',
    },
  };

  return mappings[sourceType][status] || 'brouillon';
};

const mapPaymentMethod = (source: string): string => {
  const method = source.toLowerCase().trim();
  const mappings: Record<string, string> = {
    'virement': 'virement',
    'vir': 'virement',
    'cheque': 'cheque',
    'chèque': 'cheque',
    'chq': 'cheque',
    'carte': 'cb',
    'carte bancaire': 'cb',
    'cb': 'cb',
    'especes': 'especes',
    'espèces': 'especes',
    'cash': 'especes',
    'autre': 'autre',
  };
  return mappings[method] || 'autre';
};

// ==================== OBAT CONFIG ====================

export const OBAT_CONFIG: SourceConfig = {
  name: 'obat',
  label: 'Obat',
  description: 'Logiciel de gestion Obat (très courant)',
  categories: {
    clients: {
      possibleFileNames: ['clients.csv', 'clients_obat.csv', 'export_clients.csv'],
      columnMappings: [
        { sourceColumn: 'Prénom|Prenom', targetField: 'prenom', transform: normalizeString },
        { sourceColumn: 'Nom', targetField: 'nom', transform: normalizeString },
        { sourceColumn: 'Société|Societe', targetField: 'raison_sociale', transform: normalizeString },
        { sourceColumn: 'Adresse|Address', targetField: 'adresse', transform: normalizeString },
        { sourceColumn: 'Code postal|Code_postal|CP|Code_Postal', targetField: 'code_postal', transform: normalizeString },
        { sourceColumn: 'Ville|City', targetField: 'ville', transform: normalizeString },
        { sourceColumn: 'Email|E-mail|Mail', targetField: 'email', transform: normalizeString },
        { sourceColumn: 'Téléphone|Telephone|Tel|Phone', targetField: 'telephone', transform: normalizeString },
        { sourceColumn: 'SIRET|Siret', targetField: 'siret', transform: normalizeString },
        { sourceColumn: 'Notes|Observations|Remarques', targetField: 'notes_internes', transform: normalizeString },
      ],
      requiredColumns: ['Nom'],
    },
    devis: {
      possibleFileNames: ['devis.csv', 'devis_obat.csv', 'export_devis.csv', 'quotes.csv'],
      columnMappings: [
        { sourceColumn: 'N° devis|N°devis|Numero devis|Numéro devis|Numero|Reference', targetField: 'numero', transform: normalizeString },
        { sourceColumn: 'Nom client|Client|Nom', targetField: 'client_name', transform: normalizeString },
        { sourceColumn: 'Date|Date émission|Date_emission|Date devis', targetField: 'date_emission', transform: parseFrenchDate },
        { sourceColumn: 'Date validité|Date_validite|Validité|Valid until|Valid_until', targetField: 'date_validite', transform: parseFrenchDate },
        { sourceColumn: 'Objet|Subject|Description', targetField: 'objet', transform: normalizeString },
        { sourceColumn: 'Montant HT|Montant_HT|Total HT|Total_HT|Amount HT', targetField: 'montant_ht', transform: parseAmount },
        { sourceColumn: 'Montant TVA|TVA|Tax', targetField: 'montant_tva', transform: parseAmount },
        { sourceColumn: 'Montant TTC|Total TTC|Total_TTC|Amount TTC', targetField: 'montant_ttc', transform: parseAmount },
        { sourceColumn: 'Statut|Status|État|State', targetField: 'statut', transform: (v) => mapQuoteStatus(v, 'obat') },
        { sourceColumn: 'Conditions paiement|Conditions_paiement|Payment terms|Payment_terms', targetField: 'conditions_paiement', transform: normalizeString },
        { sourceColumn: 'Acompte %|Acompte|Acompte_pourcentage|Deposit', targetField: 'acompte_pourcentage', transform: parsePercentage },
      ],
      requiredColumns: ['N° devis', 'Nom client', 'Date'],
    },
    devis_lignes: {
      possibleFileNames: ['devis_details.csv', 'devis_lignes.csv', 'devis_articles.csv'],
      columnMappings: [
        { sourceColumn: 'N° devis|Numero devis|Devis', targetField: 'devis_numero', transform: normalizeString },
        { sourceColumn: 'Ordre|Order|Ligne|Line', targetField: 'ordre', transform: (v) => parseInt(v) || 0 },
        { sourceColumn: 'Désignation|Designation|Description|Article', targetField: 'designation', transform: normalizeString },
        { sourceColumn: 'Quantité|Quantite|Qty|Quantity', targetField: 'quantite', transform: parseAmount },
        { sourceColumn: 'Unité|Unite|Unit|U', targetField: 'unite', transform: normalizeString },
        { sourceColumn: 'Prix HT|Prix_HT|Price HT|Unit price', targetField: 'prix_unitaire_ht', transform: parseAmount },
        { sourceColumn: 'TVA %|TVA|Tax rate|Taux TVA|Taux_TVA', targetField: 'taux_tva', transform: parseTVARate },
        { sourceColumn: 'Montant HT|Total HT|Line total', targetField: 'montant_ht', transform: parseAmount },
      ],
      requiredColumns: ['N° devis', 'Désignation'],
    },
    factures: {
      possibleFileNames: ['factures.csv', 'factures_obat.csv', 'invoices.csv'],
      columnMappings: [
        { sourceColumn: 'N° facture|Numero facture|Numéro|Reference', targetField: 'numero', transform: normalizeString },
        { sourceColumn: 'Nom client|Client|Nom', targetField: 'client_name', transform: normalizeString },
        { sourceColumn: 'Date|Date émission|Date_emission|Invoice date', targetField: 'date_emission', transform: parseFrenchDate },
        { sourceColumn: 'Date échéance|Date_echeance|Due date|Échéance', targetField: 'date_echeance', transform: parseFrenchDate },
        { sourceColumn: 'Type|Invoice type|Type facture', targetField: 'type', transform: normalizeString },
        { sourceColumn: 'Montant HT|Total HT|Amount HT', targetField: 'montant_ht', transform: parseAmount },
        { sourceColumn: 'Montant TVA|TVA|Tax', targetField: 'montant_tva', transform: parseAmount },
        { sourceColumn: 'Montant TTC|Total TTC|Amount TTC', targetField: 'montant_ttc', transform: parseAmount },
        { sourceColumn: 'Montant payé|Montant_paye|Amount paid', targetField: 'montant_paye', transform: parseAmount },
        { sourceColumn: 'Date paiement|Date_paiement|Payment date', targetField: 'date_paiement', transform: parseFrenchDate },
        { sourceColumn: 'Statut|Status|État', targetField: 'statut', transform: (v) => mapInvoiceStatus(v, 'obat') },
      ],
      requiredColumns: ['N° facture', 'Nom client', 'Date'],
    },
    facture_lignes: {
      possibleFileNames: ['factures_details.csv', 'facture_lignes.csv', 'factures_articles.csv'],
      columnMappings: [
        { sourceColumn: 'N° facture|Numero facture|Facture', targetField: 'facture_numero', transform: normalizeString },
        { sourceColumn: 'Ordre|Order|Ligne', targetField: 'ordre', transform: (v) => parseInt(v) || 0 },
        { sourceColumn: 'Désignation|Designation|Description', targetField: 'designation', transform: normalizeString },
        { sourceColumn: 'Quantité|Quantite|Qty', targetField: 'quantite', transform: parseAmount },
        { sourceColumn: 'Unité|Unite|Unit', targetField: 'unite', transform: normalizeString },
        { sourceColumn: 'Prix HT|Prix_HT|Price HT', targetField: 'prix_unitaire_ht', transform: parseAmount },
        { sourceColumn: 'TVA %|TVA|Tax rate', targetField: 'taux_tva', transform: parseTVARate },
        { sourceColumn: 'Montant HT|Total HT', targetField: 'montant_ht', transform: parseAmount },
      ],
      requiredColumns: ['N° facture', 'Désignation'],
    },
    chantiers: {
      possibleFileNames: ['chantiers.csv', 'projects.csv', 'sites.csv'],
      columnMappings: [
        { sourceColumn: 'Nom client|Client|Nom', targetField: 'client_name', transform: normalizeString },
        { sourceColumn: 'Titre|Title|Nom chantier|Project name', targetField: 'titre', transform: normalizeString },
        { sourceColumn: 'Description|Desc|Details', targetField: 'description', transform: normalizeString },
        { sourceColumn: 'Adresse|Address|Lieu', targetField: 'adresse_chantier', transform: normalizeString },
        { sourceColumn: 'Code postal|CP|Code_postal', targetField: 'code_postal_chantier', transform: normalizeString },
        { sourceColumn: 'Ville|City', targetField: 'ville_chantier', transform: normalizeString },
        { sourceColumn: 'Date début|Date_debut|Start date|Début', targetField: 'date_debut', transform: parseFrenchDate },
        { sourceColumn: 'Date fin|Date_fin|End date|Fin prévue', targetField: 'date_fin_prevue', transform: parseFrenchDate },
        { sourceColumn: 'Statut|Status|État', targetField: 'statut', transform: normalizeString },
        { sourceColumn: 'Notes|Notes|Observations', targetField: 'notes', transform: normalizeString },
      ],
      requiredColumns: ['Titre'],
    },
    prestations: {
      possibleFileNames: ['prestations.csv', 'services.csv', 'catalog.csv'],
      columnMappings: [
        { sourceColumn: 'Désignation|Designation|Description|Service', targetField: 'designation', transform: normalizeString },
        { sourceColumn: 'Unité|Unite|Unit|U', targetField: 'unite', transform: normalizeString },
        { sourceColumn: 'Prix HT|Prix|Price|Unit price', targetField: 'prix_unitaire_ht', transform: parseAmount },
        { sourceColumn: 'TVA %|TVA|Tax rate', targetField: 'taux_tva', transform: parseTVARate },
        { sourceColumn: 'Catégorie|Categorie|Category|Type', targetField: 'categorie', transform: normalizeString },
      ],
      requiredColumns: ['Désignation'],
    },
    fournisseurs: {
      possibleFileNames: ['fournisseurs.csv', 'suppliers.csv', 'vendors.csv'],
      columnMappings: [
        { sourceColumn: 'Nom|Name|Raison sociale|Societe', targetField: 'nom', transform: normalizeString },
        { sourceColumn: 'Contact|Personne|Person', targetField: 'contact', transform: normalizeString },
        { sourceColumn: 'Email|E-mail', targetField: 'email', transform: normalizeString },
        { sourceColumn: 'Téléphone|Telephone|Tel|Phone', targetField: 'telephone', transform: normalizeString },
        { sourceColumn: 'Adresse|Address', targetField: 'adresse', transform: normalizeString },
        { sourceColumn: 'Code postal|CP', targetField: 'code_postal', transform: normalizeString },
        { sourceColumn: 'Ville|City', targetField: 'ville', transform: normalizeString },
        { sourceColumn: 'SIRET|Siret', targetField: 'siret', transform: normalizeString },
        { sourceColumn: 'Notes|Observations', targetField: 'notes', transform: normalizeString },
      ],
      requiredColumns: ['Nom'],
    },
    intervenants: {
      possibleFileNames: ['intervenants.csv', 'workers.csv', 'employees.csv', 'team.csv'],
      columnMappings: [
        { sourceColumn: 'Prénom|Prenom|First name', targetField: 'prenom', transform: normalizeString },
        { sourceColumn: 'Nom|Last name', targetField: 'nom', transform: normalizeString },
        { sourceColumn: 'Téléphone|Telephone|Phone', targetField: 'telephone', transform: normalizeString },
        { sourceColumn: 'Email|E-mail', targetField: 'email', transform: normalizeString },
        { sourceColumn: 'Métier|Metier|Job|Trade', targetField: 'metier', transform: normalizeString },
        { sourceColumn: 'Type contrat|Type_contrat|Contract type', targetField: 'type_contrat', transform: normalizeString },
        { sourceColumn: 'Taux horaire|Taux_horaire|Hourly rate', targetField: 'taux_horaire', transform: parseAmount },
      ],
      requiredColumns: ['Nom'],
    },
    planning: {
      possibleFileNames: ['planning.csv', 'schedule.csv', 'interventions.csv'],
      columnMappings: [
        { sourceColumn: 'Chantier|Site|Project', targetField: 'chantier_name', transform: normalizeString },
        { sourceColumn: 'Intervenant|Worker|Ouvrier', targetField: 'intervenant_name', transform: normalizeString },
        { sourceColumn: 'Titre|Title|Description', targetField: 'titre', transform: normalizeString },
        { sourceColumn: 'Travaux|Works|Details', targetField: 'description_travaux', transform: normalizeString },
        { sourceColumn: 'Date début|Date_debut|Start date', targetField: 'date_debut', transform: parseFrenchDate },
        { sourceColumn: 'Date fin|Date_fin|End date', targetField: 'date_fin', transform: parseFrenchDate },
        { sourceColumn: 'Heure début|Heure_debut|Start time', targetField: 'heure_debut', transform: normalizeString },
        { sourceColumn: 'Heure fin|Heure_fin|End time', targetField: 'heure_fin', transform: normalizeString },
        { sourceColumn: 'Créneau|Creneau|Slot|Time slot', targetField: 'creneau', transform: normalizeString },
        { sourceColumn: 'Statut|Status', targetField: 'statut', transform: normalizeString },
        { sourceColumn: 'Notes|Observations', targetField: 'notes', transform: normalizeString },
      ],
      requiredColumns: ['Titre'],
    },
    paiements: {
      possibleFileNames: ['paiements.csv', 'payments.csv', 'reglements.csv'],
      columnMappings: [
        { sourceColumn: 'N° facture|Numero facture|Facture|Invoice', targetField: 'facture_numero', transform: normalizeString },
        { sourceColumn: 'Montant|Amount|Somme', targetField: 'montant', transform: parseAmount },
        { sourceColumn: 'Date|Date paiement|Payment date', targetField: 'date_paiement', transform: parseFrenchDate },
        { sourceColumn: 'Méthode|Methode|Method|Mode', targetField: 'methode', transform: mapPaymentMethod },
        { sourceColumn: 'Référence|Reference|Ref|N°', targetField: 'reference', transform: normalizeString },
      ],
      requiredColumns: ['N° facture', 'Montant', 'Date'],
    },
    achats: {
      possibleFileNames: ['achats.csv', 'purchases.csv', 'orders.csv'],
      columnMappings: [
        { sourceColumn: 'Fournisseur|Supplier|Vendor', targetField: 'fournisseur_name', transform: normalizeString },
        { sourceColumn: 'Chantier|Site|Project', targetField: 'chantier_name', transform: normalizeString },
        { sourceColumn: 'Date|Date achat|Purchase date', targetField: 'date_achat', transform: parseFrenchDate },
        { sourceColumn: 'Description|Article|Details', targetField: 'description', transform: normalizeString },
        { sourceColumn: 'Montant HT|Amount HT|Total HT', targetField: 'montant_ht', transform: parseAmount },
        { sourceColumn: 'TVA %|Tax rate', targetField: 'taux_tva', transform: parseTVARate },
        { sourceColumn: 'Montant TTC|Total TTC|Amount TTC', targetField: 'montant_ttc', transform: parseAmount },
      ],
      requiredColumns: ['Description', 'Date'],
    },
  },
};

// ==================== TOLTECK CONFIG ====================

export const TOLTECK_CONFIG: SourceConfig = {
  name: 'tolteck',
  label: 'Tolteck',
  description: 'Logiciel de gestion Tolteck',
  categories: {
    clients: {
      possibleFileNames: ['clients.csv', 'clients_tolteck.csv'],
      columnMappings: [
        { sourceColumn: 'Prénom|Prenom', targetField: 'prenom', transform: normalizeString },
        { sourceColumn: 'Nom du client|Nom', targetField: 'nom', transform: normalizeString },
        { sourceColumn: 'Raison sociale|Societe', targetField: 'raison_sociale', transform: normalizeString },
        { sourceColumn: 'Adresse', targetField: 'adresse', transform: normalizeString },
        { sourceColumn: 'Code postal|CP', targetField: 'code_postal', transform: normalizeString },
        { sourceColumn: 'Ville', targetField: 'ville', transform: normalizeString },
        { sourceColumn: 'Email|E-mail', targetField: 'email', transform: normalizeString },
        { sourceColumn: 'Téléphone|Telephone', targetField: 'telephone', transform: normalizeString },
        { sourceColumn: 'SIRET', targetField: 'siret', transform: normalizeString },
        { sourceColumn: 'Remarques|Notes', targetField: 'notes_internes', transform: normalizeString },
      ],
      requiredColumns: ['Nom du client'],
    },
    devis: {
      possibleFileNames: ['devis.csv', 'devis_tolteck.csv'],
      columnMappings: [
        { sourceColumn: 'Référence|Reference', targetField: 'numero', transform: normalizeString },
        { sourceColumn: 'Nom du client|Client', targetField: 'client_name', transform: normalizeString },
        { sourceColumn: 'Date', targetField: 'date_emission', transform: parseFrenchDate },
        { sourceColumn: 'Date de validité|Date validite', targetField: 'date_validite', transform: parseFrenchDate },
        { sourceColumn: 'Libellé|Objet', targetField: 'objet', transform: normalizeString },
        { sourceColumn: 'Total HT', targetField: 'montant_ht', transform: parseAmount },
        { sourceColumn: 'TVA', targetField: 'montant_tva', transform: parseAmount },
        { sourceColumn: 'Total TTC', targetField: 'montant_ttc', transform: parseAmount },
        { sourceColumn: 'État|Statut', targetField: 'statut', transform: (v) => mapQuoteStatus(v, 'tolteck') },
        { sourceColumn: 'Conditions', targetField: 'conditions_paiement', transform: normalizeString },
        { sourceColumn: 'Acompte|Acompte %', targetField: 'acompte_pourcentage', transform: parsePercentage },
      ],
      requiredColumns: ['Référence', 'Nom du client'],
    },
    devis_lignes: {
      possibleFileNames: ['devis_lignes.csv', 'devis_details.csv'],
      columnMappings: [
        { sourceColumn: 'Référence devis|Devis', targetField: 'devis_numero', transform: normalizeString },
        { sourceColumn: 'Ligne|Order', targetField: 'ordre', transform: (v) => parseInt(v) || 0 },
        { sourceColumn: 'Libellé|Designation', targetField: 'designation', transform: normalizeString },
        { sourceColumn: 'Quantité|Quantite', targetField: 'quantite', transform: parseAmount },
        { sourceColumn: 'Unité|Unite', targetField: 'unite', transform: normalizeString },
        { sourceColumn: 'Prix unitaire|Prix', targetField: 'prix_unitaire_ht', transform: parseAmount },
        { sourceColumn: 'Taux TVA|TVA %', targetField: 'taux_tva', transform: parseTVARate },
        { sourceColumn: 'Montant HT|Total', targetField: 'montant_ht', transform: parseAmount },
      ],
      requiredColumns: ['Référence devis', 'Libellé'],
    },
    factures: {
      possibleFileNames: ['factures.csv', 'factures_tolteck.csv'],
      columnMappings: [
        { sourceColumn: 'Référence|Numero', targetField: 'numero', transform: normalizeString },
        { sourceColumn: 'Nom du client|Client', targetField: 'client_name', transform: normalizeString },
        { sourceColumn: 'Date', targetField: 'date_emission', transform: parseFrenchDate },
        { sourceColumn: 'Date d\'échéance|Date echeance', targetField: 'date_echeance', transform: parseFrenchDate },
        { sourceColumn: 'Type', targetField: 'type', transform: normalizeString },
        { sourceColumn: 'Total HT', targetField: 'montant_ht', transform: parseAmount },
        { sourceColumn: 'TVA', targetField: 'montant_tva', transform: parseAmount },
        { sourceColumn: 'Total TTC', targetField: 'montant_ttc', transform: parseAmount },
        { sourceColumn: 'Montant payé|Montant paye', targetField: 'montant_paye', transform: parseAmount },
        { sourceColumn: 'Date de paiement|Date paiement', targetField: 'date_paiement', transform: parseFrenchDate },
        { sourceColumn: 'État|Statut', targetField: 'statut', transform: (v) => mapInvoiceStatus(v, 'tolteck') },
      ],
      requiredColumns: ['Référence', 'Nom du client'],
    },
    facture_lignes: {
      possibleFileNames: ['factures_lignes.csv', 'factures_details.csv'],
      columnMappings: [
        { sourceColumn: 'Référence facture|Facture', targetField: 'facture_numero', transform: normalizeString },
        { sourceColumn: 'Ligne|Order', targetField: 'ordre', transform: (v) => parseInt(v) || 0 },
        { sourceColumn: 'Libellé|Designation', targetField: 'designation', transform: normalizeString },
        { sourceColumn: 'Quantité|Quantite', targetField: 'quantite', transform: parseAmount },
        { sourceColumn: 'Unité|Unite', targetField: 'unite', transform: normalizeString },
        { sourceColumn: 'Prix unitaire|Prix', targetField: 'prix_unitaire_ht', transform: parseAmount },
        { sourceColumn: 'Taux TVA|TVA %', targetField: 'taux_tva', transform: parseTVARate },
        { sourceColumn: 'Montant HT|Total', targetField: 'montant_ht', transform: parseAmount },
      ],
      requiredColumns: ['Référence facture', 'Libellé'],
    },
    chantiers: {
      possibleFileNames: ['chantiers.csv', 'projects.csv'],
      columnMappings: [
        { sourceColumn: 'Nom du client|Client', targetField: 'client_name', transform: normalizeString },
        { sourceColumn: 'Titre|Nom', targetField: 'titre', transform: normalizeString },
        { sourceColumn: 'Description', targetField: 'description', transform: normalizeString },
        { sourceColumn: 'Adresse', targetField: 'adresse_chantier', transform: normalizeString },
        { sourceColumn: 'Code postal|CP', targetField: 'code_postal_chantier', transform: normalizeString },
        { sourceColumn: 'Ville', targetField: 'ville_chantier', transform: normalizeString },
        { sourceColumn: 'Date début|Date debut', targetField: 'date_debut', transform: parseFrenchDate },
        { sourceColumn: 'Date fin prévue|Date fin prevue', targetField: 'date_fin_prevue', transform: parseFrenchDate },
        { sourceColumn: 'État|Statut', targetField: 'statut', transform: normalizeString },
        { sourceColumn: 'Notes|Remarques', targetField: 'notes', transform: normalizeString },
      ],
      requiredColumns: ['Titre'],
    },
    prestations: {
      possibleFileNames: ['prestations.csv', 'services.csv'],
      columnMappings: [
        { sourceColumn: 'Libellé|Designation', targetField: 'designation', transform: normalizeString },
        { sourceColumn: 'Unité|Unite', targetField: 'unite', transform: normalizeString },
        { sourceColumn: 'Prix unitaire|Prix', targetField: 'prix_unitaire_ht', transform: parseAmount },
        { sourceColumn: 'Taux TVA|TVA %', targetField: 'taux_tva', transform: parseTVARate },
        { sourceColumn: 'Catégorie|Categorie', targetField: 'categorie', transform: normalizeString },
      ],
      requiredColumns: ['Libellé'],
    },
    fournisseurs: {
      possibleFileNames: ['fournisseurs.csv', 'suppliers.csv'],
      columnMappings: [
        { sourceColumn: 'Nom|Raison sociale', targetField: 'nom', transform: normalizeString },
        { sourceColumn: 'Contact', targetField: 'contact', transform: normalizeString },
        { sourceColumn: 'Email|E-mail', targetField: 'email', transform: normalizeString },
        { sourceColumn: 'Téléphone|Telephone', targetField: 'telephone', transform: normalizeString },
        { sourceColumn: 'Adresse', targetField: 'adresse', transform: normalizeString },
        { sourceColumn: 'Code postal|CP', targetField: 'code_postal', transform: normalizeString },
        { sourceColumn: 'Ville', targetField: 'ville', transform: normalizeString },
        { sourceColumn: 'SIRET', targetField: 'siret', transform: normalizeString },
        { sourceColumn: 'Notes|Remarques', targetField: 'notes', transform: normalizeString },
      ],
      requiredColumns: ['Nom'],
    },
    intervenants: {
      possibleFileNames: ['intervenants.csv', 'workers.csv'],
      columnMappings: [
        { sourceColumn: 'Prénom|Prenom', targetField: 'prenom', transform: normalizeString },
        { sourceColumn: 'Nom', targetField: 'nom', transform: normalizeString },
        { sourceColumn: 'Téléphone|Telephone', targetField: 'telephone', transform: normalizeString },
        { sourceColumn: 'Email|E-mail', targetField: 'email', transform: normalizeString },
        { sourceColumn: 'Métier|Metier', targetField: 'metier', transform: normalizeString },
        { sourceColumn: 'Type contrat|Type de contrat', targetField: 'type_contrat', transform: normalizeString },
        { sourceColumn: 'Taux horaire|Tarif horaire', targetField: 'taux_horaire', transform: parseAmount },
      ],
      requiredColumns: ['Nom'],
    },
    planning: {
      possibleFileNames: ['planning.csv', 'interventions.csv'],
      columnMappings: [
        { sourceColumn: 'Chantier', targetField: 'chantier_name', transform: normalizeString },
        { sourceColumn: 'Intervenant|Ouvrier', targetField: 'intervenant_name', transform: normalizeString },
        { sourceColumn: 'Titre|Nom', targetField: 'titre', transform: normalizeString },
        { sourceColumn: 'Travaux|Description', targetField: 'description_travaux', transform: normalizeString },
        { sourceColumn: 'Date début|Date debut', targetField: 'date_debut', transform: parseFrenchDate },
        { sourceColumn: 'Date fin', targetField: 'date_fin', transform: parseFrenchDate },
        { sourceColumn: 'Heure début|Heure debut', targetField: 'heure_debut', transform: normalizeString },
        { sourceColumn: 'Heure fin', targetField: 'heure_fin', transform: normalizeString },
        { sourceColumn: 'Créneau|Creneau', targetField: 'creneau', transform: normalizeString },
        { sourceColumn: 'État|Statut', targetField: 'statut', transform: normalizeString },
        { sourceColumn: 'Notes|Remarques', targetField: 'notes', transform: normalizeString },
      ],
      requiredColumns: ['Titre'],
    },
    paiements: {
      possibleFileNames: ['paiements.csv', 'payments.csv'],
      columnMappings: [
        { sourceColumn: 'Référence facture|Facture', targetField: 'facture_numero', transform: normalizeString },
        { sourceColumn: 'Montant', targetField: 'montant', transform: parseAmount },
        { sourceColumn: 'Date', targetField: 'date_paiement', transform: parseFrenchDate },
        { sourceColumn: 'Méthode|Methode', targetField: 'methode', transform: mapPaymentMethod },
        { sourceColumn: 'Référence|Reference', targetField: 'reference', transform: normalizeString },
      ],
      requiredColumns: ['Référence facture', 'Montant', 'Date'],
    },
    achats: {
      possibleFileNames: ['achats.csv', 'purchases.csv'],
      columnMappings: [
        { sourceColumn: 'Fournisseur', targetField: 'fournisseur_name', transform: normalizeString },
        { sourceColumn: 'Chantier', targetField: 'chantier_name', transform: normalizeString },
        { sourceColumn: 'Date', targetField: 'date_achat', transform: parseFrenchDate },
        { sourceColumn: 'Description|Article', targetField: 'description', transform: normalizeString },
        { sourceColumn: 'Total HT|Montant HT', targetField: 'montant_ht', transform: parseAmount },
        { sourceColumn: 'Taux TVA|TVA %', targetField: 'taux_tva', transform: parseTVARate },
        { sourceColumn: 'Total TTC|Montant TTC', targetField: 'montant_ttc', transform: parseAmount },
      ],
      requiredColumns: ['Description', 'Date'],
    },
  },
};

// ==================== BATAPPLI CONFIG ====================

export const BATAPPLI_CONFIG: SourceConfig = {
  name: 'batappli',
  label: 'Batappli',
  description: 'Logiciel de gestion Batappli',
  categories: {
    clients: {
      possibleFileNames: ['clients.csv', 'clients_batappli.csv'],
      columnMappings: [
        { sourceColumn: 'Prénom|Prenom', targetField: 'prenom', transform: normalizeString },
        { sourceColumn: 'Nom', targetField: 'nom', transform: normalizeString },
        { sourceColumn: 'Raison sociale|Societe', targetField: 'raison_sociale', transform: normalizeString },
        { sourceColumn: 'Adresse', targetField: 'adresse', transform: normalizeString },
        { sourceColumn: 'Code postal|CP', targetField: 'code_postal', transform: normalizeString },
        { sourceColumn: 'Ville', targetField: 'ville', transform: normalizeString },
        { sourceColumn: 'Email|E-mail', targetField: 'email', transform: normalizeString },
        { sourceColumn: 'Téléphone|Telephone', targetField: 'telephone', transform: normalizeString },
        { sourceColumn: 'SIRET', targetField: 'siret', transform: normalizeString },
        { sourceColumn: 'Notes|Observations', targetField: 'notes_internes', transform: normalizeString },
      ],
      requiredColumns: ['Nom'],
    },
    devis: {
      possibleFileNames: ['devis.csv', 'devis_batappli.csv'],
      columnMappings: [
        { sourceColumn: 'Numéro|Numero|N°', targetField: 'numero', transform: normalizeString },
        { sourceColumn: 'Nom client|Client', targetField: 'client_name', transform: normalizeString },
        { sourceColumn: 'Date d\'émission|Date emission|Date', targetField: 'date_emission', transform: parseFrenchDate },
        { sourceColumn: 'Date de validité|Date validite', targetField: 'date_validite', transform: parseFrenchDate },
        { sourceColumn: 'Objet|Subject', targetField: 'objet', transform: normalizeString },
        { sourceColumn: 'Montant HT|Total HT', targetField: 'montant_ht', transform: parseAmount },
        { sourceColumn: 'TVA', targetField: 'montant_tva', transform: parseAmount },
        { sourceColumn: 'Montant TTC|Total TTC', targetField: 'montant_ttc', transform: parseAmount },
        { sourceColumn: 'Situation|Statut|État', targetField: 'statut', transform: (v) => mapQuoteStatus(v, 'batappli') },
        { sourceColumn: 'Conditions de paiement|Conditions paiement', targetField: 'conditions_paiement', transform: normalizeString },
        { sourceColumn: 'Acompte|Acompte %', targetField: 'acompte_pourcentage', transform: parsePercentage },
      ],
      requiredColumns: ['Numéro', 'Nom client'],
    },
    devis_lignes: {
      possibleFileNames: ['devis_lignes.csv', 'devis_details.csv'],
      columnMappings: [
        { sourceColumn: 'Numéro devis|Numero devis|Devis', targetField: 'devis_numero', transform: normalizeString },
        { sourceColumn: 'Ordre|Order|Ligne', targetField: 'ordre', transform: (v) => parseInt(v) || 0 },
        { sourceColumn: 'Désignation|Designation|Description', targetField: 'designation', transform: normalizeString },
        { sourceColumn: 'Quantité|Quantite|Qty', targetField: 'quantite', transform: parseAmount },
        { sourceColumn: 'Unité|Unite|Unit', targetField: 'unite', transform: normalizeString },
        { sourceColumn: 'Prix unitaire HT|Prix HT|Unit price', targetField: 'prix_unitaire_ht', transform: parseAmount },
        { sourceColumn: 'Taux TVA|TVA %|Tax rate', targetField: 'taux_tva', transform: parseTVARate },
        { sourceColumn: 'Montant HT|Total HT', targetField: 'montant_ht', transform: parseAmount },
      ],
      requiredColumns: ['Numéro devis', 'Désignation'],
    },
    factures: {
      possibleFileNames: ['factures.csv', 'factures_batappli.csv'],
      columnMappings: [
        { sourceColumn: 'Numéro|Numero|N°', targetField: 'numero', transform: normalizeString },
        { sourceColumn: 'Nom client|Client', targetField: 'client_name', transform: normalizeString },
        { sourceColumn: 'Date d\'émission|Date emission|Date', targetField: 'date_emission', transform: parseFrenchDate },
        { sourceColumn: 'Date d\'échéance|Date echeance', targetField: 'date_echeance', transform: parseFrenchDate },
        { sourceColumn: 'Type', targetField: 'type', transform: normalizeString },
        { sourceColumn: 'Montant HT|Total HT', targetField: 'montant_ht', transform: parseAmount },
        { sourceColumn: 'TVA', targetField: 'montant_tva', transform: parseAmount },
        { sourceColumn: 'Montant TTC|Total TTC', targetField: 'montant_ttc', transform: parseAmount },
        { sourceColumn: 'Montant payé|Montant paye', targetField: 'montant_paye', transform: parseAmount },
        { sourceColumn: 'Date de paiement|Date paiement', targetField: 'date_paiement', transform: parseFrenchDate },
        { sourceColumn: 'Situation|Statut|État', targetField: 'statut', transform: (v) => mapInvoiceStatus(v, 'batappli') },
      ],
      requiredColumns: ['Numéro', 'Nom client'],
    },
    facture_lignes: {
      possibleFileNames: ['factures_lignes.csv', 'factures_details.csv'],
      columnMappings: [
        { sourceColumn: 'Numéro facture|Numero facture|Facture', targetField: 'facture_numero', transform: normalizeString },
        { sourceColumn: 'Ordre|Order|Ligne', targetField: 'ordre', transform: (v) => parseInt(v) || 0 },
        { sourceColumn: 'Désignation|Designation|Description', targetField: 'designation', transform: normalizeString },
        { sourceColumn: 'Quantité|Quantite|Qty', targetField: 'quantite', transform: parseAmount },
        { sourceColumn: 'Unité|Unite|Unit', targetField: 'unite', transform: normalizeString },
        { sourceColumn: 'Prix unitaire HT|Prix HT|Unit price', targetField: 'prix_unitaire_ht', transform: parseAmount },
        { sourceColumn: 'Taux TVA|TVA %|Tax rate', targetField: 'taux_tva', transform: parseTVARate },
        { sourceColumn: 'Montant HT|Total HT', targetField: 'montant_ht', transform: parseAmount },
      ],
      requiredColumns: ['Numéro facture', 'Désignation'],
    },
    chantiers: {
      possibleFileNames: ['chantiers.csv', 'projects.csv'],
      columnMappings: [
        { sourceColumn: 'Nom client|Client', targetField: 'client_name', transform: normalizeString },
        { sourceColumn: 'Titre|Nom|Dénomination', targetField: 'titre', transform: normalizeString },
        { sourceColumn: 'Description', targetField: 'description', transform: normalizeString },
        { sourceColumn: 'Adresse', targetField: 'adresse_chantier', transform: normalizeString },
        { sourceColumn: 'Code postal|CP', targetField: 'code_postal_chantier', transform: normalizeString },
        { sourceColumn: 'Ville', targetField: 'ville_chantier', transform: normalizeString },
        { sourceColumn: 'Date de début|Date debut', targetField: 'date_debut', transform: parseFrenchDate },
        { sourceColumn: 'Date de fin|Date fin', targetField: 'date_fin_prevue', transform: parseFrenchDate },
        { sourceColumn: 'Situation|Statut|État', targetField: 'statut', transform: normalizeString },
        { sourceColumn: 'Notes|Observations', targetField: 'notes', transform: normalizeString },
      ],
      requiredColumns: ['Titre'],
    },
    prestations: {
      possibleFileNames: ['prestations.csv', 'services.csv'],
      columnMappings: [
        { sourceColumn: 'Désignation|Designation|Description', targetField: 'designation', transform: normalizeString },
        { sourceColumn: 'Unité|Unite', targetField: 'unite', transform: normalizeString },
        { sourceColumn: 'Prix unitaire HT|Prix', targetField: 'prix_unitaire_ht', transform: parseAmount },
        { sourceColumn: 'Taux TVA|TVA %', targetField: 'taux_tva', transform: parseTVARate },
        { sourceColumn: 'Catégorie|Categorie', targetField: 'categorie', transform: normalizeString },
      ],
      requiredColumns: ['Désignation'],
    },
    fournisseurs: {
      possibleFileNames: ['fournisseurs.csv', 'suppliers.csv'],
      columnMappings: [
        { sourceColumn: 'Nom|Raison sociale', targetField: 'nom', transform: normalizeString },
        { sourceColumn: 'Contact|Personne', targetField: 'contact', transform: normalizeString },
        { sourceColumn: 'Email|E-mail', targetField: 'email', transform: normalizeString },
        { sourceColumn: 'Téléphone|Telephone', targetField: 'telephone', transform: normalizeString },
        { sourceColumn: 'Adresse', targetField: 'adresse', transform: normalizeString },
        { sourceColumn: 'Code postal|CP', targetField: 'code_postal', transform: normalizeString },
        { sourceColumn: 'Ville', targetField: 'ville', transform: normalizeString },
        { sourceColumn: 'SIRET', targetField: 'siret', transform: normalizeString },
        { sourceColumn: 'Notes|Observations', targetField: 'notes', transform: normalizeString },
      ],
      requiredColumns: ['Nom'],
    },
    intervenants: {
      possibleFileNames: ['intervenants.csv', 'workers.csv'],
      columnMappings: [
        { sourceColumn: 'Prénom|Prenom', targetField: 'prenom', transform: normalizeString },
        { sourceColumn: 'Nom', targetField: 'nom', transform: normalizeString },
        { sourceColumn: 'Téléphone|Telephone', targetField: 'telephone', transform: normalizeString },
        { sourceColumn: 'Email|E-mail', targetField: 'email', transform: normalizeString },
        { sourceColumn: 'Métier|Metier', targetField: 'metier', transform: normalizeString },
        { sourceColumn: 'Type de contrat|Type contrat', targetField: 'type_contrat', transform: normalizeString },
        { sourceColumn: 'Taux horaire|Tarif', targetField: 'taux_horaire', transform: parseAmount },
      ],
      requiredColumns: ['Nom'],
    },
    planning: {
      possibleFileNames: ['planning.csv', 'interventions.csv'],
      columnMappings: [
        { sourceColumn: 'Chantier', targetField: 'chantier_name', transform: normalizeString },
        { sourceColumn: 'Intervenant|Ouvrier', targetField: 'intervenant_name', transform: normalizeString },
        { sourceColumn: 'Titre|Nom', targetField: 'titre', transform: normalizeString },
        { sourceColumn: 'Travaux|Description', targetField: 'description_travaux', transform: normalizeString },
        { sourceColumn: 'Date de début|Date debut', targetField: 'date_debut', transform: parseFrenchDate },
        { sourceColumn: 'Date de fin|Date fin', targetField: 'date_fin', transform: parseFrenchDate },
        { sourceColumn: 'Heure de début|Heure debut', targetField: 'heure_debut', transform: normalizeString },
        { sourceColumn: 'Heure de fin|Heure fin', targetField: 'heure_fin', transform: normalizeString },
        { sourceColumn: 'Créneau|Creneau', targetField: 'creneau', transform: normalizeString },
        { sourceColumn: 'Situation|Statut|État', targetField: 'statut', transform: normalizeString },
        { sourceColumn: 'Notes|Observations', targetField: 'notes', transform: normalizeString },
      ],
      requiredColumns: ['Titre'],
    },
    paiements: {
      possibleFileNames: ['paiements.csv', 'payments.csv'],
      columnMappings: [
        { sourceColumn: 'Numéro facture|Numero facture|Facture', targetField: 'facture_numero', transform: normalizeString },
        { sourceColumn: 'Montant', targetField: 'montant', transform: parseAmount },
        { sourceColumn: 'Date', targetField: 'date_paiement', transform: parseFrenchDate },
        { sourceColumn: 'Méthode|Methode', targetField: 'methode', transform: mapPaymentMethod },
        { sourceColumn: 'Référence|Reference', targetField: 'reference', transform: normalizeString },
      ],
      requiredColumns: ['Numéro facture', 'Montant', 'Date'],
    },
    achats: {
      possibleFileNames: ['achats.csv', 'purchases.csv'],
      columnMappings: [
        { sourceColumn: 'Fournisseur', targetField: 'fournisseur_name', transform: normalizeString },
        { sourceColumn: 'Chantier', targetField: 'chantier_name', transform: normalizeString },
        { sourceColumn: 'Date d\'achat|Date achat|Date', targetField: 'date_achat', transform: parseFrenchDate },
        { sourceColumn: 'Description|Article', targetField: 'description', transform: normalizeString },
        { sourceColumn: 'Montant HT|Total HT', targetField: 'montant_ht', transform: parseAmount },
        { sourceColumn: 'Taux TVA|TVA %', targetField: 'taux_tva', transform: parseTVARate },
        { sourceColumn: 'Montant TTC|Total TTC', targetField: 'montant_ttc', transform: parseAmount },
      ],
      requiredColumns: ['Description', 'Date d\'achat'],
    },
  },
};

// ==================== HENRRI CONFIG ====================

export const HENRRI_CONFIG: SourceConfig = {
  name: 'henrri',
  label: 'Henrri',
  description: 'Logiciel gratuit Henrri',
  categories: {
    clients: {
      possibleFileNames: ['clients.csv', 'clients_henrri.csv'],
      columnMappings: [
        { sourceColumn: 'Prénom|Prenom', targetField: 'prenom', transform: normalizeString },
        { sourceColumn: 'Nom', targetField: 'nom', transform: normalizeString },
        { sourceColumn: 'Société|Societe', targetField: 'raison_sociale', transform: normalizeString },
        { sourceColumn: 'Adresse', targetField: 'adresse', transform: normalizeString },
        { sourceColumn: 'Code postal|CP', targetField: 'code_postal', transform: normalizeString },
        { sourceColumn: 'Ville', targetField: 'ville', transform: normalizeString },
        { sourceColumn: 'Email|E-mail', targetField: 'email', transform: normalizeString },
        { sourceColumn: 'Téléphone|Telephone', targetField: 'telephone', transform: normalizeString },
        { sourceColumn: 'SIRET', targetField: 'siret', transform: normalizeString },
        { sourceColumn: 'Notes|Remarques', targetField: 'notes_internes', transform: normalizeString },
      ],
      requiredColumns: ['Nom'],
    },
    devis: {
      possibleFileNames: ['devis.csv', 'devis_henrri.csv'],
      columnMappings: [
        { sourceColumn: 'Numéro|Numero|N°', targetField: 'numero', transform: normalizeString },
        { sourceColumn: 'Nom client|Client|Société', targetField: 'client_name', transform: normalizeString },
        { sourceColumn: 'Date', targetField: 'date_emission', transform: parseFrenchDate },
        { sourceColumn: 'Validité|Valid until|Valide jusqu\'au', targetField: 'date_validite', transform: parseFrenchDate },
        { sourceColumn: 'Objet|Sujet|Description', targetField: 'objet', transform: normalizeString },
        { sourceColumn: 'Montant HT|Total HT', targetField: 'montant_ht', transform: parseAmount },
        { sourceColumn: 'Montant TVA|TVA', targetField: 'montant_tva', transform: parseAmount },
        { sourceColumn: 'Montant TTC|Total TTC', targetField: 'montant_ttc', transform: parseAmount },
        { sourceColumn: 'Statut|Status|État', targetField: 'statut', transform: (v) => mapQuoteStatus(v, 'henrri') },
        { sourceColumn: 'Conditions|Terms', targetField: 'conditions_paiement', transform: normalizeString },
        { sourceColumn: 'Acompte|Deposit %', targetField: 'acompte_pourcentage', transform: parsePercentage },
      ],
      requiredColumns: ['Numéro', 'Nom client'],
    },
    devis_lignes: {
      possibleFileNames: ['devis_lignes.csv', 'devis_articles.csv'],
      columnMappings: [
        { sourceColumn: 'Numéro devis|Numero devis|Quote number', targetField: 'devis_numero', transform: normalizeString },
        { sourceColumn: 'Ordre|Order|Ligne', targetField: 'ordre', transform: (v) => parseInt(v) || 0 },
        { sourceColumn: 'Désignation|Designation|Description', targetField: 'designation', transform: normalizeString },
        { sourceColumn: 'Quantité|Quantite|Qty', targetField: 'quantite', transform: parseAmount },
        { sourceColumn: 'Unité|Unite|Unit|U', targetField: 'unite', transform: normalizeString },
        { sourceColumn: 'Prix unitaire|Prix|Price', targetField: 'prix_unitaire_ht', transform: parseAmount },
        { sourceColumn: 'TVA %|Taux TVA|Tax rate', targetField: 'taux_tva', transform: parseTVARate },
        { sourceColumn: 'Montant|Total|Amount', targetField: 'montant_ht', transform: parseAmount },
      ],
      requiredColumns: ['Numéro devis', 'Désignation'],
    },
    factures: {
      possibleFileNames: ['factures.csv', 'factures_henrri.csv'],
      columnMappings: [
        { sourceColumn: 'Numéro|Numero|N°', targetField: 'numero', transform: normalizeString },
        { sourceColumn: 'Nom client|Client|Société', targetField: 'client_name', transform: normalizeString },
        { sourceColumn: 'Date', targetField: 'date_emission', transform: parseFrenchDate },
        { sourceColumn: 'Échéance|Echeance|Due date', targetField: 'date_echeance', transform: parseFrenchDate },
        { sourceColumn: 'Type', targetField: 'type', transform: normalizeString },
        { sourceColumn: 'Montant HT|Total HT', targetField: 'montant_ht', transform: parseAmount },
        { sourceColumn: 'Montant TVA|TVA', targetField: 'montant_tva', transform: parseAmount },
        { sourceColumn: 'Montant TTC|Total TTC', targetField: 'montant_ttc', transform: parseAmount },
        { sourceColumn: 'Payé|Paye|Paid', targetField: 'montant_paye', transform: parseAmount },
        { sourceColumn: 'Date paiement|Date paid', targetField: 'date_paiement', transform: parseFrenchDate },
        { sourceColumn: 'Statut|Status|État', targetField: 'statut', transform: (v) => mapInvoiceStatus(v, 'henrri') },
      ],
      requiredColumns: ['Numéro', 'Nom client'],
    },
    facture_lignes: {
      possibleFileNames: ['factures_lignes.csv', 'factures_articles.csv'],
      columnMappings: [
        { sourceColumn: 'Numéro facture|Numero facture|Invoice number', targetField: 'facture_numero', transform: normalizeString },
        { sourceColumn: 'Ordre|Order|Ligne', targetField: 'ordre', transform: (v) => parseInt(v) || 0 },
        { sourceColumn: 'Désignation|Designation|Description', targetField: 'designation', transform: normalizeString },
        { sourceColumn: 'Quantité|Quantite|Qty', targetField: 'quantite', transform: parseAmount },
        { sourceColumn: 'Unité|Unite|Unit|U', targetField: 'unite', transform: normalizeString },
        { sourceColumn: 'Prix unitaire|Prix|Price', targetField: 'prix_unitaire_ht', transform: parseAmount },
        { sourceColumn: 'TVA %|Taux TVA|Tax rate', targetField: 'taux_tva', transform: parseTVARate },
        { sourceColumn: 'Montant|Total|Amount', targetField: 'montant_ht', transform: parseAmount },
      ],
      requiredColumns: ['Numéro facture', 'Désignation'],
    },
    chantiers: {
      possibleFileNames: ['chantiers.csv', 'projects.csv', 'sites.csv'],
      columnMappings: [
        { sourceColumn: 'Nom client|Client|Société', targetField: 'client_name', transform: normalizeString },
        { sourceColumn: 'Titre|Nom|Title', targetField: 'titre', transform: normalizeString },
        { sourceColumn: 'Description', targetField: 'description', transform: normalizeString },
        { sourceColumn: 'Adresse|Address', targetField: 'adresse_chantier', transform: normalizeString },
        { sourceColumn: 'Code postal|CP', targetField: 'code_postal_chantier', transform: normalizeString },
        { sourceColumn: 'Ville|City', targetField: 'ville_chantier', transform: normalizeString },
        { sourceColumn: 'Date début|Date debut|Start', targetField: 'date_debut', transform: parseFrenchDate },
        { sourceColumn: 'Date fin|Date end|Fin', targetField: 'date_fin_prevue', transform: parseFrenchDate },
        { sourceColumn: 'Statut|Status|État', targetField: 'statut', transform: normalizeString },
        { sourceColumn: 'Notes|Remarques|Notes', targetField: 'notes', transform: normalizeString },
      ],
      requiredColumns: ['Titre'],
    },
    prestations: {
      possibleFileNames: ['prestations.csv', 'services.csv', 'catalog.csv'],
      columnMappings: [
        { sourceColumn: 'Désignation|Designation|Description', targetField: 'designation', transform: normalizeString },
        { sourceColumn: 'Unité|Unite|Unit|U', targetField: 'unite', transform: normalizeString },
        { sourceColumn: 'Prix|Price|Tarif', targetField: 'prix_unitaire_ht', transform: parseAmount },
        { sourceColumn: 'TVA %|Tax rate', targetField: 'taux_tva', transform: parseTVARate },
        { sourceColumn: 'Catégorie|Categorie|Category', targetField: 'categorie', transform: normalizeString },
      ],
      requiredColumns: ['Désignation'],
    },
    fournisseurs: {
      possibleFileNames: ['fournisseurs.csv', 'suppliers.csv', 'vendors.csv'],
      columnMappings: [
        { sourceColumn: 'Nom|Name|Société|Societe', targetField: 'nom', transform: normalizeString },
        { sourceColumn: 'Contact|Personne|Person', targetField: 'contact', transform: normalizeString },
        { sourceColumn: 'Email|E-mail', targetField: 'email', transform: normalizeString },
        { sourceColumn: 'Téléphone|Telephone|Phone', targetField: 'telephone', transform: normalizeString },
        { sourceColumn: 'Adresse|Address', targetField: 'adresse', transform: normalizeString },
        { sourceColumn: 'Code postal|CP', targetField: 'code_postal', transform: normalizeString },
        { sourceColumn: 'Ville|City', targetField: 'ville', transform: normalizeString },
        { sourceColumn: 'SIRET', targetField: 'siret', transform: normalizeString },
        { sourceColumn: 'Notes|Remarques', targetField: 'notes', transform: normalizeString },
      ],
      requiredColumns: ['Nom'],
    },
    intervenants: {
      possibleFileNames: ['intervenants.csv', 'workers.csv', 'employees.csv'],
      columnMappings: [
        { sourceColumn: 'Prénom|Prenom|First name', targetField: 'prenom', transform: normalizeString },
        { sourceColumn: 'Nom|Last name', targetField: 'nom', transform: normalizeString },
        { sourceColumn: 'Téléphone|Telephone|Phone', targetField: 'telephone', transform: normalizeString },
        { sourceColumn: 'Email|E-mail', targetField: 'email', transform: normalizeString },
        { sourceColumn: 'Métier|Metier|Trade|Job', targetField: 'metier', transform: normalizeString },
        { sourceColumn: 'Type contrat|Type de contrat|Contract', targetField: 'type_contrat', transform: normalizeString },
        { sourceColumn: 'Taux horaire|Tarif horaire|Hourly', targetField: 'taux_horaire', transform: parseAmount },
      ],
      requiredColumns: ['Nom'],
    },
    planning: {
      possibleFileNames: ['planning.csv', 'schedule.csv', 'interventions.csv'],
      columnMappings: [
        { sourceColumn: 'Chantier|Site|Project', targetField: 'chantier_name', transform: normalizeString },
        { sourceColumn: 'Intervenant|Worker|Ouvrier', targetField: 'intervenant_name', transform: normalizeString },
        { sourceColumn: 'Titre|Title|Nom', targetField: 'titre', transform: normalizeString },
        { sourceColumn: 'Travaux|Works|Details', targetField: 'description_travaux', transform: normalizeString },
        { sourceColumn: 'Date début|Date debut|Start', targetField: 'date_debut', transform: parseFrenchDate },
        { sourceColumn: 'Date fin|Date end|End', targetField: 'date_fin', transform: parseFrenchDate },
        { sourceColumn: 'Heure début|Heure debut|Start time', targetField: 'heure_debut', transform: normalizeString },
        { sourceColumn: 'Heure fin|Heure end|End time', targetField: 'heure_fin', transform: normalizeString },
        { sourceColumn: 'Créneau|Creneau|Slot', targetField: 'creneau', transform: normalizeString },
        { sourceColumn: 'Statut|Status', targetField: 'statut', transform: normalizeString },
        { sourceColumn: 'Notes|Remarques', targetField: 'notes', transform: normalizeString },
      ],
      requiredColumns: ['Titre'],
    },
    paiements: {
      possibleFileNames: ['paiements.csv', 'payments.csv', 'reglements.csv'],
      columnMappings: [
        { sourceColumn: 'Numéro facture|Numero facture|Invoice', targetField: 'facture_numero', transform: normalizeString },
        { sourceColumn: 'Montant|Amount', targetField: 'montant', transform: parseAmount },
        { sourceColumn: 'Date|Date paiement', targetField: 'date_paiement', transform: parseFrenchDate },
        { sourceColumn: 'Méthode|Methode|Method', targetField: 'methode', transform: mapPaymentMethod },
        { sourceColumn: 'Référence|Reference|Ref', targetField: 'reference', transform: normalizeString },
      ],
      requiredColumns: ['Numéro facture', 'Montant', 'Date'],
    },
    achats: {
      possibleFileNames: ['achats.csv', 'purchases.csv', 'orders.csv'],
      columnMappings: [
        { sourceColumn: 'Fournisseur|Supplier', targetField: 'fournisseur_name', transform: normalizeString },
        { sourceColumn: 'Chantier|Site|Project', targetField: 'chantier_name', transform: normalizeString },
        { sourceColumn: 'Date|Date achat', targetField: 'date_achat', transform: parseFrenchDate },
        { sourceColumn: 'Description|Article', targetField: 'description', transform: normalizeString },
        { sourceColumn: 'Montant HT|Total HT', targetField: 'montant_ht', transform: parseAmount },
        { sourceColumn: 'TVA %|Tax rate', targetField: 'taux_tva', transform: parseTVARate },
        { sourceColumn: 'Montant TTC|Total TTC', targetField: 'montant_ttc', transform: parseAmount },
      ],
      requiredColumns: ['Description', 'Date'],
    },
  },
};

// ==================== GENERIC EXCEL CONFIG ====================

export const EXCEL_CONFIG: SourceConfig = {
  name: 'excel',
  label: 'Excel / CSV générique',
  description: 'Format Excel ou CSV générique avec colonnes standard français',
  categories: {
    clients: {
      possibleFileNames: ['clients.csv', 'clients.xlsx', 'contacts.csv'],
      columnMappings: [
        { sourceColumn: 'Prénom|Prenom|First name|Firstname|Given name', targetField: 'prenom', transform: normalizeString },
        { sourceColumn: 'Nom|Nom du client|Nom client|Nom du tiers|Nom complet|Nom et prénom|Nom contact|Contact|Last name|Lastname|Surname|Family name', targetField: 'nom', transform: normalizeString },
        { sourceColumn: 'Raison sociale|Société|Societe|Entreprise|Enseigne|Nom commercial|Company|Company name|Organisation|Organization', targetField: 'raison_sociale', transform: normalizeString },
        { sourceColumn: 'Adresse|Address|Rue|Adresse 1|Adresse ligne 1|Adresse postale|Street', targetField: 'adresse', transform: normalizeString },
        { sourceColumn: 'Code postal|CP|Code_postal|Code Postal|Postal code|ZIP|Zip code', targetField: 'code_postal', transform: normalizeString },
        { sourceColumn: 'Ville|City|Localité|Localite|Commune|Town', targetField: 'ville', transform: normalizeString },
        { sourceColumn: 'Email|E-mail|Mail|Courriel|Email address|Adresse email|Adresse e-mail', targetField: 'email', transform: normalizeString },
        { sourceColumn: 'Téléphone|Telephone|Phone|Tel|Tél|Mobile|Portable|GSM|Numéro de téléphone|Phone number', targetField: 'telephone', transform: normalizeString },
        { sourceColumn: 'SIRET|SIREN|Siret|Siren|N° SIRET|Numéro SIRET|Tax ID', targetField: 'siret', transform: normalizeString },
        { sourceColumn: 'Pays|Country|Nation', targetField: 'pays', transform: normalizeString },
        { sourceColumn: 'Num. TVA|N° TVA|N° TVA intracommunautaire|Numéro TVA|Numero TVA|TVA intra|TVA intracommunautaire|Numéro de TVA intracommunautaire|VAT|VAT number', targetField: 'tva_intra', transform: normalizeString },
        { sourceColumn: 'Notes|Observations|Remarques|Comments|Notes internes|Mémo|Memo|Commentaire client', targetField: 'notes_internes', transform: normalizeString },
      ],
      requiredColumns: ['Nom'],
    },
    devis: {
      possibleFileNames: ['devis.csv', 'devis.xlsx', 'quotes.csv', 'quotations.csv'],
      columnMappings: [
        { sourceColumn: 'N°|N°devis|Numéro|Numero|Numéro devis|Numero devis|Reference|Ref', targetField: 'numero', transform: normalizeString },
        { sourceColumn: 'Client|Nom client|Nom|Customer|Customer name', targetField: 'client_name', transform: normalizeString },
        { sourceColumn: 'Date|Date émission|Date emission|Date devis|Issue date', targetField: 'date_emission', transform: parseFrenchDate },
        { sourceColumn: 'Validité|Date validité|Date validite|Valid until|Validity', targetField: 'date_validite', transform: parseFrenchDate },
        { sourceColumn: 'Objet|Sujet|Subject|Title|Description|Libellé', targetField: 'objet', transform: normalizeString },
        { sourceColumn: 'Montant HT|Total HT|Amount HT|Subtotal|Net amount', targetField: 'montant_ht', transform: parseAmount },
        { sourceColumn: 'Montant TVA|TVA|Tax|VAT', targetField: 'montant_tva', transform: parseAmount },
        { sourceColumn: 'Montant TTC|Total TTC|Total|Amount TTC|Gross amount', targetField: 'montant_ttc', transform: parseAmount },
        { sourceColumn: 'Statut|Status|État|State|Situation', targetField: 'statut', transform: (v) => mapQuoteStatus(v, 'excel') },
        { sourceColumn: 'Conditions|Conditions paiement|Payment terms|Terms', targetField: 'conditions_paiement', transform: normalizeString },
        { sourceColumn: 'Acompte|Acompte %|Deposit|Advance %', targetField: 'acompte_pourcentage', transform: parsePercentage },
      ],
      requiredColumns: ['Numéro', 'Client'],
    },
    devis_lignes: {
      possibleFileNames: ['devis_details.csv', 'devis_lignes.csv', 'devis_articles.csv'],
      columnMappings: [
        { sourceColumn: 'N°|Numéro devis|Numero devis|Quote|Quote number|Devis', targetField: 'devis_numero', transform: normalizeString },
        { sourceColumn: 'Ordre|Order|Line|Ligne|Numéro ligne|Line number', targetField: 'ordre', transform: (v) => parseInt(v) || 0 },
        { sourceColumn: 'Désignation|Designation|Description|Article|Item|Label', targetField: 'designation', transform: normalizeString },
        { sourceColumn: 'Quantité|Quantite|Qty|Quantity|Qte', targetField: 'quantite', transform: parseAmount },
        { sourceColumn: 'Unité|Unite|Unit|U|UM', targetField: 'unite', transform: normalizeString },
        { sourceColumn: 'Prix|Prix HT|Prix unitaire|Unit price|Price HT|Tarif', targetField: 'prix_unitaire_ht', transform: parseAmount },
        { sourceColumn: 'TVA|TVA %|Taux TVA|Tax|Tax rate|VAT %', targetField: 'taux_tva', transform: parseTVARate },
        { sourceColumn: 'Montant|Montant HT|Total|Line total|Amount', targetField: 'montant_ht', transform: parseAmount },
      ],
      requiredColumns: ['Désignation'],
    },
    factures: {
      possibleFileNames: ['factures.csv', 'factures.xlsx', 'invoices.csv'],
      columnMappings: [
        { sourceColumn: 'N°|N°facture|Numéro|Numero|Numéro facture|Numero facture|Reference|Invoice number', targetField: 'numero', transform: normalizeString },
        { sourceColumn: 'Client|Nom client|Customer|Customer name|Nom', targetField: 'client_name', transform: normalizeString },
        { sourceColumn: 'Date|Date émission|Date emission|Issue date|Date facture', targetField: 'date_emission', transform: parseFrenchDate },
        { sourceColumn: 'Échéance|Echeance|Due date|Date échéance|Date echeance', targetField: 'date_echeance', transform: parseFrenchDate },
        { sourceColumn: 'Type|Invoice type|Type facture', targetField: 'type', transform: normalizeString },
        { sourceColumn: 'Montant HT|Total HT|Amount HT|Subtotal|Net', targetField: 'montant_ht', transform: parseAmount },
        { sourceColumn: 'Montant TVA|TVA|Tax|VAT', targetField: 'montant_tva', transform: parseAmount },
        { sourceColumn: 'Montant TTC|Total TTC|Total|Amount|Gross', targetField: 'montant_ttc', transform: parseAmount },
        { sourceColumn: 'Montant payé|Montant paye|Paid|Amount paid|Réglé|Regle', targetField: 'montant_paye', transform: parseAmount },
        { sourceColumn: 'Date paiement|Date paid|Payment date|Date règlement', targetField: 'date_paiement', transform: parseFrenchDate },
        { sourceColumn: 'Statut|Status|État|State|Situation', targetField: 'statut', transform: (v) => mapInvoiceStatus(v, 'excel') },
      ],
      requiredColumns: ['Numéro', 'Client'],
    },
    facture_lignes: {
      possibleFileNames: ['factures_details.csv', 'factures_lignes.csv', 'factures_articles.csv'],
      columnMappings: [
        { sourceColumn: 'N°|Numéro facture|Numero facture|Invoice|Invoice number|Facture', targetField: 'facture_numero', transform: normalizeString },
        { sourceColumn: 'Ordre|Order|Line|Ligne|Line number', targetField: 'ordre', transform: (v) => parseInt(v) || 0 },
        { sourceColumn: 'Désignation|Designation|Description|Article|Item', targetField: 'designation', transform: normalizeString },
        { sourceColumn: 'Quantité|Quantite|Qty|Quantity|Qte', targetField: 'quantite', transform: parseAmount },
        { sourceColumn: 'Unité|Unite|Unit|U|UM', targetField: 'unite', transform: normalizeString },
        { sourceColumn: 'Prix|Prix HT|Prix unitaire|Unit price|Price|Tarif', targetField: 'prix_unitaire_ht', transform: parseAmount },
        { sourceColumn: 'TVA|TVA %|Taux TVA|Tax|Tax rate', targetField: 'taux_tva', transform: parseTVARate },
        { sourceColumn: 'Montant|Montant HT|Total|Line total', targetField: 'montant_ht', transform: parseAmount },
      ],
      requiredColumns: ['Désignation'],
    },
    chantiers: {
      possibleFileNames: ['chantiers.csv', 'projects.csv', 'sites.csv', 'worksites.csv'],
      columnMappings: [
        { sourceColumn: 'Nom client|Client|Customer|Société', targetField: 'client_name', transform: normalizeString },
        { sourceColumn: 'Titre|Nom|Title|Name|Dénomination', targetField: 'titre', transform: normalizeString },
        { sourceColumn: 'Description|Details|Détails', targetField: 'description', transform: normalizeString },
        { sourceColumn: 'Adresse|Address|Lieu|Location', targetField: 'adresse_chantier', transform: normalizeString },
        { sourceColumn: 'Code postal|CP|Postal code|ZIP', targetField: 'code_postal_chantier', transform: normalizeString },
        { sourceColumn: 'Ville|City|Localité', targetField: 'ville_chantier', transform: normalizeString },
        { sourceColumn: 'Date début|Date debut|Start date|Début', targetField: 'date_debut', transform: parseFrenchDate },
        { sourceColumn: 'Date fin|Date end|End date|Fin|Fin prévue', targetField: 'date_fin_prevue', transform: parseFrenchDate },
        { sourceColumn: 'Statut|Status|État|State|Situation', targetField: 'statut', transform: normalizeString },
        { sourceColumn: 'Notes|Observations|Remarques|Comments', targetField: 'notes', transform: normalizeString },
      ],
      requiredColumns: ['Titre'],
    },
    prestations: {
      possibleFileNames: ['prestations.csv', 'services.csv', 'catalog.csv', 'price_list.csv'],
      columnMappings: [
        { sourceColumn: 'Désignation|Designation|Libellé|Libelle|Intitulé|Intitule|Nom|Nom du produit|Nom de la prestation|Produit|Prestation|Service|Article|Item|Label|Description', targetField: 'designation', transform: normalizeString },
        { sourceColumn: 'Unité|Unite|Unit|U|UM|Unité de vente', targetField: 'unite', transform: mapUnite },
        { sourceColumn: 'Prix|Prix HT|Prix unitaire|Prix unitaire HT|PU HT|PU|Tarif|Tarif HT|Unit price|Price|Cost', targetField: 'prix_unitaire_ht', transform: parseAmount },
        { sourceColumn: 'TVA|TVA %|Taux TVA|Taux de TVA|Tax|Tax rate|VAT', targetField: 'taux_tva', transform: parseTVARate },
        { sourceColumn: 'Catégorie|Categorie|Category|Type|Famille|Groupe|Rubrique', targetField: 'categorie', transform: mapPrestationCategorie },
        { sourceColumn: 'Code|Référence|Reference|Réf|Ref|Code article|Code produit', targetField: 'reference', transform: normalizeString },
        { sourceColumn: 'Commentaire|Commentaires|Description|Détail|Detail|Note|Notes|Remarque|Remarques|Observation|Observations|Complément', targetField: 'description', transform: normalizeString },
      ],
      requiredColumns: ['Désignation'],
    },
    fournisseurs: {
      possibleFileNames: ['fournisseurs.csv', 'suppliers.csv', 'vendors.csv', 'contacts_fournisseurs.csv'],
      columnMappings: [
        { sourceColumn: 'Nom|Raison sociale|Societe|Supplier|Company|Name', targetField: 'nom', transform: normalizeString },
        { sourceColumn: 'Contact|Personne|Person|Contact person', targetField: 'contact', transform: normalizeString },
        { sourceColumn: 'Email|E-mail|Mail', targetField: 'email', transform: normalizeString },
        { sourceColumn: 'Téléphone|Telephone|Phone|Tel|Mobile', targetField: 'telephone', transform: normalizeString },
        { sourceColumn: 'Adresse|Address|Rue', targetField: 'adresse', transform: normalizeString },
        { sourceColumn: 'Code postal|CP|Postal code', targetField: 'code_postal', transform: normalizeString },
        { sourceColumn: 'Ville|City|Localité', targetField: 'ville', transform: normalizeString },
        { sourceColumn: 'SIRET|SIREN|Tax ID', targetField: 'siret', transform: normalizeString },
        { sourceColumn: 'Notes|Observations|Comments', targetField: 'notes', transform: normalizeString },
      ],
      requiredColumns: ['Nom'],
    },
    intervenants: {
      possibleFileNames: ['intervenants.csv', 'workers.csv', 'employees.csv', 'team.csv'],
      columnMappings: [
        { sourceColumn: 'Prénom|Prenom|First name|Firstname', targetField: 'prenom', transform: normalizeString },
        { sourceColumn: 'Nom|Last name|Surname|Lastname', targetField: 'nom', transform: normalizeString },
        { sourceColumn: 'Téléphone|Telephone|Phone|Tel|Mobile', targetField: 'telephone', transform: normalizeString },
        { sourceColumn: 'Email|E-mail|Mail', targetField: 'email', transform: normalizeString },
        { sourceColumn: 'Métier|Metier|Job|Trade|Profession', targetField: 'metier', transform: normalizeString },
        { sourceColumn: 'Type contrat|Type de contrat|Contract type|Employment', targetField: 'type_contrat', transform: normalizeString },
        { sourceColumn: 'Taux horaire|Tarif horaire|Hourly rate|Rate|Tarif', targetField: 'taux_horaire', transform: parseAmount },
      ],
      requiredColumns: ['Nom'],
    },
    planning: {
      possibleFileNames: ['planning.csv', 'schedule.csv', 'interventions.csv', 'calendar.csv'],
      columnMappings: [
        { sourceColumn: 'Chantier|Site|Project|Worksite', targetField: 'chantier_name', transform: normalizeString },
        { sourceColumn: 'Intervenant|Worker|Ouvrier|Employee', targetField: 'intervenant_name', transform: normalizeString },
        { sourceColumn: 'Titre|Title|Nom|Name|Description', targetField: 'titre', transform: normalizeString },
        { sourceColumn: 'Travaux|Works|Details|Détails', targetField: 'description_travaux', transform: normalizeString },
        { sourceColumn: 'Date début|Date debut|Start date|Début', targetField: 'date_debut', transform: parseFrenchDate },
        { sourceColumn: 'Date fin|Date end|End date|Fin', targetField: 'date_fin', transform: parseFrenchDate },
        { sourceColumn: 'Heure début|Heure debut|Start time|Début', targetField: 'heure_debut', transform: normalizeString },
        { sourceColumn: 'Heure fin|Heure end|End time|Fin', targetField: 'heure_fin', transform: normalizeString },
        { sourceColumn: 'Créneau|Creneau|Slot|Time slot', targetField: 'creneau', transform: normalizeString },
        { sourceColumn: 'Statut|Status|État|State', targetField: 'statut', transform: normalizeString },
        { sourceColumn: 'Notes|Observations|Remarques|Comments', targetField: 'notes', transform: normalizeString },
      ],
      requiredColumns: ['Titre'],
    },
    paiements: {
      possibleFileNames: ['paiements.csv', 'payments.csv', 'reglements.csv', 'transactions.csv'],
      columnMappings: [
        { sourceColumn: 'N°|Numéro|Numero|Invoice|Facture|Reference', targetField: 'facture_numero', transform: normalizeString },
        { sourceColumn: 'Montant|Amount|Somme|Total', targetField: 'montant', transform: parseAmount },
        { sourceColumn: 'Date|Date paiement|Payment date|Date règlement', targetField: 'date_paiement', transform: parseFrenchDate },
        { sourceColumn: 'Méthode|Methode|Method|Mode|Payment method', targetField: 'methode', transform: mapPaymentMethod },
        { sourceColumn: 'Référence|Reference|Ref|N°|Justificatif', targetField: 'reference', transform: normalizeString },
      ],
      requiredColumns: ['Montant', 'Date'],
    },
    achats: {
      possibleFileNames: ['achats.csv', 'purchases.csv', 'orders.csv', 'commandes.csv'],
      columnMappings: [
        { sourceColumn: 'Fournisseur|Supplier|Vendor|Nom', targetField: 'fournisseur_name', transform: normalizeString },
        { sourceColumn: 'Chantier|Site|Project|Worksite', targetField: 'chantier_name', transform: normalizeString },
        { sourceColumn: 'Date|Date achat|Purchase date|Date commande', targetField: 'date_achat', transform: parseFrenchDate },
        { sourceColumn: 'Description|Article|Item|Détails', targetField: 'description', transform: normalizeString },
        { sourceColumn: 'Montant HT|Total HT|Amount|Subtotal', targetField: 'montant_ht', transform: parseAmount },
        { sourceColumn: 'TVA|TVA %|Tax|Tax rate', targetField: 'taux_tva', transform: parseTVARate },
        { sourceColumn: 'Montant TTC|Total TTC|Total|Gross', targetField: 'montant_ttc', transform: parseAmount },
      ],
      requiredColumns: ['Description', 'Date'],
    },
  },
};

// ==================== OBAT EXPORT COMPTABLE CONFIG ====================
//
// Config "factice" pour le format comptable OBAT : le parsing réel se
// fait via lib/import/obat-comptable.ts (qui groupe les écritures par
// référence). Cette config existe uniquement pour satisfaire le type
// SOURCE_CONFIGS et permettre les pré-checks de catégorie. Les
// columnMappings ne sont jamais appliqués pour cette source — le
// pipeline parse/route.ts utilise preprocessObatComptable() à la place.
export const OBAT_COMPTABLE_CONFIG: SourceConfig = {
  name: 'obat_comptable',
  label: 'Obat (export comptable)',
  description: 'Export comptable Obat — regroupe les ecritures par reference pour reconstituer les devis et factures',
  categories: {
    clients: {
      possibleFileNames: [],
      columnMappings: [
        { sourceColumn: 'Client', targetField: 'nom', transform: normalizeString },
      ],
      requiredColumns: ['Client'],
    },
    devis: {
      possibleFileNames: ['devis.csv', 'export_devis.csv', 'export_liste_devis.csv'],
      columnMappings: [],
      requiredColumns: ['Référence de la pièce justificative'],
    },
    factures: {
      possibleFileNames: ['factures.csv', 'export_factures.csv', 'export_liste_facture.csv'],
      columnMappings: [],
      requiredColumns: ['Référence de la pièce justificative'],
    },
    devis_lignes: { possibleFileNames: [], columnMappings: [], requiredColumns: [] },
    facture_lignes: { possibleFileNames: [], columnMappings: [], requiredColumns: [] },
    chantiers: {
      possibleFileNames: [],
      columnMappings: [
        { sourceColumn: 'Intitulé du chantier', targetField: 'titre', transform: normalizeString },
      ],
      requiredColumns: ['Intitulé du chantier'],
    },
    prestations: { possibleFileNames: [], columnMappings: [], requiredColumns: [] },
    fournisseurs: { possibleFileNames: [], columnMappings: [], requiredColumns: [] },
    intervenants: { possibleFileNames: [], columnMappings: [], requiredColumns: [] },
    planning: { possibleFileNames: [], columnMappings: [], requiredColumns: [] },
    paiements: { possibleFileNames: [], columnMappings: [], requiredColumns: [] },
    achats: { possibleFileNames: [], columnMappings: [], requiredColumns: [] },
  },
};

// ==================== MASTER SOURCE CONFIGS ====================

export const SOURCE_CONFIGS: Record<SourceType, SourceConfig> = {
  obat: OBAT_CONFIG,
  obat_comptable: OBAT_COMPTABLE_CONFIG,
  tolteck: TOLTECK_CONFIG,
  batappli: BATAPPLI_CONFIG,
  henrri: HENRRI_CONFIG,
  excel: EXCEL_CONFIG,
};

// ==================== DETECTION FUNCTIONS ====================

export function detectSource(headers: string[]): SourceType {
  const headerLower = headers.map(h => h.toLowerCase().trim());

  // Obat export COMPTABLE : signatures très distinctives
  //   - "Référence de la pièce justificative"
  //   - "Numéro de compte"
  //   - "Sens d'écriture"
  // Doit être testé AVANT le format Obat standard pour ne pas se faire
  // intercepter par celui-ci (le mot "devis" apparaît dans les deux).
  const hasRefPiece = headerLower.some(h => h.includes('référence de la pièce') || h.includes('reference de la piece'));
  const hasCompte = headerLower.some(h => h.includes('numéro de compte') || h.includes('numero de compte'));
  const hasSens = headerLower.some(h => h.includes("sens d'écriture") || h.includes("sens d'ecriture"));
  if (hasRefPiece && hasCompte && hasSens) {
    return 'obat_comptable';
  }

  // Obat signatures
  if (headerLower.some(h => /^n°\s?devis|devis/.test(h)) &&
      headerLower.some(h => /montant.*ttc|total.*ttc/.test(h))) {
    return 'obat';
  }

  // Tolteck signatures (Référence is distinctive)
  if (headerLower.some(h => h === 'référence' || h === 'reference') &&
      headerLower.some(h => /nom du client/.test(h))) {
    return 'tolteck';
  }

  // Batappli signatures
  if (headerLower.some(h => /situation|état/.test(h)) &&
      headerLower.some(h => /raison sociale|societe/.test(h))) {
    return 'batappli';
  }

  // Henrri signatures (often uses "Société" prominently)
  if (headerLower.some(h => h === 'société' || h === 'societe') &&
      !headerLower.some(h => /raison sociale/.test(h))) {
    return 'henrri';
  }

  return 'excel';
}

export function detectCategory(headers: string[], source: SourceType, sheetName?: string): DataCategory | null {
  const headerLower = headers.map(h => h.toLowerCase().trim());
  const config = SOURCE_CONFIGS[source];

  // ─── PRIORITE AU NOM DE FICHIER ───
  // Si le fichier porte un nom explicite (fournisseurs.csv, clients.csv,
  // prestations.csv, suppliers.csv...), on route directement vers la categorie
  // correspondante. Indispensable pour les FOURNISSEURS : leurs colonnes sont
  // identiques a celles des clients, donc sur la seule detection par en-tetes,
  // "clients" l'emporte toujours a egalite. Les listes possibleFileNames
  // existent deja par categorie ; on les exploite enfin ici.
  // Non-cassant : ne s'active QUE si le nom correspond exactement a une entree
  // possibleFileNames ; sinon on retombe sur la detection par en-tetes.
  if (sheetName) {
    const stripExt = (s: string) => s.toLowerCase().trim().replace(/\.(csv|xlsx|xls)$/, '');
    const fstem = stripExt(sheetName);
    for (const [category, categoryConfig] of Object.entries(config.categories) as [DataCategory, CategoryConfig][]) {
      if (categoryConfig.possibleFileNames.some(n => stripExt(n) === fstem)) {
        return category;
      }
    }
  }

  // Desambiguisation "catalogue de produits/prestations" (source generique).
  // Beaucoup de logiciels nomment la colonne du produit "nom"/"libellé" au lieu
  // de "désignation", ce qui faisait passer un catalogue pour des CLIENTS (la
  // colonne "nom" declenchait la categorie clients). Un catalogue se reconnait
  // a : une colonne de PRIX + un libellé, SANS colonnes de contact client,
  // SANS quantité et SANS numéro de devis/facture (sinon c'est une ligne de
  // devis/facture).
  if (source === 'excel') {
    const has = (keys: string[]) =>
      keys.some(k => headerLower.some(h => h === k || h.includes(k)));
    const hasPrix = has(['prix', 'tarif', 'unit price', 'price']);
    const hasLibelle = has(['désignation', 'designation', 'nom', 'libellé', 'libelle', 'intitulé', 'intitule', 'article', 'produit', 'prestation', 'service']);
    const hasContactClient = has(['email', 'e-mail', 'mail', 'adresse', 'ville', 'téléphone', 'telephone', 'code postal', 'siret']);
    const hasQuantite = has(['quantité', 'quantite', 'qty', 'qte']);
    const hasNumPiece = has(['n° devis', 'numéro devis', 'numero devis', 'n° facture', 'numéro facture', 'devis', 'facture']);
    if (hasPrix && hasLibelle && !hasContactClient && !hasQuantite && !hasNumPiece) {
      return 'prestations';
    }
  }

  let matches: { category: DataCategory; matchCount: number }[] = [];

  for (const [category, categoryConfig] of Object.entries(config.categories) as [DataCategory, CategoryConfig][]) {
    const requiredCols = categoryConfig.requiredColumns.map(c => c.toLowerCase());
    const matchCount = requiredCols.filter(req =>
      headerLower.some(h => h === req || h.includes(req.toLowerCase()))
    ).length;

    if (matchCount > 0) {
      matches.push({ category, matchCount });
    }
  }

  if (matches.length === 0) return null;

  matches.sort((a, b) => b.matchCount - a.matchCount);
  return matches[0].category;
}
