// Game configuration
const GRID_SIZE = 16;
let CELL_SIZE;

// Base class for all game elements
class GameElement {
  constructor(x, y, imageUrl) {
    this.x = x;
    this.y = y;
    this.image = new Image();
    this.loaded = false;

    if (imageUrl) {
      this.loadImage(imageUrl);
    }
  }

  loadImage(url) {
    return new Promise((resolve, reject) => {
      this.image.onload = () => {
        this.loaded = true;
        resolve();
      };
      this.image.onerror = () =>
        reject(new Error(`Failed to load image: ${url}`));
      this.image.src = url;
    });
  }

  draw(ctx) {
    if (this.loaded) {
      ctx.drawImage(
        this.image,
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
    this.ctx = this.canvas.getContext("2d");
    this.avatar = null;
    this.tiles = [];
    this.sprites = [];
    this.items = [];
  }

  async initialize() {
    // Create avatar
    this.avatar = new Avatar(0, 0, "./image.gif");
    await this.avatar.loadImage("./image.gif");

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
        this.ctx.strokeRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }

  gameLoop(timestamp) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw and update game elements
    this.drawGrid();
    this.tiles.forEach((tile) => tile.draw(this.ctx));
    this.sprites.forEach((sprite) => {
      sprite.update(timestamp);
      sprite.draw(this.ctx);
    });
    this.items.forEach((item) => item.draw(this.ctx));
    this.avatar.draw(this.ctx);

    requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
  }
}

// Initialize the game
const game = new GameState();
game.initialize().catch(console.error);
