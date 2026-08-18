export const AURORA_TIERS = [
  {
    id: 'horizon',
    name: 'Horizon',
    threshold: 'Dès l\'inscription',
    description: 'Le niveau d\'entrée, accordé automatiquement à toute inscription au programme.',
    benefits: ['Cumul de points Aurora', 'Sélection de siège incluse', 'Tarifs Aurora sur une sélection de vols'],
  },
  {
    id: 'meridien',
    name: 'Méridien',
    threshold: '25 000 miles / an',
    description: 'Pour les voyageurs réguliers sur le réseau européen et méditerranéen.',
    benefits: ['Enregistrement prioritaire', 'Franchise bagages +1 pièce', 'Accès aux files prioritaires SkyTeam'],
  },
  {
    id: 'zenith',
    name: 'Zénith',
    threshold: '60 000 miles / an',
    description: 'Le statut le plus reconnu au sein de SkyTeam, pour les grands voyageurs long-courrier.',
    benefits: ['Accès Aurora Lounge et salons SkyTeam', 'Surclassement soumis à disponibilité', 'Ligne dédiée au Terminal 2'],
  },
  {
    id: 'astral',
    name: 'Astral',
    threshold: 'Sur invitation',
    description: 'Un statut confidentiel réservé aux voyageurs les plus fidèles, avec un service personnalisé.',
    benefits: ['Conciergerie dédiée 24/7', 'Accès à l\'espace Première', 'Garantie de disponibilité en Business'],
  },
]

export const AURORA_PARTNERS = [
  'Compagnies partenaires SkyTeam',
  'Chaînes hôtelières partenaires',
  'Sociétés de location de voitures',
  'Partenaires financiers (cartes cobrandées)',
]
