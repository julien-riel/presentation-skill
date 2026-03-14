# Notes d'intégration — Skill pptx-generator

Recherche effectuée le 14 mars 2026.

---

## 1. Claude Code CLI — Chargement des skills

### Ce qui fonctionne aujourd'hui

**Format SKILL.md.** Chaque skill est un dossier contenant un fichier `SKILL.md` avec deux parties :
- Un frontmatter YAML (entre `---`) contenant au minimum `name` et `description`
- Du contenu Markdown avec les instructions que Claude suit quand le skill est invoqué

Le champ `name` devient la commande slash (ex : `name: pptx-generator` donne `/pptx-generator`).
Le champ `description` aide Claude a decider quand charger automatiquement le skill.

Autres champs frontmatter utiles :
- `disable-model-invocation: true` — le skill ne peut etre invoque que par l'utilisateur (utile pour les workflows avec effets de bord)
- `user-invocable: false` — seul Claude peut invoquer le skill (connaissances de fond)
- `allowed-tools` — restreint les outils disponibles pendant l'execution du skill

**Emplacements de decouverte :**
- `~/.claude/skills/` — skills personnels (tous les projets)
- `.claude/skills/` — skills du projet (commites dans le repo)
- Repertoires ajoutes via `--add-dir` — les skills dans `.claude/skills/` de ces repertoires sont charges automatiquement avec detection de changements en temps reel

**Fichiers de support.** Un skill peut contenir des fichiers supplementaires dans son repertoire (scripts, references, assets). Claude Code fournit automatiquement le chemin de base du repertoire du skill, ce qui permet de localiser les ressources incluses. Les chemins dans SKILL.md doivent correspondre a la structure reelle du repertoire.

Structure type recommandee :
```
mon-skill/
  SKILL.md
  scripts/       # scripts executables (Python, Bash)
  references/    # documentation chargee dans le contexte
  assets/        # templates et fichiers binaires
```

**Recommandation : garder SKILL.md sous 500 lignes.** Pour les references longues (specs API, tables, exemples detailles), les mettre dans des fichiers separes et les referencer depuis SKILL.md.

### Installation depuis un depot Git

Il y a deux mecanismes :

1. **Skill simple (copie manuelle).** Cloner le repo et copier le dossier du skill dans `~/.claude/skills/` ou `.claude/skills/` du projet.

2. **Plugin marketplace.** Les plugins sont distribues via des marketplaces — des depots Git que Claude Code peut cloner. On peut utiliser le marketplace officiel Anthropic ou creer un marketplace prive. Structure d'un plugin :
   ```
   mon-plugin/
     .claude-plugin/
       plugin.json    # obligatoire
     skills/
       mon-skill/
         SKILL.md
     commands/        # optionnel
     agents/          # optionnel
   ```
   Le `.claude-plugin/` doit etre a la racine. Les skills sont prefixes par le nom du plugin (ex : `/mon-plugin:pptx-generator`).

**Contrainte importante sur les chemins :** quand un plugin est installe via marketplace, il est copie dans un cache local (`~/.claude/plugins/cache`). Les references a des fichiers en dehors du repertoire du plugin (ex : `../shared-utils`) ne fonctionnent pas car ces fichiers ne sont pas copies. Tous les assets doivent etre inclus dans le repertoire du plugin.

### Ce qu'il faut faire pour notre skill

- Creer `SKILL.md` a la racine de `pptx-generator/`
- Inclure `assets/default-template.pptx` dans le repertoire du skill (deja le cas)
- S'assurer que tous les chemins dans SKILL.md sont relatifs au repertoire du skill
- Optionnellement : creer un wrapper plugin avec `.claude-plugin/plugin.json` pour la distribution via marketplace

---

## 2. Extension VS Code Claude (par Anthropic)

### Ce qui fonctionne aujourd'hui

L'extension VS Code Claude (marketplace : `anthropic.claude-code`) supporte les skills customs. VS Code lit directement les fichiers de configuration Claude, donc les skills, instructions et hooks fonctionnent de maniere identique entre le CLI et VS Code sans duplication.

**Decouverte des skills :** l'extension utilise les memes mecanismes que le CLI :
- `~/.claude/skills/` pour les skills personnels
- `.claude/skills/` dans le workspace ouvert pour les skills de projet

**Differences avec le CLI :**
- L'interface est integree dans un panneau lateral VS Code avec diffs inline
- Le contexte du workspace VS Code est automatiquement disponible
- Les extensions VS Code peuvent empaqueter et distribuer des skills via le point de contribution `chatSkills`
- La norme Agent Skills ouverte est GA (Generally Available), ce qui signifie que les skills sont portables entre les outils compatibles

### Ce qu'il faut faire pour notre skill

Rien de specifique — si le skill fonctionne avec le CLI Claude Code, il fonctionnera dans VS Code. L'installation est la meme : copier le dossier du skill dans `.claude/skills/` du projet ou `~/.claude/skills/`.

---

## 3. Claude Cowork (par Anthropic)

### Ce qui fonctionne aujourd'hui

Claude Cowork est un agent desktop (Mac et Windows) qui supporte les skills customs. Le format SKILL.md est le meme que pour Claude Code — les skills suivent la norme ouverte Agent Skills et sont portables entre les deux environnements.

**Systeme de plugins.** Cowork utilise un systeme de plugins qui regroupe skills, connecteurs, commandes slash et sous-agents dans un package. Les plugins sont entierement bases sur des fichiers.

**Decouverte et gestion :**
- Cowork a une section "Customize" qui regroupe skills, plugins et connecteurs
- Les admins peuvent creer des marketplaces de plugins prives
- Un plugin `Plugin Create` integre permet de creer des plugins directement dans Cowork sans connaissances techniques
- Les skills peuvent etre partagees : quand une personne decouvre le workflow optimal pour une tache recurrente et le sauvegarde en tant que Skill, toute l'organisation peut le reproduire

**Fonctionnalites entreprise :**
- Taches recurrentes et a la demande
- Connexion a Google Drive, Gmail, DocuSign, FactSet
- Skills preconçues pour certains secteurs (finance, etc.)

### Ce qu'il faut faire pour notre skill

- Le skill devrait fonctionner dans Cowork sans modification si le SKILL.md est au bon format
- Pour une distribution en entreprise, empaqueter le skill dans un plugin Cowork serait recommande
- Tester manuellement dans Cowork pour valider le fonctionnement, notamment l'execution des commandes CLI (`npx tsx src/cli.ts`)

---

## 4. Instructions d'installation recommandees

### Pour Claude Code CLI

```bash
# Option 1 : skill de projet (recommande pour le developpement)
cd mon-projet
mkdir -p .claude/skills
git clone https://github.com/<org>/presentation-skill.git .claude/skills/pptx-generator
cd .claude/skills/pptx-generator/pptx-generator
npm install

# Option 2 : skill personnel (disponible partout)
git clone https://github.com/<org>/presentation-skill.git ~/.claude/skills/pptx-generator
cd ~/.claude/skills/pptx-generator/pptx-generator
npm install

# Option 3 : via --add-dir (temporaire, pour une session)
claude --add-dir /chemin/vers/presentation-skill/pptx-generator
```

### Pour VS Code

Meme chose que le CLI : copier le skill dans `.claude/skills/` du workspace ou `~/.claude/skills/`. L'extension VS Code detecte les memes chemins.

### Pour Cowork

1. Ouvrir la section "Customize" dans Cowork
2. Soit importer le dossier du skill manuellement
3. Soit utiliser un marketplace prive d'entreprise si configure par un admin

---

## 5. Pieges et limitations

| Point | Detail |
|---|---|
| **Chemins relatifs dans les plugins** | Quand un plugin est copie dans le cache (`~/.claude/plugins/cache`), les fichiers en dehors du repertoire du plugin sont inaccessibles. Tous les assets (template .pptx, scripts) doivent etre dans le repertoire du skill. |
| **Taille du SKILL.md** | Garder sous 500 lignes. Deplacer les specs longues dans `references/`. |
| **Execution de commandes** | Le skill depend de `npx tsx` pour executer le CLI TypeScript. L'utilisateur doit avoir Node.js et les dependances installees (`npm install`). |
| **Template binaire** | Le fichier `assets/default-template.pptx` est un binaire. Il doit etre commite dans Git (pas dans `.gitignore`). Verifier qu'il est inclus lors de la copie/installation du skill. |
| **Compatibilite Cowork** | Cowork peut executer des scripts locaux, mais il faut verifier que le chemin vers `node`/`npx` est dans le PATH de l'agent desktop. Cela pourrait poser probleme sur certaines configurations. |
| **Norme Agent Skills** | La norme est GA, donc le format SKILL.md est stable. Toutefois, les champs frontmatter specifiques a Claude Code (`allowed-tools`, `disable-model-invocation`) pourraient ne pas etre reconnus par des outils tiers compatibles Agent Skills. |
| **Pas de hot-reload pour les plugins marketplace** | Les skills dans `.claude/skills/` ou via `--add-dir` supportent le hot-reload. Les plugins installes depuis un marketplace doivent etre mis a jour manuellement. |

---

## 6. Points non confirmes (information insuffisante)

- **Limite de taille totale d'un skill** (nombre de fichiers, taille des binaires) : pas de documentation officielle trouvee sur des limites specifiques au-dela de la recommandation des 500 lignes pour SKILL.md.
- **Comportement exact de Cowork avec des skills qui executent des processus Node.js** : les exemples trouves portent surtout sur des scripts Python/Bash simples ou des skills sans execution de code. A tester empiriquement.
- **Marketplace prive auto-heberge (hors GitHub)** : la documentation mentionne que les URL Git (GitLab, Bitbucket, self-hosted) sont supportees, mais les details de configuration n'ont pas ete trouves.

---

## Sources

- [Extend Claude with skills — Claude Code Docs](https://code.claude.com/docs/en/skills)
- [Create plugins — Claude Code Docs](https://code.claude.com/docs/en/plugins)
- [Plugin marketplaces — Claude Code Docs](https://code.claude.com/docs/en/plugin-marketplaces)
- [Plugins reference — Claude Code Docs](https://code.claude.com/docs/en/plugins-reference)
- [Agent Skills — GitHub (anthropics/skills)](https://github.com/anthropics/skills)
- [Use plugins in Cowork — Claude Help Center](https://support.claude.com/en/articles/13837440-use-plugins-in-cowork)
- [Cowork plugins — Claude Blog](https://claude.com/blog/cowork-plugins)
- [How to create custom Skills — Claude Help Center](https://support.claude.com/en/articles/12512198-how-to-create-custom-skills)
- [Claude Code for VS Code — VS Marketplace](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code)
- [Knowledge work plugins — GitHub (anthropics/knowledge-work-plugins)](https://github.com/anthropics/knowledge-work-plugins)
