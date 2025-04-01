let GRID_SIZE = 16;
const WORLD_SIZE = 128; // Set WORLD_SIZE as a constant
let CELL_SIZE;

function isDebugMode() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("debug") === "true";
}

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
    this.titleScreen = null;
    this.endingScreen = null;
    this.gameStarted = false;
    this.debugMode = isDebugMode();

    this.viewportX = 0;
    this.viewportY = 0;

    // Initialize worldMap with the constant WORLD_SIZE
    this.worldMap = Array(WORLD_SIZE)
      .fill()
      .map(() => Array(WORLD_SIZE).fill(0));
  }

  showEndingScreen() {
    this.endingScreen = new TitleScreen(
      "Congratulations!",
      "You finished the game!",
      "Press ESC to return to the title screen"
    );

    this.endingScreen.visible = true;
  }

  gameLoop(timestamp) {
    const deltaTime = timestamp - (this.lastTimestamp || timestamp);
    this.lastTimestamp = timestamp;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.imageSmoothingEnabled = false;

    if (this.titleScreen && this.titleScreen.visible) {
      this.titleScreen.update(timestamp);
      this.titleScreen.draw(this.ctx);
      requestAnimationFrame((ts) => this.gameLoop(ts));
      return;
    }

    if (this.endingScreen && this.endingScreen.visible) {
      this.endingScreen.update(timestamp);
      this.endingScreen.draw(this.ctx);
      requestAnimationFrame((ts) => this.gameLoop(ts));
      return;
    }
    const targetX = 15; //replace x and y with the actual target coordinates
    const targetY = 15;
    if (this.avatar.x === targetX && this.avatar.y === targetY) {
      this.showEndingScreen();
      return;
    }

    if (this.backgroundImage) {
      const bgScaleX = this.backgroundImage.width / WORLD_SIZE;
      const bgScaleY = this.backgroundImage.height / WORLD_SIZE;

      const sourceX = this.viewportX * bgScaleX;
      const sourceY = this.viewportY * bgScaleY;
      const sourceWidth = GRID_SIZE * bgScaleX;
      const sourceHeight = GRID_SIZE * bgScaleY;

      this.ctx.drawImage(
        this.backgroundImage,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );
    }

    this.debugMode && this.drawGrid();

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

    this.avatar.update(timestamp);
    this.avatar.draw(this.ctx, this.viewportX, this.viewportY);

    // If a dialog is active, update and draw it - now treating it as a GameElement
    if (this.dialog) {
      this.dialog.update(timestamp); // Pass timestamp instead of deltaTime
      this.dialog.draw(this.ctx, this.viewportX, this.viewportY);
    }

    requestAnimationFrame((ts) => this.gameLoop(ts));
  }

  async initialize() {
    this.titleScreen = new TitleScreen(
      "bitsy but better",
      "a little fun demo",
      "Press ENTER to start"
    );

    // Now loading a single GIF instead of separate files
    await this.loadWorld("images/world.gif");

    this.avatar = new Avatar(8, 8, "images/avatar2.gif");
    this.items.push(
      new Item(12, 12, "images/coin.png", "coin", "You picked up a coin!")
    );
    this.sprites.push(new Sprite(10, 10, "images/cat.png", "Meow! I'm a cat."));
    // this.worldTiles.push(new ExitTile(15, 15, "images/exit.png"));
    this.centerViewportOnAvatar();

    this.setupInputHandlers();
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
    requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
  }

  async loadWorld(worldGifUrl) {
    return new Promise((resolve, reject) => {
      try {
        // Load the GIF
        const tempImage = document.createElement("img");
        tempImage.onload = () => {
          // Set up SuperGif
          const rub = new SuperGif({
            gif: tempImage,
            auto_play: false,
          });

          rub.load(() => {
            // Check if we have at least 2 frames in the GIF
            const frameCount = rub.get_length();
            if (frameCount < 2) {
              reject(
                new Error(`GIF must have at least 2 frames: ${worldGifUrl}`)
              );
              return;
            }

            // First frame is the background image
            rub.move_to(0);
            const bgCanvas = rub.get_canvas();
            this.backgroundImage = new Image();
            this.backgroundImage.src = bgCanvas.toDataURL();

            // Second frame contains the tilemap
            rub.move_to(1);
            const tilemapCanvas = rub.get_canvas();
            const tilemapCtx = tilemapCanvas.getContext("2d");
            const imageData = tilemapCtx.getImageData(
              0,
              0,
              tilemapCanvas.width,
              tilemapCanvas.height
            ).data;

            // Scale factors to map from tilemap coords to world coords
            const xScale = WORLD_SIZE / tilemapCanvas.width;
            const yScale = WORLD_SIZE / tilemapCanvas.height;

            // Parse the tilemap frame - read the red channel for tile indices
            // and ignore transparent pixels
            for (let y = 0; y < tilemapCanvas.height; y++) {
              for (let x = 0; x < tilemapCanvas.width; x++) {
                const pixelIndex = (y * tilemapCanvas.width + x) * 4;
                const tileIndex = imageData[pixelIndex]; // Red component
                const alpha = imageData[pixelIndex + 3]; // Alpha component

                // Skip transparent pixels
                if (alpha === 0) {
                  continue;
                }

                // Calculate world coordinates based on scale
                const worldX = Math.floor(x * xScale);
                const worldY = Math.floor(y * yScale);

                console.log(
                  `Tile at (${worldX}, ${worldY}) has index ${tileIndex}`
                );

                // Only create tiles for non-zero indices (assuming 0 is empty)
                if (tileIndex > 0) {
                  const tile = new Tile(
                    worldX,
                    worldY,
                    `images/tile${tileIndex}.png`,
                    true
                  );
                  this.worldTiles.push(tile);
                }
              }
            }

            resolve();
          });
        };

        tempImage.onerror = () => {
          reject(new Error(`Failed to load world GIF: ${worldGifUrl}`));
        };

        tempImage.src = worldGifUrl;
      } catch (error) {
        reject(error);
      }
    });
  }

  resizeCanvas() {
    const padding = 0;
    const maxHeight = window.innerHeight - padding * 2;
    const maxWidth = window.innerWidth - padding * 2;
    CELL_SIZE = Math.round(
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
      if (this.titleScreen && this.titleScreen.visible) {
        if (e.code === "Enter" || e.code === "Space") {
          this.titleScreen.visible = false;
          this.gameStarted = true;

          if (!this.gameStarted) {
            this.dialog = new DialogBox(
              "Welcome to the game! Use arrow keys to move."
            );
            this.gameStarted = true;
          }
          return;
        }
        return; // Don't process other inputs when on title screen
      }

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

      // Handle game controls
      let moved = false;
      switch (e.code) {
        case "ArrowUp":
        case "KeyW":
          moved = this.avatar.move(0, -1, this);
          break;
        case "ArrowDown":
        case "KeyS":
          moved = this.avatar.move(0, 1, this);
          break;
        case "ArrowLeft":
        case "KeyA":
          moved = this.avatar.move(-1, 0, this);
          break;
        case "ArrowRight":
        case "KeyD":
          moved = this.avatar.move(1, 0, this);
          break;
        case "KeyE": // Zoom in
          if (GRID_SIZE > 4) {
            GRID_SIZE -= 4;
            this.resizeCanvas();
            this.centerViewportOnAvatar();
          }
          break;
        case "KeyQ": // Zoom out
          if (GRID_SIZE < WORLD_SIZE) {
            GRID_SIZE += 4;
            this.resizeCanvas();
            this.centerViewportOnAvatar();
          }
          break;
        case "Escape": // Return to title screen
          this.showTitleScreen();
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
        this.ctx.font = "10px sans-serif";
        this.ctx.strokeText(
          `${worldX},${worldY}`,
          x * CELL_SIZE + 10,
          y * CELL_SIZE + 10
        );
        this.ctx.strokeRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }

  isInViewport(x, y) {
    return (
      x >= this.viewportX &&
      x < this.viewportX + GRID_SIZE &&
      y >= this.viewportY &&
      y < this.viewportY + GRID_SIZE
    );
  }

  showTitleScreen() {
    if (this.titleScreen) {
      this.titleScreen.visible = true;
    }
  }
}

const game = new GameState();
game.initialize().catch(console.error);
