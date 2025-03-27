let GRID_SIZE = 16;
const WORLD_SIZE = 256;
let CELL_SIZE;

class GameState {
  constructor() {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.avatar = null;
    this.worldTiles = [];
    this.sprites = [];
    this.items = [];
    this.dialog = null;
    this.lastTimestamp = 0;

    this.viewportX = 0;
    this.viewportY = 0;

    this.worldMap = Array(WORLD_SIZE)
      .fill()
      .map(() => Array(WORLD_SIZE).fill(0));
  }

  async initialize() {
    await this.loadWorld("images/world.gif");

    this.avatar = new Avatar(8, 8, "images/avatar.gif");
    this.items.push(
      new Item(12, 12, "images/coin.png", "coin", "You picked up a coin!")
    );
    this.sprites.push(new Sprite(10, 10, "images/cat.png", "Meow! I'm a cat."));

    this.centerViewportOnAvatar();

    this.dialog = new DialogBox("Welcome to the game! Use arrow keys to move.");

    this.setupInputHandlers();
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
    requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
  }

  async loadWorld(worldImageUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext("2d");
        tempCtx.drawImage(img, 0, 0);

        // Read the image data to get the red values
        const imageData = tempCtx.getImageData(
          0,
          0,
          img.width,
          img.height
        ).data;

        // Parse the red channel values to determine tile types
        for (let y = 0; y < img.height && y < WORLD_SIZE; y++) {
          for (let x = 0; x < img.width && x < WORLD_SIZE; x++) {
            const pixelIndex = (y * img.width + x) * 4;
            const tileIndex = imageData[pixelIndex]; // Red component
            if (imageData[pixelIndex + 3] === 0) {
              // Skip transparent pixels
              continue;
            }

            this.worldMap[y][x] = tileIndex;

            const tile = new Tile(x, y, `images/tile${tileIndex}.png`, true);
            this.worldTiles.push(tile);
          }
        }
        resolve();
      };
      img.onerror = () =>
        reject(new Error(`Failed to load world image: ${worldImageUrl}`));
      img.src = worldImageUrl;
    });
  }

  resizeCanvas() {
    const padding = 0;
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

  centerViewportOnAvatar() {
    // Center the viewport on the avatar
    this.viewportX = Math.max(
      0,
      Math.min(
        this.avatar.x - Math.floor(GRID_SIZE / 2),
        WORLD_SIZE - GRID_SIZE
      )
    );
    this.viewportY = Math.max(
      0,
      Math.min(
        this.avatar.y - Math.floor(GRID_SIZE / 2),
        WORLD_SIZE - GRID_SIZE
      )
    );
  }

  setupInputHandlers() {
    window.addEventListener("keydown", (e) => {
      if (this.dialog) {
        if (!this.dialog.readyToContinue) {
          this.dialog.skip();
        } else {
          const isFinished = this.dialog.continue();
          if (isFinished) {
            this.dialog = null;
          }
        }
        return;
      }

      let moved = false;
      switch (e.code) {
        case "ArrowUp":
          moved = this.avatar.move(0, -1, this);
          break;
        case "ArrowDown":
          moved = this.avatar.move(0, 1, this);
          break;
        case "ArrowLeft":
          moved = this.avatar.move(-1, 0, this);
          break;
        case "ArrowRight":
          moved = this.avatar.move(1, 0, this);
          break;
        case "KeyA": // Zoom in
          if (GRID_SIZE > 9) {
            GRID_SIZE -= 2;
            this.resizeCanvas();
            this.centerViewportOnAvatar();
          }
          break;
        case "KeyD": // Zoom out
          if (GRID_SIZE < 90) {
            GRID_SIZE += 2;
            this.resizeCanvas();
            this.centerViewportOnAvatar();
          }
          break;
      }

      if (moved) {
        this.centerViewportOnAvatar();
      }
    });
  }

  drawGrid() {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const worldX = x + this.viewportX;
        const worldY = y + this.viewportY;

        this.ctx.strokeStyle = "#555";
        this.ctx.strokeText(
          `${worldX},${worldY}`,
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
    this.ctx.imageSmoothingEnabled = false;
    this.drawGrid();

    // Draw only tiles that are within the viewport
    this.worldTiles.forEach((tile) => {
      if (this.isInViewport(tile.x, tile.y)) {
        tile.update(timestamp);
        tile.draw(this.ctx, this.viewportX, this.viewportY);
      }
    });

    // Draw sprites and items with viewport offset
    this.sprites.forEach((sprite) => {
      if (this.isInViewport(sprite.x, sprite.y)) {
        sprite.update(timestamp);
        sprite.draw(this.ctx, this.viewportX, this.viewportY);
      }
    });

    this.items.forEach((item) => {
      if (this.isInViewport(item.x, item.y)) {
        item.update(timestamp);
        item.draw(this.ctx, this.viewportX, this.viewportY);
      }
    });

    // Draw avatar with viewport offset
    this.avatar.update(timestamp);
    this.avatar.draw(this.ctx, this.viewportX, this.viewportY);

    // If a dialog is active, update and draw it on top
    if (this.dialog) {
      this.dialog.update(deltaTime);
      this.dialog.draw(this.ctx, this.canvas.width, this.canvas.height);
    }

    requestAnimationFrame((ts) => this.gameLoop(ts));
  }

  isInViewport(x, y) {
    return (
      x >= this.viewportX &&
      x < this.viewportX + GRID_SIZE &&
      y >= this.viewportY &&
      y < this.viewportY + GRID_SIZE
    );
  }
}

const game = new GameState();
game.initialize().catch(console.error);
