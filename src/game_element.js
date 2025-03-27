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
    this.isSkipped = false; // Add this new property
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
