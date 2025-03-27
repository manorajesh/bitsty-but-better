# bitsy but better

An enhanced pixel art game engine inspired by [Bitsy](https://ledoux.itch.io/bitsy), featuring expanded capabilities for creating retro-style adventure games.

![Game Screenshot](docs/screenshot.png)

## Features

- **Seamless World Scrolling**: Explore large 256×256 pixel worlds with a smooth-scrolling viewport
- **Dynamic Animations**: Full support for animated GIFs for characters, items, and tiles
- **Dialog System**: Configurable dialog boxes with special text effects (rainbow colors, ripple animations)
- **World Building**: Create worlds from a two-frame GIF, with background in the first frame and tile layout in the second
- **Interactive Elements**: NPCs with dialog, collectible items, and exit tiles
- **Responsive Design**: Canvas automatically scales to fit the browser window
- **Polished UI**: Title screen and ending screen with animations

## Quick Start

1. Clone the repository
2. Serve the files from a local web server (due to browser security restrictions)
3. Open the game in your browser

```bash
# Example using Python's built-in HTTP server
cd bitsy-but-better
python -m http.server
# Then visit http://localhost:8000 in your browser
```

## Controls

- **Arrow Keys** or **WASD**: Move the avatar
- **Q**: Zoom out (increase viewport size)
- **E**: Zoom in (decrease viewport size)
- **ESC**: Return to title screen
- **Enter/Space**: Interact with dialog boxes
- Add `?debug=true` to the URL to enable debug mode

## Creating Your Own Game

### World Creation

The game world is defined by a special two-frame GIF file:

- **Frame 1**: Background image for the world
- **Frame 2**: Tilemap where the red component of each pixel determines the tile type

For example, a pixel with RGB value `(5,0,0)` will place `tile5.png` at that position.

```javascript
// World loading process:
// 1. First frame becomes the background image
// 2. Second frame's red channel determines tile indices
// 3. Transparent pixels in the second frame are ignored
```

### Adding Game Elements

#### Tiles

Place your tile images in the `images/` directory named as `tile0.png`, `tile1.png`, etc.

#### Avatar

```javascript
// In initialize()
this.avatar = new Avatar(8, 8, "images/avatar.gif");
```

#### Items

```javascript
// In initialize()
this.items.push(
  new Item(12, 12, "images/coin.png", "coin", "You picked up a coin!")
);
```

#### NPCs/Sprites

```javascript
// In initialize()
this.sprites.push(new Sprite(10, 10, "images/cat.png", "Meow! I'm a cat."));
```

## Customization

### Changing the Title Screen

```javascript
// In initialize()
this.titleScreen = new TitleScreen(
  "Your Game Title",
  "A short subtitle",
  "Press ENTER to start"
);
```

### Modifying the Viewport Size

```javascript
// At the top of bitsy.js
let GRID_SIZE = 16; // Default viewport size (16×16 tiles)
```

### Text Effects in Dialog

```javascript
// Create a dialog with rainbow color effect and ripple animation
new DialogBox("This text has special effects!", true, true);
```

## Architecture

The game is built with a component-based architecture:

- `GameState`: Manages the overall game state, rendering, and input
- `GameElement`: Base class for all game objects (avatar, tiles, sprites, items)
- `DialogBox`: Handles text display and animations
- `TitleScreen`: Creates the game's title/menu screen

## License

MIT License - See LICENSE file for details

## Credits

- Font: [PixelFont](link-to-font)
- Inspired by [Bitsy](https://ledoux.itch.io/bitsy) by Adam Le Doux
