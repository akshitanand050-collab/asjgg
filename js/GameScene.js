class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });

        this.presentPlayer = null;
        this.echoPlayer = null;
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
        const screenWidth = this.sys.game.config.width;
        const screenHeight = this.sys.game.config.height;
        const halfHeight = screenHeight / 2;
        this.lanes = [screenWidth * 0.25, screenWidth * 0.5, screenWidth * 0.75];

        // --- Set up Cameras for Split Screen ---
        this.cameras.main.setViewport(0, 0, screenWidth, halfHeight);
        this.echoCamera = this.cameras.add(0, halfHeight, screenWidth, halfHeight);

        // Add visual effects to the echo camera
        this.echoCamera.postFX.addVignette(0.5, 0.5, 0.9);
        this.echoCamera.postFX.addBarrel(1.05);

        // --- Create World Elements for Both Timelines ---
        this.add.rectangle(screenWidth / 2, halfHeight, screenWidth, 100, 0x222222).setOrigin(0.5, 1); // Present ground
        this.add.rectangle(screenWidth / 2, screenHeight, screenWidth, 100, 0x222222).setOrigin(0.5, 1); // Echo ground

        this.presentLaneMarkers = this.createLaneMarkers(halfHeight);
        this.echoLaneMarkers = this.createLaneMarkers(screenHeight, halfHeight);

        // --- Create Players ---
        const playerX = this.lanes[this.currentLane];
        this.presentPlayerY = halfHeight * 0.8;
        this.echoPlayerY = halfHeight + (halfHeight * 0.8);

        this.presentPlayer = this.createPlayer(playerX, this.presentPlayerY, 0x00ff00);
        this.echoPlayer = this.createPlayer(playerX, this.echoPlayerY, 0xff00ff); // Magenta for echo

        // Initialize keyboard controls
        this.cursors = this.input.keyboard.createCursorKeys();

        // Obstacle groups
        const obstacleGroupConfig = { defaultKey: 'whitePixel', runChildUpdate: true };
        this.presentJumpObstacles = this.physics.add.group(obstacleGroupConfig);
        this.presentSlideObstacles = this.physics.add.group(obstacleGroupConfig);
        this.echoJumpObstacles = this.physics.add.group(obstacleGroupConfig);
        this.echoSlideObstacles = this.physics.add.group(obstacleGroupConfig);

        // Spawn obstacles periodically
        this.time.addEvent({ delay: 1500, callback: this.spawnObstacle, callbackScope: this, loop: true });

        // Add collision detection for both players
        this.physics.add.overlap(this.presentPlayer, [this.presentJumpObstacles, this.presentSlideObstacles], this.playerHit, null, this);
        this.physics.add.overlap(this.echoPlayer, [this.echoJumpObstacles, this.echoSlideObstacles], this.playerHit, null, this);

        // --- Particle Emitters ---
        this.jumpParticles = this.add.particles(0, 0, 'whitePixel', {
            speed: { min: -100, max: 100 },
            angle: { min: 0, max: 360 },
            scale: { start: 1, end: 0 },
            lifespan: 400,
            gravityY: 200,
            emitting: false
        });
        this.slideParticles = this.add.particles(0, 0, 'whitePixel', {
            speed: 20,
            angle: { min: 170, max: 190 },
            scale: { start: 0.5, end: 0 },
            lifespan: 300,
            emitting: false
        });
        this.laneChangeParticles = this.add.particles(0, 0, 'whitePixel', {
            speed: { min: 50, max: 150 },
            angle: { min: -30, max: 30 },
            scale: { start: 1, end: 0 },
            lifespan: 200,
            emitting: false
        });

        console.log("GameScene created for Dual Timelines");
    }

    createPlayer(x, y, color) {
        const player = this.physics.add.sprite(x, y, 'whitePixel')
            .setTint(color)
            .setDisplaySize(50, 50);
        player.postFX.addGlow(color, 1);
        player.setCollideWorldBounds(true);
        player.body.setGravityY(0);

        // Add running animation
        this.tweens.add({
            targets: player,
            scaleY: 1.1,
            duration: 300,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        return player;
    }

    createLaneMarkers(viewHeight, yOffset = 0) {
        const markers = this.add.group();
        for (let i = 0; i < 5; i++) {
            const y = yOffset + (i * 100);
            markers.add(this.add.rectangle(this.lanes[0] - 25, y, 5, 50, 0x555555));
            markers.add(this.add.rectangle(this.lanes[1] - 25, y, 5, 50, 0x555555));
            markers.add(this.add.rectangle(this.lanes[1] + 25, y, 5, 50, 0x555555));
            markers.add(this.add.rectangle(this.lanes[2] + 25, y, 5, 50, 0x555555));
        }
        return markers;
    }

    spawnObstacle() {
        const obstacleType = Phaser.Math.Between(0, 1); // 0 for jump, 1 for slide

        // --- Present Timeline Obstacle ---
        const presentLaneIndex = Phaser.Math.Between(0, 2);
        const presentGroup = (obstacleType === 0) ? this.presentJumpObstacles : this.presentSlideObstacles;
        const presentObstacle = this.setupObstacle(presentGroup, presentLaneIndex, 0, obstacleType);
        if (presentObstacle) presentObstacle.setVelocityY(this.gameSpeed);

        // --- Echo Timeline Obstacle ---
        let echoLaneIndex = Phaser.Math.Between(0, 2);
        while (echoLaneIndex === presentLaneIndex) {
            echoLaneIndex = Phaser.Math.Between(0, 2); // Ensure it's a different lane
        }
        const echoGroup = (obstacleType === 0) ? this.echoJumpObstacles : this.echoSlideObstacles;
        const echoObstacle = this.setupObstacle(echoGroup, echoLaneIndex, this.sys.game.config.height / 2, obstacleType);
        if (echoObstacle) echoObstacle.setVelocityY(this.gameSpeed);
    }

    setupObstacle(group, laneIndex, yOffset, type) {
        const obstacle = group.get(this.lanes[laneIndex], yOffset - 100);
        if (!obstacle) return null;

        const color = (type === 0) ? 0xff0000 : 0xffff00; // Red for jump, Yellow for slide
        obstacle.setActive(true).setVisible(true).setDisplaySize(50, 50).setTint(color);

        if (type === 0) { // Jump obstacle
             obstacle.body.setSize(50, 50).setOffset(0, 0);
        } else { // Slide obstacle
             obstacle.body.setSize(50, 50).setOffset(0, -25);
        }

        if (!obstacle.postFX) obstacle.bootPostPipeline();
        const glow = obstacle.postFX.addGlow(color, 1);

        // Add pulsing animation to the glow
        this.tweens.add({
            targets: glow,
            strength: 2,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        return obstacle;
    }

    playerHit(player, obstacle) {
        console.log("Player hit an obstacle! Game Over.");
        this.scene.start('GameOverScene');
    }

    update(time, delta) {
        this.updateLaneMarkers(this.presentLaneMarkers, this.sys.game.config.height / 2, 0);
        this.updateLaneMarkers(this.echoLaneMarkers, this.sys.game.config.height, this.sys.game.config.height / 2);

        this.handleInput();

        // Recycle obstacles for all groups
        this.recycleObstacles(this.presentJumpObstacles);
        this.recycleObstacles(this.presentSlideObstacles);
        this.recycleObstacles(this.echoJumpObstacles);
        this.recycleObstacles(this.echoSlideObstacles);
    }

    recycleObstacles(group) {
        group.children.each(obstacle => {
            if (obstacle.active && obstacle.y > this.sys.game.config.height + 50) {
                obstacle.setActive(false).setVisible(false);
            }
        });
    }

    updateLaneMarkers(group, boundary, yOffset) {
        const speed = this.gameSpeed * (this.game.loop.delta / 1000);
        group.children.iterate(marker => {
            marker.y += speed;
            if (marker.y > boundary) {
                marker.y = yOffset - 50;
            }
        });
    }

    handleInput() {
        const leftJustPressed = Phaser.Input.Keyboard.JustDown(this.cursors.left);
        const rightJustPressed = Phaser.Input.Keyboard.JustDown(this.cursors.right);
        const upJustPressed = Phaser.Input.Keyboard.JustDown(this.cursors.up);
        const downJustPressed = Phaser.Input.Keyboard.JustDown(this.cursors.down);

        if (!this.isSwitchingLanes && !this.isJumping && !this.isSliding) {
            if (leftJustPressed && this.currentLane > 0) this.switchLane(-1);
            else if (rightJustPressed && this.currentLane < 2) this.switchLane(1);
        }
        if (upJustPressed && !this.isJumping && !this.isSliding) this.jump();
        if (downJustPressed && !this.isJumping && !this.isSliding) this.slide();
    }

    switchLane(direction) {
        this.isSwitchingLanes = true;
        this.currentLane += direction;
        const targetX = this.lanes[this.currentLane];

        // Emit particles
        this.laneChangeParticles.setX(this.presentPlayer.x).setY(this.presentPlayer.y).explode(10);
        this.laneChangeParticles.setX(this.echoPlayer.x).setY(this.echoPlayer.y).explode(10);

        this.tweens.add({
            targets: [this.presentPlayer, this.echoPlayer],
            x: targetX,
            duration: 200,
            ease: 'Cubic.easeOut',
            onComplete: () => { this.isSwitchingLanes = false; }
        });
    }

    jump() {
        this.isJumping = true;

        // Emit particles
        this.jumpParticles.setX(this.presentPlayer.x).setY(this.presentPlayer.y).explode(20);
        this.jumpParticles.setX(this.echoPlayer.x).setY(this.echoPlayer.y).explode(20);

        // Jump animation for both players
        [this.presentPlayer, this.echoPlayer].forEach(player => {
            this.tweens.add({
                targets: player,
                angle: player.angle + 360,
                duration: 400,
                ease: 'Power1'
            });
        });

        this.tweens.add({
            targets: this.presentPlayer,
            y: this.presentPlayerY - 100,
            duration: 300,
            ease: 'Cubic.easeOut',
            yoyo: true
        });
        this.tweens.add({
            targets: this.echoPlayer,
            y: this.echoPlayerY - 100,
            duration: 300,
            ease: 'Cubic.easeOut',
            yoyo: true,
            onComplete: () => {
                this.isJumping = false;
                this.presentPlayer.y = this.presentPlayerY;
                this.echoPlayer.y = this.echoPlayerY;
            }
        });
    }

    slide() {
        this.isSliding = true;

        // Start sliding particles
        this.slideParticles.startFollow(this.presentPlayer);
        this.slideParticles.startFollow(this.echoPlayer); // Note: follows one target, will follow last set
        this.slideParticles.emitting = true;

        [this.presentPlayer, this.echoPlayer].forEach(p => {
            p.setDisplaySize(50, 25).body.setSize(50, 25, false);
        });

        this.time.delayedCall(500, () => {
            [this.presentPlayer, this.echoPlayer].forEach(p => {
                p.setDisplaySize(50, 50).body.setSize(50, 50, false);
            });
            this.isSliding = false;
            this.slideParticles.emitting = false;
        });
    }
}
