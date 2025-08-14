class GameOverScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameOverScene' });
    }

    create() {
        const screenWidth = this.sys.game.config.width;
        const screenHeight = this.sys.game.config.height;

        // Game Over text
        const gameOverText = this.add.text(screenWidth / 2, screenHeight / 2 - 50, 'GAME OVER', {
            fontSize: '48px',
            fill: '#ff0000'
        }).setOrigin(0.5);
        gameOverText.postFX.addGlow(0xff0000, 2);


        // Restart button
        const restartButton = this.add.text(screenWidth / 2, screenHeight / 2 + 50, 'Restart', {
            fontSize: '32px',
            fill: '#ffffff'
        }).setOrigin(0.5);
        restartButton.postFX.addGlow(0xffffff, 1);

        restartButton.setInteractive();
        restartButton.on('pointerdown', () => {
            this.scene.start('GameScene');
        });
    }
}
