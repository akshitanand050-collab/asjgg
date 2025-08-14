class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.player = null;
        this.lanes = [];
        this.currentLane = 1; // 0, 1, 2 for left, middle, right
        this.cursors = null;
        this.isJumping = false;
        this.isSliding = false;
        this.isSwitchingLanes = false;
        this.gameSpeed = 300; // Speed in pixels per second
    }

    preload() {
        // Generate a white pixel texture to use for player and obstacles
        let graphics = this.add.graphics();
        graphics.fillStyle(0xffffff, 1);
        graphics.fillRect(0, 0, 1, 1);
        graphics.generateTexture('whitePixel', 1, 1);
        graphics.destroy();
    }

    create() {
        // Define the lanes
        const screenWidth = this.sys.game.config.width;
        const screenHeight = this.sys.game.config.height;
        this.lanes = [screenWidth * 0.25, screenWidth * 0.5, screenWidth * 0.75];

        // Create player
        const playerX = this.lanes[this.currentLane];
        this.playerY = screenHeight * 0.8;
        this.player = this.physics.add.sprite(playerX, this.playerY, 'whitePixel')
            .setTint(0x00ff00)
            .setDisplaySize(50, 50);
        this.player.postFX.addGlow(0x00ff00, 1);
        this.player.setCollideWorldBounds(true);
        this.player.body.setGravityY(0);

        // Add placeholder for the ground
        this.add.rectangle(screenWidth / 2, screenHeight, screenWidth, 100, 0x333333).setOrigin(0.5, 1);

        // Create lane markers
        this.laneMarkers = this.add.group();
        for (let i = 0; i < 10; i++) {
            const y = i * 100;
            this.laneMarkers.add(this.add.rectangle(this.lanes[0] - 25, y, 5, 50, 0x555555));
            this.laneMarkers.add(this.add.rectangle(this.lanes[1] - 25, y, 5, 50, 0x555555));
            this.laneMarkers.add(this.add.rectangle(this.lanes[1] + 25, y, 5, 50, 0x555555));
            this.laneMarkers.add(this.add.rectangle(this.lanes[2] + 25, y, 5, 50, 0x555555));
        }

        // Initialize keyboard controls
        this.cursors = this.input.keyboard.createCursorKeys();

        // Obstacle groups
        const obstacleGroupConfig = {
            defaultKey: 'whitePixel',
            runChildUpdate: true
        };
        this.jumpObstacles = this.physics.add.group(obstacleGroupConfig);
        this.slideObstacles = this.physics.add.group(obstacleGroupConfig);

        // Spawn obstacles periodically
        this.time.addEvent({
            delay: 1500,
            callback: this.spawnObstacle,
            callbackScope: this,
            loop: true
        });

        // Add collision detection
        this.physics.add.overlap(this.player, this.jumpObstacles, this.playerHit, null, this);
        this.physics.add.overlap(this.player, this.slideObstacles, this.playerHit, null, this);

        console.log("GameScene created and controls initialized");
    }

    spawnObstacle() {
        const laneIndex = Phaser.Math.Between(0, 2);
        const obstacleType = Phaser.Math.Between(0, 1); // 0 for jump, 1 for slide

        let obstacle;
        if (obstacleType === 0) { // Jump obstacle (low)
            obstacle = this.jumpObstacles.get(this.lanes[laneIndex], -100);
            if (obstacle) {
                obstacle.setActive(true).setVisible(true).setDisplaySize(50, 50).setTint(0xff0000);
                obstacle.body.setSize(50, 50).setOffset(0, 0);
                if (!obstacle.postFX) obstacle.bootPostPipeline(); // Ensure pipeline is ready
                obstacle.postFX.addGlow(0xff0000, 1);
            }
        } else { // Slide obstacle (high)
            obstacle = this.slideObstacles.get(this.lanes[laneIndex], -100);
            if (obstacle) {
                obstacle.setActive(true).setVisible(true).setDisplaySize(50, 50).setTint(0xffff00);
                obstacle.body.setSize(50, 50).setOffset(0, -25); // Positioned higher
                if (!obstacle.postFX) obstacle.bootPostPipeline();
                obstacle.postFX.addGlow(0xffff00, 1);
            }
        }

        if (obstacle) {
            obstacle.setVelocityY(this.gameSpeed);
        }
    }

    playerHit(player, obstacle) {
        console.log("Player hit an obstacle! Game Over.");
        this.scene.start('GameOverScene');
    }

    update(time, delta) {
        // Move lane markers to give illusion of speed
        const speed = this.gameSpeed * delta / 1000;
        this.laneMarkers.children.iterate(marker => {
            marker.y += speed * 60 / (1000/60); // approximate conversion
            if (marker.y > this.sys.game.config.height) {
                marker.y = -50;
            }
        });

        this.handleInput();

        // Recycle obstacles
        this.jumpObstacles.children.each(ob => {
            if (ob.active && ob.y > this.sys.game.config.height + 50) {
                ob.setActive(false).setVisible(false);
            }
        });
        this.slideObstacles.children.each(ob => {
            if (ob.active && ob.y > this.sys.game.config.height + 50) {
                ob.setActive(false).setVisible(false);
            }
        });
    }

    handleInput() {
        const leftJustPressed = Phaser.Input.Keyboard.JustDown(this.cursors.left);
        const rightJustPressed = Phaser.Input.Keyboard.JustDown(this.cursors.right);
        const upJustPressed = Phaser.Input.Keyboard.JustDown(this.cursors.up);
        const downJustPressed = Phaser.Input.Keyboard.JustDown(this.cursors.down);

        // Lane Switching
        if (!this.isSwitchingLanes && !this.isJumping && !this.isSliding) {
            if (leftJustPressed && this.currentLane > 0) {
                this.switchLane(-1);
            } else if (rightJustPressed && this.currentLane < 2) {
                this.switchLane(1);
            }
        }

        // Jumping
        if (upJustPressed && !this.isJumping && !this.isSliding) {
            this.jump();
        }

        // Sliding
        if (downJustPressed && !this.isJumping && !this.isSliding) {
            this.slide();
        }
    }

    switchLane(direction) {
        this.isSwitchingLanes = true;
        this.currentLane += direction;
        this.tweens.add({
            targets: this.player,
            x: this.lanes[this.currentLane],
            duration: 200,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                this.isSwitchingLanes = false;
            }
        });
    }

    jump() {
        this.isJumping = true;
        this.tweens.add({
            targets: this.player,
            y: this.playerY - 100,
            duration: 300,
            ease: 'Cubic.easeOut',
            yoyo: true,
            onComplete: () => {
                this.isJumping = false;
                this.player.y = this.playerY; // Ensure player returns to exact position
            }
        });
    }

    slide() {
        this.isSliding = true;
        this.player.setDisplaySize(50, 25).body.setSize(50, 25, false);

        this.time.delayedCall(500, () => {
            this.player.setDisplaySize(50, 50).body.setSize(50, 50, false);
            this.isSliding = false;
        });
    }
}
