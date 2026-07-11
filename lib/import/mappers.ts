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
  const config = SOURCE_CONFIGS[source];

  // ═══════════════════════════════════════════════════════════════════════
  // EXCEL / CSV GENERIQUE  →  moteur de detection SEMANTIQUE multi-signaux.
  // C'est la source "fourre-tout" utilisee pour tous les exports qu'on ne
  // reconnait pas comme Obat/Tolteck/Henrri/Batappli. On ne peut donc PAS se
  // fier au seul nom des colonnes : on raisonne sur la STRUCTURE (present /
  // absent) via des familles de synonymes FR + EN, singulier + pluriel, avec
  // et sans accents. Le nom de fichier ne fait que RENFORCER le score.
  // ═══════════════════════════════════════════════════════════════════════
  if (source === 'excel') {
    return detectCategoryExcel(headers, sheetName, config);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SOURCES SPECIFIQUES (obat, obat_comptable, tolteck, henrri, batappli)
  // Comportement HISTORIQUE inchange : nom de fichier exact, puis scoring par
  // requiredColumns. On ne touche a rien ici (non-cassant garanti).
  // ═══════════════════════════════════════════════════════════════════════
  const headerLower = headers.map(h => h.toLowerCase().trim());

  // ─── PRIORITE AU NOM DE FICHIER ───
  if (sheetName) {
    const stripExt = (s: string) => s.toLowerCase().trim().replace(/\.(csv|xlsx|xls)$/, '');
    const fstem = stripExt(sheetName);
    for (const [category, categoryConfig] of Object.entries(config.categories) as [DataCategory, CategoryConfig][]) {
      if (categoryConfig.possibleFileNames.some(n => stripExt(n) === fstem)) {
        return category;
      }
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

// ─── Normalise un nom de fichier / d'onglet en "stem" (sans extension) ───
function normalizeFileStem(sheetName?: string): string {
  return (sheetName || '').toLowerCase().trim().replace(/\.(csv|xlsx|xls|tsv)$/, '');
}

// ═══════════════════════════════════════════════════════════════════════════
// DETECTION SEMANTIQUE POUR LA SOURCE 'excel'
//
// Principe : un fichier est range d'apres ce que ses COLONNES revelent, pas
// d'apres un nom exact. On calcule des "flags" structurels (familles de
// synonymes), puis :
//   1) une REGLE DURE distingue une LIGNE (quantite + designation, SANS
//      contact) d'un DOCUMENT — c'est LE correctif du bug (64 lignes de
//      factures importees comme faux devis) ;
//   2) le nom de fichier exact reste un raccourci non-cassant ;
//   3) sinon un SCORING pondere tranche, le nom de fichier ajoutant un bonus.
//
// Contraintes techniques : tsconfig sans `target` → PAS de spread d'iterateur
// (on reste sur des tableaux + boucles). Familles de synonymes accentuees ET
// non accentuees (pas de .normalize a l'execution). Aucune regex a flags ES6.
// ═══════════════════════════════════════════════════════════════════════════
function detectCategoryExcel(headers: string[], sheetName: string | undefined, config: SourceConfig): DataCategory | null {
  const H = headers.map(h => (h || '').toLowerCase().trim()).filter(h => h.length > 0);
  if (H.length === 0) return null;

  const fstem = normalizeFileStem(sheetName);

  // Un token est cherche en "contient" (robuste aux prefixes/suffixes du type
  // "date d'emission", "n° facture"...) ou en "egal" (pour les tokens tres
  // courts/ambigus comme "nom", "u", "site" qu'on ne veut pas voir matcher
  // "prenom" ou "worksite").
  const containsAny = (tokens: string[]): boolean =>
    tokens.some(t => H.some(h => h.indexOf(t) !== -1));
  const exactAny = (tokens: string[]): boolean =>
    tokens.some(t => H.some(h => h === t));

  // ─────────────────────────── FLAGS STRUCTURELS ───────────────────────────
  // Quantite PAR LIGNE : signal le plus discriminant (un document n'en a pas).
  const hasQuantite = containsAny(['quantité', 'quantite', 'quantity', 'qty', 'qté', 'qte']);

  // Designation d'un article/prestation.
  const hasDesignationStrong = containsAny([
    'désignation', 'designation', 'libellé', 'libelle', 'intitulé', 'intitule',
    'article', 'produit', 'prestation', 'item',
  ]);
  const hasDesignationAny = hasDesignationStrong
    || exactAny(['nom', 'name', 'description', 'label', 'service', 'détail', 'detail']);

  // Infos de CONTACT (email/adresse/ville/CP/tel/SIRET) → identifie un TIERS.
  const hasEmail = containsAny(['email', 'e-mail', 'courriel', 'mail']);
  const hasAdresse = containsAny(['adresse', 'address', 'rue', 'street']);
  const hasVille = containsAny(['ville', 'city', 'localité', 'localite', 'commune', 'town']);
  const hasCP = containsAny(['code postal', 'code_postal', 'postal code', 'zip']) || exactAny(['cp']);
  const hasTel = containsAny(['téléphone', 'telephone', 'phone', 'mobile', 'portable', 'gsm']) || exactAny(['tel', 'tél']);
  const hasSiret = containsAny(['siret', 'siren']);
  const hasContact = hasEmail || hasAdresse || hasVille || hasCP || hasTel || hasSiret;

  // Reference au DOCUMENT PARENT (indispensable pour trancher une LIGNE).
  const refFacture = containsAny(['numéro facture', 'numero facture', 'n° facture', 'n°facture', 'invoice number', 'facture', 'invoice']);
  const refDevis = containsAny(['numéro devis', 'numero devis', 'n° devis', 'n°devis', 'quote number', 'devis', 'quote']);

  // Numero de piece / reference generique.
  // NB : 'number' en MOT EXACT uniquement (sinon "phone number" ferait un faux
  // positif de numero de piece via la sous-chaine "number").
  const hasNumero = containsAny(['numéro', 'numero'])
    || exactAny(['number', 'n°', 'ref', 'réf', 'reference', 'référence']);

  // Nom du client rattache (present dans un document ; PAS une info de contact).
  const hasClient = exactAny(['client', 'customer', 'clients', 'customers'])
    || containsAny(['nom client', 'nom du client', 'customer name', 'client name']);

  const hasDate = containsAny(['date', 'échéance', 'echeance', 'due']);
  const hasDateDebutFin = containsAny(['date début', 'date debut', 'date fin', 'start date', 'end date'])
    || exactAny(['début', 'debut', 'fin']);

  // Montants de DOCUMENT (totaux) vs total generique.
  const hasMontantHT = containsAny(['montant ht', 'total ht', 'net amount']) || exactAny(['subtotal', 'net']);
  const hasMontantTTC = containsAny(['montant ttc', 'total ttc']) || exactAny(['gross', 'gross amount']);
  const hasMontantDoc = hasMontantHT || hasMontantTTC;
  const hasMontantGeneric = hasMontantDoc || exactAny(['montant', 'amount', 'somme', 'total']);

  const hasPrix = containsAny(['prix', 'tarif', 'unit price', 'price', 'cost']) || exactAny(['pu', 'pu ht']);

  // Signaux propres a la FACTURE.
  const hasEcheance = containsAny(['échéance', 'echeance', 'due date']);
  const hasPaiementInfo = containsAny(['payé', 'paye', 'paid', 'réglé', 'regle', 'date paiement', 'payment date', 'date règlement', 'date reglement']);
  // 'avoir' exige en MOT EXACT : sinon "pouvoir"/"savoir"/"avoirs" declencheraient
  // un faux signal facture via la sous-chaine "avoir".
  const hasAvoirSituation = exactAny(['avoir']) || containsAny(['situation']);
  const factureSignal = refFacture || hasEcheance || hasPaiementInfo || hasAvoirSituation;

  // Signaux propres au DEVIS.
  const hasValidite = containsAny(['validité', 'validite', 'valid until', 'validity']);
  const hasAcompte = containsAny(['acompte', 'deposit', 'advance']);
  const hasAccepteRefuse = containsAny(['accepté', 'accepte', 'refusé', 'refuse', 'accepted', 'refused']);
  const hasObjet = exactAny(['objet', 'sujet', 'subject']);
  const devisSignal = refDevis || hasValidite || hasAcompte || hasAccepteRefuse || hasObjet;

  const hasNom = exactAny(['nom', 'name', 'raison sociale'])
    || containsAny(['raison sociale', 'last name', 'lastname', 'surname', 'nom complet', 'nom du tiers', 'société', 'societe', 'entreprise']);
  const hasPrenom = containsAny(['prénom', 'prenom', 'first name', 'firstname', 'given name']);
  const hasTitre = exactAny(['titre', 'title', 'dénomination', 'denomination']);

  const hasChantierCol = containsAny(['chantier', 'worksite', 'projet', 'project']) || exactAny(['site', 'sites']);

  const hasMetier = containsAny(['métier', 'metier', 'trade', 'profession']) || exactAny(['job']);
  const hasContrat = containsAny(['contrat', 'contract', 'employment']);
  const hasTauxHoraire = containsAny(['taux horaire', 'tarif horaire', 'hourly rate']);
  const hasIntervenantCol = containsAny(['intervenant', 'ouvrier', 'worker']) || exactAny(['employee', 'employé', 'employe']);

  const hasCreneau = containsAny(['créneau', 'creneau', 'time slot']) || exactAny(['slot']);
  const hasHeure = containsAny(['heure', 'start time', 'end time']);

  const hasMethode = containsAny(['méthode', 'methode', 'payment method', 'mode de paiement', 'mode de règlement', 'mode de reglement']) || exactAny(['method', 'mode']);

  const hasFournisseurWord = containsAny(['fournisseur', 'supplier', 'vendor']);
  const hasAchatWord = containsAny(['achat', 'purchase', 'commande']) || exactAny(['order', 'orders']);

  const hasUnite = exactAny(['unité', 'unite', 'unit', 'u', 'um']) || containsAny(['unité de vente', 'unit of measure']);
  const hasReference = containsAny(['référence', 'reference', 'code article', 'code produit']) || exactAny(['code', 'ref', 'réf']);
  const hasCategorie = containsAny(['catégorie', 'categorie', 'category', 'famille', 'rubrique']) || exactAny(['type', 'groupe', 'group']);
  const hasTvaRate = containsAny(['tva', 'taux tva', 'taux de tva', 'vat', 'tax rate', 'tax']);

  // ─────────────────── 1) REGLE DURE : LIGNE vs DOCUMENT ────────────────────
  // Une LIGNE de devis/facture = quantite PAR LIGNE + designation, et AUCUNE
  // info de contact. Un document (devis/facture) n'a jamais de quantite par
  // ligne ; un catalogue (prestations) n'a jamais de quantite. Donc :
  //   quantite + designation + pas de contact  ⇒  c'est une LIGNE.
  // On choisit ensuite le sous-type via le document parent, puis le nom de
  // fichier, puis les signaux, avec devis_lignes en repli historique.
  // 0) RACCOURCI CATALOGUE : un catalogue de prestations peut legitimement avoir
  // une colonne "quantite" (quantite par defaut). Si le NOM DE FICHIER evoque un
  // catalogue/tarif ET qu'aucune reference a un document parent n'est presente,
  // c'est un catalogue de prestations, pas des lignes de devis. On tranche AVANT
  // la regle dure LIGNE pour eviter un faux classement en devis_lignes.
  const prestaFileHint = ['catalog', 'catalogue', 'prestation', 'tarif', 'price', 'service']
    .some(s => fstem.indexOf(s) !== -1);
  if (prestaFileHint && !refFacture && !refDevis) return 'prestations';

  // Une LIGNE de devis/facture = quantite PAR LIGNE + designation, et AUCUNE
  // info de contact NI mot-cle fournisseur. Le mot "fournisseur" n'est PAS un
  // contact : sans cette garde, un bon de commande "achats.csv" [Fournisseur,
  // Chantier, Date, Article, Quantite, Montant HT] serait pris pour des lignes de
  // devis. On l'exclut donc de la regle dure pour le laisser retomber sur le nom
  // de fichier / le scoring (ou 'achats' gagne).
  if (hasQuantite && hasDesignationAny && !hasContact && !hasFournisseurWord) {
    if (refFacture && !refDevis) return 'facture_lignes';
    if (refDevis && !refFacture) return 'devis_lignes';
    if (fstem.indexOf('facture') !== -1 || fstem.indexOf('invoice') !== -1) return 'facture_lignes';
    if (fstem.indexOf('devis') !== -1 || fstem.indexOf('quote') !== -1) return 'devis_lignes';
    if (factureSignal && !devisSignal) return 'facture_lignes';
    if (devisSignal && !factureSignal) return 'devis_lignes';
    return 'devis_lignes'; // repli unique LIGNE = devis_lignes (coherent avec le scoring)
  }

  // ─────────── 2) NOM DE FICHIER EXACT (raccourci non-cassant) ───────────────
  // Garantit que clients.csv / prestations.csv / fournisseurs.csv / devis.csv /
  // factures.csv / devis_lignes.csv continuent d'etre routes exactement comme
  // avant. Place APRES la regle dure : un fichier de lignes mal nomme (ex.
  // "factures.csv" contenant en fait des lignes) est deja intercepte ci-dessus.
  const stripExt = (s: string) => s.toLowerCase().trim().replace(/\.(csv|xlsx|xls|tsv)$/, '');
  if (fstem) {
    for (const [category, categoryConfig] of Object.entries(config.categories) as [DataCategory, CategoryConfig][]) {
      if (categoryConfig.possibleFileNames.some(n => stripExt(n) === fstem)) {
        return category;
      }
    }
  }

  // ─────────────────────────── 3) SCORING PONDERE ───────────────────────────
  const scores: Record<DataCategory, number> = {
    clients: 0, devis: 0, factures: 0, devis_lignes: 0, facture_lignes: 0,
    chantiers: 0, prestations: 0, fournisseurs: 0, intervenants: 0,
    planning: 0, paiements: 0, achats: 0,
  };

  // clients : identite + contact, mais NI prix, NI quantite, NI document.
  if (hasEmail) scores.clients += 2;
  if (hasAdresse) scores.clients += 1;
  if (hasVille) scores.clients += 1;
  if (hasCP) scores.clients += 1;
  if (hasTel) scores.clients += 1;
  if (hasSiret) scores.clients += 2;
  if (hasNom) scores.clients += 1;
  if (hasPrenom) scores.clients += 1;
  if (hasPrix) scores.clients -= 3;
  if (hasQuantite) scores.clients -= 4;
  if (refFacture || refDevis) scores.clients -= 3;
  if (hasMontantDoc) scores.clients -= 2;
  if (hasMetier) scores.clients -= 2;

  // fournisseurs : meme profil de contact + mot-cle "fournisseur/supplier".
  // Sans mot-cle, fournisseurs reste sous clients → clients par defaut.
  if (hasEmail) scores.fournisseurs += 2;
  if (hasAdresse) scores.fournisseurs += 1;
  if (hasVille) scores.fournisseurs += 1;
  if (hasCP) scores.fournisseurs += 1;
  if (hasTel) scores.fournisseurs += 1;
  if (hasSiret) scores.fournisseurs += 2;
  if (hasNom) scores.fournisseurs += 1;
  if (hasFournisseurWord) scores.fournisseurs += 5;
  if (hasPrix) scores.fournisseurs -= 2;
  if (hasQuantite) scores.fournisseurs -= 4;
  if (refFacture || refDevis) scores.fournisseurs -= 3;

  // prestations (catalogue) : designation + prix, SANS quantite/contact/doc/date.
  if (hasDesignationStrong) scores.prestations += 3;
  else if (hasDesignationAny) scores.prestations += 1;
  if (hasPrix) scores.prestations += 3;
  if (hasUnite) scores.prestations += 1;
  if (hasTvaRate) scores.prestations += 1;
  if (hasReference) scores.prestations += 1;
  if (hasCategorie) scores.prestations += 1;
  if (hasQuantite) scores.prestations -= 5;
  if (hasContact) scores.prestations -= 3;
  if (refFacture || refDevis) scores.prestations -= 3;
  if (hasDate) scores.prestations -= 2;
  if (hasMontantDoc) scores.prestations -= 2;
  if (hasClient) scores.prestations -= 2;

  // devis (document) : numero + client + date + montants, SANS quantite/ligne.
  if (hasNumero) scores.devis += 2;
  if (hasClient) scores.devis += 2;
  if (hasDate) scores.devis += 1;
  if (hasMontantDoc) scores.devis += 2;
  else if (hasMontantGeneric) scores.devis += 1;
  if (devisSignal) scores.devis += 3;
  if (hasQuantite) scores.devis -= 5;
  if (factureSignal && !devisSignal) scores.devis -= 2;
  if (hasContact) scores.devis -= 1;

  // factures (document) : idem devis mais signaux facture (echeance/paye/...).
  if (hasNumero) scores.factures += 2;
  if (hasClient) scores.factures += 2;
  if (hasDate) scores.factures += 1;
  if (hasMontantDoc) scores.factures += 2;
  else if (hasMontantGeneric) scores.factures += 1;
  if (factureSignal) scores.factures += 4;
  if (hasQuantite) scores.factures -= 5;
  if (devisSignal && !factureSignal) scores.factures -= 2;
  if (hasContact) scores.factures -= 1;

  // lignes (repli du scoring ; la regle dure les capte en priorite).
  const lineBase = (hasDesignationAny ? 2 : 0) + (hasQuantite ? 4 : 0)
    + (hasPrix ? 1 : 0) - (hasContact ? 4 : 0) - (hasMontantDoc ? 2 : 0);
  scores.devis_lignes += lineBase + (refDevis ? 3 : 0) + (devisSignal ? 1 : 0);
  scores.facture_lignes += lineBase + (refFacture ? 3 : 0) + (factureSignal ? 1 : 0);

  // chantiers : titre + client + adresse chantier + dates, mot-cle chantier.
  if (hasChantierCol) scores.chantiers += 3;
  if (hasTitre) scores.chantiers += 2;
  if (hasClient) scores.chantiers += 1;
  if (hasAdresse) scores.chantiers += 1;
  if (hasDateDebutFin) scores.chantiers += 1;
  if (hasPrix) scores.chantiers -= 2;
  if (hasQuantite) scores.chantiers -= 3;
  if (refFacture || refDevis) scores.chantiers -= 2;
  if (hasMontantDoc) scores.chantiers -= 2;

  // intervenants : prenom/nom + metier + contrat + taux horaire.
  if (hasMetier) scores.intervenants += 3;
  if (hasContrat) scores.intervenants += 2;
  if (hasTauxHoraire) scores.intervenants += 2;
  if (hasPrenom) scores.intervenants += 1;
  if (hasNom) scores.intervenants += 1;
  if (hasMontantDoc) scores.intervenants -= 3;
  if (refFacture || refDevis) scores.intervenants -= 3;
  if (hasQuantite) scores.intervenants -= 3;

  // planning : chantier + intervenant + dates/heures/creneau.
  if (hasCreneau) scores.planning += 3;
  if (hasHeure) scores.planning += 2;
  if (hasIntervenantCol) scores.planning += 2;
  if (hasChantierCol) scores.planning += 1;
  if (hasTitre) scores.planning += 1;
  if (hasDateDebutFin) scores.planning += 1;
  if (hasPrix) scores.planning -= 2;
  if (hasMontantDoc) scores.planning -= 2;
  if (hasQuantite) scores.planning -= 2;

  // paiements : reference facture + montant + date paiement + methode.
  if (hasMethode) scores.paiements += 3;
  if (hasMontantGeneric) scores.paiements += 2;
  if (hasPaiementInfo) scores.paiements += 2;
  if (hasDate) scores.paiements += 1;
  if (refFacture || hasNumero) scores.paiements += 1;
  if (hasQuantite) scores.paiements -= 3;
  if (hasDesignationStrong) scores.paiements -= 2;
  if (hasContact) scores.paiements -= 2;

  // achats : fournisseur + date + montant (+ chantier) ; refere un fournisseur.
  if (hasFournisseurWord) scores.achats += 3;
  if (hasAchatWord) scores.achats += 2;
  if (hasMontantDoc) scores.achats += 2;
  if (hasDate) scores.achats += 1;
  if (hasChantierCol) scores.achats += 1;
  if (hasDesignationAny) scores.achats += 1;
  if (hasFournisseurWord && hasMontantDoc && !hasContact) scores.achats += 2;
  if (hasQuantite) scores.achats -= 2;
  if (hasClient && !hasFournisseurWord) scores.achats -= 2;
  if (refDevis) scores.achats -= 2;

  // ─────────── Bonus NOM DE FICHIER (conforte, ne decide pas seul) ───────────
  if (fstem) {
    const nameHas = (subs: string[]): boolean => subs.some(s => fstem.indexOf(s) !== -1);
    const isLineName = nameHas(['ligne', 'detail', 'détail', 'lines', 'line', 'article', 'item']);
    if (isLineName && nameHas(['facture', 'invoice'])) scores.facture_lignes += 6;
    else if (isLineName && nameHas(['devis', 'quote'])) scores.devis_lignes += 6;
    if (nameHas(['fournisseur', 'supplier', 'vendor'])) scores.fournisseurs += 6;
    if (nameHas(['prestation', 'service', 'catalog', 'catalogue', 'price', 'tarif', 'articles'])) scores.prestations += 5;
    if (nameHas(['client', 'customer'])) scores.clients += 5;
    if (nameHas(['contact']) && !nameHas(['fournisseur'])) scores.clients += 2;
    if (!isLineName && nameHas(['devis', 'quote', 'estimate'])) scores.devis += 5;
    if (!isLineName && nameHas(['facture', 'invoice'])) scores.factures += 5;
    if (nameHas(['achat', 'purchase', 'commande', 'order'])) scores.achats += 5;
    if (nameHas(['chantier', 'projet', 'project', 'worksite', 'site'])) scores.chantiers += 5;
    if (nameHas(['intervenant', 'worker', 'employee', 'salarie', 'salarié', 'ouvrier', 'team', 'equipe', 'équipe'])) scores.intervenants += 5;
    if (nameHas(['planning', 'schedule', 'calendar', 'calendrier', 'agenda'])) scores.planning += 5;
    if (nameHas(['paiement', 'payment', 'reglement', 'règlement', 'transaction'])) scores.paiements += 5;
  }

  // ─── Argmax avec ordre de priorite en cas d'egalite stricte ───
  // On exige au moins 1 point de "preuve" (sinon on rend null, comme l'ancien
  // code rendait null sans requiredColumns). L'ordre place les categories
  // structurellement specifiques AVANT les generiques (clients = repli ultime).
  // Ordre de priorite en cas d'EGALITE stricte de score :
  //  - 'devis_lignes' AVANT 'facture_lignes' : repli unique des lignes ambigues
  //    (coherent avec la regle dure qui replie aussi sur devis_lignes).
  //  - 'clients' AVANT 'fournisseurs' : a profil de contact identique et SANS
  //    mot-cle fournisseur, un tiers pro est un CLIENT. 'fournisseurs' ne gagne
  //    que par un vrai signal (+5 mot-cle / +6 nom de fichier), jamais par egalite.
  const priority: DataCategory[] = [
    'devis_lignes', 'facture_lignes', 'paiements', 'achats', 'planning',
    'intervenants', 'chantiers', 'prestations', 'clients', 'devis',
    'factures', 'fournisseurs',
  ];
  let best: DataCategory | null = null;
  let bestScore = 0;
  for (let i = 0; i < priority.length; i++) {
    const cat = priority[i];
    if (scores[cat] > bestScore) {
      bestScore = scores[cat];
      best = cat;
    }
  }
  return best;
}
