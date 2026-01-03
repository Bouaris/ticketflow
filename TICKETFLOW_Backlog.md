# ticketflow - Product Backlog

> Document de référence pour le développement
> Dernière mise à jour : 2026-01-03

---

## Table des matières
1. [Bugs](#1-bugs)
2. [Court Terme](#2-court-terme)
3. [Long Terme](#3-long-terme)
4. [Autres Idées](#4-autres-idées)
5. [rara](#5-rara)
6. [Légende](#6-legende)

---

## 1. BUGS

### BUG-001 | 🐛 Corriger le problème de chargement d'images
**Composant:** Module de gestion des images
**Module:** Module de gestion des images
**Sévérité:** P1 - Critique
**Effort:** M (Medium)
**Description:** Le système échoue à charger les images de plus de 5MB, provoquant un crash de l'application. Le comportement attendu est que les images de toutes tailles soient chargées sans erreur.

**Spécifications:**
- La taille maximale des images est de 10MB
- Le chargement des images doit être effectué en arrière-plan pour éviter les blocages de l'interface utilisateur

**Critères d'acceptation:**
- [ ] Les images de plus de 5MB sont chargées sans erreur
- [ ] Le système ne plante pas lors du chargement d'images de grandes tailles
- [ ] Le chargement des images est effectué en arrière-plan sans bloquer l'interface utilisateur

**Screenshots:**
![BUG-001_1767455693167](..backlog-assets/screenshots/BUG-001_1767455693167.png)

---

## 2. COURT TERME

---

## 3. LONG TERME

---

## 4. AUTRES IDÉES

---

## 5. RARA

---

## 6. Légende

### Légende Effort

| Code | Signification | Estimation |
|------|---------------|------------|
| XS | Extra Small | < 2h |
| S | Small | 2-4h |
| M | Medium | 1-2 jours |
| L | Large | 3-5 jours |
| XL | Extra Large | 1-2 semaines |

---



### Conventions

- **BUG-XXX** : Bugs
- **CT-XXX** : Court Terme
- **LT-XXX** : Long Terme
- **AUTRE-XXX** : Autres Idées
- **DA-XXX** : rara

---



### Sévérité (Bugs)

| Code | Signification |
|------|---------------|
| P0 | Bloquant - Production down |
| P1 | Critique - Impact majeur |
| P2 | Moyenne - Contournable |
| P3 | Faible - Mineur |
| P4 | Cosmétique |

---



### Priorité (Features)

| Niveau | Signification |
|--------|---------------|
| Haute | Sprint actuel |
| Moyenne | Prochain sprint |
| Faible | Backlog |
