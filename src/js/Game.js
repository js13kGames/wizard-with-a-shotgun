'use strict';

import { Sprite } from './Sprite';
import { Input } from './input/Input';
import { MapLoader } from './MapLoader';
import { Text } from './Text';
import { Player } from './Player';
import { Viewport } from './Viewport';
import { WALL_TOP, WALL_RIGHT, WALL_BOTTOM, WALL_LEFT, OPEN_TOP, OPEN_RIGHT, OPEN_BOTTOM, OPEN_LEFT, DIALOG_START_A, DIALOG_START_B, DIALOG_HINT_1, DIALOG_HINT_2, DIALOG_HINT_3, DIALOG_HINT_DEATH, R360 } from './Constants';
import { uv2xy, xy2qr, angle2vector, rgba, createCanvas } from './Util';
import { Audio } from './Audio';
import { Brawl } from './systems/Brawl';
import { Movement } from './systems/Movement';
import { Damage } from './systems/Damage';
import { DialogScheduling } from './systems/DialogScheduling';
import { Victory } from './systems/Victory';
import { Hud } from './Hud';
import { ScreenShake } from './ScreenShake';
import { Maze } from './Maze';

/**
 * Game state.
 */
export class Game {
    init() {
        Sprite.loadSpritesheet(() => {
            Viewport.init();
            Sprite.init();
            Text.init();
            Input.init();
            Audio.init();

            this.maze = MapLoader.load();
            this.entities = [];
            this.dialogPending = {};
            this.dialogSeen = {};
            this.roomsCleared = [];
            this.shadowCanvas = createCanvas(500, 500);
            this.shadowOffset = 0;
            this.screenshakes = [];
            this.player = new Player();
            this.entities.push(this.player);
            this.camera = { pos: { ...this.player.pos } };

            window.addEventListener('blur', () => this.pause());
            window.addEventListener('focus', () => this.unpause());

            this.start();
        });
    }

    start() {
        this.frame = 0;
        this.dialogPending[DIALOG_START_A] =
        this.dialogPending[DIALOG_START_B] =
        this.dialogPending[DIALOG_HINT_1] =
        this.dialogPending[DIALOG_HINT_2] =
        this.dialogPending[DIALOG_HINT_3] = true;

        this.update();
        window.requestAnimationFrame(() => this.onFrame(1));
    }

    onFrame(currentms) {
        this.frame++;
        Viewport.resize();
        this.update();
        this.draw(Viewport.ctx);
        window.requestAnimationFrame(() => this.onFrame(currentms));
    }

    update() {
        // Pull in frame by frame button pushes / keypresses / mouse clicks
        Input.update();

        if (Input.pressed[Input.Action.MENU]) {
            this.paused ? this.unpause() : this.pause();
        }

        if (this.paused) return;

        // Apply any per-frame audio updates
        Audio.update();

        // Behavior (AI, player input, etc.)
        //apply(this.entities); <-- cut to save space
        for (let entity of game.entities) {
            if (entity.think) entity.think();
        }

        // Apply any queued damage
        Damage.apply(this.entities);

        // Movement (apply entity velocities to position)
        Movement.apply(this.entities);

        // Dialog scheduling
        DialogScheduling.apply();

        // Brawl system (aka "room battles")
        Brawl.apply();

        // Victory condtions
        Victory.apply();

        // Culling (typically when an entity dies)
        this.entities = this.entities.filter(entity => !entity.cull);

        // Camera logic
        let diff = {
            x: this.player.pos.x - this.camera.pos.x,
            y: this.player.pos.y - this.camera.pos.y
        };
        this.camera.pos.x += diff.x * 0.2;
        this.camera.pos.y += diff.y * 0.2;

        // Tick screenshakes and cull finished screenshakes
        this.screenshakes = this.screenshakes.filter(screenshake =>
            screenshake.update()
        );

        // Flickering shadows
        if (game.frame % 6 === 0) this.shadowOffset = (Math.random() * 10) | 0;
    }

    draw() {
        let ctx = Viewport.ctx;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(Viewport.scale, Viewport.scale);

        let shakeX = 0;
        let shakeY = 0;
        this.screenshakes.forEach(shake => {
            shakeX += shake.x;
            shakeY += shake.y;
        });
        ctx.translate(shakeX, shakeY);

        Maze.draw();

        for (let entity of this.entities) {
            if (entity.z > 0 || !entity.z) entity.draw();
        }

        Viewport.ctx.drawImage(
            Sprite.shadow.img,
            0,
            0,
            500,
            500,
            0 - this.shadowOffset,
            0 - this.shadowOffset,
            Viewport.width + this.shadowOffset * 2,
            Viewport.height + this.shadowOffset * 2
        );

        Hud.draw();

        for (let entity of this.entities) {
            if (entity.z && entity.z > 100) entity.draw();
        }
    }

    pause() {
        if (this.paused) return;
        this.paused = true;
        Audio.pause();
    }

    unpause() {
        if (!this.paused) return;
        this.paused = false;
        Audio.unpause();
    }
}

export const game = new Game();
