export const fr = {
  common: {
    memeSwap: 'Meme Swap',
    reset: 'Réinitialiser',
    loading: 'Chargement...',
    success: 'Succès',
    error: 'Erreur',
    recommended: 'Recommandé',
    slow: 'Lent',
    change: 'Changer de GIF',
  },
  page: {
    titlePrefix: 'Le FaceSwap',
    titleSuffix: 'Haute Performance',
    subtitle:
      'Remplacez des visages dans des médias animés grâce à un pipeline IA local et sécurisé via FaceFusion.',
    genSettings: 'Paramètres de génération',
    mcpServer: 'Serveur MCP local',
    startSwap: 'Lancer le FaceSwap',
    processing: 'Génération en cours…',
    errorOccurred: "Une erreur s'est produite",
    checkSettings: 'Vérifiez vos paramètres ou les médias fournis.',
    technicalDetails: 'Détails Techniques',
    tipsTitle: 'Conseils pour un meilleur rendu',
    tipsDesc:
      'Assurez-vous que le visage source soit bien éclairé, sans obstruction (ni lunettes, ni cheveux devant les yeux). Pour le média cible, privilégiez un fichier de courte durée.',
    tryTestData: 'Essayer avec les images de test',
    footerText: 'FACEFUSION ENGINE · DESIGN TOKENS UI',
  },
  upload: {
    sourceLabel: 'Visage source',
    sourceDesc: 'Image claire, de face (JPG, PNG)',
    targetLabel: 'Média cible',
    targetDesc: 'GIF ou vidéo MP4 à modifier',
    dragDrop: 'Glissez-déposez ou',
    browse: 'parcourez',
    invalidImage: 'Veuillez déposer une image valide (JPG, PNG, etc.)',
    invalidVideo: 'Veuillez déposer un fichier GIF ou MP4 valide',
    preview: 'Aperçu',
    analyzing: 'Analyse Faciale...',
    deleteFile: 'Supprimer le fichier',
    recentFaces: 'Visages récents',
    noHistory: 'Aucun visage sélectionné récemment.',
  },
  model: {
    title: 'Paramètres du modèle',
    subtitle: 'Configuration FaceFusion, accélération et options',
    presets: {
      title: 'Presets de qualité',
      subtitle: 'Pré-configurations de vitesse et de réalisme',
      low: 'Rapide (Low)',
      medium: 'Équilibré (Medium)',
      high: 'Cinématique (High)',
      custom: 'Personnalisé (Custom)',
    },
    engines: 'Moteurs FaceFusion',
    faceSwapper: 'Face Swapper',
    faceSwapperDesc: "Moteur principal d'échange de visage.",
    faceEnhancer: 'Amélioration du Visage',
    faceEnhancerDesc: 'Restaure les détails et affine la netteté.',
    faceEnhancerBlend: "Intensité de l'amélioration",
    faceEnhancerBlendDesc:
      'Mélange le visage brut et amélioré pour un aspect plus naturel. (Défaut: 80%)',
    frameEnhancer: 'Amélioration globale (Frame)',
    frameEnhancerDesc:
      'Améliore toute la vidéo pour accorder sa netteté avec le visage inséré.',
    expressionRestorer: 'Restauration des expressions',
    expressionRestorerDesc: 'Restaure les expressions faciales et les détails.',
    faceMaskBlend: 'Face Mask Blend',
    faceMaskBlendDesc:
      'Lissage des bords du masque sur le visage cible. (Défaut: 80)',
    acceleration: 'Accélération Matérielle',
    providers: {
      coreml: 'Apple Neural Engine (CoreML)',
      cpu: 'Processeur (CPU)',
      cuda: 'NVIDIA GPU (CUDA)',
    },
    selectorMode: 'Mode du Sélecteur de Visage',
    selectorModes: {
      reference: 'Remplace le visage le plus similaire au visage source.',
      many: 'Remplace tous les visages détectés dans le média cible.',
      one: 'Remplace uniquement le premier visage détecté.',
    },
    performance: 'Performances',
    threadsCpu: 'Threads CPU',
    threadsCount: 'cœurs',
    rec: 'Rec.',
    logLevel: 'Niveau de log',
  },
  mcp: {
    title: 'Serveur MCP local',
    subtitle: 'Model Context Protocol (Faceswap API)',
    checking: 'Vérification...',
    active: 'Actif (Port {port})',
    inactive: 'Inactif',
    desc1:
      "Le protocole MCP permet à votre assistant IA (comme Claude Desktop) de se connecter directement à l'application Meme Swap sur votre Mac.",
    desc2:
      "L'assistant IA pourra exécuter l'outil run_faceswap pour modifier des GIFs/Vidéos de manière autonome avec accélération CoreML locale.",
    claudeConnect: 'Connexion à Claude Desktop',
    step1: '1. Ouvrez le fichier de configuration de Claude :',
    step2: '2. Ajoutez la configuration suivante (SSE) :',
    copied: 'Copié!',
    copy: 'Copier',
    instructionExample: "Exemple d'instruction :",
    exampleText:
      "\"Utilise l'outil run_faceswap pour remplacer le visage dans '/chemin/target.gif' par '/chemin/visage.jpg' et enregistre le résultat.\"",
  },
  process: {
    title: 'Pipeline de traitement',
    subtitle: 'Suivi en temps réel',
    steps: {
      upload: {
        label: 'Téléversement & Validation',
        desc: 'Transfert et vérification de la conformité des fichiers.',
      },
      pre: {
        label: 'Pré-traitement média',
        desc: 'Conversion en flux vidéo MP4 optimisé.',
      },
      inference: {
        label: 'Inférence FaceFusion',
        desc: 'Détection des repères faciaux et échange de visage.',
      },
      final: {
        label: 'Génération finale',
        desc: 'Exportation et encodage au format cible.',
      },
    },
    note: 'Note :',
    noteDesc:
      "L'inférence AI tourne localement via CoreML. Comptez 20s à 1min selon la taille du média.",
    progress: {
      analysing: 'Analyse des visages',
      extracting: 'Extraction des images',
      processing: 'Remplacement des visages',
      merging: 'Fusion finale de la vidéo',
    },
    etaRemaining: '~{time} restant',
  },
  result: {
    title: 'Résultat final',
    layout: {
      slider: 'Glissant',
      sideBySide: 'Côte à côte',
      focus: 'Focus',
    },
    notAvailable: 'Non disponible',
    swapped: 'Swapped',
    original: 'Original',
    sliderTip:
      "Faites glisser le curseur pour comparer l'original et le résultat.",
    mediaOriginal: 'Média original',
    resultSwapped: 'Résultat face-swappé',
    tabOriginal: 'Original',
    tabResult: 'Résultat',
    newSwap: 'Nouveau swap',
    download: 'Télécharger',
  },
  settings: {
    title: "Configuration de l'application",
    save: 'Sauvegarder la configuration',
    giphyKeyLabel: "Clé d'API Giphy",
    giphyKeyPlaceholder: "Collez votre clé d'API Giphy ici...",
    helpTitle: "Comment récupérer une clé d'API Giphy ?",
    helpStep1: '1. Rendez-vous sur le portail développeur Giphy :',
    helpStep2: '2. Connectez-vous ou créez un compte gratuitement.',
    helpStep3:
      "3. Cliquez sur 'Create an App' (Créer une application) dans le tableau de bord.",
    helpStep4:
      "4. Sélectionnez l'option 'API' (et non SDK) puis cliquez sur 'Next Step'.",
    helpStep5:
      "5. Donnez un nom à votre application (ex: 'Meme Swap') et écrivez une courte description.",
    helpStep6: "6. Cliquez sur 'Create App' pour générer votre clé d'API.",
    helpStep7:
      "7. Copiez votre clé d'API (une suite de lettres et chiffres) et collez-la dans le champ de gauche.",
    helpDisclaimer:
      "Note : La clé d'API développeur Giphy est 100% gratuite et propose une limite de requêtes quotidienne largement suffisante pour un usage personnel et développement.",
    savedSuccess: 'Configuration sauvegardée avec succès !',
  },
  giphySearch: {
    tabLibrary: 'Bibliothèque GIF',
    tabUpload: 'Importer un fichier',
    searchPlaceholder: 'Rechercher un GIF amusant...',
    searchButton: 'Rechercher',
    noResults: 'Aucun GIF trouvé. Essayez une autre recherche !',
    offlineBadge: 'Mode Mèmes prédéfinis',
    dropTargetLabel: 'Ou déposez ici pour charger la cible',
    loadingGif: 'Téléchargement du GIF sélectionné...',
    fetchingError:
      'Échec du téléchargement du GIF Giphy. Veuillez vérifier votre connexion internet.',
    selectedBadge: 'Média cible',
    prevPage: 'Précédent',
    nextPage: 'Suivant',
  },
  setup: {
    title: 'Configuration de Meme Swap',
    subtitle:
      "Nous devons installer FaceFusion et ses dépendances avant de pouvoir échanger des visages. Cette étape ne se produit qu'une seule fois et reste sur votre Mac.",
    steps: {
      systemChecks: {
        label: 'Vérification système',
        desc: 'Vérification de Python 3 et de Homebrew, puis installation de FFmpeg via Homebrew.',
      },
      cloneRepo: {
        label: 'Téléchargement de FaceFusion',
        desc: 'Clonage du dépôt du moteur FaceFusion.',
      },
      setupVenv: {
        label: 'Environnement Python',
        desc: 'Création d\'un environnement virtuel isolé.',
      },
      installDeps: {
        label: 'Installation des dépendances',
        desc: 'Installation d\'ONNX CoreML et des paquets Python.',
      },
      verifyInstall: {
        label: 'Vérification finale',
        desc: 'Exécution d\'un échange de visages test pour confirmer que CoreML/onnxruntime fonctionne.',
      },
    },
    logsTitle: "Journal d'installation",
    waitingLogs: "En attente du démarrage de l'installation...",
    readyStatus: "Prêt à démarrer l'installation",
    runningStatus: 'Installation en cours...',
    successStatus: 'Configuration terminée ! Chargement de l\'application...',
    failedStatus: "Échec de l'installation. Consultez les journaux ci-dessus.",
    startButton: "Démarrer l'installation",
    retryButton: 'Réessayer',
    sizeEstimate:
      'Télécharge environ 4 Go de modèles IA au total. Compte généralement 5 à 10 minutes selon votre connexion.',
    diskWarning:
      "Espace disque faible : seulement {free} disponibles. Cette installation peut nécessiter jusqu'à ~8 Go — vous pouvez continuer, mais pensez à libérer de l'espace au préalable.",
    footerNote:
      'Cette étape installe FaceFusion et son environnement virtuel Python dans ~/.meme-swap, et FFmpeg via Homebrew.',
  },
};
