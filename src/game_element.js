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
    this.tileIndex = 0;
    this.onLoad = null;
    this.inventory = [];

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
            const delay = 500;
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

  draw(ctx, viewportX = 0, viewportY = 0) {
    if (this.loaded && this.frames.length > 0) {
      const screenX = (this.x - viewportX) * CELL_SIZE;
      const screenY = (this.y - viewportY) * CELL_SIZE;

      if (
        screenX >= -CELL_SIZE &&
        screenX <= ctx.canvas.width &&
        screenY >= -CELL_SIZE &&
        screenY <= ctx.canvas.height
      ) {
        ctx.drawImage(
          this.frames[this.currentFrame],
          screenX,
          screenY,
          CELL_SIZE,
          CELL_SIZE
        );
      }
    }
  }
}

class Avatar extends GameElement {
  /**
   * Checks if the avatar can move to the specified position
   * @param {number} dx - X direction
   * @param {number} dy - Y direction
   * @param {GameState} gameState - Current game state
   * @returns {boolean} - Whether the avatar moved
   */
  move(dx, dy, gameState) {
    const newX = this.x + dx;
    const newY = this.y + dy;

    // Check for world boundaries
    if (newX < 0 || newX >= WORLD_SIZE || newY < 0 || newY >= WORLD_SIZE) {
      return false;
    }

    function isBackgroundColor(color) {
      return color.r === 46 && color.g === 39 && color.b === 102;
    }

    function getNumNonBackgroundAround(x, y) {
      let count = 0;
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          const color = gameState.getPixelColor(x + i, y + j);
          if (
            (i !== 0 || j !== 0) &&
            (color.r !== 46 || color.g !== 39 || color.b !== 102)
          ) {
            count++;
          }
        }
      }
      return count;
    }

    const color = gameState.getPixelColor(newX, newY);
    const numNonBackground = getNumNonBackgroundAround(newX, newY);
    if (
      color.r === 46 &&
      color.g === 39 &&
      color.b === 102 &&
      numNonBackground < 2
    ) {
      console.log(`Blocked by solid tile at (${newX}, ${newY})`);
      return false;
    }
    console.log(
      `Number of non-background pixels around (${newX}, ${newY}):`,
      numNonBackground
    );
    console.log(`Pixel color at (${newX}, ${newY}):`, color);

    // Check for obstructions (solid tiles or sprites)
    const solid = gameState.worldTiles.some(
      (tile) => tile.x === newX && tile.y === newY && tile.solid
    );

    if (solid) {
      return false;
    }

    // The avatar can move, update position
    if (!gameState.isWalkable(newX, newY)) {
      console.log(`Cannot move to (${newX}, ${newY}): Unwalkable`);
      return false;
    }

    // Update position
    this.x = newX;
    this.y = newY;

    // Check for portals but DON'T automatically handle them here
    // This is important - let the main game loop handle portals
    const portal = gameState.portals.find(
      (p) => p.x === this.x && p.y === this.y
    );

    if (portal) {
      console.log(`Player at portal #${portal.portalId}`);
      // Don't change rooms directly here! Let the main game handle it
      // Remove any code that would directly call changeRoom
    }

    return true;
  }
}

class Tile extends GameElement {
  constructor(x, y, imageUrl, isWall = false, isInvisible = false) {
    super(x, y, imageUrl);
    this.isWall = isWall;
    this.isInvisible = isInvisible;
  }

  draw(ctx, viewportX = 0, viewportY = 0) {
    if (!this.isInvisible) {
      super.draw(ctx, viewportX, viewportY);
    }
  }
}

class ExitTile extends GameElement {
  constructor(x, y, imageUrl) {
    super(x, y, imageUrl);
    this.isExit = true;
  }

  interact(gameState) {
    if (this.isExit) {
      gameState.levelComplete = true;
    }
  }
}

class Sprite extends GameElement {
  constructor(x, y, imageUrl, dialog) {
    super(x, y, imageUrl);
    this.dialog = dialog;
  }
  interact(gameState) {
    gameState.dialog = new DialogBox(this.dialog, true, true);
  }
}

class Item extends GameElement {
  constructor(x, y, imageUrl, type, dialog = null) {
    super(x, y, imageUrl);
    this.type = type;
    this.collected = false;
    this.dialog = dialog;
  }

  collect(gameState) {
    this.collected = true;
    if (this.dialog) {
      this.interact(gameState);
    }
  }

  interact(gameState) {
    gameState.dialog = new DialogBox(this.dialog, false, true);
  }

  draw(ctx, viewportX = 0, viewportY = 0) {
    if (!this.collected) {
      super.draw(ctx, viewportX, viewportY);
    }
  }
}

class Portal extends GameElement {
  constructor(x, y, targetRoom, isForward = true, portalId = -1) {
    super(x, y);
    this.targetRoom = targetRoom;
    this.isForward = isForward;
    this.isVisible = false;
    this.portalId = portalId;
  }

  interact(gameState) {
    console.log(`Player chose portal #${this.portalId}`);
    gameState.changeRoom(this.targetRoom);
  }

  draw(ctx, viewportX = 0, viewportY = 0, isDebugMode = false) {
    if (this.isVisible) {
      super.draw(ctx, viewportX, viewportY);
    }

    if (isDebugMode) {
      const screenX = (this.x - viewportX) * CELL_SIZE;
      const screenY = (this.y - viewportY) * CELL_SIZE;

      ctx.fillStyle = this.isForward
        ? "rgba(0,0,255,0.3)"
        : "rgba(0,255,0,0.3)";
      ctx.fillRect(screenX, screenY, CELL_SIZE, CELL_SIZE);
    }
  }
}

class DialogBox extends GameElement {
  constructor(text, isColor = false, isRipple = false, isFirstDialog = false) {
    super(0, 0, null);
    this.text = text;
    this.words = text.split(" ");
    this.lines = [];
    this.currentPage = 0; // Track the current page instead of line
    this.linesPerPage = 2; // Show 2 lines per page
    this.currentLine = 0; // This is now the line within the current page
    this.currentChar = 0;
    this.timer = 0;
    this.charDelay = 50;
    this.readyToContinue = false;
    this.isSkipped = false;
    this.isColor = isColor;
    this.isRipple = isRipple;
    this.rippleProgress = 0;

    // New properties for fade effect
    this.isFirstDialog = isFirstDialog;
    this.isFading = false;
    this.fadeProgress = 0;
    this.fadeSpeed = 0.001; // Controls how fast the fade occurss

    // Add a new property to track if the dialog is completely finished
    this.isCompletelyFinished = false;

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

  update(timestamp) {
    super.update(timestamp);

    const deltaTime = timestamp - (this.lastDialogUpdate || timestamp);
    this.lastDialogUpdate = timestamp;

    if (this.isRipple || this.isColor) {
      this.rippleProgress += deltaTime * 0.003;
    }

    // Handle fade effect
    if (this.isFading) {
      this.fadeProgress += deltaTime * this.fadeSpeed;
      if (this.fadeProgress >= 1) {
        this.fadeProgress = 1;
        // Mark as completely finished when fade is complete
        this.isCompletelyFinished = true;
      }
    }

    if (this.readyToContinue) return;

    if (this.isSkipped) {
      const currentPageLine =
        this.currentPage * this.linesPerPage + this.currentLine;
      if (currentPageLine < this.lines.length) {
        this.currentChar = this.lines[currentPageLine].length;
      }

      // Check if we need to skip to the next line within the page
      if (
        this.currentLine < this.linesPerPage - 1 &&
        currentPageLine + 1 < this.lines.length
      ) {
        this.currentLine++;
        this.currentChar = 0;
        this.isSkipped = true;
      } else {
        this.readyToContinue = true;
        this.isSkipped = false;
      }
      return;
    }

    this.timer += deltaTime;
    if (this.timer >= this.charDelay) {
      const currentPageLine =
        this.currentPage * this.linesPerPage + this.currentLine;

      if (
        currentPageLine < this.lines.length &&
        this.currentChar < this.lines[currentPageLine].length
      ) {
        this.currentChar++;
      } else if (
        this.currentLine < this.linesPerPage - 1 &&
        currentPageLine + 1 < this.lines.length
      ) {
        // Move to the next line within the current page
        this.currentLine++;
        this.currentChar = 0;
      } else {
        this.readyToContinue = true;
      }
      this.timer = 0;
    }
  }

  getRippleOffset(index) {
    const frequency = 0.2;
    const amplitude = 5;
    return Math.sin(frequency * index + this.rippleProgress) * amplitude;
  }

  getRainbowColor(index) {
    const frequency = 0.3;
    const red = Math.sin(frequency * index + this.rippleProgress) * 127 + 128;
    const green =
      Math.sin(frequency * (index + this.rippleProgress * 0.7) + 2) * 127 + 128;
    const blue =
      Math.sin(frequency * (index + this.rippleProgress * 1.3) + 4) * 127 + 128;
    return `rgb(${Math.floor(red)}, ${Math.floor(green)}, ${Math.floor(blue)})`;
  }

  draw(ctx, viewportX = 0, viewportY = 0) {
    // If completely finished, don't draw anything
    if (this.isCompletelyFinished) return;

    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    // If it's the first dialog and not fading, cover the entire screen with black
    if (this.isFirstDialog && !this.isFading) {
      ctx.fillStyle = "rgb(0,0,0)";
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }
    // If it's fading, draw a semi-transparent black overlay
    else if (this.isFirstDialog && this.isFading) {
      const alpha = 1 - this.fadeProgress;
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // If fully faded, don't draw the dialog box
      if (this.fadeProgress >= 0.95) {
        return;
      }
    }

    const boxHeight = 100;
    const boxY = canvasHeight - boxHeight - 20;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(10, boxY, canvasWidth - 20, boxHeight);

    ctx.font = "30px BitsyFont";

    for (let i = 0; i < this.linesPerPage; i++) {
      const lineIndex = this.currentPage * this.linesPerPage + i;
      if (lineIndex >= this.lines.length) break;

      // Determine how much of this line to show
      const textToDraw =
        i === this.currentLine &&
        lineIndex === this.currentPage * this.linesPerPage + this.currentLine
          ? this.lines[lineIndex].substring(0, this.currentChar)
          : i < this.currentLine
          ? this.lines[lineIndex]
          : "";

      let x = 30;
      const baseY = boxY + 40 + i * 30;

      for (let j = 0; j < textToDraw.length; j++) {
        const char = textToDraw[j];

        if (this.isColor) {
          ctx.fillStyle = this.getRainbowColor(j);
        } else {
          ctx.fillStyle = "white";
        }

        const yOffset = this.isRipple ? this.getRippleOffset(j) : 0;
        ctx.fillText(char, x, baseY + yOffset);
        x += ctx.measureText(char).width;
      }
    }

    if (this.readyToContinue) {
      ctx.fillStyle = "white";
      ctx.fillText(">>", canvasWidth - 40, boxY + boxHeight - 10);
    }
  }

  skip() {
    if (!this.readyToContinue) {
      this.isSkipped = true;
    }
  }

  continue() {
    if (this.readyToContinue) {
      const totalPages = Math.ceil(this.lines.length / this.linesPerPage);

      if (this.currentPage < totalPages - 1) {
        // Move to the next page
        this.currentPage++;
        this.currentLine = 0;
        this.currentChar = 0;
        this.readyToContinue = false;
        this.isSkipped = false;
      } else {
        // We've shown all pages
        // If this is the first dialog, start the fade effect
        if (this.isFirstDialog) {
          this.isFading = true;
          return false; // Don't dismiss the dialog until fade is complete
        }
        return true;
      }
    }
    return false;
  }

  // Add a method to check if the dialog is truly finished
  isFinished() {
    return (
      this.isCompletelyFinished ||
      (this.readyToContinue && !this.isFirstDialog) ||
      (this.isFading && this.fadeProgress >= 1)
    );
  }
}

class TitleScreen extends GameElement {
  constructor(title, subtitle = "", instructions = "") {
    super(0, 0, null);
    this.title = title;
    this.subtitle = subtitle;
    this.instructions = instructions;
    this.visible = true;
    this.animationProgress = 0;
    this.alpha = 1.0;

    this.decorations = [];
    for (let i = 0; i < 20; i++) {
      this.decorations.push({
        x: Math.random(),
        y: Math.random(),
        size: Math.random() * 5 + 2,
        speed: Math.random() * 0.5 + 0.1,
      });
    }
  }

  update(timestamp) {
    super.update(timestamp);
    const deltaTime = timestamp - (this.lastTitleUpdate || timestamp);
    this.lastTitleUpdate = timestamp;

    this.animationProgress += deltaTime * 0.001;

    this.decorations.forEach((dot) => {
      dot.y = (dot.y + dot.speed * deltaTime * 0.001) % 1;
    });
  }

  draw(ctx, viewportX = 0, viewportY = 0) {
    if (!this.visible) return;

    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.fillStyle = "#333";
    this.decorations.forEach((dot) => {
      ctx.fillRect(
        dot.x * canvasWidth,
        dot.y * canvasHeight,
        dot.size,
        dot.size
      );
    });

    const titleY = canvasHeight * 0.35;
    const titleOffset = Math.sin(this.animationProgress * 2) * 3;

    ctx.font = "40px BitsyFont, monospace";
    ctx.fillStyle = "#FFF";

    const titleWidth = ctx.measureText(this.title).width;
    ctx.fillText(
      this.title,
      (canvasWidth - titleWidth) / 2,
      titleY + titleOffset
    );

    if (this.subtitle) {
      ctx.font = "24px BitsyFont, monospace";
      // grey
      ctx.fillStyle = "#AAA";
      const subtitleWidth = ctx.measureText(this.subtitle).width;
      ctx.fillText(
        this.subtitle,
        (canvasWidth - subtitleWidth) / 2,
        titleY + 60
      );
    }

    if (this.instructions) {
      const pulse = Math.sin(this.animationProgress * 4) * 0.35 + 0.65;
      ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
      ctx.font = "18px BitsyFont, monospace";
      const instructionsWidth = ctx.measureText(this.instructions).width;
      ctx.fillText(
        this.instructions,
        (canvasWidth - instructionsWidth) / 2,
        canvasHeight * 0.7
      );
    }

    const borderWidth = Math.min(canvasWidth, canvasHeight) * 0.8;
    const borderHeight = Math.min(canvasWidth, canvasHeight) * 0.6;
    const borderX = (canvasWidth - borderWidth) / 2;
    const borderY = (canvasHeight - borderHeight) / 2;

    ctx.strokeStyle = "#FFF";
    ctx.lineWidth = 3;
    ctx.strokeRect(borderX, borderY, borderWidth, borderHeight);

    const innerPulse = Math.sin(this.animationProgress * 2) * 5 + 10;
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      borderX + innerPulse,
      borderY + innerPulse,
      borderWidth - innerPulse * 2,
      borderHeight - innerPulse * 2
    );
  }
}

class LoadingScreen extends GameElement {
  constructor(message = "Loading...") {
    super(0, 0, null);
    this.message = message;
    this.animationProgress = 0;
  }

  update(timestamp) {
    super.update(timestamp);
    const deltaTime = timestamp - (this.lastUpdate || timestamp);
    this.lastUpdate = timestamp;

    this.animationProgress += deltaTime * 0.002;
  }

  draw(ctx) {
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    // Background
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Loading text
    ctx.font = "30px BitsyFont, monospace";
    ctx.fillStyle = "#FFF";

    const text = this.message;
    const textWidth = ctx.measureText(text).width;
    ctx.fillText(text, (canvasWidth - textWidth) / 2, canvasHeight / 2);

    // Analog clock
    const clockRadius = 30;
    const clockX = canvasWidth / 2;
    const clockY = canvasHeight / 2 + 70;

    // Draw clock face
    ctx.beginPath();
    ctx.arc(clockX, clockY, clockRadius, 0, Math.PI * 2);
    ctx.strokeStyle = "#FFF";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw small markers for hours
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const innerRadius = clockRadius - 5;
      const outerRadius = clockRadius - 2;

      ctx.beginPath();
      ctx.moveTo(
        clockX + Math.sin(angle) * innerRadius,
        clockY - Math.cos(angle) * innerRadius
      );
      ctx.lineTo(
        clockX + Math.sin(angle) * outerRadius,
        clockY - Math.cos(angle) * outerRadius
      );
      ctx.strokeStyle = "#FFF";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Calculate hand positions
    const secondsAngle = (this.animationProgress * 6) % (Math.PI * 2);
    const minutesAngle = (this.animationProgress * 0.5) % (Math.PI * 2);
    const hoursAngle = (this.animationProgress * 0.1) % (Math.PI * 2);

    // Draw hour hand
    ctx.beginPath();
    ctx.moveTo(clockX, clockY);
    ctx.lineTo(
      clockX + Math.sin(hoursAngle) * (clockRadius * 0.5),
      clockY - Math.cos(hoursAngle) * (clockRadius * 0.5)
    );
    ctx.strokeStyle = "#FFF";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw minute hand
    ctx.beginPath();
    ctx.moveTo(clockX, clockY);
    ctx.lineTo(
      clockX + Math.sin(minutesAngle) * (clockRadius * 0.7),
      clockY - Math.cos(minutesAngle) * (clockRadius * 0.7)
    );
    ctx.strokeStyle = "#FFF";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw second hand
    ctx.beginPath();
    ctx.moveTo(clockX, clockY);
    ctx.lineTo(
      clockX + Math.sin(secondsAngle) * (clockRadius * 0.9),
      clockY - Math.cos(secondsAngle) * (clockRadius * 0.9)
    );
    ctx.strokeStyle = "#FF3333";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw central dot
    ctx.beginPath();
    ctx.arc(clockX, clockY, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#FFF";
    ctx.fill();
  }
}

class TextInputBox extends GameElement {
  constructor(promptText, placeholder = "") {
    super(0, 0, null);
    this.promptText = promptText;
    this.placeholder = placeholder;
    this.userInput = "";
    this.visible = true;
    this.cursorVisible = true;
    this.cursorBlinkTime = 0;
  }

  update(timestamp) {
    super.update(timestamp);
    const deltaTime = timestamp - (this.lastUpdate || timestamp);
    this.lastUpdate = timestamp;

    this.cursorBlinkTime += deltaTime;
    if (this.cursorBlinkTime > 500) {
      this.cursorVisible = !this.cursorVisible;
      this.cursorBlinkTime = 0;
    }
  }

  draw(ctx) {
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    // Background
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Prompt text
    ctx.font = "24px BitsyFont, monospace";
    ctx.fillStyle = "#FFF";
    const promptWidth = ctx.measureText(this.promptText).width;
    ctx.fillText(
      this.promptText,
      (canvasWidth - promptWidth) / 2,
      canvasHeight / 3
    );

    // Input box
    const boxWidth = canvasWidth * 0.8;
    const boxHeight = 40;
    const boxX = (canvasWidth - boxWidth) / 2;
    const boxY = canvasHeight / 2 - boxHeight / 2;

    ctx.fillStyle = "#111";
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

    // Input text or placeholder
    ctx.font = "18px BitsyFont, monospace";

    if (this.userInput.length > 0) {
      ctx.fillStyle = "#FFF";
      ctx.fillText(this.userInput, boxX + 10, boxY + boxHeight / 2 + 6);

      // Cursor
      if (this.cursorVisible) {
        const textWidth = ctx.measureText(this.userInput).width;
        ctx.fillRect(boxX + 10 + textWidth, boxY + 10, 2, boxHeight - 20);
      }
    } else {
      // Placeholder
      ctx.fillStyle = "#555";
      ctx.fillText(this.placeholder, boxX + 10, boxY + boxHeight / 2 + 6);
    }

    // Instructions
    ctx.font = "16px BitsyFont, monospace";
    ctx.fillStyle = "#AAA";
    const instructionText = "Press Enter when ready";
    const instructionWidth = ctx.measureText(instructionText).width;
    ctx.fillText(
      instructionText,
      (canvasWidth - instructionWidth) / 2,
      boxY + boxHeight + 30
    );
  }

  handleKeyInput(e) {
    if (e.key === "Backspace") {
      this.userInput = this.userInput.slice(0, -1);
    } else if (e.key === "Escape") {
      this.userInput = "";
    } else if (e.key.length === 1) {
      // Single character
      this.userInput += e.key;
    }
  }

  submitInput() {
    const input = this.userInput.trim() || "Adventure in a magical world";
    this.userInput = "";
    return input;
  }
}

class GameOverScreen extends GameElement {
  constructor(description, instructions = "Press ESC to restart") {
    super(0, 0, null);
    this.description = description;
    this.instructions = instructions;
    this.visible = true;
    this.animationProgress = 0;
    this.lines = [];

    // Break description into lines for better display
    const words = description.split(" ");
    const maxCharsPerLine = 40;
    let currentLine = "";

    for (const word of words) {
      if ((currentLine + " " + word).length <= maxCharsPerLine) {
        currentLine += (currentLine ? " " : "") + word;
      } else {
        this.lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) {
      this.lines.push(currentLine);
    }
  }

  update(timestamp) {
    super.update(timestamp);
    const deltaTime = timestamp - (this.lastUpdate || timestamp);
    this.lastUpdate = timestamp;

    this.animationProgress += deltaTime * 0.001;
  }

  draw(ctx) {
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    // Background with vignette effect
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const gradient = ctx.createRadialGradient(
      canvasWidth / 2,
      canvasHeight / 2,
      100,
      canvasWidth / 2,
      canvasHeight / 2,
      canvasHeight
    );
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, "rgba(0,0,0,0.8)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Game over title
    ctx.font = "36px BitsyFont, monospace";
    ctx.fillStyle = "#FF3333";
    const gameOverText = "GAME OVER";
    const gameOverWidth = ctx.measureText(gameOverText).width;
    ctx.fillText(
      gameOverText,
      (canvasWidth - gameOverWidth) / 2,
      canvasHeight / 4
    );

    // Description
    ctx.font = "20px BitsyFont, monospace";
    ctx.fillStyle = "#FFFFFF";

    const lineHeight = 30;
    const startY = canvasHeight / 2 - (this.lines.length * lineHeight) / 2;

    this.lines.forEach((line, index) => {
      const lineWidth = ctx.measureText(line).width;
      ctx.fillText(
        line,
        (canvasWidth - lineWidth) / 2,
        startY + index * lineHeight
      );
    });

    // Instructions
    const pulse = Math.sin(this.animationProgress * 4) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
    ctx.font = "18px BitsyFont, monospace";
    const instructionWidth = ctx.measureText(this.instructions).width;
    ctx.fillText(
      this.instructions,
      (canvasWidth - instructionWidth) / 2,
      canvasHeight * 0.85
    );
  }
}
