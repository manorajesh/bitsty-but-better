// Game configuration
const GRID_SIZE = 16;
let CELL_SIZE;

// --- Game State Management with Dialog Integration ---

class GameState {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.avatar = null;
    this.tiles = [];
    this.sprites = [];
    this.items = [];
    this.dialog = null; // Active dialog, if any
    this.lastTimestamp = 0;
  }

  async initialize() {
    // Create game elements
    this.avatar = new Avatar(0, 0, "./image.gif");
    this.items.push(new Item(5, 5, "./coin.png", "coin"));

    // Start with a sample dialog message
    this.dialog = new DialogBox("Welcome to the game! Use arrow keys to move.");

    this.setupInputHandlers();
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
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
      // When a dialog is active, use Enter/Space to continue it
      if (this.dialog) {
        if (this.dialog.continue()) {
          this.dialog = null;
        }
        return; // Do not process movement while dialog is active
      }
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
        this.ctx.strokeText(
          `${x},${y}`,
          x * CELL_SIZE + 10,
          y * CELL_SIZE + 10
        );
        this.ctx.strokeRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }

  gameLoop(timestamp) {
    const deltaTime = timestamp - (this.lastTimestamp || timestamp);
    this.lastTimestamp = timestamp;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawGrid();

    // Update and draw game elements
    this.tiles.forEach((tile) => {
      tile.update(timestamp);
      tile.draw(this.ctx);
    });
    this.sprites.forEach((sprite) => {
      sprite.update(timestamp);
      sprite.draw(this.ctx);
    });
    this.items.forEach((item) => {
      item.update(timestamp);
      item.draw(this.ctx);
    });
    this.avatar.update(timestamp);
    this.avatar.draw(this.ctx);

    // If a dialog is active, update and draw it on top
    if (this.dialog) {
      this.dialog.update(deltaTime);
      this.dialog.draw(this.ctx, this.canvas.width, this.canvas.height);
    }

    requestAnimationFrame((ts) => this.gameLoop(ts));
  }
}

// Initialize the game
const game = new GameState();
game.initialize().catch(console.error);
