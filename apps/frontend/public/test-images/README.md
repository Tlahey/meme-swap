# Test Images

This folder contains test images for the Meme Swap application.

## Required files

To test face swapping, place the following files in this folder:

1. **source.jpg** - The face image to transfer (JPEG or PNG format)
2. **target.gif** - The target GIF where the face will be replaced

## Usage example

Once the files are placed here, you can use them to test the application by running:

```bash
pnpm frontend:dev
```

Then go to `http://localhost:3000` in your browser.

## Notes

- Images should be good quality for the best result
- The source face should be clearly visible and facing the camera
- Short GIFs work best for testing
