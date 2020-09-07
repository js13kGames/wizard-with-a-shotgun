'use strict';

import { SpriteSheet } from './SpriteSheet-gen';
import { rgba, createCanvas } from './Util';
import { Text } from './Text';
import { game } from './Game';
import { Viewport } from './Viewport';
import { SPRITESHEET_URI, R360 } from './Constants';

/**
 * Sprite
 *
 * Encapsulates loading sprite slices from the spritesheet, organizing them, and
 * modifying them or constructing using primitives. To save space, we use some techniques
 * like storing only a small slice of an image in the spritesheet, then using code
 * to duplicate it, add some randomness, etc.
 */
export const Sprite = {
    // This is an exception to the rule, loading the spritesheet is a special action that
    // happens BEFORE everything is initialized.
    loadSpritesheet(cb) {
        let image = new Image(), uri = SPRITESHEET_URI;
        image.onload = cb;
        image.src = uri;
        Sprite.sheet = image;
    },

    init() {
        // Base pixel font and icons (see `Text.init` for additional variations)
        Sprite.font = initBasicSprite(SpriteSheet.font[0]);
        Sprite.icon_mouse_lmb = initBasicSprite(SpriteSheet.icon_mouse[0]);
        Sprite.icon_mouse_rmb = initBasicSprite(SpriteSheet.icon_mouse[1]);
        Sprite.icon_keys_w = initBasicSprite(SpriteSheet.icon_keys[0]);
        Sprite.icon_keys_a = initBasicSprite(SpriteSheet.icon_keys[1]);
        Sprite.icon_keys_s = initBasicSprite(SpriteSheet.icon_keys[2]);
        Sprite.icon_keys_d = initBasicSprite(SpriteSheet.icon_keys[3]);

        // Player
        Sprite.player = SpriteSheet.player.map(data =>
            initBasicSprite(data, { x: 10, y: 21 })
        );
        Sprite.shotgun_blast = SpriteSheet.shotgun_blast.map(data =>
            initBasicSprite(data, { x: /*12*/ 22, y: 41 })
        );

        // Enemies
        Sprite.stabguts = SpriteSheet.stabguts.map(initBasicSprite);
        Sprite.spindoctor = SpriteSheet.sawblade.map(initBasicSprite);

        // Gore/blood
        Sprite.gore = SpriteSheet.gore.map(initBasicSprite);

        // GUI
        Sprite.hud_shells_empty = initBasicSprite(
            SpriteSheet.hud_shells[0]
        );
        Sprite.hud_shells_full = initBasicSprite(
            SpriteSheet.hud_shells[1]
        );
        Sprite.hud_health_frame = initBasicSprite(
            SpriteSheet.hud_healthbar[0]
        );
        Sprite.hud_health_fill = initBasicSprite(
            SpriteSheet.hud_healthbar[1]
        );
        Sprite.hud_health_chunk = initBasicSprite(
            SpriteSheet.hud_healthbar[2]
        );
        Sprite.hud_crosshair = initBasicSprite(
            SpriteSheet.hud_crosshair[0]
        );
        Sprite.hud_crosshair_wait = initBasicSprite(
            SpriteSheet.hud_crosshair[1]
        );

        // Pages
        Sprite.page = SpriteSheet.page.map(initBasicSprite);

        // Tiles
        Sprite.tiles = SpriteSheet.tiles.map(initBasicSprite);
        Sprite.tiles[1] = initDynamicSprite(createSecondTile(Sprite.tiles[0].img));
        Sprite.tilebg = initDynamicSprite(createTileBg(Sprite.tiles[0].img));
        Sprite.shadow = initDynamicSprite(createShadow());

        // Walls/gates (gates are openings that close during brawls)
        let w = SpriteSheet.walls.map(initBasicSprite);
        Sprite.walls = initDynamicSprite(createWalls(w[0].img));
        Sprite.gates = initDynamicSprite(createGates(w[0].img, w[1].img));

        // Dialog
        let dialog = SpriteSheet.dialog.map(initBasicSprite);
        Sprite.dialog_speech = initDynamicSprite(createDialogSpeech(dialog[0].img, dialog[2].img));
        Sprite.dialog_hint = initDynamicSprite(createDialogHint(dialog[1].img));
    },

    /**
     * A small helper that draws a sprite onto a canvas, respecting the anchor point of
     * the sprite. Note that the canvas should be PRE-TRANSLATED and PRE-ROTATED, if
     * that's appropriate!
     */
    drawSprite(ctx, sprite, u, v) {
        ctx.drawImage(sprite.img, u - sprite.anchor.x, v - sprite.anchor.y);
    },

    drawViewportSprite(sprite, pos, rotation) {
        let { u, v } = this.viewportSprite2uv(
            sprite,
            pos
        );
        if (rotation) {
            Viewport.ctx.save();
            Viewport.ctx.translate(u + sprite.anchor.x, v + sprite.anchor.y);
            Viewport.ctx.rotate(rotation);
            Viewport.ctx.drawImage(
                sprite.img,
                -sprite.anchor.x,
                -sprite.anchor.y
            );
            Viewport.ctx.restore();
        } else {
            Viewport.ctx.drawImage(sprite.img, u, v);
        }
    },

    viewportSprite2uv(sprite, pos) {
        return {
            u: pos.x - sprite.anchor.x - game.camera.pos.x + Viewport.center.u,
            v: pos.y - sprite.anchor.y - game.camera.pos.y + Viewport.center.v
        };
    }
};

// Sprite utility functions

function initBasicSprite(data, anchor) {
    return initDynamicSprite(
        loadCacheSlice(
            data.x,
            data.y,
            data.w,
            data.h
        ),
        anchor
    );
}

function initDynamicSprite(source, anchor) {
    let w = source.width,
        h = source.height;

    return {
        img: source,
        // Hack! Using a flat `.map(initBasicSprite)` is actually going to pass the
        // element INDEX as second argument, resulting in "anchor=1". The right solution
        // here is "typeof anchor === 'object' ?", but to save bytes I avoid using
        // the typeof and instanceof keywords anywhere in the codebase. Hence,
        // "anchor && anchor.x".
        anchor: (anchor && anchor.x) ? anchor : { x: (w / 2) | 0, y: (h / 2) | 0 }
    };
}

function loadCacheSlice(x, y, w, h) {
    const source = Sprite.sheet;
    const sliceCanvas = createCanvas(w, h);
    sliceCanvas.ctx.drawImage(source, x, y, w, h, 0, 0, w, h);
    return sliceCanvas.canvas;
}

function createWalls(source) {
    let canvas = createCanvas(36, 36);
    for (let i = 0; i < 36; i += 4) {
        canvas.ctx.drawImage(source, i, 0);
        canvas.ctx.drawImage(source, i, 32);
        canvas.ctx.drawImage(source, 0, i);
        canvas.ctx.drawImage(source, 32, i);
    }
    addNoise(canvas);
    return canvas.canvas;
}

function createGates(wallSource, spikeSource) {
    let canvas = createCanvas(36, 36);
    for (let i = 0; i < 36; i += 4) {
        canvas.ctx.drawImage(spikeSource, i, 0);
        canvas.ctx.drawImage(spikeSource, i, 32);
        canvas.ctx.drawImage(spikeSource, 0, i);
        canvas.ctx.drawImage(spikeSource, 32, i);
    }
    canvas.ctx.drawImage(wallSource, 0, 0);
    canvas.ctx.drawImage(wallSource, 32, 0);
    canvas.ctx.drawImage(wallSource, 0, 32);
    canvas.ctx.drawImage(wallSource, 32, 32);
    addNoise(canvas);
    return canvas.canvas;
}

function addNoise(canvas) {
    canvas.ctx.globalCompositeOperation = 'source-atop';
    for (let y = 0; y < 36; y++) {
        for (let x = 0; x < 36; x++) {
            canvas.ctx.fillStyle = rgba(0, 0, 0, Math.random() * 0.6);
            canvas.ctx.fillRect(x, y, 1, 1);
        }
    }
}

function createTileBg(source) {
    let canvas = createCanvas(544, 334);
    for (let y = 0; y < 334; y += 32) {
        for (let x = 0; x < 544; x += 32) {
            canvas.ctx.drawImage(source, x, y);
        }
    }
    return canvas.canvas;
}

function createShadow() {
    let canvas = createCanvas(500, 500);
    let gradient = canvas.ctx.createRadialGradient(
        250,
        250,
        0,
        250,
        250,
        250
    );
    gradient.addColorStop(0.3, rgba(0, 0, 0, 0));
    gradient.addColorStop(1, rgba(0, 0, 0, 0.9));
    canvas.ctx.fillStyle = gradient;
    canvas.ctx.fillRect(0, 0, 500, 500);
    return canvas.canvas;
}

function createDialogSpeech(source, tail) {
    let canvas = createCanvas(130, 45);
    canvas.ctx.drawImage(expandNineTile(source).canvas, 0, 5);
    canvas.ctx.drawImage(tail, 5, 0);
    return canvas.canvas;
}

function createDialogHint(source) {
    let canvas = expandNineTile(source);
    return canvas.canvas;
}

function expandNineTile(source) {
    let canvas = createCanvas(130, 40);
    for (let y = 0; y < 40; y += 5) {
        for (let x = 0; x < 130; x += 5) {
            let sx = x === 0 ? 0 : (x === 125 ? 10 : 5);
            let sy = y === 0 ? 0 : (y === 35 ? 10 : 5);
            canvas.ctx.drawImage(source, sx, sy, 5, 5, x, y, 5, 5);
        }
    }
    return canvas;
}

function createSecondTile(source) {
    let canvas = createCanvas(32, 32);
    canvas.ctx.fillStyle = rgba(48, 0, 0, 1);
    canvas.ctx.fillRect(0, 0, 32, 32);
    canvas.ctx.globalAlpha = 0.6;
    canvas.ctx.globalCompositeOperation = 'hard-light';
    canvas.ctx.drawImage(source, 0, 0);
    addNoise(canvas);
    return canvas.canvas;
}
