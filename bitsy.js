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

// Draw grid lines
function drawGrid() {
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      ctx.strokeStyle = "#555";
      ctx.strokeRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
  }
}

// Basic input handling
window.addEventListener("keydown", (e) => {
  switch (e.code) {
    case "ArrowUp":
      console.log("Up");
      break;
    case "ArrowDown":
      console.log("Down");
      break;
    case "ArrowLeft":
      console.log("Left");
      break;
    case "ArrowRight":
      console.log("Right");
      break;
  }
});

// Add resize listener
window.addEventListener("resize", resizeCanvas);

// Initial setup
resizeCanvas();
requestAnimationFrame(gameLoop);
