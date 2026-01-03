# Changelog

Toutes les modifications notables de ce projet sont documentées ici.

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

## [1.1.0] - 2026-01-04

### Ajouté
- System tray avec minimisation dans la barre des tâches
- Protection single-instance (empêche plusieurs fenêtres)
- Système de mise à jour automatique via GitHub Releases
- Modal de confirmation pour quitter sans sauvegarder
- Bouton "Vérifier les mises à jour" dans Paramètres
- Badge notification rouge sur Settings quand une mise à jour est disponible mais reportée
- Smart dismiss: le modal de mise à jour ne réapparaît pas après "Plus tard" (sauf vérification manuelle)
- Persistance du dismiss entre les sessions (localStorage)

### Corrigé
- Bug du logo violet géant dans les suggestions IA
- Nom de l'action Rust dans le workflow CI
- Bug du modal de mise à jour qui ne réapparaissait pas après clic sur "Vérifier"

## [1.0.0] - 2026-01-02

### Ajouté
- Gestion complète du backlog produit (CRUD tickets)
- Génération IA avec Groq (Llama 3.3) et Gemini (1.5 Flash)
- Système de screenshots intégré avec stockage local
- Export des tickets pour clipboard (format Markdown)
- Application desktop Tauri pour Windows
- Vue Kanban avec drag & drop
- Vue liste avec filtres avancés
- Types de tickets dynamiques et personnalisables
- Sélecteur de provider IA (Groq/Gemini)
- Parsing et round-trip Markdown préservant le formatage
- Project Launcher style GitHub Desktop
