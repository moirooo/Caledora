---
name: Hydratation Instagram au changement de route
description: Éviter de réconcilier la sauvegarde Instagram avant le chargement asynchrone des pages WikiBase.
---

Instagram ne doit démarrer sa réconciliation avec WikiBase qu'une fois les pages chargées.

**Why:** une liste de pages temporairement vide au montage peut être confondue avec une suppression réelle. La réconciliation enlève alors les profils WikiBase et leurs publications avant de sauvegarder cet état incomplet.

**How to apply:** lorsqu'un écran Instagram est remonté après une navigation, attendre explicitement la fin du chargement des pages avant de charger ou de réconcilier ses données persistées. Persister les mutations utilisateur au moment de leur validation, sans dépendre uniquement d'un effet après rendu.