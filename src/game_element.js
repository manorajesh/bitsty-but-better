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

  // Updated draw method to account for viewport offset
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
  move(dx, dy, gameState) {
    const newX = this.x + dx;
    const newY = this.y + dy;
    const sprite = gameState.sprites.find(
      (sprite) => sprite.x === newX && sprite.y === newY
    );
    if (sprite) {
      sprite.interact(gameState);
      return false;
    }
    const item = gameState.items.find(
      (item) => item.x === newX && item.y === newY && !item.collected
    );
    if (item) {
      item.collect(gameState);
      this.inventory.push(item);
    }

    // worldTiles is a 1D array, so we need to convert 2D coordinates to 1D
    const wallTile = gameState.worldTiles.find(
      (tile) => tile.x === newX && tile.y === newY && tile.isWall
    );
    if (wallTile) {
      return;
    }

    // Check world boundaries, not just viewport
    if (newX >= 0 && newX < WORLD_SIZE && newY >= 0 && newY < WORLD_SIZE) {
      this.x = newX;
      this.y = newY;
      return true;
    }
    return false;
  }
}

class Tile extends GameElement {
  constructor(x, y, imageUrl, isWall = false) {
    super(x, y, imageUrl);
    this.isWall = isWall;
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

// --- Dialog/Text Effect ---
class DialogBox extends GameElement {
  constructor(text, isColor = false, isRipple = false) {
    super(0, 0, null);
    this.text = text;
    this.words = text.split(" ");
    this.lines = [];
    this.currentLine = 0;
    this.currentChar = 0;
    this.timer = 0;
    this.charDelay = 50;
    this.readyToContinue = false;
    this.isSkipped = false;
    this.isColor = isColor;
    this.isRipple = isRipple;
    this.rippleProgress = 0;
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
    // Call parent update for any frame-related animation
    super.update(timestamp);

    const deltaTime = timestamp - (this.lastDialogUpdate || timestamp);
    this.lastDialogUpdate = timestamp;

    if (this.isRipple || this.isColor) {
      this.rippleProgress += deltaTime * 0.003;
    }

    if (this.readyToContinue) return;

    // If skipped, show entire current line
    if (this.isSkipped) {
      this.currentChar = this.lines[this.currentLine].length;
      this.readyToContinue = true;
      this.isSkipped = false;
      return;
    }

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

  // Override draw from GameElement
  draw(ctx, viewportX = 0, viewportY = 0) {
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    // Draw semi-transparent dialog background at the bottom
    const boxHeight = 100;
    const boxY = canvasHeight - boxHeight - 20;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(10, boxY, canvasWidth - 20, boxHeight);

    ctx.font = "30px BitsyFont";

    for (let i = 0; i <= this.currentLine; i++) {
      const textToDraw =
        i === this.currentLine
          ? this.lines[i].substring(0, this.currentChar)
          : this.lines[i];

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
      if (this.currentLine < this.lines.length - 1) {
        this.currentLine++;
        this.currentChar = 0;
        this.readyToContinue = false;
        this.isSkipped = false; // Reset skip state for next line
      } else {
        // Signal that dialog is finished
        return true;
      }
    }
    return false;
  }
}

// Title Screen for the game
class TitleScreen extends GameElement {
  constructor(title, subtitle = "", instructions = "") {
    super(0, 0, null); // Position doesn't matter for centered elements
    this.title = title;
    this.subtitle = subtitle;
    this.instructions = instructions;
    this.visible = true;
    this.animationProgress = 0;
    this.alpha = 1.0; // For fade transitions

    // Optional decorative elements
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

    // Update animation values
    this.animationProgress += deltaTime * 0.001;

    // Update decoration positions
    this.decorations.forEach((dot) => {
      dot.y = (dot.y + dot.speed * deltaTime * 0.001) % 1;
    });
  }

  draw(ctx, viewportX = 0, viewportY = 0) {
    if (!this.visible) return;

    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    // Draw opaque background
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw decorative animated elements (subtle pixel stars)
    ctx.fillStyle = "#333";
    this.decorations.forEach((dot) => {
      ctx.fillRect(
        dot.x * canvasWidth,
        dot.y * canvasHeight,
        dot.size,
        dot.size
      );
    });

    // Draw title with slight animation effect
    const titleY = canvasHeight * 0.35;
    const titleOffset = Math.sin(this.animationProgress * 2) * 3;

    ctx.font = "40px BitsyFont, monospace";
    ctx.fillStyle = "#FFF";

    // Center align text
    const titleWidth = ctx.measureText(this.title).width;
    ctx.fillText(
      this.title,
      (canvasWidth - titleWidth) / 2,
      titleY + titleOffset
    );

    // Draw subtitle
    if (this.subtitle) {
      ctx.font = "24px BitsyFont, monospace";
      const subtitleWidth = ctx.measureText(this.subtitle).width;
      ctx.fillText(
        this.subtitle,
        (canvasWidth - subtitleWidth) / 2,
        titleY + 60
      );
    }

    // Draw instructions with pulsing effect
    if (this.instructions) {
      // Pulse effect - alpha oscillates between 0.3 and 1.0
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

    // Draw a decorative border
    const borderWidth = Math.min(canvasWidth, canvasHeight) * 0.8;
    const borderHeight = Math.min(canvasWidth, canvasHeight) * 0.6;
    const borderX = (canvasWidth - borderWidth) / 2;
    const borderY = (canvasHeight - borderHeight) / 2;

    ctx.strokeStyle = "#FFF";
    ctx.lineWidth = 3;
    ctx.strokeRect(borderX, borderY, borderWidth, borderHeight);

    // Draw inner border with animation
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
