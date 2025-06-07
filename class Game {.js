class Game {
    constructor() {
        this.score = 0;
        this.combo = 0;
        this.time = 0;
        this.isRunning = false;
        this.isPaused = false;
        this.mode = 'classic'; // 'classic' 或 'survival'
        this.difficulty = 'medium'; // 'easy', 'medium', 或 'hard'
        this.moleHoles = [];
        this.activeMoles = new Set();
        this.missedMoles = 0;
        this.maxMissedMoles = 5; // 生存模式下允許錯過的最大數量
        this.gameTimer = null;
        this.moleTimer = null;
        this.freezeActive = false;
        this.freezeTimer = null;
        
        // 難度設置
        this.difficultySettings = {
            easy: {
                gridSize: 3,
                moleShowTime: 2000,
                moleInterval: 1500,
                bombProbability: 0.1,
                freezeProbability: 0.05,
                gameTime: 60, // 秒
                scoreMultiplier: 1
            },
            medium: {
                gridSize: 4,
                moleShowTime: 1500,
                moleInterval: 1000,
                bombProbability: 0.15,
                freezeProbability: 0.03,
                gameTime: 60, // 秒
                scoreMultiplier: 1.5
            },
            hard: {
                gridSize: 4,
                moleShowTime: 1000,
                moleInterval: 800,
                bombProbability: 0.2,
                freezeProbability: 0.02,
                gameTime: 60, // 秒
                scoreMultiplier: 2
            }
        };
    }
    
    setMode(mode) {
        this.mode = mode;
    }
    
    setDifficulty(difficulty) {
        this.difficulty = difficulty;
    }
    
    start() {
        // 重置遊戲狀態
        this.score = 0;
        this.combo = 0;
        this.missedMoles = 0;
        this.isRunning = true;
        this.isPaused = false;
        this.freezeActive = false;
        this.activeMoles.clear();
        
        // 獲取當前難度設置
        const settings = this.difficultySettings[this.difficulty];
        
        // 創建遊戲網格
        this.moleHoles = ui.createGameGrid(settings.gridSize);
        
        // 更新UI
        ui.updateScore(this.score);
        ui.updateCombo(this.combo);
        
        // 設置遊戲時間
        if (this.mode === 'classic') {
            this.time = settings.gameTime;
            ui.updateTime(this.time);
        } else {
            this.time = 0;
            ui.updateTime(this.time);
        }
        
        // 播放開始音效
        audioManager.play('gameStart');
        
        // 開始遊戲計時器
        this.startGameTimer();
        
        // 開始生成地鼠
        this.startMoleTimer();
    }
    
    startGameTimer() {
        clearInterval(this.gameTimer);
        
        this.gameTimer = setInterval(() => {
            if (this.mode === 'classic') {
                // 經典模式：倒計時
                this.time--;
                ui.updateTime(this.time);
                
                if (this.time <= 0) {
                    this.end();
                }
            } else {
                // 生存模式：計時增加
                this.time++;
                ui.updateTime(this.time);
            }
        }, 1000);
    }
    
    startMoleTimer() {
        clearInterval(this.moleTimer);
        
        const settings = this.difficultySettings[this.difficulty];
        let interval = settings.moleInterval;
        
        // 生存模式下，隨時間增加難度
        if (this.mode === 'survival') {
            const difficultyFactor = Math.max(0.5, 1 - this.time / 120); // 2分鐘後達到最高難度
            interval *= difficultyFactor;
        }
        
        // 如果凍結道具激活，增加間隔
        if (this.freezeActive) {
            interval *= 1.5;
        }
        
        this.moleTimer = setInterval(() => {
            this.showRandomMole();
        }, interval);
    }
    
    showRandomMole() {
        if (!this.isRunning || this.isPaused) return;
        
        const settings = this.difficultySettings[this.difficulty];
        const totalHoles = this.moleHoles.length;
        
        // 找到一個空閒的洞
        let availableHoles = [];
        for (let i = 0; i < totalHoles; i++) {
            if (!this.activeMoles.has(i)) {
                availableHoles.push(i);
            }
        }
        
        if (availableHoles.length === 0) return;
        
        // 隨機選擇一個洞
        const randomIndex = availableHoles[Math.floor(Math.random() * availableHoles.length)];
        
        // 決定是顯示地鼠、炸彈還是凍結道具
        let moleType = 'mole';
        const random = Math.random();
        
        if (random < settings.bombProbability) {
            moleType = 'bomb';
        } else if (random < settings.bombProbability + settings.freezeProbability) {
            moleType = 'freeze';
        }
        
        // 顯示地鼠/道具
        ui.showMole(randomIndex, moleType);
        this.activeMoles.add(randomIndex);
        
        // 設置地鼠/道具消失計時器
        setTimeout(() => {
            if (this.activeMoles.has(randomIndex)) {
                ui.hideMole(randomIndex);
                this.activeMoles.delete(randomIndex);
                
                // 如果是地鼠且未被擊中，在生存模式下增加錯過計數
                if (moleType === 'mole' && this.mode === 'survival') {
                    this.missedMoles++;
                    if (this.missedMoles >= this.maxMissedMoles) {
                        this.end();
                    }
                }
            }
        }, settings.moleShowTime);
    }
    
    hitAttempt(index) {
        if (!this.isRunning || this.isPaused || !this.activeMoles.has(index)) return;
        
        const mole = document.querySelector(`.mole-hole[data-index="${index}"] .mole`);
        if (!mole) return;
        
        // 檢查擊中的是什麼類型
        if (mole.classList.contains('bomb')) {
            // 擊中炸彈
            audioManager.play('bomb');
            this.score = Math.max(0, this.score - 10); // 扣分，最低為0
            this.combo = 0; // 重置連擊
        } else if (mole.classList.contains('freeze')) {
            // 擊中凍結道具
            audioManager.play('freeze');
            this.activateFreeze();
        } else {
            // 擊中地鼠
            audioManager.play('hit');
            this.combo++;
            
            // 計算得分（基礎分 + 連擊獎勵）
            const settings = this.difficultySettings[this.difficulty];
            const baseScore = 1 * settings.scoreMultiplier;
            const comboBonus = Math.min(this.combo - 1, 5) * 0.2; // 最多+100%
            
            this.score += Math.round(baseScore * (1 + comboBonus));
        }
        
        // 更新UI
        ui.hitMole(index);
        ui.updateScore(this.score);
        ui.updateCombo(this.combo);
        
        // 隱藏地鼠/道具
        setTimeout(() => {
            ui.hideMole(index);
            this.activeMoles.delete(index);
        }, 300);
    }
    
    activateFreeze() {
        // 激活凍結效果
        this.freezeActive = true;
        
        // 重新啟動地鼠計時器以應用新的間隔
        this.startMoleTimer();
        
        // 設置凍結效果持續時間
        clearTimeout(this.freezeTimer);
        this.freezeTimer = setTimeout(() => {
            this.freezeActive = false;
            this.startMoleTimer(); // 恢復正常間隔
        }, 5000); // 凍結效果持續5秒
    }
    
    pause() {
        if (!this.isRunning) return;
        
        this.isPaused = true;
        clearInterval(this.gameTimer);
        clearInterval(this.moleTimer);
    }
    
    resume() {
        if (!this.isRunning || !this.isPaused) return;
        
        this.isPaused = false;
        this.startGameTimer();
        this.startMoleTimer();
    }
    
    end() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        clearInterval(this.gameTimer);
        clearInterval(this.moleTimer);
        clearTimeout(this.freezeTimer);
        
        // 隱藏所有地鼠
        this.activeMoles.forEach(index => {
            ui.hideMole(index);
        });
        this.activeMoles.clear();
        
        // 保存分數到排行榜
        this.saveScore();
        
        // 獲取最高分
        const highScore = this.getHighScore();
        
        // 顯示結束畫面
        ui.showEndScreen(this.score, highScore);
    }
    
    restart() {
        this.start();
    }
    
    saveScore() {
        // 從LocalStorage獲取現有排行榜
        const leaderboard = JSON.parse(localStorage.getItem('whackAMole_leaderboard') || '[]');
        
        // 添加新分數
        leaderboard.push({
            mode: this.mode,
            difficulty: this.difficulty,
            score: this.score,
            date: new Date().toISOString()
        });
        
        // 按分數排序
        leaderboard.sort((a, b) => b.score - a.score);
        
        // 只保留前10名
        const topScores = leaderboard.slice(0, 10);
        
        // 保存回LocalStorage
        localStorage.setItem('whackAMole_leaderboard', JSON.stringify(topScores));
    }
    
    getHighScore() {
        const leaderboard = JSON.parse(localStorage.getItem('whackAMole_leaderboard') || '[]');
        
        // 過濾相同模式和難度的分數
        const filteredScores = leaderboard.filter(entry => 
            entry.mode === this.mode && entry.difficulty === this.difficulty
        );
        
        if (filteredScores.length === 0) return 0;
        
        // 返回最高分
        return filteredScores[0].score;
    }
}

// 創建全局遊戲實例
const game = new Game();

// 當頁面加載完成時，顯示主菜單
window.addEventListener('load', () => {
    ui.showScreen('mainMenu');
});