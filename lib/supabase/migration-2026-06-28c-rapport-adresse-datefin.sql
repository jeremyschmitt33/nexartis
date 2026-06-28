-- Trace (appliquee via MCP "rapport_adresse_parts_date_fin"). Base deja a jour.
-- Adresse en 3 champs (comme devis) + date de fin (intervention sur plusieurs jours).
ALTER TABLE public.rapports_intervention
  ADD COLUMN adresse_rue text,
  ADD COLUMN adresse_cp text,
  ADD COLUMN adresse_ville text,
  ADD COLUMN date_fin date;
