---
name: Médias des profils sociaux partagés
description: Règle de persistance des photos et bannières synchronisées entre Instagram et Twitter/X.
---

Les profils sociaux partagés doivent stocker uniquement des identifiants de média canoniques (nom de fichier, chemin d’upload applicatif ou identifiant IndexedDB), jamais une URL rendue par l’interface.

**Why:** les URLs d’affichage dépendent du chemin de l’artefact et ne passent pas la validation de la sauvegarde. Les réenregistrer peut faire disparaître une photo ou une bannière après rechargement.

**How to apply:** lors de toute mutation de profil depuis une interface sociale, garder la valeur de stockage brute séparée de l’URL utilisée pour prévisualiser l’image. Valider et refuser silencieusement les valeurs d’affichage non canoniques plutôt que d’écraser le média existant.