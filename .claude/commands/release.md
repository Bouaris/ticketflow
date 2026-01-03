---
description: Publie une nouvelle release Ticketflow (bump version, changelog, tag, push)
allowed-tools: Read, Edit, Write, Bash, Glob, Grep
argument-hint: [version] (ex: 1.2.0)
---

# Release Ticketflow v$ARGUMENTS

## Contexte actuel

- Version package.json: !`node -p "require('./package.json').version"`
- Dernier tag git: !`git describe --tags --abbrev=0 2>/dev/null || echo "aucun"`
- Git status: !`git status --short`

---

## Checklist pré-release

Tu dois vérifier chaque point dans l'ordre. Si un point échoue, STOP et indique ce qui manque.

### 1. Valider le numéro de version

La version demandée `$ARGUMENTS` doit:
- Suivre le format semver (X.Y.Z)
- Être supérieure à la version actuelle
- Ne pas déjà exister comme tag git

### 2. Synchroniser les versions

Mettre à jour avec la MÊME version `$ARGUMENTS` dans ces 3 fichiers:
- `package.json` → champ `"version"`
- `src-tauri/Cargo.toml` → champ `version`
- `src-tauri/tauri.conf.json` → champ `"version"`

### 3. Vérifier CHANGELOG.md

Le fichier `CHANGELOG.md` doit contenir:
- Une section `## [$ARGUMENTS]` avec la date du jour (format: YYYY-MM-DD)
- Les changements documentés sous les catégories: Ajouté, Modifié, Corrigé, Supprimé

Si la section n'existe pas, la créer avec les commits depuis le dernier tag.

### 4. Vérifier README.md

- Le badge version doit afficher `$ARGUMENTS`
- La section "Dernière version" doit mentionner v$ARGUMENTS

### 5. Build de vérification

Lancer `pnpm build` et s'assurer qu'il passe sans erreur.

### 6. Git propre

- Tous les fichiers modifiés doivent être stagés
- Pas de fichiers non trackés importants (ignorer node_modules, dist, target)

---

## Actions à exécuter

Si toutes les vérifications passent:

### Étape 1: Commit de release
```bash
git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json CHANGELOG.md README.md
git commit -m "chore: release v$ARGUMENTS"
```

### Étape 2: Créer le tag
```bash
git tag v$ARGUMENTS
```

### Étape 3: Push avec tags
```bash
git push origin master --tags
```

### Étape 4: Confirmation
Afficher:
- Lien vers GitHub Actions: https://github.com/Bouaris/ticketflow/actions
- Lien vers la future release: https://github.com/Bouaris/ticketflow/releases/tag/v$ARGUMENTS

---

## En cas d'erreur

Si une vérification échoue:
1. Indique clairement quel point a échoué
2. Propose une correction automatique si possible
3. NE CONTINUE PAS le processus de release tant que ce n'est pas résolu

---

## Résumé des fichiers touchés

| Fichier | Modification |
|---------|--------------|
| `package.json` | version → $ARGUMENTS |
| `src-tauri/Cargo.toml` | version → $ARGUMENTS |
| `src-tauri/tauri.conf.json` | version → $ARGUMENTS |
| `CHANGELOG.md` | Nouvelle section [$ARGUMENTS] |
| `README.md` | Badge + dernière version |
