let GRID_SIZE = 16;
const WORLD_SIZE = 50;
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

    // Narrative game elements
    this.narrativeManager = null;
    this.currentNarrativeState = null;
    this.isLoadingResponse = false;
    this.loadingScreen = null;
    this.premiseInput = null;
    this.gameOverScreen = null;

    this.viewportX = 0;
    this.viewportY = 0;

    this.currentRoomNumber = 1;
    this.portals = [];

    // Tracks the portal the player is currently at
    this.currentPortal = null;
  }

  showEndingScreen() {
    this.endingScreen = new TitleScreen(
      "Congratulations!",
      "You finished the game!",
      "Press ESC to return to the title screen"
    );

    this.endingScreen.visible = true;
  }

  showGameOverScreen(description) {
    this.gameOverScreen = new GameOverScreen(
      description,
      "Press ESC to restart"
    );
    this.gameOverScreen.visible = true;
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

    if (this.loadingScreen && this.isLoadingResponse) {
      this.loadingScreen.update(timestamp);
      this.loadingScreen.draw(this.ctx);
      requestAnimationFrame((ts) => this.gameLoop(ts));
      return;
    }

    if (this.premiseInput && this.premiseInput.visible) {
      this.premiseInput.update(timestamp);
      this.premiseInput.draw(this.ctx);
      requestAnimationFrame((ts) => this.gameLoop(ts));
      return;
    }

    if (this.gameOverScreen && this.gameOverScreen.visible) {
      this.gameOverScreen.update(timestamp);
      this.gameOverScreen.draw(this.ctx);
      requestAnimationFrame((ts) => this.gameLoop(ts));
      return;
    }

    if (this.endingScreen && this.endingScreen.visible) {
      this.endingScreen.update(timestamp);
      this.endingScreen.draw(this.ctx);
      requestAnimationFrame((ts) => this.gameLoop(ts));
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

          this.showPremiseInput();
          return;
        }
        return;
      }

      if (this.premiseInput && this.premiseInput.visible) {
        if (e.code === "Enter") {
          const premise = this.premiseInput.submitInput();
          this.startNarrativeGame(premise);
          return;
        }
        this.premiseInput.handleKeyInput(e);
        return;
      }

      if (this.gameOverScreen && this.gameOverScreen.visible) {
        if (e.code === "Escape") {
          this.gameOverScreen.visible = false;
          this.showPremiseInput();
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

            // if (this.currentPortal) {
            //   this.currentPortal = null;
            // }
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
        case "KeyT":
          if (this.currentPortal) {
            console.log(
              "Making choice at portal:",
              this.currentPortal.portalId
            );
            this.makeNarrativeChoice(this.currentPortal.portalId);
          } else if (this.currentNarrativeState) {
            this.dialog = new DialogBox(
              "You need to be at a portal to make a choice.",
              false,
              false
            );
          }
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
          if (this.endingScreen && this.endingScreen.visible) {
            this.showPremiseInput();
            this.endingScreen.visible = false;
          } else {
            this.showTitleScreen();
          }
          break;
      }

      if (moved) {
        this.centerViewportOnAvatar();

        const portal = this.portals.find(
          (portal) => portal.x === this.avatar.x && portal.y === this.avatar.y
        );

        if (portal) {
          if (portal.targetRoom === -1 && this.currentNarrativeState) {
            console.log("Narrative portal found:", portal);
            const choiceIndex = portal.portalId;
            if (choiceIndex < this.currentNarrativeState.choices.length) {
              const choice = this.currentNarrativeState.choices[choiceIndex];
              this.currentPortal = portal;

              // console.log("Displaying choice:", choice);
              // console.log("Choice title:", choice.title);
              // console.log("Choice description:", choice.description);

              this.dialog = new DialogBox(
                `${choice.title || "Option " + (choiceIndex + 1)} - ${
                  choice.description || "this option is empty..."
                }\n\n -- (Press T to choose this option)`,
                false,
                false
              );
            } else {
              console.warn(
                `Invalid choice index: ${choiceIndex}. Only ${this.currentNarrativeState.choices.length} choices available.`
              );
            }
          } else if (portal.targetRoom > 0) {
            this.changeRoom(portal.targetRoom);
          }
        }
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
    const canvasX = Math.floor(
      (x - this.viewportX) * CELL_SIZE + CELL_SIZE / 2
    );
    const canvasY = Math.floor(
      (y - this.viewportY) * CELL_SIZE + CELL_SIZE / 2
    );

    if (
      canvasX < 0 ||
      canvasX >= this.canvas.width ||
      canvasY < 0 ||
      canvasY >= this.canvas.height
    ) {
      return { r: 0, g: 0, b: 0 }; // Default to black if out of bounds
    }

    const imageData = this.ctx.getImageData(canvasX, canvasY, 1, 1);
    const [r, g, b] = imageData.data;

    console.log(`Pixel color at (${x}, ${y}):`, { r, g, b }); // Debugging
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

            for (
              let frameIndex = 2;
              frameIndex < Math.min(frameCount, 7);
              frameIndex++
            ) {
              rub.move_to(frameIndex);
              const canvas = rub.get_canvas();
              const ctx = canvas.getContext("2d");
              const targetRoomNumber = frameIndex - 1;

              const imageData = ctx.getImageData(
                0,
                0,
                canvas.width,
                canvas.height
              );
              const data = imageData.data;

              const pixelWidth = canvas.width / WORLD_SIZE;
              const pixelHeight = canvas.height / WORLD_SIZE;

              const processedLocations = new Set();

              for (let y = 0; y < WORLD_SIZE; y++) {
                for (let x = 0; x < WORLD_SIZE; x++) {
                  const centerX = Math.floor((x + 0.5) * pixelWidth);
                  const centerY = Math.floor((y + 0.5) * pixelHeight);

                  const index = (centerY * canvas.width + centerX) * 4;

                  if (
                    data[index] === 0 &&
                    data[index + 1] === 0 &&
                    data[index + 2] === 255
                  ) {
                    const locationKey = `${x},${y}`;
                    if (!processedLocations.has(locationKey)) {
                      processedLocations.add(locationKey);

                      const portalId = this.portals.length;
                      const portal = new Portal(
                        x,
                        y,
                        targetRoomNumber,
                        true,
                        portalId
                      );
                      portal.isVisible = true;
                      this.portals.push(portal);
                    }
                  }
                }
              }
              console.log(
                `Loaded ${this.portals.length} portals from ${worldGifUrl}`
              );
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

  async startNarrativeGame(premise) {
    this.premiseInput.visible = false;
    this.isLoadingResponse = true;
    this.loadingScreen = new LoadingScreen("Generating your adventure...");

    try {
      const initialState = await this.narrativeManager.startGame(premise);
      this.currentNarrativeState = initialState;

      this.isLoadingResponse = false;
      this.loadingScreen = null;
      this.dialog = new DialogBox(initialState.description, false, false);

      const numChoices = initialState.choices.length;
      const worldNumber = Math.min(Math.max(numChoices, 1), 5);
      await this.changeRoom(worldNumber);
    } catch (error) {
      console.error("Error starting narrative game:", error);
      this.isLoadingResponse = false;
      this.dialog = new DialogBox(
        "Error starting game. Please try again.",
        false,
        false
      );
      setTimeout(() => {
        this.dialog = null;
        this.showPremiseInput();
      }, 3000);
    }
  }

  async makeNarrativeChoice(choiceIndex) {
    if (
      !this.currentNarrativeState ||
      choiceIndex >= this.currentNarrativeState.choices.length
    ) {
      return;
    }

    const choice = this.currentNarrativeState.choices[choiceIndex];
    this.dialog = null;
    this.currentPortal = null;

    if (choice.isGameOver) {
      this.showGameOverScreen(choice.gameOverDescription);
      return;
    }

    this.isLoadingResponse = true;
    this.loadingScreen = new LoadingScreen(`${choice.timePassed}...`);

    try {
      const nextState = await this.narrativeManager.makeChoice(choiceIndex);
      this.currentNarrativeState = nextState;

      this.isLoadingResponse = false;
      this.loadingScreen = null;
      this.dialog = new DialogBox(nextState.description, false, false);

      const numChoices = nextState.choices.length;
      const worldNumber = Math.min(Math.max(numChoices, 1), 5);
      await this.changeRoom(worldNumber);
    } catch (error) {
      console.error("Error making narrative choice:", error);
      this.isLoadingResponse = false;
      this.dialog = new DialogBox(
        "Error processing your choice. Please try again.",
        false,
        false
      );
    }
  }

  showPremiseInput() {
    this.premiseInput = new TextInputBox(
      "Enter your story premise:",
      "Type your premise here..."
    );
    this.premiseInput.visible = true;
  }

  async changeRoom(roomNumber) {
    if (this.currentRoomState === undefined) {
      this.currentRoomState = {};
    }
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
    this.portals = [];
    this.currentRoomNumber = roomNumber;

    const worldGifUrl = `images/world${roomNumber}.gif`;

    console.log(`Changing to room ${roomNumber}, loading ${worldGifUrl}`);

    await this.loadWorld(worldGifUrl);

    this.items = [];
    this.sprites = [];

    if (this.currentNarrativeState) {
      await this.createNarrativePortals();
    } else if (this.currentRoomState[roomNumber]) {
      const roomState = this.currentRoomState[roomNumber];

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

      this.sprites = roomState.sprites.map((spriteData) => {
        return new Sprite(
          spriteData.x,
          spriteData.y,
          "images/sprite.png",
          spriteData.dialog
        );
      });
    } else {
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

    const avatarPositions = {
      1: { x: 25, y: 25 },
      2: { x: 25, y: 25 },
      3: { x: 25, y: 25 },
      4: { x: 25, y: 25 },
      5: { x: 25, y: 25 },
    };

    const pos = avatarPositions[roomNumber] || { x: 25, y: 25 };
    this.avatar.x = pos.x;
    this.avatar.y = pos.y;

    if (!this.currentNarrativeState) {
      await this.loadPortalsFromGif(worldGifUrl);
    }

    this.centerViewportOnAvatar();
  }

  async createNarrativePortals() {
    if (!this.currentNarrativeState || !this.currentNarrativeState.choices) {
      return;
    }

    const worldGifUrl = `images/world${this.currentRoomNumber}.gif`;

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
                `GIF has less than 3 frames, no portals will be loaded for narrative choices: ${worldGifUrl}`
              );
              resolve();
              return;
            }

            for (
              let frameIndex = 2;
              frameIndex <
              Math.min(
                frameCount,
                2 + this.currentNarrativeState.choices.length
              );
              frameIndex++
            ) {
              rub.move_to(frameIndex);
              const canvas = rub.get_canvas();
              const ctx = canvas.getContext("2d");
              const choiceIndex = frameIndex - 2;

              const imageData = ctx.getImageData(
                0,
                0,
                canvas.width,
                canvas.height
              );
              const data = imageData.data;

              const pixelWidth = canvas.width / WORLD_SIZE;
              const pixelHeight = canvas.height / WORLD_SIZE;

              const processedLocations = new Set();

              for (let y = 0; y < WORLD_SIZE; y++) {
                for (let x = 0; x < WORLD_SIZE; x++) {
                  const centerX = Math.floor((x + 0.5) * pixelWidth);
                  const centerY = Math.floor((y + 0.5) * pixelHeight);

                  const index = (centerY * canvas.width + centerX) * 4;

                  if (
                    data[index] === 0 &&
                    data[index + 1] === 0 &&
                    data[index + 2] === 255
                  ) {
                    const locationKey = `${x},${y}`;
                    if (!processedLocations.has(locationKey)) {
                      processedLocations.add(locationKey);

                      const portal = new Portal(x, y, -1, true, choiceIndex);
                      portal.isVisible = true;
                      this.portals.push(portal);
                    }
                  }
                }
              }
            }

            console.log(
              `Created ${this.portals.length} narrative portals from ${worldGifUrl}`
            );
            resolve();
          });
        };

        tempImage.onerror = () => {
          reject(
            new Error(
              `Failed to load world GIF for narrative portals: ${worldGifUrl}`
            )
          );
        };

        tempImage.src = worldGifUrl;
      } catch (error) {
        reject(error);
      }
    });
  }

  async initialize() {
    console.log("Initializing game...");

    this.narrativeManager = new NarrativeGameManager(
      "AIzaSyDds9iN85cgeUisvbNUe4mDZlRp663kERc"
    );

    this.titleScreen = new TitleScreen(
      "What's Next?",
      "made with love, tears, and all nighters",
      "Press ENTER to start"
    );

    this.avatar = new Avatar(25, 25, "images/yellow.gif");

    this.centerViewportOnAvatar();

    console.log("Game initialized.");

    this.setupInputHandlers();
    this.resizeCanvas();
    window.addEventListener("resize", () => this.resizeCanvas());
    requestAnimationFrame((timestamp) => this.gameLoop(timestamp));
  }
  isWalkable(x, y) {
    const { r, g, b } = this.getPixelColor(x, y);
    return !(r === 49 && g === 36 && b === 102); // Return false for unwalkable
  }
}

const game = new GameState();
game.initialize().catch(console.error);
