let GRID_SIZE = 16;
const WORLD_SIZE = 64;
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

    this.currentRoomNumber = 1;
    this.portals = [];
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
    const targetX = 15;
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

    this.portals.forEach((portal) => {
      if (this.isInViewport(portal.x, portal.y)) {
        portal.update(timestamp);
        portal.draw(this.ctx, this.viewportX, this.viewportY, this.debugMode);
      }
    });

    if (this.dialog) {
      this.dialog.update(timestamp);
      this.dialog.draw(this.ctx, this.viewportX, this.viewportY);
    }

    requestAnimationFrame((ts) => this.gameLoop(ts));
  }

  // async initialize() {
  //   console.log("Initializing game...");
  //   const gameManager = new NarrativeGameManager(
  //     "AIzaSyDds9iN85cgeUisvbNUe4mDZlRp663kERc"
  //   );

  //   this.titleScreen = new TitleScreen(
  //     "bitsy but better",
  //     "a little fun demo",
  //     "Press ENTER to start"
  //   );

  //   await this.loadWorld("images/world1.gif");

  //   this.avatar = new Avatar(36, 4, "images/avatar2.gif");
  //   this.items.push(
  //     new Item(12, 12, "images/coin.png", "coin", "You picked up a coin!")
  //   );
  //   this.sprites.push(new Sprite(10, 10, "images/cat.png", "Meow! I'm a cat."));
  //   this.worldTiles.push(new ExitTile(15, 15, "images/door.png"));
  //   this.centerViewportOnAvatar();

  //   console.log("Game initialized.");

  //   this.setupInputHandlers();
  //   this.resizeCanvas();
  //   window.addEventListener("resize", () => this.resizeCanvas());
  //   requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
  // }

  async loadWorld(worldGifUrl) {
    return new Promise((resolve, reject) => {
      try {
        const tempImage = document.createElement("img");
        tempImage.onload = () => {
          const rub = new SuperGif({
            gif: tempImage,
            auto_play: false,
          });

          rub.load(() => {
            const frameCount = rub.get_length();
            if (frameCount < 2) {
              reject(
                new Error(`GIF must have at least 2 frames: ${worldGifUrl}`)
              );
              return;
            }

            rub.move_to(0);
            const bgCanvas = rub.get_canvas();
            this.backgroundImage = new Image();
            this.backgroundImage.src = bgCanvas.toDataURL();

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
        return;
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
        case "KeyE":
          if (GRID_SIZE > 4) {
            GRID_SIZE -= 4;
            this.resizeCanvas();
            this.centerViewportOnAvatar();
          }
          break;
        case "KeyQ":
          if (GRID_SIZE < WORLD_SIZE) {
            GRID_SIZE += 4;
            this.resizeCanvas();
            this.centerViewportOnAvatar();
          }
          break;
        case "Escape":
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

  getPixelColor(x, y) {
    const canvasX = (x - this.viewportX) * CELL_SIZE;
    const canvasY = (y - this.viewportY) * CELL_SIZE;

    const imageData = this.ctx.getImageData(canvasX, canvasY, 1, 1);
    const [r, g, b] = imageData.data;

    return { r, g, b };
  }

  async loadPortalsFromGif(worldGifUrl) {
    return new Promise((resolve, reject) => {
      try {
        const tempImage = document.createElement("img");
        tempImage.onload = () => {
          const rub = new SuperGif({
            gif: tempImage,
            auto_play: false,
          });

          rub.load(() => {
            const frameCount = rub.get_length();
            if (frameCount < 3) {
              console.warn(
                `GIF has less than 3 frames, no portals will be loaded: ${worldGifUrl}`
              );
              resolve();
              return;
            }

            // Start from the third frame (index 2)
            for (
              let frameIndex = 2;
              frameIndex < Math.min(frameCount, 7);
              frameIndex++
            ) {
              // Limit to 5 portals (frames 2-6)
              rub.move_to(frameIndex);
              const canvas = rub.get_canvas();
              const ctx = canvas.getContext("2d");
              const targetRoomNumber = frameIndex - 1; // Map to room numbers 2, 3, 4, etc.

              // Scan the entire image for blue pixels (portals)
              const imageData = ctx.getImageData(
                0,
                0,
                canvas.width,
                canvas.height
              );
              const data = imageData.data;

              // Calculate scaling factors
              const pixelWidth = canvas.width / WORLD_SIZE;
              const pixelHeight = canvas.height / WORLD_SIZE;

              // Track processed portal locations to avoid duplicates
              const processedLocations = new Set();

              for (let y = 0; y < WORLD_SIZE; y++) {
                for (let x = 0; x < WORLD_SIZE; x++) {
                  // Calculate the pixel location in the image (center of the tile)
                  const centerX = Math.floor((x + 0.5) * pixelWidth);
                  const centerY = Math.floor((y + 0.5) * pixelHeight);

                  // Get the index in the imageData array
                  const index = (centerY * canvas.width + centerX) * 4;

                  // Check if this is a blue pixel (portal)
                  if (
                    data[index] === 0 &&
                    data[index + 1] === 0 &&
                    data[index + 2] === 255
                  ) {
                    const locationKey = `${x},${y}`;
                    if (!processedLocations.has(locationKey)) {
                      processedLocations.add(locationKey);

                      // Add a portal at this location
                      const portalId = this.portals.length;
                      const portal = new Portal(
                        x,
                        y,
                        targetRoomNumber,
                        true,
                        portalId
                      );
                      portal.isVisible = true; // Make the portal visible
                      this.portals.push(portal);
                      console.log(
                        `Added portal at ${x},${y} to room ${targetRoomNumber} (Portal ID: ${portalId})`
                      );
                    }
                  }
                }
              }
            }

            resolve();
          });
        };

        tempImage.onerror = () => {
          reject(
            new Error(`Failed to load world GIF for portals: ${worldGifUrl}`)
          );
        };

        tempImage.src = worldGifUrl;
      } catch (error) {
        reject(error);
      }
    });
  }

  // New method to add to GameState class for changing rooms
  async changeRoom(roomNumber) {
    // Save current room items state if needed
    if (this.currentRoomState === undefined) {
      this.currentRoomState = {};
    }

    // Save the state of the current room
    this.currentRoomState[this.currentRoomNumber] = {
      items: this.items.map((item) => ({
        x: item.x,
        y: item.y,
        type: item.type,
        collected: item.collected,
      })),
      sprites: this.sprites.map((sprite) => ({
        x: sprite.x,
        y: sprite.y,
        dialog: sprite.dialog,
      })),
    };

    // Clear existing portals
    this.portals = [];

    // Keep track of the current room
    this.currentRoomNumber = roomNumber;

    // Get the world GIF for this room
    const worldGifUrl = `images/world${roomNumber}.gif`;

    console.log(`Changing to room ${roomNumber}, loading ${worldGifUrl}`);

    // Load the world image
    await this.loadWorld(worldGifUrl);

    // Reset items and sprites for the new room
    // This could be customized based on the room number
    this.items = [];
    this.sprites = [];

    // If we have saved state for this room, restore it
    if (this.currentRoomState[roomNumber]) {
      const roomState = this.currentRoomState[roomNumber];

      // Restore items
      this.items = roomState.items.map((itemData) => {
        const item = new Item(
          itemData.x,
          itemData.y,
          `images/${itemData.type}.png`,
          itemData.type
        );
        item.collected = itemData.collected;
        return item;
      });

      // Restore sprites
      this.sprites = roomState.sprites.map((spriteData) => {
        return new Sprite(
          spriteData.x,
          spriteData.y,
          "images/sprite.png",
          spriteData.dialog
        );
      });
    } else {
      // Default items and sprites for new rooms
      if (roomNumber === 2) {
        this.items.push(
          new Item(8, 8, "images/key.png", "key", "You found a key!")
        );
      } else if (roomNumber === 3) {
        this.sprites.push(
          new Sprite(5, 5, "images/npc.png", "Welcome to room 3!")
        );
      }
    }

    // Set avatar position based on room
    // This could be customized for each room or portal
    const avatarPositions = {
      1: { x: 36, y: 4 },
      2: { x: 5, y: 5 },
      3: { x: 10, y: 10 },
      4: { x: 20, y: 20 },
      5: { x: 30, y: 30 },
    };

    const pos = avatarPositions[roomNumber] || { x: 5, y: 5 };
    this.avatar.x = pos.x;
    this.avatar.y = pos.y;

    // Load portals from the GIF frames
    await this.loadPortalsFromGif(worldGifUrl);

    // Center viewport on avatar
    this.centerViewportOnAvatar();
  }

  // Modifications to the initialize method in GameState
  async initialize() {
    console.log("Initializing game...");
    const gameManager = new NarrativeGameManager(
      "AIzaSyDds9iN85cgeUisvbNUe4mDZlRp663kERc"
    );
    this.titleScreen = new TitleScreen(
      "bitsy but better",
      "a little fun demo",
      "Press ENTER to start"
    );

    // Initialize the current room number
    this.currentRoomNumber = 1;

    // Load the first world
    await this.loadWorld("images/world1.gif");

    this.avatar = new Avatar(36, 4, "images/avatar2.gif");
    this.items.push(
      new Item(
        12,
        12,
        "images/sparkle_big.gif",
        "sparkle",
        "You collected a sparkle!"
      )
    );
    this.sprites.push(new Sprite(10, 10, "images/cat.png", "Meow! I'm a cat."));
    this.worldTiles.push(new ExitTile(15, 15, "images/door.png"));

    // Load portals from the first world GIF
    await this.loadPortalsFromGif("images/world1.gif");

    this.centerViewportOnAvatar();

    console.log("Game initialized.");

    this.setupInputHandlers();
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
    requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
  }
}

const game = new GameState();
game.initialize().catch(console.error);
