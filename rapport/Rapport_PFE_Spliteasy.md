---
title: "Spliteasy : Conception et Réalisation d'une Application Web de Gestion et de Partage des Dépenses de Groupe"
subtitle: "Projet de Fin d'Études — Ingénierie Informatique et Réseaux"
author: "[À COMPLÉTER — Votre nom]"
date: "Année Universitaire 2025-2026"
lang: fr
---

\newpage

# Page de garde

**École Marocaine des Sciences de l'Ingénieur — EMSI**

**PROJET DE FIN D'ÉTUDES**

Filière : Ingénierie Informatique et Réseaux — 3ème Année Cycle d'Ingénieur

---

**Intitulé du projet :**

## Spliteasy : Conception et Réalisation d'une Application Web de Gestion et de Partage des Dépenses de Groupe

---

**Réalisé par :** [À COMPLÉTER — Votre nom]

**Tuteur pédagogique :** [À COMPLÉTER]  ·  EMSI

**Tuteur en entreprise :** [À COMPLÉTER]

**Membres du jury :** [À COMPLÉTER]

**Année Universitaire 2025-2026**

\newpage

# Dédicaces

À mes très chers parents,
Pour votre amour inconditionnel, votre patience et vos sacrifices tout au long de ces années d'études. Rien de tout cela n'aurait été possible sans votre soutien constant.

À ma famille et à mes proches,
Pour vos encouragements permanents et votre confiance qui m'ont porté dans les moments les plus exigeants.

À mes ami(e)s et camarades de promotion,
Avec qui j'ai partagé cette aventure, ses défis et ses réussites.

À l'ensemble du corps professoral de l'EMSI,
Pour la qualité de la formation reçue durant mon cursus d'ingénierie.

À toutes celles et ceux qui, de près ou de loin, ont contribué à l'aboutissement de ce travail, je dédie ce modeste mémoire.

**[À COMPLÉTER — Votre nom]**

\newpage

# Remerciements

Au terme de ce projet de fin d'études, je tiens à exprimer ma profonde gratitude à toutes les personnes qui ont contribué à sa réalisation.

Je remercie tout particulièrement **[À COMPLÉTER — nom de l'encadrant pédagogique]**, mon encadrant à l'École Marocaine des Sciences de l'Ingénieur (EMSI), pour la qualité de son encadrement, sa disponibilité et ses conseils avisés, tant sur le plan technique que méthodologique.

J'adresse également mes remerciements à **[À COMPLÉTER — encadrant entreprise / organisme]** pour son accompagnement et le partage de son expertise tout au long de ce travail.

Mes remerciements s'étendent aux membres du jury pour l'honneur qu'ils me font en acceptant d'évaluer ce travail, ainsi qu'à l'ensemble du corps professoral de l'EMSI pour la formation dispensée durant mon cursus.

Enfin, je remercie chaleureusement ma famille et mes amis pour leur soutien indéfectible.

\newpage

# Résumé

Le projet **Spliteasy** consiste en la conception et la réalisation d'une application web de gestion et de partage des dépenses de groupe. Dans la vie quotidienne — colocations, voyages entre amis, sorties, projets communs — le suivi des dépenses partagées est une source fréquente d'erreurs, d'oublis et de tensions. Les méthodes traditionnelles (tableurs, notes manuelles, calculs mentaux) sont laborieuses, peu fiables et n'offrent aucune traçabilité.

Spliteasy répond à cette problématique en proposant une plateforme centralisée permettant aux utilisateurs de créer des groupes, d'enregistrer des dépenses, de répartir automatiquement les montants entre les membres, de calculer les dettes de manière déterministe, de simplifier les remboursements, d'enregistrer des règlements (settlements) et de consulter l'historique des opérations.

L'application repose sur une architecture client–serveur découplée : un frontend développé avec Next.js et TypeScript, et un backend exposant une API REST construite avec FastAPI, SQLAlchemy et Pydantic, sécurisé par authentification JWT, le tout adossé à une base de données MySQL et conteneurisé avec Docker.

Ce rapport décrit l'ensemble de la démarche : étude du contexte et de l'existant, gestion de projet selon la méthode Agile Scrum, analyse et conception (UML, MCD/MLD), architecture technique, réalisation et, enfin, tests et validation.

**Mots-clés :** Partage de dépenses, FastAPI, Next.js, API REST, JWT, MySQL, Docker, Agile Scrum, UML.

\newpage

# Abstract

The **Spliteasy** project involves the design and implementation of a web application for managing and sharing group expenses. In everyday life — shared flats, trips with friends, outings, joint projects — tracking shared expenses is a frequent source of errors, omissions and tensions. Traditional methods (spreadsheets, manual notes, mental calculations) are tedious, unreliable and offer no traceability.

Spliteasy addresses this issue by providing a centralized platform that allows users to create groups, record expenses, automatically split amounts among members, compute debts deterministically, simplify reimbursements, record settlements, and review the history of operations.

The application is based on a decoupled client–server architecture: a frontend built with Next.js and TypeScript, and a backend exposing a REST API built with FastAPI, SQLAlchemy and Pydantic, secured with JWT authentication, backed by a MySQL database and containerized with Docker.

This report describes the entire process: context and state-of-the-art study, project management using the Agile Scrum methodology, analysis and design (UML, ERD), technical architecture, implementation, and finally testing and validation.

**Keywords:** Expense sharing, FastAPI, Next.js, REST API, JWT, MySQL, Docker, Agile Scrum, UML.

\newpage

# Liste des acronymes

| Acronyme | Signification |
|---|---|
| API | Application Programming Interface |
| CRUD | Create, Read, Update, Delete |
| ERD | Entity-Relationship Diagram |
| HTTP | HyperText Transfer Protocol |
| JWT | JSON Web Token |
| MCD | Modèle Conceptuel de Données |
| MLD | Modèle Logique de Données |
| ORM | Object-Relational Mapping |
| PFE | Projet de Fin d'Études |
| RBAC | Role-Based Access Control |
| REST | Representational State Transfer |
| SGBD | Système de Gestion de Base de Données |
| SPA | Single Page Application |
| SQL | Structured Query Language |
| UML | Unified Modeling Language |
| UI / UX | User Interface / User Experience |

\newpage

# Introduction Générale

La transformation numérique a profondément modifié notre rapport à la gestion financière personnelle et collective. Si les paiements et les transferts d'argent se sont largement dématérialisés, la gestion des dépenses partagées au sein d'un groupe reste, pour de nombreux utilisateurs, un point de friction persistant. Qu'il s'agisse d'un voyage entre amis, d'une colocation, d'un événement familial ou d'un projet commun, la question récurrente demeure la même : « qui a payé quoi, et qui doit combien à qui ? ».

En l'absence d'outil adapté, les utilisateurs recourent à des méthodes manuelles — tableurs, messages, calculs approximatifs — qui présentent plusieurs limites : risque d'erreur élevé, absence de traçabilité, difficulté à équilibrer les comptes lorsque le nombre de participants augmente, et tensions interpersonnelles liées aux oublis ou aux malentendus.

C'est dans ce contexte que s'inscrit le projet Spliteasy, une application web de gestion et de partage des dépenses de groupe. L'objectif est de fournir une solution centralisée, fiable et intuitive permettant de créer des groupes, d'y enregistrer des dépenses, de répartir automatiquement les montants, de calculer les soldes de chaque membre, de simplifier les remboursements et de conserver un historique complet des opérations.

Sur le plan technique, ce projet a été l'occasion de mettre en œuvre une architecture moderne découplée, articulée autour d'un frontend Next.js / TypeScript et d'un backend exposant une API REST avec FastAPI, sécurisé par JWT et adossé à une base de données MySQL, le tout conteneurisé avec Docker afin d'assurer la portabilité et la reproductibilité de l'environnement.

Ce rapport est organisé en six chapitres :

- **Chapitre 1 — Contexte général du projet :** présentation du cadre du projet, étude de l'existant, analyse comparative des solutions concurrentes, formulation de la problématique, définition des objectifs, du cahier des charges et des livrables.
- **Chapitre 2 — Gestion de projet :** méthodologie Agile Scrum, Product Backlog, User Stories, planification des sprints, diagramme de Gantt et gestion des risques.
- **Chapitre 3 — Analyse et conception :** besoins fonctionnels et non fonctionnels, modélisation UML (cas d'utilisation, séquence, classes) et modélisation des données (MCD/MLD).
- **Chapitre 4 — Architecture technique :** architectures frontend et backend, API REST, authentification JWT, gestion des permissions, base de données MySQL et conteneurisation Docker.
- **Chapitre 5 — Réalisation :** présentation de l'implémentation, structure du projet, fonctionnalités clés et interfaces de l'application.
- **Chapitre 6 — Tests et validation :** stratégie de test, tests fonctionnels et tests d'API, cas de test et résultats obtenus.

Le rapport se clôt par une conclusion générale dressant le bilan du projet et présentant les perspectives d'évolution envisagées.

\newpage

# Chapitre 1 : Contexte Général du Projet

> **Résumé :** Ce premier chapitre pose le cadre général du projet Spliteasy. Il présente l'organisme d'accueil et son domaine d'activité, puis situe le contexte du projet et analyse l'existant à travers une étude comparative des solutions concurrentes. Il formule ensuite la problématique à résoudre, définit les objectifs visés, précise le cahier des charges (fonctionnel et technique) ainsi que les contraintes, et énumère enfin les livrables attendus.

## 1.1 Introduction

Toute démarche d'ingénierie logicielle débute par une compréhension fine du contexte et des besoins. Ce chapitre a pour vocation d'établir les fondations du projet Spliteasy : il identifie le problème métier auquel l'application répond, étudie les solutions déjà disponibles sur le marché afin d'en dégager les forces et les limites, et délimite précisément le périmètre fonctionnel et technique du projet. Cette analyse préalable conditionne l'ensemble des choix de conception et de réalisation présentés dans les chapitres suivants.

## 1.2 Présentation de l'organisme d'accueil

*(Section à compléter avec les informations réelles de votre organisme d'accueil.)*

**[À COMPLÉTER]** est une entreprise spécialisée dans **[domaine — ex. le développement d'applications web et mobiles / les services numériques]**. Implantée à **[ville]**, elle accompagne ses clients dans leur transformation numérique en proposant des solutions logicielles sur mesure ainsi que le développement de produits internes innovants.

### 1.2.1 Domaines d'expertise

- **[À COMPLÉTER]** — ex. Développement d'applications web (front-end et back-end).
- **[À COMPLÉTER]** — ex. Conception d'API et de services back-end.
- **[À COMPLÉTER]** — ex. Conseil, hébergement et déploiement (DevOps).

### 1.2.2 Fiche technique

**Tableau 1 : Fiche technique de l'organisme d'accueil**

| Composante | Identification |
|---|---|
| Dénomination | [À COMPLÉTER] |
| Statut juridique | [À COMPLÉTER] |
| Forme juridique | [À COMPLÉTER] |
| Ville / Siège | [À COMPLÉTER] |
| Secteur d'activité | [À COMPLÉTER] |
| N° de RC | [À COMPLÉTER] |
| N° d'ICE | [À COMPLÉTER] |
| Date de création | [À COMPLÉTER] |
| Site web / Contact | [À COMPLÉTER] |

> *Remarque : si le projet a été réalisé dans un cadre purement académique, cette section peut être remplacée par une présentation du cadre du PFE et de la filière Ingénierie Informatique et Réseaux de l'EMSI.*

## 1.3 Contexte du projet

La gestion des dépenses communes est une situation universelle : une part importante des conflits entre colocataires, amis ou groupes de voyageurs trouve son origine dans des désaccords liés à l'argent partagé. Le problème n'est pas tant le montant des sommes en jeu que l'absence d'un système clair, équitable et transparent pour les suivre.

Concrètement, plusieurs difficultés se posent :

- **La dispersion de l'information :** les dépenses sont payées par des personnes différentes, à des moments différents, sans registre unique.
- **La complexité du calcul :** dès que le groupe dépasse trois ou quatre personnes, déterminer manuellement qui doit combien à qui devient fastidieux et source d'erreurs.
- **Le déséquilibre des remboursements :** sans outil de simplification, un groupe de *n* membres peut générer un grand nombre de transactions croisées inutiles.
- **Le manque de traçabilité :** aucune trace fiable ne permet de retrouver l'historique des dépenses et des règlements.

Spliteasy se positionne comme une réponse directe à ces difficultés, en centralisant, automatisant et traçant l'ensemble du cycle de vie d'une dépense partagée.

## 1.4 Étude de l'existant

Le marché propose déjà plusieurs applications de partage de dépenses, dont les plus connues sont Splitwise, Tricount et Settle Up. L'étude de ces solutions permet de comprendre les attentes des utilisateurs, d'identifier les fonctionnalités devenues standards et de repérer les axes de différenciation possibles.

- **Splitwise :** référence du marché, riche en fonctionnalités, mais dont de nombreuses options (limite de dépenses quotidiennes, fonctionnalités avancées) sont passées derrière un abonnement payant.
- **Tricount :** très apprécié pour sa simplicité, particulièrement orienté voyages, mais offrant des fonctionnalités collaboratives et de remboursement plus limitées.
- **Settle Up :** centré sur la simplification des dettes, avec une interface efficace mais une expérience web moins aboutie que le mobile.

Ces solutions, bien que matures, présentent des limites communes : modèle freemium parfois contraignant, personnalisation limitée, absence d'accès libre au code et impossibilité d'adapter l'outil à un contexte spécifique.

## 1.5 Analyse comparative des solutions existantes

Le tableau suivant compare les principales solutions selon des critères fonctionnels et techniques pertinents pour notre projet.

**Tableau 2 : Analyse comparative des solutions existantes**

| Critère | Splitwise | Tricount | Settle Up | Spliteasy (proposé) |
|---|:---:|:---:|:---:|:---:|
| Création de groupes multiples | Oui | Oui | Oui | Oui |
| Enregistrement des dépenses | Oui | Oui | Oui | Oui |
| Répartition (égale / personnalisée) | Oui | Limité | Oui | Oui |
| Calcul automatique des dettes | Oui | Oui | Oui | Oui |
| Simplification des remboursements | Payant | Non | Oui | Oui |
| Règlements (settlements) tracés | Oui | Partiel | Oui | Oui |
| Historique des opérations | Oui | Oui | Oui | Oui |
| Application web complète | Partiel | Oui | Partiel | Oui |
| Gratuit / sans freemium contraignant | Non | Oui | Partiel | Oui |
| Solution maîtrisée / personnalisable | Non | Non | Non | Oui |

**Synthèse :** Spliteasy ne vise pas à concurrencer frontalement ces acteurs établis, mais à proposer une solution web complète, maîtrisée de bout en bout et entièrement personnalisable, reprenant les fonctionnalités devenues standards (groupes, dépenses, calcul des dettes, settlements, historique) tout en s'affranchissant des limitations du modèle freemium. Le projet présente en outre une forte valeur pédagogique : il met en œuvre une architecture moderne découplée et des technologies actuelles (FastAPI, Next.js, JWT, Docker).

## 1.6 Problématique

À la lumière de l'étude précédente, la problématique du projet peut être formulée ainsi :

> *Comment concevoir et réaliser une application web fiable, sécurisée et intuitive, capable de centraliser la gestion des dépenses partagées d'un groupe, de calculer automatiquement et équitablement les dettes entre membres, de simplifier les remboursements et d'assurer une traçabilité complète des opérations ?*

Cette problématique soulève plusieurs sous-questions :

- Comment modéliser les entités du domaine (utilisateurs, groupes, membres, dépenses, parts, règlements) de manière cohérente et évolutive ?
- Quel algorithme adopter pour calculer les soldes et minimiser le nombre de transactions de remboursement ?
- Comment garantir la sécurité des données et le contrôle d'accès aux ressources de chaque groupe ?
- Comment concevoir une architecture performante, maintenable et déployable facilement ?

## 1.7 Objectifs du projet

### 1.7.1 Objectif général

Concevoir et développer Spliteasy, une application web permettant la gestion collaborative et transparente des dépenses partagées au sein de groupes d'utilisateurs.

### 1.7.2 Objectifs spécifiques

- Mettre en place un système d'authentification et de gestion des utilisateurs sécurisé (JWT).
- Permettre la création et la gestion de groupes ainsi que de leurs membres.
- Offrir l'enregistrement de dépenses avec répartition (égale ou personnalisée) entre les participants.
- Implémenter le calcul automatique des dettes et la simplification des remboursements.
- Gérer les règlements (settlements) et leur suivi (en attente, accepté, refusé).
- Fournir un tableau de bord synthétique (solde global, « ce que l'on me doit / ce que je dois »).
- Conserver un historique complet et consultable des opérations.
- Garantir une expérience utilisateur responsive et accessible.

## 1.8 Cahier des charges

### 1.8.1 Besoins fonctionnels (vue d'ensemble)

- Gestion des comptes utilisateurs (inscription, connexion, profil).
- Gestion des groupes (création, modification, suppression, membres).
- Gestion des dépenses (ajout, édition, suppression, catégorisation, répartition).
- Calcul des soldes et des dettes par groupe et au niveau global.
- Simplification et enregistrement des remboursements.
- Consultation de l'historique et du tableau de bord.

*(Ces besoins sont détaillés et formalisés au Chapitre 3.)*

### 1.8.2 Contraintes techniques

- **Frontend :** Next.js (App Router) et TypeScript ; communication via Axios avec intercepteur JWT ; gestion d'état via React Context ; mise en forme via variables CSS et Tailwind CSS.
- **Backend :** API REST avec FastAPI ; couche de persistance SQLAlchemy ; validation des données via Pydantic ; sécurité par JWT.
- **Base de données :** MySQL.
- **Infrastructure :** conteneurisation via Docker et Docker Compose ; gestion de versions via Git et GitHub.
- **Qualité :** code structuré, modulaire et maintenable ; interface responsive ; sécurité des accès.

### 1.8.3 Contraintes non techniques

- Respect des délais fixés par le planning du PFE.
- Documentation technique et fonctionnelle du projet.

## 1.9 Livrables attendus

1. Application web fonctionnelle (frontend + backend) couvrant l'ensemble des fonctionnalités décrites.
2. API REST documentée (documentation interactive générée par FastAPI / OpenAPI).
3. Base de données MySQL structurée et versionnée.
4. Environnement conteneurisé (Docker / Docker Compose) prêt au déploiement.
5. Code source versionné et structuré, hébergé sur GitHub.
6. Rapport de projet de fin d'études documentant la démarche complète.

## 1.10 Conclusion

Ce premier chapitre a permis de poser le cadre du projet Spliteasy. L'étude du contexte et l'analyse comparative des solutions existantes ont mis en évidence un besoin réel et des opportunités de différenciation, tout en confirmant le périmètre fonctionnel attendu d'une application de partage de dépenses. La problématique, les objectifs, le cahier des charges et les livrables étant désormais clairement définis, le chapitre suivant s'attachera à présenter la méthodologie de gestion de projet adoptée pour mener à bien sa réalisation.
