# Images de Test

Ce dossier contient les images de test pour l'application Meme Swap.

## Fichiers requis

Pour tester le face swap, placez les fichiers suivants dans ce dossier :

1. **source.jpg** - L'image du visage à transférer (format JPEG ou PNG)
2. **target.gif** - Le GIF cible où le visage sera remplacé

## Exemple d'utilisation

Une fois les fichiers placés ici, vous pouvez les utiliser pour tester l'application en lançant :

```bash
pnpm frontend:dev
```

Puis accédez à `http://localhost:3000` dans votre navigateur.

## Notes

- Les images doivent être de bonne qualité pour un meilleur résultat
- Le visage source doit être clairement visible et face à la caméra
- Les GIFs courts fonctionnent mieux pour le test