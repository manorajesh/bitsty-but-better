// Game configuration
const GRID_SIZE = 16;
let CELL_SIZE;

// Base class for all game elements
class GameElement {
  constructor(x, y, imageUrl) {
    this.x = x;
    this.y = y;
    this.frames = [];
    this.frameDelays = [];
    this.currentFrame = 0;
    this.lastFrame = 0;
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
          for (let i = 0; i < frameCount; i++) {
            rub.move_to(i);
            const frameCanvas = rub.get_canvas();
            const delay = 300;
            const frameImage = new Image();
            frameImage.src = frameCanvas.toDataURL();
            this.frames.push(frameImage);
            this.frameDelays.push(delay);
          }
          this.loaded = true;
          this.isGif = true;
          URL.revokeObjectURL(tempImage.src);
          resolve();
        });
      };

      tempImage.onerror = () => reject(new Error("Failed to load GIF"));
    });
  }

  update(timestamp) {
    if (this.isGif && this.frames.length > 1) {
      const delay = this.frameDelays[this.currentFrame] || 100;
      if (timestamp - this.lastFrame > delay) {
        this.currentFrame = (this.currentFrame + 1) % this.frames.length;
        this.lastFrame = timestamp;
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
  constructor(x, y, imageUrl, dialog) {
    super(x, y, imageUrl);
    this.dialog = dialog;
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

// --- Dialog/Text Effect ---

class DialogBox {
  constructor(text) {
    this.text = text;
    this.words = text.split(" ");
    this.lines = [];
    this.currentLine = 0;
    this.currentChar = 0;
    this.timer = 0;
    this.charDelay = 50; // milliseconds per character
    this.readyToContinue = false;
    this.prepareDialog();
  }

  prepareDialog() {
    const maxChars = 32;
    let line = "";
    for (const word of this.words) {
      if (line.length + word.length + 1 <= maxChars) {
        line += (line ? " " : "") + word;
      } else {
        this.lines.push(line);
        line = word;
      }
    }
    if (line) this.lines.push(line);
  }

  update(deltaTime) {
    if (this.readyToContinue) return;
    this.timer += deltaTime;
    if (this.timer >= this.charDelay) {
      if (this.currentChar < this.lines[this.currentLine].length) {
        this.currentChar++;
      } else {
        this.readyToContinue = true;
      }
      this.timer = 0;
    }
  }

  draw(ctx, canvasWidth, canvasHeight) {
    // Draw semi-transparent dialog background at the bottom
    const boxHeight = 100;
    const boxY = canvasHeight - boxHeight - 10;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(10, boxY, canvasWidth - 20, boxHeight);

    ctx.fillStyle = "white";
    ctx.font = "16px monospace";
    for (let i = 0; i <= this.currentLine; i++) {
      const textToDraw =
        i === this.currentLine
          ? this.lines[i].substring(0, this.currentChar)
          : this.lines[i];
      ctx.fillText(textToDraw, 20, boxY + 30 + i * 20);
    }

    // Draw an arrow if the current line is complete
    if (this.readyToContinue) {
      ctx.fillText(">>", canvasWidth - 40, boxY + boxHeight - 10);
    }
  }

  continue() {
    if (this.readyToContinue) {
      if (this.currentLine < this.lines.length - 1) {
        this.currentLine++;
        this.currentChar = 0;
        this.readyToContinue = false;
      } else {
        // Signal that dialog is finished
        return true;
      }
    }
    return false;
  }
}

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
