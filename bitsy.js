// Game configuration
const GRID_SIZE = 16;
let CELL_SIZE;

// Base class for all game elements
class GameElement {
  constructor(x, y, imageUrl) {
    this.x = x;
    this.y = y;
    this.frames = [];
    this.frameDelays = []; // Add array to store individual frame delays
    this.currentFrame = 0;
    this.lastFrameTime = 0;
    this.loaded = false;
    this.isGif = false;

    if (imageUrl) {
      this.loadImage(imageUrl);
    }
  }

  async loadImage(url) {
    if (url.toLowerCase().endsWith(".gif")) {
      try {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        await this.decodeGif(buffer);
      } catch (error) {
        console.error("Failed to load GIF:", error);
      }
    } else {
      // Handle regular image loading
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          this.frames = [img];
          this.loaded = true;
          resolve();
        };
        img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
        img.src = url;
      });
    }
  }

  async decodeGif(buffer) {
    return new Promise((resolve, reject) => {
      const tempImage = document.createElement("img");
      const blob = new Blob([buffer], { type: "image/gif" });
      tempImage.src = URL.createObjectURL(blob);

      tempImage.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = tempImage.width;
        canvas.height = tempImage.height;

        const rub = new SuperGif({
          gif: tempImage,
          auto_play: false,
        });

        rub.load(() => {
          const frameCount = rub.get_length();

          // Extract all frames and their delays
          for (let i = 0; i < frameCount; i++) {
            rub.move_to(i);
            const frameCanvas = rub.get_canvas();
            const delay = rub.delay;

            // Store frame and its delay
            const frameImage = new Image();
            frameImage.src = frameCanvas.toDataURL();
            this.frames.push(frameImage);
            this.frameDelays.push(delay);
          }

          this.loaded = true;
          this.isGif = true;

          // Clean up
          URL.revokeObjectURL(tempImage.src);
          resolve();
        });
      };

      tempImage.onerror = () => {
        reject(new Error("Failed to load GIF"));
      };
    });
  }

  update(timestamp) {
    if (this.isGif && this.frames.length > 1) {
      // Get current frame's delay, or use 100ms as fallback
      const delay = this.frameDelays[this.currentFrame] || 100;

      if (timestamp - this.lastFrameTime > delay) {
        this.currentFrame = (this.currentFrame + 1) % this.frames.length;
        this.lastFrameTime = timestamp;
      }
    }
  }

  draw(ctx) {
    if (this.loaded && this.frames.length > 0) {
      ctx.drawImage(
        this.frames[this.currentFrame],
        this.x * CELL_SIZE,
        this.y * CELL_SIZE,
        CELL_SIZE,
        CELL_SIZE
      );
    }
  }
}

// Player character that can move
class Avatar extends GameElement {
  move(dx, dy) {
    const newX = this.x + dx;
    const newY = this.y + dy;

    if (newX >= 0 && newX < GRID_SIZE && newY >= 0 && newY < GRID_SIZE) {
      this.x = newX;
      this.y = newY;
    }
  }
}

// Static background elements
class Tile extends GameElement {
  constructor(x, y, imageUrl, walkable = true) {
    super(x, y, imageUrl);
    this.walkable = walkable;
  }
}

// Animated elements that don't move
class Sprite extends GameElement {
  constructor(x, y, imageUrl, frameCount = 1) {
    super(x, y, imageUrl);
    this.frameCount = frameCount;
    this.currentFrame = 0;
    this.animationSpeed = 100; // ms per frame
    this.lastFrameTime = 0;
  }

  update(timestamp) {
    if (timestamp - this.lastFrameTime > this.animationSpeed) {
      this.currentFrame = (this.currentFrame + 1) % this.frameCount;
      this.lastFrameTime = timestamp;
    }
  }
}

// Collectible elements
class Item extends GameElement {
  constructor(x, y, imageUrl, type) {
    super(x, y, imageUrl);
    this.type = type;
    this.collected = false;
  }

  collect() {
    this.collected = true;
  }

  draw(ctx) {
    if (!this.collected) {
      super.draw(ctx);
    }
  }
}

// Game state management
class GameState {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.avatar = null;
    this.tiles = [];
    this.sprites = [];
    this.items = [];
  }

  async initialize() {
    // Create avatar
    this.avatar = new Avatar(0, 0, "./image.gif");

    // Initialize game elements
    this.setupInputHandlers();
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());

    // Start game loop
    requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
  }

  resizeCanvas() {
    const padding = 20;
    const maxHeight = window.innerHeight - padding * 2;
    const maxWidth = window.innerWidth - padding * 2;

    CELL_SIZE = Math.floor(
      Math.min(maxHeight / GRID_SIZE, maxWidth / GRID_SIZE)
    );

    this.canvas.width = GRID_SIZE * CELL_SIZE;
    this.canvas.height = GRID_SIZE * CELL_SIZE;

    this.canvas.style.position = "absolute";
    this.canvas.style.left = "50%";
    this.canvas.style.top = "50%";
    this.canvas.style.transform = "translate(-50%, -50%)";
  }

  setupInputHandlers() {
    window.addEventListener("keydown", (e) => {
      switch (e.code) {
        case "ArrowUp":
          this.avatar.move(0, -1);
          break;
        case "ArrowDown":
          this.avatar.move(0, 1);
          break;
        case "ArrowLeft":
          this.avatar.move(-1, 0);
          break;
        case "ArrowRight":
          this.avatar.move(1, 0);
          break;
      }
    });
  }

  drawGrid() {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        this.ctx.strokeStyle = "#555";
        // this.ctx.strokeRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }

  gameLoop(timestamp) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw and update game elements
    this.drawGrid();

    // Update and draw tiles
    this.tiles.forEach((tile) => {
      tile.update(timestamp);
      tile.draw(this.ctx);
    });

    // Update and draw sprites
    this.sprites.forEach((sprite) => {
      sprite.update(timestamp);
      sprite.draw(this.ctx);
    });

    // Update and draw items
    this.items.forEach((item) => {
      item.update(timestamp);
      item.draw(this.ctx);
    });

    // Update and draw avatar
    this.avatar.update(timestamp);
    this.avatar.draw(this.ctx);

    requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
  }
}

// Initialize the game
const game = new GameState();
game.initialize().catch(console.error);
