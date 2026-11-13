// 테트리스 상수 설정
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30; // 10 * 30 = 300, 20 * 30 = 600

const canvas = document.getElementById('tetris-canvas');
const ctx = canvas.getContext('2d');

const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');

const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');

const scoreElem = document.getElementById('score');
const linesElem = document.getElementById('lines');
const levelElem = document.getElementById('level');

const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg = document.getElementById('overlay-msg');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const restartBtn = document.getElementById('restart-btn');

// 테트로미노 모양 정의
const PIECES = {
  I: {
    color: '#00f0f0',
    shape: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ]
  },
  J: {
    color: '#0000f0',
    shape: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0]
    ]
  },
  L: {
    color: '#f0a000',
    shape: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0]
    ]
  },
  O: {
    color: '#f0f000',
    shape: [
      [1, 1],
      [1, 1]
    ]
  },
  S: {
    color: '#00f000',
    shape: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0]
    ]
  },
  T: {
    color: '#a000f0',
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0]
    ]
  },
  Z: {
    color: '#f00000',
    shape: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0]
    ]
  }
};

const PIECE_KEYS = Object.keys(PIECES);

// 게임 상태
let board = createBoard();
let currentPiece = null;
let nextPiece = null;
let holdPiece = null;
let canHold = true;

let score = 0;
let lines = 0;
let level = 1;

let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let isGameOver = false;
let isPaused = false;
let animationId = null;

// 보드 초기화
function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

// 7-Bag 랜덤 조각 생성기
let pieceBag = [];
function getNextRandomPiece() {
  if (pieceBag.length === 0) {
    pieceBag = [...PIECE_KEYS];
    // Fisher-Yates 셔플
    for (let i = pieceBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pieceBag[i], pieceBag[j]] = [pieceBag[j], pieceBag[i]];
    }
  }
  const key = pieceBag.pop();
  return {
    type: key,
    color: PIECES[key].color,
    shape: PIECES[key].shape.map(row => [...row]),
    x: Math.floor(COLS / 2) - Math.ceil(PIECES[key].shape[0].length / 2),
    y: 0
  };
}

// 회전 함수 (시계/반시계)
function rotate(matrix, dir) {
  const n = matrix.length;
  const result = Array.from({ length: n }, () => Array(n).fill(0));
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (dir > 0) {
        result[x][n - 1 - y] = matrix[y][x]; // 시계방향
      } else {
        result[n - 1 - x][y] = matrix[y][x]; // 반시계방향
      }
    }
  }
  return result;
}

// 충돌 감지
function collide(b, piece, offset = { x: 0, y: 0 }) {
  const m = piece.shape;
  for (let y = 0; y < m.length; y++) {
    for (let x = 0; x < m[y].length; x++) {
      if (m[y][x] !== 0) {
        const newX = piece.x + x + offset.x;
        const newY = piece.y + y + offset.y;
        if (newX < 0 || newX >= COLS || newY >= ROWS) {
          return true;
        }
        if (newY >= 0 && b[newY][newX] !== 0) {
          return true;
        }
      }
    }
  }
  return false;
}

// 현재 조각을 보드에 병합
function merge(b, piece) {
  piece.shape.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        const boardY = piece.y + y;
        const boardX = piece.x + x;
        if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
          b[boardY][boardX] = piece.color;
        }
      }
    });
  });
}

// 라인 클리어 및 점수 계산
function arenaSweep() {
  let rowCount = 0;
  outer: for (let y = ROWS - 1; y >= 0; y--) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x] === 0) {
        continue outer;
      }
    }

    const row = board.splice(y, 1)[0].fill(0);
    board.unshift(row);
    y++; // 한 줄 내렸으므로 현재 인덱스 재확인
    rowCount++;
  }

  if (rowCount > 0) {
    const lineScores = [0, 100, 300, 500, 800];
    score += (lineScores[rowCount] || rowCount * 200) * level;
    lines += rowCount;
    level = Math.floor(lines / 10) + 1;
    // 레벨에 따른 속도 증가 (최소 100ms)
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateStats();
  }
}

// 블록 아래로 떨어뜨리기
function playerDrop() {
  if (isGameOver || isPaused) return;

  if (!collide(board, currentPiece, { x: 0, y: 1 })) {
    currentPiece.y++;
  } else {
    merge(board, currentPiece);
    arenaSweep();
    spawnNextPiece();
  }
  dropCounter = 0;
}

// 하드 드롭 (즉시 바닥으로)
function playerHardDrop() {
  if (isGameOver || isPaused) return;

  let addedScore = 0;
  while (!collide(board, currentPiece, { x: 0, y: 1 })) {
    currentPiece.y++;
    addedScore += 2;
  }
  score += addedScore;
  updateStats();
  merge(board, currentPiece);
  arenaSweep();
  spawnNextPiece();
  dropCounter = 0;
}

// 좌우 이동
function playerMove(dir) {
  if (isGameOver || isPaused) return;
  if (!collide(board, currentPiece, { x: dir, y: 0 })) {
    currentPiece.x += dir;
  }
}

// 회전 (기본 벽차기(Wall-kick) 포함)
function playerRotate(dir) {
  if (isGameOver || isPaused) return;
  const originalShape = currentPiece.shape;
  currentPiece.shape = rotate(currentPiece.shape, dir);

  // 기본 위치에서 충돌 시 좌우로 1~2칸 밀어서 보정 시도
  const kicks = [0, 1, -1, 2, -2];
  let successful = false;
  for (let kick of kicks) {
    if (!collide(board, currentPiece, { x: kick, y: 0 })) {
      currentPiece.x += kick;
      successful = true;
      break;
    }
  }

  if (!successful) {
    currentPiece.shape = originalShape; // 되돌리기
  }
}

// 홀드 기능
function playerHold() {
  if (isGameOver || isPaused || !canHold) return;

  if (holdPiece === null) {
    holdPiece = {
      type: currentPiece.type,
      color: PIECES[currentPiece.type].color,
      shape: PIECES[currentPiece.type].shape.map(row => [...row])
    };
    currentPiece = nextPiece;
    nextPiece = getNextRandomPiece();
  } else {
    const tempType = holdPiece.type;
    holdPiece = {
      type: currentPiece.type,
      color: PIECES[currentPiece.type].color,
      shape: PIECES[currentPiece.type].shape.map(row => [...row])
    };
    currentPiece = {
      type: tempType,
      color: PIECES[tempType].color,
      shape: PIECES[tempType].shape.map(row => [...row]),
      x: Math.floor(COLS / 2) - Math.ceil(PIECES[tempType].shape[0].length / 2),
      y: 0
    };
  }

  canHold = false;
  drawPreview(holdCanvas, holdCtx, holdPiece);
  drawPreview(nextCanvas, nextCtx, nextPiece);
}

// 다음 조각 가져오기
function spawnNextPiece() {
  currentPiece = nextPiece || getNextRandomPiece();
  nextPiece = getNextRandomPiece();
  canHold = true;

  drawPreview(nextCanvas, nextCtx, nextPiece);

  // 스폰 위치에서 충돌 발생 시 게임오버
  if (collide(board, currentPiece)) {
    gameOver();
  }
}

// 고스트 블록 (착지 예상 위치 y 계산)
function getGhostY() {
  if (!currentPiece) return 0;
  let ghostY = currentPiece.y;
  while (!collide(board, currentPiece, { x: 0, y: ghostY - currentPiece.y + 1 })) {
    ghostY++;
  }
  return ghostY;
}

// 렌더링 헬퍼 (블록 1칸 그리기)
function drawBlock(ctx, x, y, color, isGhost = false) {
  const px = x * BLOCK_SIZE;
  const py = y * BLOCK_SIZE;

  if (isGhost) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px + 2, py + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4);
    return;
  }

  ctx.fillStyle = color;
  ctx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);

  // 입체감 주는 하이라이트 & 그림자 효과
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.fillRect(px, py, BLOCK_SIZE, 3);
  ctx.fillRect(px, py, 3, BLOCK_SIZE);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.fillRect(px, py + BLOCK_SIZE - 3, BLOCK_SIZE, 3);
  ctx.fillRect(px + BLOCK_SIZE - 3, py, 3, BLOCK_SIZE);

  ctx.strokeStyle = '#0e131d';
  ctx.lineWidth = 1;
  ctx.strokeRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
}

// 메인 보드 그리기
function draw() {
  // 배경 클리어
  ctx.fillStyle = '#0c0f17';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 연한 그리드 라인
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK_SIZE, 0);
    ctx.lineTo(c * BLOCK_SIZE, canvas.height);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK_SIZE);
    ctx.lineTo(canvas.width, r * BLOCK_SIZE);
    ctx.stroke();
  }

  // 배치된 블록들 그리기
  board.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        drawBlock(ctx, x, y, value);
      }
    });
  });

  if (currentPiece) {
    // 고스트(낙하 가이드) 그리기
    const ghostY = getGhostY();
    if (ghostY > currentPiece.y) {
      currentPiece.shape.forEach((row, y) => {
        row.forEach((val, x) => {
          if (val !== 0) {
            drawBlock(ctx, currentPiece.x + x, ghostY + y, currentPiece.color, true);
          }
        });
      });
    }

    // 현재 조작 중인 피스 그리기
    currentPiece.shape.forEach((row, y) => {
      row.forEach((val, x) => {
        if (val !== 0) {
          drawBlock(ctx, currentPiece.x + x, currentPiece.y + y, currentPiece.color);
        }
      });
    });
  }
}

// 미리보기(Next, Hold) 그리기
function drawPreview(c, context, piece) {
  context.clearRect(0, 0, c.width, c.height);
  if (!piece) return;

  const shape = piece.shape;
  const pSize = 20;
  const offsetX = (c.width - shape[0].length * pSize) / 2;
  const offsetY = (c.height - shape.length * pSize) / 2;

  shape.forEach((row, y) => {
    row.forEach((val, x) => {
      if (val !== 0) {
        const px = offsetX + x * pSize;
        const py = offsetY + y * pSize;

        context.fillStyle = piece.color;
        context.fillRect(px, py, pSize, pSize);

        context.fillStyle = 'rgba(255, 255, 255, 0.3)';
        context.fillRect(px, py, pSize, 2);
        context.fillRect(px, py, 2, pSize);

        context.fillStyle = 'rgba(0, 0, 0, 0.3)';
        context.fillRect(px, py + pSize - 2, pSize, 2);
        context.fillRect(px + pSize - 2, py, 2, pSize);

        context.strokeStyle = '#0d121c';
        context.strokeRect(px, py, pSize, pSize);
      }
    });
  });
}

function updateStats() {
  scoreElem.innerText = score.toLocaleString();
  linesElem.innerText = lines;
  levelElem.innerText = level;
}

// 메인 게임 루프
function update(time = 0) {
  if (isGameOver) return;

  const deltaTime = time - lastTime;
  lastTime = time;

  if (!isPaused) {
    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
      playerDrop();
    }
  }

  draw();
  animationId = requestAnimationFrame(update);
}

// 게임 시작
function startGame() {
  board = createBoard();
  pieceBag = [];
  score = 0;
  lines = 0;
  level = 1;
  dropInterval = 1000;
  dropCounter = 0;
  isGameOver = false;
  isPaused = false;
  holdPiece = null;
  canHold = true;

  updateStats();
  overlay.classList.add('hidden');
  pauseBtn.innerText = '일시정지 (P)';

  drawPreview(holdCanvas, holdCtx, null);
  nextPiece = getNextRandomPiece();
  spawnNextPiece();

  lastTime = performance.now();
  if (animationId) cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(update);
}

// 게임 오버
function gameOver() {
  isGameOver = true;
  overlayTitle.innerText = 'GAME OVER';
  overlayMsg.innerText = `최종 점수: ${score.toLocaleString()}점 (레벨 ${level})`;
  startBtn.innerText = '다시 도전';
  overlay.classList.remove('hidden');
}

// 일시정지 토글
function togglePause() {
  if (isGameOver) return;
  isPaused = !isPaused;
  if (isPaused) {
    overlayTitle.innerText = 'PAUSED';
    overlayMsg.innerText = '게임이 일시 정지되었습니다';
    startBtn.innerText = '계속하기';
    overlay.classList.remove('hidden');
    pauseBtn.innerText = '계속하기 (P)';
  } else {
    overlay.classList.add('hidden');
    pauseBtn.innerText = '일시정지 (P)';
    lastTime = performance.now();
  }
}

// 키보드 입력 핸들러
window.addEventListener('keydown', e => {
  if (isGameOver) return;

  // 브라우저 기본 스크롤 방지
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
    e.preventDefault();
  }

  if (e.key === 'p' || e.key === 'P') {
    togglePause();
    return;
  }

  if (isPaused) return;

  switch (e.key) {
    case 'ArrowLeft':
      playerMove(-1);
      break;
    case 'ArrowRight':
      playerMove(1);
      break;
    case 'ArrowDown':
      playerDrop();
      break;
    case 'ArrowUp':
    case 'x':
    case 'X':
      playerRotate(1); // 시계 회전
      break;
    case 'z':
    case 'Z':
      playerRotate(-1); // 반시계 회전
      break;
    case ' ':
      playerHardDrop(); // 하드 드롭
      break;
    case 'c':
    case 'C':
      playerHold(); // 홀드
      break;
  }
});

// 버튼 이벤트 리스너
startBtn.addEventListener('click', () => {
  if (isGameOver || !currentPiece) {
    startGame();
  } else if (isPaused) {
    togglePause();
  }
});

pauseBtn.addEventListener('click', togglePause);
restartBtn.addEventListener('click', startGame);

// 초기 화면 렌더링
draw();
