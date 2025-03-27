const GRID_SIZE = 16; // Cells per row/column
let CELL_SIZE; // Cell pixel size will be dynamic

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Resize handler
function resizeCanvas() {
  const padding = 20; // Padding from window edges
  const maxHeight = window.innerHeight - padding * 2;
  const maxWidth = window.innerWidth - padding * 2;

  // Calculate cell size based on available space
  CELL_SIZE = Math.floor(Math.min(maxHeight / GRID_SIZE, maxWidth / GRID_SIZE));

  // Update canvas size
  canvas.width = GRID_SIZE * CELL_SIZE;
  canvas.height = GRID_SIZE * CELL_SIZE;

  // Center canvas
  canvas.style.position = "absolute";
  canvas.style.left = "50%";
  canvas.style.top = "50%";
  canvas.style.transform = "translate(-50%, -50%)";
}

// Game loop
function gameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  requestAnimationFrame(gameLoop);
}

// Add new variables for GIF handling
let gifImage = new Image();
let gifPosition = { x: 0, y: 0 }; // Default position in grid coordinates

// Load GIF function
function loadGIF(gifURL) {
  return new Promise((resolve, reject) => {
    gifImage.onload = () => resolve();
    gifImage.onerror = () => reject(new Error("Failed to load GIF"));
    gifImage.src = gifURL;
  });
}

// Modify the drawGrid function to include GIF rendering
function drawGrid() {
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      ctx.strokeStyle = "#555";
      ctx.strokeRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);

      // Draw GIF if it's at this position
      if (x === gifPosition.x && y === gifPosition.y && gifImage.complete) {
        ctx.drawImage(
          gifImage,
          x * CELL_SIZE,
          y * CELL_SIZE,
          CELL_SIZE,
          CELL_SIZE
        );
      }
    }
  }
}

// Update your game initialization
async function initGame() {
  resizeCanvas();

  // Load the GIF from the image.gif file
  try {
    await loadGIF("./image.gif");
    console.log("GIF loaded successfully");
  } catch (error) {
    console.error("Failed to load GIF:", error);
  }

  requestAnimationFrame(gameLoop);
}

// Replace the current initialization code at the bottom with:
initGame();

// Basic input handling
window.addEventListener("keydown", (e) => {
  switch (e.code) {
    case "ArrowUp":
      gifPosition.y = Math.max(0, gifPosition.y - 1);
      break;
    case "ArrowDown":
      gifPosition.y = Math.min(GRID_SIZE - 1, gifPosition.y + 1);
      break;
    case "ArrowLeft":
      gifPosition.x = Math.max(0, gifPosition.x - 1);
      break;
    case "ArrowRight":
      gifPosition.x = Math.min(GRID_SIZE - 1, gifPosition.x + 1);
      break;
  }
});

// Add resize listener
window.addEventListener("resize", resizeCanvas);

// Initial setup
resizeCanvas();
requestAnimationFrame(gameLoop);
